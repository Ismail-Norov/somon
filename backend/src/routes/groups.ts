import { Router } from 'express';
import { z } from 'zod';
import { GroupStatus, LearningFormat, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
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
        where: { teacherId: req.user!.teacherId },
        include: {
          course: true,
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { code: 'asc' },
      });
      return res.json(ok(groups));
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

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student) {
      await notifyUser(student.userId, 'ENROLLMENT', 'Запись в группу', `Вы добавлены в группу ${group.code}`);
    }
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
