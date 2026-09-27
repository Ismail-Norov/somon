import { Router } from 'express';
import { z } from 'zod';
import { Role, SubmissionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { audit, notifyUser } from '../services/notifications';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.STUDENT) {
      const grades = await prisma.grade.findMany({
        where: { studentId: req.user!.studentId },
        include: {
          teacher: { include: { user: { select: publicUserSelect } } },
          submission: { include: { assignment: { include: { course: true, group: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(ok(grades));
    }

    const groupId = req.query.groupId as string | undefined;
    if (req.user!.role === Role.TEACHER && groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
    }

    const grades = await prisma.grade.findMany({
      where:
        req.user!.role === Role.TEACHER
          ? {
              teacherId: req.user!.teacherId,
              submission: groupId ? { assignment: { groupId } } : undefined,
            }
          : groupId
            ? { submission: { assignment: { groupId } } }
            : undefined,
      include: {
        student: { include: { user: { select: publicUserSelect } } },
        teacher: { include: { user: { select: publicUserSelect } } },
        submission: { include: { assignment: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(grades));
  })
);

const gradeSchema = z.object({
  submissionId: z.string().optional(),
  studentId: z.string(),
  assignmentId: z.string().optional(),
  score: z.number().min(0),
  maxScore: z.number().positive().optional(),
  comment: z.string().optional().nullable(),
});

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = gradeSchema.parse(req.body);

    let groupId: string | undefined;
    let submissionId = body.submissionId;

    if (submissionId) {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { assignment: true },
      });
      if (!submission) throw new AppError('Ответ не найден', 404, 'NOT_FOUND');
      if (submission.studentId !== body.studentId) {
        throw new AppError('Студент не соответствует ответу', 400, 'MISMATCH');
      }
      groupId = submission.assignment.groupId || undefined;
      if (body.maxScore === undefined) body.maxScore = submission.assignment.maxScore;
    } else if (body.assignmentId) {
      const assignment = await prisma.assignment.findUnique({ where: { id: body.assignmentId } });
      if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
      groupId = assignment.groupId || undefined;
      if (body.maxScore === undefined) body.maxScore = assignment.maxScore;
    }

    if (!groupId) throw new AppError('Не удалось определить группу', 400, 'NO_GROUP');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
    }

    const member = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId: body.studentId } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new AppError('Студент не относится к группе/курсу', 400, 'NOT_IN_GROUP');
    }

    const maxScore = body.maxScore ?? 5;
    if (body.score > maxScore) {
      throw new AppError('Балл превышает максимум', 400, 'SCORE_TOO_HIGH');
    }

    let grade;
    if (submissionId) {
      grade = await prisma.grade.upsert({
        where: { submissionId },
        create: {
          submissionId,
          studentId: body.studentId,
          teacherId: req.user!.teacherId,
          assignmentId: body.assignmentId,
          score: body.score,
          maxScore,
          comment: body.comment,
        },
        update: {
          score: body.score,
          maxScore,
          comment: body.comment,
          teacherId: req.user!.teacherId,
        },
      });
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.GRADED },
      });
    } else {
      grade = await prisma.grade.create({
        data: {
          studentId: body.studentId,
          teacherId: req.user!.teacherId,
          assignmentId: body.assignmentId,
          score: body.score,
          maxScore,
          comment: body.comment,
        },
      });
    }

    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (student) {
      await notifyUser(
        student.userId,
        'GRADE',
        'Работа проверена',
        `Получена оценка: ${body.score}/${maxScore}`
      );
    }

    await audit(req.user!.id, 'CREATE', 'Grade', grade.id);
    res.status(201).json(ok(grade));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        score: z.number().min(0).optional(),
        maxScore: z.number().positive().optional(),
        comment: z.string().optional().nullable(),
      })
      .parse(req.body);

    const existing = await prisma.grade.findUnique({
      where: { id: req.params.id },
      include: { submission: { include: { assignment: true } } },
    });
    if (!existing) throw new AppError('Оценка не найдена', 404, 'NOT_FOUND');

    const groupId = existing.submission?.assignment.groupId;
    if (req.user!.role === Role.TEACHER && groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
    }

    const grade = await prisma.grade.update({
      where: { id: existing.id },
      data: body,
    });
    await audit(req.user!.id, 'UPDATE', 'Grade', grade.id);
    res.json(ok(grade));
  })
);

export default router;
