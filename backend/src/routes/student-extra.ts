import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertCanReadMaterial, assertStudentInGroup, assertTeacherOwnsGroup } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUser, notifyUsers } from '../services/notifications';
import { ensureAchievements, logActivity } from '../services/activity';

const router = Router();
router.use(requireAuth);

router.get(
  '/activity',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const items = await prisma.studentActivity.findMany({
      where: { studentId: req.user!.studentId! },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(ok(items));
  })
);

router.post(
  '/activity',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ type: z.enum(['VIDEO_OPEN', 'LINK_OPEN']), materialId: z.string() })
      .parse(req.body);
    await assertCanReadMaterial(req.user!, body.materialId);
    const material = await prisma.material.findUniqueOrThrow({ where: { id: body.materialId }, select: { title: true } });
    const title = body.type === 'VIDEO_OPEN' ? `Просмотр видео «${material.title}»` : `Открыта ссылка «${material.title}»`;
    await logActivity(req.user!.studentId, body.type, title, { materialId: body.materialId });
    res.status(201).json(ok({ success: true }));
  })
);

router.get(
  '/achievements',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    await ensureAchievements(req.user!.studentId!);
    const earned = await prisma.studentAchievement.findMany({
      where: { studentId: req.user!.studentId! },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });
    const all = await prisma.achievement.findMany({ orderBy: { title: 'asc' } });
    res.json(
      ok({
        earned,
        catalog: all.map((a) => ({
          ...a,
          unlocked: earned.some((e) => e.achievementId === a.id),
        })),
      })
    );
  })
);

router.get(
  '/library',
  requireRole(Role.STUDENT, Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const category = req.query.category as string | undefined;
    let access: Prisma.PublicMaterialWhereInput = {};
    if (req.user!.role === Role.STUDENT) {
      access = {
        OR: [
          { isPublic: true },
          {
            course: {
              groups: {
                some: { groupStudents: { some: { studentId: req.user!.studentId, status: 'ACTIVE' } } },
              },
            },
          },
        ],
      };
    } else if (req.user!.role === Role.TEACHER) {
      access = { OR: [{ isPublic: true }, { course: { groups: { some: { teacherId: req.user!.teacherId } } } }] };
    }
    const items = await prisma.publicMaterial.findMany({
      where: { AND: [access, category ? { category } : {}] },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const groupId = req.query.groupId as string | undefined;
    const include = {
      author: { select: publicUserSelect },
      group: { include: { course: true } },
    } as const;

    if (req.user!.role === Role.STUDENT) {
      if (groupId) await assertStudentInGroup(req.user!.studentId, groupId);
      const links = await prisma.groupStudent.findMany({
        where: { studentId: req.user!.studentId!, status: 'ACTIVE' },
      });
      const items = await prisma.announcement.findMany({
        where: { groupId: groupId ? groupId : { in: links.map((l) => l.groupId) } },
        include,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return res.json(ok(items));
    }

    if (req.user!.role === Role.TEACHER) {
      if (groupId) await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
      const groups = await prisma.group.findMany({ where: { teacherId: req.user!.teacherId } });
      const items = await prisma.announcement.findMany({
        where: { groupId: groupId ? groupId : { in: groups.map((g) => g.id) } },
        include,
        orderBy: { createdAt: 'desc' },
      });
      return res.json(ok(items));
    }

    const items = await prisma.announcement.findMany({
      where: groupId ? { groupId } : undefined,
      include,
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.post(
  '/announcements',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        groupId: z.string(),
        title: z.string().trim().min(1, 'Укажите заголовок').max(200),
        body: z.string().trim().min(1, 'Напишите текст объявления').max(5000),
      })
      .parse(req.body);

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    } else if (!(await prisma.group.findUnique({ where: { id: body.groupId } }))) {
      throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    }

    const item = await prisma.announcement.create({
      data: {
        groupId: body.groupId,
        authorId: req.user!.id,
        title: body.title,
        body: body.body,
      },
    });

    const userIds = await getGroupStudentUserIds(body.groupId);
    const group = await prisma.group.findUniqueOrThrow({ where: { id: body.groupId }, select: { courseId: true, code: true } });
    await notifyUsers(
      userIds,
      'ANNOUNCEMENT',
      `Объявление: ${body.title}`,
      `${group.code} · ${body.body.slice(0, 140)}`,
      `/student/courses/${group.courseId}`
    );
    await audit(req.user!.id, 'CREATE', 'Announcement', item.id);
    res.status(201).json(ok(item));
  })
);

router.delete(
  '/announcements/:id',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Объявление не найдено', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
    }
    await prisma.announcement.delete({ where: { id: existing.id } });
    await audit(req.user!.id, 'DELETE', 'Announcement', existing.id);
    res.json(ok({ success: true }));
  })
);

router.post(
  '/applications',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        courseId: z.string(),
        groupId: z.string().optional().nullable(),
        message: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (!course || course.status !== 'PUBLISHED') {
      throw new AppError('Курс недоступен', 400, 'COURSE_UNAVAILABLE');
    }
    if (body.groupId) {
      const group = await prisma.group.findUnique({ where: { id: body.groupId } });
      if (!group || group.courseId !== body.courseId) {
        throw new AppError('Группа не относится к курсу', 400, 'GROUP_MISMATCH');
      }
    }
    const already = await prisma.groupStudent.findFirst({
      where: { studentId: req.user!.studentId!, status: 'ACTIVE', group: { courseId: body.courseId } },
    });
    if (already) throw new AppError('Вы уже учитесь на этом курсе', 409, 'ALREADY_ENROLLED');
    const pending = await prisma.courseApplication.findFirst({
      where: { studentId: req.user!.studentId!, courseId: body.courseId, status: 'PENDING' },
    });
    if (pending) throw new AppError('Заявка на этот курс уже подана', 409, 'APPLICATION_EXISTS');

    const app = await prisma.courseApplication.create({
      data: {
        studentId: req.user!.studentId!,
        courseId: body.courseId,
        groupId: body.groupId,
        message: body.message,
      },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    await notifyUsers(
      admins.map((a) => a.id),
      'APPLICATION',
      'Заявка на обучение',
      `${req.user!.firstName} ${req.user!.lastName} подал заявку на «${course.title}»`,
      '/admin/applications'
    );
    await logActivity(req.user!.studentId, 'APPLICATION', `Заявка на курс «${course.title}»`);
    res.status(201).json(ok(app));
  })
);

router.get(
  '/applications',
  requireRole(Role.ADMIN, Role.STUDENT),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.STUDENT) {
      const items = await prisma.courseApplication.findMany({
        where: { studentId: req.user!.studentId! },
        include: { course: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(ok(items));
    }
    const statusParam = req.query.status as string | undefined;
    const status = statusParam && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusParam)
      ? (statusParam as 'PENDING' | 'APPROVED' | 'REJECTED')
      : undefined;
    const items = await prisma.courseApplication.findMany({
      where: { status },
      include: {
        course: { select: { id: true, title: true, status: true } },
        student: { include: { user: { select: publicUserSelect } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const groupIds = [...new Set(items.map((i) => i.groupId).filter((id): id is string => !!id))];
    const groups = groupIds.length
      ? await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, code: true } })
      : [];
    const groupById = new Map(groups.map((g) => [g.id, g]));
    res.json(ok(items.map((i) => ({ ...i, group: i.groupId ? groupById.get(i.groupId) ?? null : null }))));
  })
);

router.patch(
  '/applications/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
        groupId: z.string().optional().nullable(),
        comment: z.string().trim().max(500).optional(),
      })
      .parse(req.body);
    const existing = await prisma.courseApplication.findUnique({
      where: { id: req.params.id },
      include: { course: true, student: true },
    });
    if (!existing) throw new AppError('Заявка не найдена', 404, 'NOT_FOUND');

    const groupId = body.groupId || existing.groupId;
    let groupCode: string | null = null;
    if (body.status === 'APPROVED') {
      if (!groupId) {
        throw new AppError('Выберите группу, в которую зачислить студента', 400, 'GROUP_REQUIRED');
      }
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } },
      });
      if (!group || group.courseId !== existing.courseId) {
        throw new AppError('Группа не относится к курсу заявки', 400, 'GROUP_MISMATCH');
      }
      if (group.status === 'COMPLETED' || group.status === 'ARCHIVED') {
        throw new AppError('Группа завершена или в архиве', 400, 'GROUP_CLOSED');
      }
      const alreadyIn = await prisma.groupStudent.findUnique({
        where: { groupId_studentId: { groupId: group.id, studentId: existing.studentId } },
      });
      if (alreadyIn?.status !== 'ACTIVE' && group._count.groupStudents >= group.capacity) {
        throw new AppError('В группе нет свободных мест. Увеличьте вместимость или выберите другую группу.', 409, 'CAPACITY');
      }
      groupCode = group.code;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.courseApplication.update({
        where: { id: existing.id },
        data: { status: body.status, groupId: groupId ?? null },
      });
      if (body.status === 'APPROVED' && groupId) {
        await tx.groupStudent.upsert({
          where: { groupId_studentId: { groupId, studentId: existing.studentId } },
          create: { groupId, studentId: existing.studentId },
          update: { status: 'ACTIVE' },
        });
        await tx.enrollment.upsert({
          where: { studentId_courseId: { studentId: existing.studentId, courseId: existing.courseId } },
          create: { studentId: existing.studentId, courseId: existing.courseId },
          update: { status: 'ACTIVE' },
        });
      }
      return app;
    });

    if (body.status !== 'PENDING') {
      const approved = body.status === 'APPROVED';
      const details = [
        `Курс «${existing.course.title}»`,
        approved && groupCode ? `группа ${groupCode}` : null,
        body.comment || null,
      ]
        .filter(Boolean)
        .join('. ');
      await notifyUser(
        existing.student.userId,
        'APPLICATION',
        approved ? 'Заявка одобрена' : 'Заявка отклонена',
        details,
        approved ? '/student/courses' : '/student/catalog'
      );
      if (approved) {
        await logActivity(existing.studentId, 'ENROLLMENT', `Зачислен на курс «${existing.course.title}»`);
      }
    }
    await audit(req.user!.id, 'UPDATE', 'CourseApplication', existing.id, body);
    res.json(ok(updated));
  })
);

export default router;
