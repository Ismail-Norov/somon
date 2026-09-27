import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Role, SubmissionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup, markOverdueAssignments } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUser, notifyUsers } from '../services/notifications';
import { ensureAchievements, logActivity } from '../services/activity';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    await markOverdueAssignments();
    const groupId = req.query.groupId as string | undefined;
    const status = req.query.status as AssignmentStatus | undefined;

    if (req.user!.role === Role.STUDENT) {
      const links = await prisma.groupStudent.findMany({
        where: { studentId: req.user!.studentId, status: 'ACTIVE' },
      });
      const groupIds = links.map((l) => l.groupId);
      const assignments = await prisma.assignment.findMany({
        where: {
          groupId: { in: groupIds },
          status: { not: 'DRAFT' },
        },
        include: {
          course: true,
          group: true,
          submissions: { where: { studentId: req.user!.studentId }, include: { grade: true } },
        },
        orderBy: { deadline: 'asc' },
      });
      return res.json(ok(assignments));
    }

    if (req.user!.role === Role.TEACHER) {
      const assignments = await prisma.assignment.findMany({
        where: {
          group: { teacherId: req.user!.teacherId },
          groupId: groupId || undefined,
          status: status || undefined,
        },
        include: {
          course: true,
          group: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { deadline: 'asc' },
      });
      return res.json(ok(assignments));
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

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await markOverdueAssignments();
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        group: true,
        lesson: true,
        submissions: {
          include: {
            student: { include: { user: true } },
            grade: true,
          },
        },
      },
    });
    if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER && assignment.groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, assignment.groupId);
    }
    if (req.user!.role === Role.STUDENT) {
      const mine = assignment.submissions.filter((s) => s.studentId === req.user!.studentId);
      return res.json(ok({ ...assignment, submissions: mine }));
    }
    res.json(ok(assignment));
  })
);

const assignmentSchema = z.object({
  courseId: z.string(),
  groupId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  criteria: z.string().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  maxScore: z.number().positive().optional(),
  status: z.nativeEnum(AssignmentStatus).optional(),
  attachmentUrl: z.string().optional().nullable(),
});

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = assignmentSchema.parse(req.body);
    if (req.user!.role === Role.TEACHER && body.groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId: body.courseId,
        groupId: body.groupId,
        lessonId: body.lessonId,
        title: body.title,
        description: body.description,
        criteria: body.criteria,
        deadline: body.deadline ? new Date(body.deadline) : null,
        maxScore: body.maxScore,
        status: body.status || AssignmentStatus.PUBLISHED,
        attachmentUrl: body.attachmentUrl,
      },
    });

    if (assignment.status === 'PUBLISHED' && assignment.groupId) {
      const userIds = await getGroupStudentUserIds(assignment.groupId);
      await notifyUsers(userIds, 'ASSIGNMENT', 'Новое задание', assignment.title);
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
    if (req.user!.role === Role.TEACHER && existing.groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
    }

    const assignment = await prisma.assignment.update({
      where: { id: existing.id },
      data: {
        ...body,
        deadline: body.deadline === undefined ? undefined : body.deadline ? new Date(body.deadline) : null,
      },
    });
    await audit(req.user!.id, 'UPDATE', 'Assignment', assignment.id);
    res.json(ok(assignment));
  })
);

const submissionSchema = z.object({
  text: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
});

router.post(
  '/:id/submissions',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const body = submissionSchema.parse(req.body);
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new AppError('Задание не найдено', 404, 'NOT_FOUND');
    if (assignment.status === 'DRAFT') throw new AppError('Задание ещё не опубликовано', 400, 'NOT_PUBLISHED');
    if (!assignment.groupId) throw new AppError('Задание не привязано к группе', 400, 'NO_GROUP');

    const member = await prisma.groupStudent.findUnique({
      where: {
        groupId_studentId: { groupId: assignment.groupId, studentId: req.user!.studentId! },
      },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new AppError('Вы не состоите в группе задания', 403, 'FORBIDDEN');
    }

    const overdue = assignment.deadline && assignment.deadline < new Date();
    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: req.user!.studentId!,
        },
      },
      create: {
        assignmentId: assignment.id,
        studentId: req.user!.studentId!,
        text: body.text,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        submittedAt: new Date(),
        status: overdue ? SubmissionStatus.OVERDUE : SubmissionStatus.SUBMITTED,
      },
      update: {
        text: body.text,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        submittedAt: new Date(),
        status: overdue ? SubmissionStatus.OVERDUE : SubmissionStatus.SUBMITTED,
      },
    });

    await logActivity(
      req.user!.studentId,
      'SUBMISSION',
      `Отправлено задание «${assignment.title}»`,
      { assignmentId: assignment.id }
    );
    await ensureAchievements(req.user!.studentId!);

    res.status(201).json(ok(submission));
  })
);

export default router;
