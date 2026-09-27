import { Router } from 'express';
import { z } from 'zod';
import { LearningFormat, LessonStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { lessonCardInclude, publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertStudentInGroup, assertTeacherOwnsGroup, checkScheduleConflict } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUsers } from '../services/notifications';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const groupId = req.query.groupId as string | undefined;
    const courseId = req.query.courseId as string | undefined;

    let groupFilter: { id?: string; teacherId?: string; courseId?: string; groupStudents?: object } = {};

    if (req.user!.role === Role.TEACHER) {
      groupFilter.teacherId = req.user!.teacherId;
    } else if (req.user!.role === Role.STUDENT) {
      groupFilter.groupStudents = { some: { studentId: req.user!.studentId, status: 'ACTIVE' } };
    }
    if (groupId) groupFilter.id = groupId;
    if (courseId) groupFilter.courseId = courseId;

    const lessons = await prisma.lesson.findMany({
      where: {
        group: groupFilter,
        startsAt: from || to ? { gte: from, lte: to } : undefined,
      },
      include: {
        ...lessonCardInclude,
        _count: { select: { attendance: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
    res.json(ok(lessons));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        group: {
          include: {
            course: true,
            teacher: { include: { user: { select: publicUserSelect } } },
            groupStudents: {
              where: { status: 'ACTIVE' },
              include: { student: { include: { user: { select: publicUserSelect } } } },
            },
          },
        },
        attendance: true,
        materials: true,
      },
    });
    if (!lesson) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, lesson.groupId);
    }
    if (req.user!.role === Role.STUDENT) {
      await assertStudentInGroup(req.user!.studentId, lesson.groupId);
      return res.json(
        ok({
          ...lesson,
          group: { ...lesson.group, groupStudents: [] },
          attendance: lesson.attendance.filter((a) => a.studentId === req.user!.studentId),
        })
      );
    }
    res.json(ok(lesson));
  })
);

const lessonSchema = z.object({
  groupId: z.string(),
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  format: z.nativeEnum(LearningFormat).optional(),
  room: z.string().optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  status: z.nativeEnum(LessonStatus).optional(),
});

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = lessonSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { id: body.groupId } });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    }

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    await checkScheduleConflict({
      groupId: body.groupId,
      teacherId: group.teacherId,
      startsAt,
      endsAt,
    });

    const lesson = await prisma.lesson.create({
      data: {
        groupId: body.groupId,
        title: body.title,
        startsAt,
        endsAt,
        format: body.format,
        room: body.room,
        meetingUrl: body.meetingUrl,
        comment: body.comment,
        status: body.status,
      },
    });

    const userIds = await getGroupStudentUserIds(body.groupId);
    await notifyUsers(userIds, 'LESSON', 'Новое занятие', `${lesson.title} — ${startsAt.toLocaleString('ru-RU')}`);
    await audit(req.user!.id, 'CREATE', 'Lesson', lesson.id);
    res.status(201).json(ok(lesson));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = lessonSchema.partial().parse(req.body);
    const existing = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: { group: true },
    });
    if (!existing) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
      if (body.groupId && body.groupId !== existing.groupId) {
        await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
      }
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : existing.endsAt;
    const groupId = body.groupId || existing.groupId;
    const group = await prisma.group.findUnique({ where: { id: groupId } });

    await checkScheduleConflict({
      groupId,
      teacherId: group?.teacherId,
      startsAt,
      endsAt,
      excludeLessonId: existing.id,
    });

    const lesson = await prisma.lesson.update({
      where: { id: existing.id },
      data: {
        groupId,
        title: body.title,
        startsAt,
        endsAt,
        format: body.format,
        room: body.room,
        meetingUrl: body.meetingUrl,
        comment: body.comment,
        status: body.status,
      },
    });

    const scheduleChanged =
      startsAt.getTime() !== existing.startsAt.getTime() ||
      endsAt.getTime() !== existing.endsAt.getTime() ||
      body.room !== undefined;

    if (scheduleChanged) {
      const userIds = await getGroupStudentUserIds(groupId);
      if (group?.teacherId) {
        const teacher = await prisma.teacher.findUnique({ where: { id: group.teacherId } });
        if (teacher) userIds.push(teacher.userId);
      }
      await notifyUsers(
        [...new Set(userIds)],
        'SCHEDULE',
        'Изменение расписания',
        `Занятие «${lesson.title}» перенесено на ${startsAt.toLocaleString('ru-RU')}`
      );
    }

    await audit(req.user!.id, 'UPDATE', 'Lesson', lesson.id, body);
    res.json(ok(lesson));
  })
);

export default router;
