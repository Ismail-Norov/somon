import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role, SubmissionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { audit, getStudentUserId, notifyUser } from '../services/notifications';
import { ensureAchievements, logActivity } from '../services/activity';

const router = Router();
router.use(requireAuth);

const gradeInclude = {
  teacher: { include: { user: { select: publicUserSelect } } },
  lesson: { select: { id: true, title: true, startsAt: true, group: { select: { id: true, code: true } } } },
  submission: {
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          deadline: true,
          course: { select: { id: true, title: true } },
          group: { select: { id: true, code: true } },
        },
      },
    },
  },
} satisfies Prisma.GradeInclude;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.STUDENT) {
      const grades = await prisma.grade.findMany({
        where: { studentId: req.user!.studentId },
        include: gradeInclude,
        orderBy: { updatedAt: 'desc' },
      });
      return res.json(ok(grades));
    }

    const groupId = (req.query.groupId as string | undefined) || undefined;
    const studentId = (req.query.studentId as string | undefined) || undefined;
    if (req.user!.role === Role.TEACHER && groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
    }

    const groupFilter: Prisma.GroupWhereInput | undefined =
      req.user!.role === Role.TEACHER ? { teacherId: req.user!.teacherId } : undefined;
    const scope: Prisma.GradeWhereInput[] = [];
    if (groupId || groupFilter) {
      const g: Prisma.GroupWhereInput = { ...(groupFilter ?? {}), ...(groupId ? { id: groupId } : {}) };
      scope.push({ submission: { assignment: { group: g } } }, { lesson: { group: g } });
      if (req.user!.role === Role.TEACHER && !groupId) scope.push({ teacherId: req.user!.teacherId });
    }

    const grades = await prisma.grade.findMany({
      where: { studentId, ...(scope.length ? { OR: scope } : {}) },
      include: {
        ...gradeInclude,
        student: { include: { user: { select: publicUserSelect } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    res.json(ok(grades));
  })
);

const gradeSchema = z.object({
  submissionId: z.string().optional(),
  studentId: z.string(),
  assignmentId: z.string().optional(),
  lessonId: z.string().optional(),
  score: z.number().min(0),
  maxScore: z.number().positive().max(1000).optional(),
  comment: z.string().max(5000).optional().nullable(),
});

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = gradeSchema.parse(req.body);

    let groupId: string | undefined;
    let maxScore = body.maxScore ?? 5;
    let assignmentId = body.assignmentId;
    let assignmentTitle: string | undefined;
    const submissionId = body.submissionId;

    if (submissionId) {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { assignment: true },
      });
      if (!submission) throw new AppError('Ответ не найден', 404, 'NOT_FOUND');
      if (submission.studentId !== body.studentId) {
        throw new AppError('Студент не соответствует ответу', 400, 'MISMATCH');
      }
      if (submission.status === 'DRAFT' || !submission.submittedAt) {
        throw new AppError('Студент ещё не отправил работу', 400, 'NOT_SUBMITTED');
      }
      groupId = submission.assignment.groupId || undefined;
      maxScore = submission.assignment.maxScore;
      assignmentId = submission.assignmentId;
      assignmentTitle = submission.assignment.title;
    } else if (assignmentId) {
      const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
      groupId = assignment.groupId || undefined;
      maxScore = assignment.maxScore;
      assignmentTitle = assignment.title;
    } else if (body.lessonId) {
      const lesson = await prisma.lesson.findUnique({ where: { id: body.lessonId } });
      if (!lesson) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');
      groupId = lesson.groupId;
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

    if (body.score > maxScore) {
      throw new AppError(`Балл превышает максимум (${maxScore})`, 400, 'SCORE_TOO_HIGH');
    }

    const grade = submissionId
      ? await prisma.$transaction(async (tx) => {
          const g = await tx.grade.upsert({
            where: { submissionId },
            create: {
              submissionId,
              studentId: body.studentId,
              teacherId: req.user!.teacherId,
              assignmentId,
              score: body.score,
              maxScore,
              comment: body.comment,
            },
            update: { score: body.score, maxScore, comment: body.comment, teacherId: req.user!.teacherId },
          });
          await tx.submission.update({ where: { id: submissionId }, data: { status: SubmissionStatus.GRADED } });
          return g;
        })
      : await prisma.grade.create({
          data: {
            studentId: body.studentId,
            teacherId: req.user!.teacherId,
            assignmentId,
            lessonId: body.lessonId,
            score: body.score,
            maxScore,
            comment: body.comment,
          },
        });

    const what = assignmentTitle ? `«${assignmentTitle}»` : 'за занятие';
    const userId = await getStudentUserId(body.studentId);
    if (userId) {
      await notifyUser(
        userId,
        'GRADE',
        submissionId ? 'Работа проверена' : 'Новая оценка',
        `${what}: ${body.score}/${maxScore}${body.comment ? ` · ${body.comment.slice(0, 80)}` : ''}`,
        assignmentId ? `/student/assignments/${assignmentId}` : '/student/grades'
      );
    }
    await logActivity(body.studentId, 'GRADE', `Получена оценка ${body.score}/${maxScore} ${what}`, {
      gradeId: grade.id,
      assignmentId,
    });
    await ensureAchievements(body.studentId);

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
        comment: z.string().max(5000).optional().nullable(),
      })
      .parse(req.body);

    const existing = await prisma.grade.findUnique({
      where: { id: req.params.id },
      include: { submission: { include: { assignment: true } }, lesson: true },
    });
    if (!existing) throw new AppError('Оценка не найдена', 404, 'NOT_FOUND');

    const groupId = existing.submission?.assignment.groupId ?? existing.lesson?.groupId;
    if (req.user!.role === Role.TEACHER) {
      if (groupId) await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
      else if (existing.teacherId !== req.user!.teacherId) throw new AppError('Нет доступа к оценке', 403, 'FORBIDDEN');
    }
    if (body.score !== undefined && body.score > existing.maxScore) {
      throw new AppError(`Балл превышает максимум (${existing.maxScore})`, 400, 'SCORE_TOO_HIGH');
    }

    const grade = await prisma.grade.update({
      where: { id: existing.id },
      data: body,
    });
    const userId = await getStudentUserId(existing.studentId);
    if (userId && body.score !== undefined && body.score !== existing.score) {
      await notifyUser(
        userId,
        'GRADE',
        'Оценка изменена',
        `${existing.submission ? `«${existing.submission.assignment.title}»` : 'Оценка'}: ${grade.score}/${grade.maxScore}`,
        existing.submission ? `/student/assignments/${existing.submission.assignmentId}` : '/student/grades'
      );
    }
    await audit(req.user!.id, 'UPDATE', 'Grade', grade.id);
    res.json(ok(grade));
  })
);

export default router;
