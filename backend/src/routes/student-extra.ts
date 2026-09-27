import { Router } from 'express';
import { z } from 'zod';
import { CourseLevel, MaterialType, Role } from '@prisma/client';
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
    const items = await prisma.publicMaterial.findMany({
      where: category ? { category } : undefined,
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.post(
  '/library',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().min(1),
        type: z.nativeEnum(MaterialType).optional(),
        level: z.nativeEnum(CourseLevel).optional(),
        fileUrl: z.string().optional().nullable(),
        fileName: z.string().optional().nullable(),
        linkUrl: z.string().optional().nullable(),
      })
      .parse(req.body);
    const item = await prisma.publicMaterial.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        type: body.type ?? MaterialType.NOTE,
        level: body.level ?? CourseLevel.BEGINNER,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        linkUrl: body.linkUrl,
        authorId: req.user!.id,
      },
    });
    res.status(201).json(ok(item));
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
      .object({ groupId: z.string(), title: z.string().min(1), body: z.string().min(1) })
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
    await notifyUsers(userIds, 'ANNOUNCEMENT', body.title, body.body);
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
      '/admin/groups'
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
    const items = await prisma.courseApplication.findMany({
      include: {
        course: true,
        student: { include: { user: { select: publicUserSelect } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.patch(
  '/applications/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PENDING']) }).parse(req.body);
    const existing = await prisma.courseApplication.findUnique({
      where: { id: req.params.id },
      include: { course: true, student: true },
    });
    if (!existing) throw new AppError('Заявка не найдена', 404, 'NOT_FOUND');

    const updated = await prisma.courseApplication.update({
      where: { id: existing.id },
      data: { status: body.status },
    });

    if (body.status === 'APPROVED' && existing.groupId) {
      await prisma.groupStudent.upsert({
        where: {
          groupId_studentId: { groupId: existing.groupId, studentId: existing.studentId },
        },
        create: { groupId: existing.groupId, studentId: existing.studentId },
        update: { status: 'ACTIVE' },
      });
      await prisma.enrollment.upsert({
        where: {
          studentId_courseId: { studentId: existing.studentId, courseId: existing.courseId },
        },
        create: { studentId: existing.studentId, courseId: existing.courseId },
        update: { status: 'ACTIVE' },
      });
    }

    if (body.status !== 'PENDING') {
      await notifyUser(
        existing.student.userId,
        'APPLICATION',
        body.status === 'APPROVED' ? 'Заявка одобрена' : 'Заявка отклонена',
        `Курс «${existing.course.title}»`,
        body.status === 'APPROVED' && existing.groupId ? '/student/courses' : '/student/catalog'
      );
    }
    await audit(req.user!.id, 'UPDATE', 'CourseApplication', existing.id, body);
    res.json(ok(updated));
  })
);

export default router;
