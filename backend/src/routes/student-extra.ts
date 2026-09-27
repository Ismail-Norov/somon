import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUsers } from '../services/notifications';
import { ensureAchievements, logActivity } from '../services/activity';

const router = Router();
router.use(requireAuth);

router.get(
  '/activity',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    let items = [];
    try {
      items = await prisma.studentActivity.findMany({
        where: { studentId: req.user!.studentId! },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    } catch (e) {
      // Model might not be available
    }
    res.json(ok(items));
  })
);

router.post(
  '/activity',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ type: z.string(), title: z.string(), meta: z.unknown().optional() })
      .parse(req.body);
    await logActivity(req.user!.studentId, body.type, body.title, body.meta);
    res.status(201).json(ok({ success: true }));
  })
);

router.get(
  '/achievements',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    await ensureAchievements(req.user!.studentId!);
    let earned = [];
    let all = [];
    try {
      earned = await prisma.studentAchievement.findMany({
        where: { studentId: req.user!.studentId! },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      });
      all = await prisma.achievement.findMany({ orderBy: { title: 'asc' } });
    } catch (e) {
      // Models might not be available
    }
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
    let items = [];
    try {
      items = await prisma.publicMaterial.findMany({
        where: category ? { category } : undefined,
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { publishedAt: 'desc' },
      });
    } catch (e) {
      // Model might not be available
    }
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
        type: z.string().optional(),
        level: z.string().optional(),
        fileUrl: z.string().optional().nullable(),
        fileName: z.string().optional().nullable(),
        linkUrl: z.string().optional().nullable(),
      })
      .parse(req.body);
    try {
      const item = await prisma.publicMaterial.create({
        data: {
          title: body.title,
          description: body.description,
          category: body.category,
          type: (body.type as never) || 'NOTE',
          level: (body.level as never) || 'BEGINNER',
          fileUrl: body.fileUrl,
          fileName: body.fileName,
          linkUrl: body.linkUrl,
          authorId: req.user!.id,
        },
      });
      res.status(201).json(ok(item));
    } catch (e) {
      throw new AppError('Ошибка создания материала', 500, 'MATERIAL_ERROR');
    }
  })
);

router.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const groupId = req.query.groupId as string | undefined;
    let items = [];

    try {
      if (req.user!.role === Role.STUDENT) {
        const links = await prisma.groupStudent.findMany({
          where: { studentId: req.user!.studentId!, status: 'ACTIVE' },
        });
        const ids = links.map((l) => l.groupId);
        items = await prisma.announcement.findMany({
          where: { groupId: groupId ? groupId : { in: ids } },
          include: { author: true, group: { include: { course: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return res.json(ok(items));
      }

      if (req.user!.role === Role.TEACHER) {
        const groups = await prisma.group.findMany({ where: { teacherId: req.user!.teacherId } });
        const ids = groups.map((g) => g.id);
        items = await prisma.announcement.findMany({
          where: { groupId: groupId ? groupId : { in: ids } },
          include: { author: true, group: { include: { course: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.json(ok(items));
      }

      items = await prisma.announcement.findMany({
        where: groupId ? { groupId } : undefined,
        include: { author: true, group: { include: { course: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      // Model might not be available
    }
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
    }

    try {
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
    } catch (e) {
      throw new AppError('Ошибка создания объявления', 500, 'ANNOUNCEMENT_ERROR');
    }
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
        message: z.string().optional(),
      })
      .parse(req.body);

    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (!course || course.status !== 'PUBLISHED') {
      throw new AppError('Курс недоступен', 400, 'COURSE_UNAVAILABLE');
    }

    try {
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
        `${req.user!.firstName} ${req.user!.lastName} подал заявку на «${course.title}»`
      );
      await logActivity(req.user!.studentId, 'APPLICATION', `Заявка на курс «${course.title}»`);
      res.status(201).json(ok(app));
    } catch (e) {
      throw new AppError('Ошибка создания заявки', 500, 'APPLICATION_ERROR');
    }
  })
);

router.get(
  '/applications',
  requireRole(Role.ADMIN, Role.STUDENT),
  asyncHandler(async (req, res) => {
    let items = [];
    try {
      if (req.user!.role === Role.STUDENT) {
        items = await prisma.courseApplication.findMany({
          where: { studentId: req.user!.studentId! },
          include: { course: true },
          orderBy: { createdAt: 'desc' },
        });
        return res.json(ok(items));
      }
      items = await prisma.courseApplication.findMany({
        include: {
          course: true,
          student: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      // Model might not be available
    }
    res.json(ok(items));
  })
);

router.patch(
  '/applications/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PENDING']) }).parse(req.body);
    try {
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

      await prisma.notification.create({
        data: {
          userId: existing.student.userId,
          type: 'APPLICATION',
          title: body.status === 'APPROVED' ? 'Заявка одобрена' : 'Заявка отклонена',
          body: `Курс «${existing.course.title}»`,
        },
      });

      res.json(ok(updated));
    } catch (e) {
      throw new AppError('Ошибка обновления заявки', 500, 'APPLICATION_UPDATE_ERROR');
    }
  })
);

export default router;
