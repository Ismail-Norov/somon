import { Router } from 'express';
import { z } from 'zod';
import { GroupStatus, LearningFormat, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { groupProgress, groupSummary } from '../services/progress';
import { audit, getGroupStudentUserIds, notifyUser, notifyUsers } from '../services/notifications';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = req.query.status as GroupStatus | undefined;

    if (req.user!.role === Role.ADMIN) {
      const groups = await prisma.group.findMany({
        where: {
          status: status || undefined,
          OR: q
            ? [{ code: { contains: q } }, { name: { contains: q } }]
            : undefined,
        },
        include: {
          course: true,
          teacher: { include: { user: { select: publicUserSelect } } },
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return res.json(ok(groups));
    }

    if (req.user!.role === Role.TEACHER) {
      const groups = await prisma.group.findMany({
        where: { teacherId: req.user!.teacherId, status: status || undefined },
        include: {
          course: true,
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
          lessons: {
            where: { status: 'SCHEDULED', endsAt: { gte: new Date() } },
            orderBy: { startsAt: 'asc' },
            take: 1,
            select: { id: true, title: true, startsAt: true, endsAt: true, format: true },
          },
        },
        orderBy: { code: 'asc' },
      });
      const withSummary = await Promise.all(
        groups.map(async ({ lessons, ...g }) => ({ ...g, nextLesson: lessons[0] ?? null, summary: await groupSummary(g.id) }))
      );
      return res.json(ok(withSummary));
    }

    const links = await prisma.groupStudent.findMany({
      where: { studentId: req.user!.studentId, status: 'ACTIVE' },
      include: {
        group: {
          include: {
            course: true,
            teacher: { include: { user: { select: publicUserSelect } } },
          },
        },
      },
    });
    res.json(ok(links.map((l) => l.group)));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        course: { include: { category: true } },
        teacher: { include: { user: { select: publicUserSelect } } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { student: { include: { user: { select: publicUserSelect } } } },
        },
        lessons: { orderBy: { startsAt: 'asc' } },
        assignments: { orderBy: { deadline: 'asc' } },
      },
    });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER && group.teacherId !== req.user!.teacherId) {
      throw new AppError('Нет доступа к этой группе', 403, 'FORBIDDEN');
    }
    if (req.user!.role === Role.STUDENT) {
      const member = group.groupStudents.some((gs) => gs.studentId === req.user!.studentId);
      if (!member) throw new AppError('Нет доступа к этой группе', 403, 'FORBIDDEN');
    }

    res.json(ok(group));
  })
);

/** Student card inside a group — for the group's teacher and admins. */
router.get(
  '/:id/students/:studentId',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { id: groupId, studentId } = req.params;
    const group =
      req.user!.role === Role.TEACHER
        ? await assertTeacherOwnsGroup(req.user!.teacherId, groupId)
        : await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    const link = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
      include: { student: { include: { user: { select: { ...publicUserSelect, createdAt: true } } } } },
    });
    if (!link) throw new AppError('Студент не состоит в этой группе', 404, 'NOT_FOUND');

    const [progress, attendance, assignments, lessonGrades, activities] = await Promise.all([
      groupProgress(groupId, [studentId]),
      prisma.attendance.findMany({
        where: { studentId, lesson: { groupId } },
        include: { lesson: { select: { id: true, title: true, startsAt: true } } },
        orderBy: { lesson: { startsAt: 'desc' } },
      }),
      prisma.assignment.findMany({
        where: { groupId, status: { not: 'DRAFT' } },
        select: {
          id: true,
          title: true,
          deadline: true,
          maxScore: true,
          submissions: {
            where: { studentId },
            select: { id: true, status: true, submittedAt: true, attemptCount: true, grade: { select: { score: true, maxScore: true, comment: true } } },
          },
        },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.grade.findMany({
        where: { studentId, lesson: { groupId } },
        include: { lesson: { select: { title: true, startsAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.studentActivity.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);

    res.json(
      ok({
        group: { id: group.id, code: group.code, courseId: group.courseId },
        student: { ...link.student, joinedAt: link.joinedAt, status: link.status },
        progress: progress.get(studentId) ?? null,
        attendance,
        assignments: assignments.map(({ submissions, ...a }) => ({ ...a, submission: submissions[0] ?? null })),
        lessonGrades,
        activities,
      })
    );
  })
);

const groupSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().optional(),
  courseId: z.string(),
  teacherId: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  capacity: z.number().int().positive().optional(),
  status: z.nativeEnum(GroupStatus).optional(),
  format: z.nativeEnum(LearningFormat).optional(),
  adminNote: z.string().optional().nullable(),
});

router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = groupSchema.parse(req.body);
    if (await prisma.group.findUnique({ where: { code: body.code } })) {
      throw new AppError('Код группы уже существует', 409, 'CODE_TAKEN');
    }
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      throw new AppError('Дата окончания раньше даты начала', 400, 'INVALID_DATES');
    }
    const group = await prisma.group.create({
      data: {
        code: body.code,
        name: body.name,
        courseId: body.courseId,
        teacherId: body.teacherId || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        capacity: body.capacity,
        status: body.status,
        format: body.format,
        adminNote: body.adminNote,
      },
    });
    await audit(req.user!.id, 'CREATE', 'Group', group.id);
    res.status(201).json(ok(group));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = groupSchema.partial().parse(req.body);
    const existing = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    if (body.code && body.code !== existing.code && (await prisma.group.findUnique({ where: { code: body.code } }))) {
      throw new AppError('Код группы уже существует', 409, 'CODE_TAKEN');
    }
    const start = body.startDate === undefined ? existing.startDate : body.startDate ? new Date(body.startDate) : null;
    const end = body.endDate === undefined ? existing.endDate : body.endDate ? new Date(body.endDate) : null;
    if (start && end && end < start) {
      throw new AppError('Дата окончания раньше даты начала', 400, 'INVALID_DATES');
    }
    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: {
        code: body.code,
        name: body.name,
        courseId: body.courseId,
        teacherId: body.teacherId,
        startDate: body.startDate === undefined ? undefined : body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
        capacity: body.capacity,
        status: body.status,
        format: body.format,
        adminNote: body.adminNote,
      },
    });
    if (body.teacherId && body.teacherId !== existing.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: body.teacherId } });
      if (teacher) {
        await notifyUser(
          teacher.userId,
          'GROUP',
          'Вам назначена группа',
          `Группа ${group.code}`,
          `/teacher/groups/${group.id}`
        );
      }
    }
    await audit(req.user!.id, 'UPDATE', 'Group', group.id, body);
    res.json(ok(group));
  })
);

router.post(
  '/:id/students',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const studentId = z.object({ studentId: z.string() }).parse(req.body).studentId;
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } },
    });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    if (group.status === 'ARCHIVED' || group.status === 'COMPLETED') {
      throw new AppError('Нельзя добавить студента в архивную/завершённую группу', 400, 'GROUP_CLOSED');
    }
    if (group._count.groupStudents >= group.capacity) {
      throw new AppError('Группа заполнена. Требуется явное административное расширение вместимости.', 409, 'CAPACITY');
    }
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new AppError('Студент не найден', 404, 'NOT_FOUND');

    const link = await prisma.groupStudent.upsert({
      where: { groupId_studentId: { groupId: group.id, studentId } },
      create: { groupId: group.id, studentId },
      update: { status: 'ACTIVE' },
    });
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId: group.courseId } },
      create: { studentId, courseId: group.courseId },
      update: { status: 'ACTIVE' },
    });
    await prisma.courseApplication.updateMany({
      where: { studentId, courseId: group.courseId, status: 'PENDING' },
      data: { status: 'APPROVED', groupId: group.id },
    });

    await notifyUser(student.userId, 'ENROLLMENT', 'Запись в группу', `Вы добавлены в группу ${group.code}`, '/student/courses');
    await audit(req.user!.id, 'ADD_STUDENT', 'Group', group.id, { studentId });
    res.status(201).json(ok(link));
  })
);

router.post(
  '/:id/enroll',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { course: true, _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } },
    });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    if (!['ENROLLMENT', 'ACTIVE', 'PLANNED'].includes(group.status)) {
      throw new AppError('Набор в группу закрыт', 400, 'GROUP_CLOSED');
    }
    if (group.course.status !== 'PUBLISHED') {
      throw new AppError('Курс недоступен для записи', 400, 'COURSE_UNAVAILABLE');
    }
    if (group._count.groupStudents >= group.capacity) {
      throw new AppError('Нет свободных мест', 409, 'CAPACITY');
    }

    const studentId = req.user!.studentId!;
    const link = await prisma.groupStudent.upsert({
      where: { groupId_studentId: { groupId: group.id, studentId } },
      create: { groupId: group.id, studentId },
      update: { status: 'ACTIVE' },
    });
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId: group.courseId } },
      create: { studentId, courseId: group.courseId },
      update: { status: 'ACTIVE' },
    });
    await notifyUser(req.user!.id, 'ENROLLMENT', 'Запись на курс', `Вы записаны в группу ${group.code}`);
    res.status(201).json(ok(link));
  })
);

router.delete(
  '/:id/students/:studentId',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.groupStudent.update({
      where: {
        groupId_studentId: { groupId: req.params.id, studentId: req.params.studentId },
      },
      data: { status: 'DROPPED' },
    });
    await audit(req.user!.id, 'REMOVE_STUDENT', 'Group', req.params.id, {
      studentId: req.params.studentId,
    });
    res.json(ok({ success: true }));
  })
);

export default router;
