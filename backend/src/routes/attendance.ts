import { Router } from 'express';
import { z } from 'zod';
import { AttendanceStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { audit } from '../services/notifications';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const lessonId = req.query.lessonId as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const groupId = req.query.groupId as string | undefined;

    if (req.user!.role === Role.STUDENT) {
      const rows = await prisma.attendance.findMany({
        where: { studentId: req.user!.studentId },
        include: { lesson: { include: { group: { include: { course: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(ok(rows));
    }

    if (req.user!.role === Role.TEACHER && groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
    }

    const lessonFilter =
      req.user!.role === Role.TEACHER
        ? { groupId: groupId || undefined, group: { teacherId: req.user!.teacherId } }
        : groupId
          ? { groupId }
          : undefined;

    const rows = await prisma.attendance.findMany({
      where: {
        lessonId,
        studentId,
        lesson: lessonFilter,
      },
      include: {
        student: { include: { user: { select: publicUserSelect } } },
        lesson: true,
      },
    });
    res.json(ok(rows));
  })
);

const bulkSchema = z.object({
  lessonId: z.string(),
  items: z.array(
    z.object({
      studentId: z.string(),
      status: z.nativeEnum(AttendanceStatus),
      note: z.string().optional().nullable(),
    })
  ),
});

router.post(
  '/bulk',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = bulkSchema.parse(req.body);
    const lesson = await prisma.lesson.findUnique({
      where: { id: body.lessonId },
      include: { group: { include: { groupStudents: { where: { status: 'ACTIVE' } } } } },
    });
    if (!lesson) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, lesson.groupId);
    }

    const memberIds = new Set(lesson.group.groupStudents.map((gs) => gs.studentId));
    for (const item of body.items) {
      if (!memberIds.has(item.studentId)) {
        throw new AppError('Студент не относится к занятию/группе', 400, 'NOT_IN_GROUP');
      }
    }

    const results = [];
    for (const item of body.items) {
      const row = await prisma.attendance.upsert({
        where: { lessonId_studentId: { lessonId: body.lessonId, studentId: item.studentId } },
        create: {
          lessonId: body.lessonId,
          studentId: item.studentId,
          status: item.status,
          note: item.note,
        },
        update: { status: item.status, note: item.note },
      });
      results.push(row);
    }

    await audit(req.user!.id, 'BULK_ATTENDANCE', 'Lesson', body.lessonId);
    res.json(ok(results));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.nativeEnum(AttendanceStatus).optional(),
        note: z.string().optional().nullable(),
      })
      .parse(req.body);

    const existing = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { lesson: true },
    });
    if (!existing) throw new AppError('Запись не найдена', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.lesson.groupId);
    }

    const row = await prisma.attendance.update({
      where: { id: existing.id },
      data: body,
    });
    res.json(ok(row));
  })
);

export default router;
