import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Prisma, Role, SubmissionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertStudentInGroup, assertTeacherOwnsGroup, markOverdueAssignments } from '../services/access';
import { audit, getGroupStudentUserIds, getGroupTeacherUserId, notifyUser, notifyUsers } from '../services/notifications';
import { ensureAchievements, logActivity } from '../services/activity';
import { createUploader, EXTENSION_SETS, handleUpload, MAX_FILE_MB, removeFiles } from '../lib/uploads';

const router = Router();
router.use(requireAuth);

const submissionUploader = createUploader({
  dir: 'private/submissions',
  extensions: EXTENSION_SETS.submission,
  maxFiles: 5,
});

const attemptInclude = {
  files: { select: { id: true, originalName: true, size: true, mimeType: true, createdAt: true } },
} satisfies Prisma.SubmissionAttemptInclude;

const submissionDetailInclude = {
  student: { include: { user: { select: publicUserSelect } } },
  grade: { include: { teacher: { include: { user: { select: publicUserSelect } } } } },
  attempts: { include: attemptInclude, orderBy: { number: 'desc' as const } },
} satisfies Prisma.SubmissionInclude;

/** Hides draft assignments and assignments with a future publish date from students. */
function visibleToStudents(): Prisma.AssignmentWhereInput {
  return {
    status: { not: 'DRAFT' },
    OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    await markOverdueAssignments();
    const groupId = (req.query.groupId as string | undefined) || undefined;
    const statusParam = req.query.status as string | undefined;
    const status =
      statusParam && statusParam in AssignmentStatus ? (statusParam as AssignmentStatus) : undefined;

    if (req.user!.role === Role.STUDENT) {
      const links = await prisma.groupStudent.findMany({
        where: { studentId: req.user!.studentId, status: 'ACTIVE' },
      });
      const groupIds = links.map((l) => l.groupId);
      if (groupId && !groupIds.includes(groupId)) throw new AppError('Нет доступа к группе', 403, 'FORBIDDEN');
      const assignments = await prisma.assignment.findMany({
        where: { groupId: groupId ? groupId : { in: groupIds }, ...visibleToStudents() },
        include: {
          course: true,
          group: true,
          lesson: { select: { id: true, title: true, startsAt: true } },
          submissions: {
            where: { studentId: req.user!.studentId },
            include: { grade: true },
          },
        },
        orderBy: { deadline: 'asc' },
      });
      return res.json(ok(assignments));
    }

    if (req.user!.role === Role.TEACHER) {
      if (groupId) await assertTeacherOwnsGroup(req.user!.teacherId, groupId);
      const assignments = await prisma.assignment.findMany({
        where: {
          group: { teacherId: req.user!.teacherId },
          groupId,
          status,
        },
        include: {
          course: true,
          group: true,
          lesson: { select: { id: true, title: true, startsAt: true } },
          _count: { select: { submissions: true } },
          submissions: { where: { status: { in: ['SUBMITTED', 'REVIEWING'] } }, select: { id: true } },
        },
        orderBy: { deadline: 'asc' },
      });
      return res.json(
        ok(assignments.map(({ submissions, ...a }) => ({ ...a, pendingReview: submissions.length })))
      );
    }

    const assignments = await prisma.assignment.findMany({
      where: { groupId, status },
      include: {
        course: true,
        group: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(ok(assignments));
  })
);

/** Teacher/admin queue: "Работы на проверке". */
router.get(
  '/submissions/review',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const groupId = (req.query.groupId as string | undefined) || undefined;
    const statusParam = String(req.query.status || 'SUBMITTED');
    if (groupId && req.user!.role === Role.TEACHER) await assertTeacherOwnsGroup(req.user!.teacherId, groupId);

    const statusFilter: Prisma.SubmissionWhereInput =
      statusParam === 'all'
        ? { status: { not: 'DRAFT' } }
        : statusParam === 'GRADED'
          ? { status: 'GRADED' }
          : { status: { in: ['SUBMITTED', 'REVIEWING'] } };

    const items = await prisma.submission.findMany({
      where: {
        ...statusFilter,
        assignment: {
          groupId,
          group: req.user!.role === Role.TEACHER ? { teacherId: req.user!.teacherId } : undefined,
        },
      },
      include: {
        student: { include: { user: { select: publicUserSelect } } },
        assignment: { select: { id: true, title: true, maxScore: true, deadline: true, group: { select: { id: true, code: true } }, course: { select: { id: true, title: true } } } },
        grade: { select: { score: true, maxScore: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { submittedAt: statusParam === 'GRADED' ? 'desc' : 'asc' },
      take: 200,
    });
    res.json(ok(items));
  })
);

router.get(
  '/submissions/:submissionId',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
      include: {
        ...submissionDetailInclude,
        assignment: { include: { course: true, group: true } },
      },
    });
    if (!submission) throw new AppError('Работа не найдена', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) {
      if (!submission.assignment.groupId) throw new AppError('Нет доступа', 403, 'FORBIDDEN');
      await assertTeacherOwnsGroup(req.user!.teacherId, submission.assignment.groupId);
    }
    if (submission.status === 'SUBMITTED') {
      await prisma.submission.update({ where: { id: submission.id }, data: { status: 'REVIEWING' } });
      submission.status = 'REVIEWING';
    }
    res.json(ok(submission));
  })
);

/** "Вернуть на доработку": the student can send a new attempt even if resubmission is disabled. */
router.post(
  '/submissions/:submissionId/return',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { comment } = z.object({ comment: z.string().trim().min(1, 'Напишите, что нужно исправить').max(5000) }).parse(req.body);
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
      include: { assignment: true, student: { select: { userId: true } } },
    });
    if (!submission) throw new AppError('Работа не найдена', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) {
      if (!submission.assignment.groupId) throw new AppError('Нет доступа', 403, 'FORBIDDEN');
      await assertTeacherOwnsGroup(req.user!.teacherId, submission.assignment.groupId);
    }
    if (submission.status === 'DRAFT' || !submission.submittedAt) {
      throw new AppError('Студент ещё не отправил работу', 400, 'NOT_SUBMITTED');
    }
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'RETURNED', feedback: comment, returnedAt: new Date() },
    });
    await notifyUser(
      submission.student.userId,
      'SUBMISSION',
      'Работа возвращена на доработку',
      `«${submission.assignment.title}»: ${comment.slice(0, 120)}`,
      `/student/assignments/${submission.assignmentId}`
    );
    await logActivity(submission.studentId, 'SUBMISSION_RETURNED', `Работа «${submission.assignment.title}» возвращена на доработку`, {
      assignmentId: submission.assignmentId,
    });
    await audit(req.user!.id, 'RETURN', 'Submission', submission.id);
    res.json(ok(updated));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await markOverdueAssignments();
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        group: { include: { teacher: { include: { user: { select: publicUserSelect } } } } },
        lesson: { select: { id: true, title: true, startsAt: true, endsAt: true } },
      },
    });
    if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');

    if (req.user!.role === Role.STUDENT) {
      if (!assignment.groupId) throw new AppError('Нет доступа к заданию', 403, 'FORBIDDEN');
      await assertStudentInGroup(req.user!.studentId, assignment.groupId);
      const visible = await prisma.assignment.count({ where: { id: assignment.id, ...visibleToStudents() } });
      if (!visible) throw new AppError('Задание ещё не опубликовано', 404, 'NOT_FOUND');
      const submission = await prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: req.user!.studentId! } },
        include: submissionDetailInclude,
      });
      return res.json(ok({ ...assignment, submissions: submission ? [submission] : [], submission }));
    }

    if (req.user!.role === Role.TEACHER) {
      if (!assignment.groupId) throw new AppError('Нет доступа к заданию', 403, 'FORBIDDEN');
      await assertTeacherOwnsGroup(req.user!.teacherId, assignment.groupId);
    }
    const [submissions, members] = await Promise.all([
      prisma.submission.findMany({
        where: { assignmentId: assignment.id },
        include: submissionDetailInclude,
        orderBy: { submittedAt: 'desc' },
      }),
      assignment.groupId
        ? prisma.groupStudent.findMany({
            where: { groupId: assignment.groupId, status: 'ACTIVE' },
            include: { student: { include: { user: { select: publicUserSelect } } } },
            orderBy: { student: { user: { lastName: 'asc' } } },
          })
        : Promise.resolve([]),
    ]);
    res.json(ok({ ...assignment, submissions, students: members.map((m) => m.student) }));
  })
);

const assignmentSchema = z.object({
  courseId: z.string().optional(),
  groupId: z.string(),
  lessonId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  criteria: z.string().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  publishAt: z.string().datetime().optional().nullable(),
  maxScore: z.number().positive().max(1000).optional(),
  status: z.nativeEnum(AssignmentStatus).optional(),
  allowResubmit: z.boolean().optional(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
});

async function validateAssignmentRefs(groupId: string, lessonId?: string | null, attachmentUrl?: string | null) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
  if (lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.groupId !== groupId) throw new AppError('Занятие не относится к группе', 400, 'LESSON_MISMATCH');
  }
  if (attachmentUrl && !attachmentUrl.startsWith('/uploads/private/assignments/')) {
    throw new AppError('Некорректный файл-инструкция', 400, 'INVALID_ATTACHMENT');
  }
  return group;
}

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = assignmentSchema.parse(req.body);
    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    }
    const group = await validateAssignmentRefs(body.groupId, body.lessonId, body.attachmentUrl);

    const assignment = await prisma.assignment.create({
      data: {
        courseId: group.courseId,
        groupId: group.id,
        lessonId: body.lessonId || null,
        title: body.title,
        description: body.description,
        criteria: body.criteria,
        deadline: body.deadline ? new Date(body.deadline) : null,
        publishAt: body.publishAt ? new Date(body.publishAt) : null,
        maxScore: body.maxScore,
        status: body.status || AssignmentStatus.PUBLISHED,
        allowResubmit: body.allowResubmit ?? true,
        attachmentUrl: body.attachmentUrl,
        attachmentName: body.attachmentName,
      },
    });

    const publishedNow = assignment.status !== 'DRAFT' && (!assignment.publishAt || assignment.publishAt <= new Date());
    if (publishedNow) {
      const userIds = await getGroupStudentUserIds(group.id);
      await notifyUsers(userIds, 'ASSIGNMENT', 'Новое задание', `${assignment.title} · группа ${group.code}`, `/student/assignments/${assignment.id}`);
    }

    await audit(req.user!.id, 'CREATE', 'Assignment', assignment.id);
    res.status(201).json(ok(assignment));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = assignmentSchema.partial().parse(req.body);
    const existing = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
    const targetGroupId = body.groupId ?? existing.groupId;
    if (!targetGroupId) throw new AppError('Задание не привязано к группе', 400, 'NO_GROUP');
    if (req.user!.role === Role.TEACHER) {
      if (!existing.groupId) throw new AppError('Нет доступа к заданию', 403, 'FORBIDDEN');
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
      if (targetGroupId !== existing.groupId) await assertTeacherOwnsGroup(req.user!.teacherId, targetGroupId);
    }
    const group = await validateAssignmentRefs(targetGroupId, body.lessonId, body.attachmentUrl);

    const { courseId: _ignored, deadline, publishAt, ...rest } = body;
    const assignment = await prisma.assignment.update({
      where: { id: existing.id },
      data: {
        ...rest,
        courseId: group.courseId,
        deadline: deadline === undefined ? undefined : deadline ? new Date(deadline) : null,
        publishAt: publishAt === undefined ? undefined : publishAt ? new Date(publishAt) : null,
      },
    });
    if (existing.status === 'DRAFT' && assignment.status !== 'DRAFT') {
      const userIds = await getGroupStudentUserIds(group.id);
      await notifyUsers(userIds, 'ASSIGNMENT', 'Новое задание', assignment.title, `/student/assignments/${assignment.id}`);
    }
    await audit(req.user!.id, 'UPDATE', 'Assignment', assignment.id);
    res.json(ok(assignment));
  })
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const existing = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!existing) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) {
      if (!existing.groupId) throw new AppError('Нет доступа к заданию', 403, 'FORBIDDEN');
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
    }
    if (existing._count.submissions > 0) {
      throw new AppError('По заданию уже есть ответы студентов — его можно только скрыть (статус «Черновик»)', 409, 'HAS_SUBMISSIONS');
    }
    await prisma.assignment.delete({ where: { id: existing.id } });
    await audit(req.user!.id, 'DELETE', 'Assignment', existing.id);
    res.json(ok({ success: true }));
  })
);

router.post(
  '/:id/submissions',
  requireRole(Role.STUDENT),
  handleUpload(submissionUploader, { array: 'files', max: 5 }),
  asyncHandler(async (req, res) => {
    const stored = req.storedFiles ?? [];
    try {
      const body = z
        .object({ text: z.string().max(20000).optional().nullable() })
        .parse({ text: typeof req.body?.text === 'string' ? req.body.text : null });
      const text = body.text?.trim() || null;
      if (!text && stored.length === 0) {
        throw new AppError('Добавьте текст ответа или прикрепите файл', 400, 'EMPTY_SUBMISSION');
      }

      const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { group: true } });
      if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
      if (!assignment.groupId || !assignment.group) throw new AppError('Задание не привязано к группе', 400, 'NO_GROUP');
      const visible = await prisma.assignment.count({ where: { id: assignment.id, ...visibleToStudents() } });
      if (!visible) throw new AppError('Задание ещё не опубликовано', 400, 'NOT_PUBLISHED');
      await assertStudentInGroup(req.user!.studentId, assignment.groupId);

      const studentId = req.user!.studentId!;
      const existing = await prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
      });
      const alreadySent = existing && existing.status !== 'DRAFT' && existing.attemptCount > 0;
      if (alreadySent && !assignment.allowResubmit && existing.status !== 'RETURNED') {
        throw new AppError('Повторная сдача этого задания запрещена преподавателем', 409, 'RESUBMIT_FORBIDDEN');
      }

      const now = new Date();
      const number = (existing?.attemptCount ?? 0) + 1;
      const first = stored[0];
      const submission = await prisma.$transaction(async (tx) => {
        const sub = await tx.submission.upsert({
          where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
          create: {
            assignmentId: assignment.id,
            studentId,
            text,
            fileUrl: first?.url ?? null,
            fileName: first?.originalName ?? null,
            submittedAt: now,
            status: SubmissionStatus.SUBMITTED,
            attemptCount: number,
          },
          update: {
            text,
            fileUrl: first?.url ?? null,
            fileName: first?.originalName ?? null,
            submittedAt: now,
            status: SubmissionStatus.SUBMITTED,
            attemptCount: number,
          },
        });
        await tx.submissionAttempt.create({
          data: {
            submissionId: sub.id,
            number,
            text,
            submittedAt: now,
            files: {
              create: stored.map((f) => ({ url: f.url, originalName: f.originalName, size: f.size, mimeType: f.mimeType })),
            },
          },
        });
        return tx.submission.findUniqueOrThrow({ where: { id: sub.id }, include: submissionDetailInclude });
      });

      const late = assignment.deadline && assignment.deadline < now;
      await logActivity(studentId, 'SUBMISSION', `Отправлено задание «${assignment.title}»${number > 1 ? ` (попытка №${number})` : ''}`, {
        assignmentId: assignment.id,
      });
      await ensureAchievements(studentId);
      const teacherUserId = await getGroupTeacherUserId(assignment.groupId);
      if (teacherUserId) {
        await notifyUser(
          teacherUserId,
          'SUBMISSION',
          'Новая работа на проверку',
          `${req.user!.firstName} ${req.user!.lastName} · «${assignment.title}» · ${assignment.group.code}${late ? ' · после дедлайна' : ''}`,
          `/teacher/review/${submission.id}`
        );
      }

      res.status(201).json(ok(submission));
    } catch (e) {
      await removeFiles(stored.map((f) => f.absPath));
      throw e;
    }
  })
);

router.get(
  '/meta/upload-rules',
  asyncHandler(async (_req, res) => {
    res.json(
      ok({
        maxFileMb: MAX_FILE_MB,
        maxFiles: 5,
        extensions: EXTENSION_SETS.submission.map((e) => e.slice(1).toUpperCase()),
        accept: EXTENSION_SETS.submission.join(','),
      })
    );
  })
);

export default router;
