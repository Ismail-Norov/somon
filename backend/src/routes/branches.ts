import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';

const router = Router();
router.use(requireAuth);

const branchInclude = {
  classrooms: { orderBy: { name: 'asc' as const }, include: { _count: { select: { lessons: true } } } },
  _count: { select: { classrooms: true, lessons: true } },
} satisfies Prisma.BranchInclude;

const branchSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(120),
  address: z.string().trim().min(1, 'Укажите адрес').max(300),
  phone: z.string().trim().max(40).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  workHours: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});

const classroomSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название аудитории').max(60),
  capacity: z.number().int().positive().max(1000).optional().nullable(),
});

function isUniqueError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const all = req.user!.role === Role.ADMIN && req.query.all === '1';
    const branches = await prisma.branch.findMany({
      where: all ? undefined : { isActive: true },
      include: branchInclude,
      orderBy: { name: 'asc' },
    });
    res.json(ok(branches));
  })
);

router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = branchSchema.parse(req.body);
    const branch = await prisma.branch.create({ data: body, include: branchInclude });
    await audit(req.user!.id, 'CREATE', 'Branch', branch.id);
    res.status(201).json(ok(branch));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = branchSchema.partial().parse(req.body);
    if (!(await prisma.branch.findUnique({ where: { id: req.params.id } }))) {
      throw new AppError('Филиал не найден', 404, 'NOT_FOUND');
    }
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data: body, include: branchInclude });
    await audit(req.user!.id, 'UPDATE', 'Branch', branch.id, body);
    res.json(ok(branch));
  })
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const branch = await prisma.branch.findUnique({ where: { id: req.params.id }, include: { _count: { select: { lessons: true } } } });
    if (!branch) throw new AppError('Филиал не найден', 404, 'NOT_FOUND');
    if (branch._count.lessons > 0) {
      throw new AppError('В филиале есть занятия — сделайте его неактивным вместо удаления', 409, 'BRANCH_IN_USE');
    }
    await prisma.branch.delete({ where: { id: branch.id } });
    await audit(req.user!.id, 'DELETE', 'Branch', branch.id);
    res.json(ok({ success: true }));
  })
);

router.post(
  '/:id/classrooms',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = classroomSchema.parse(req.body);
    if (!(await prisma.branch.findUnique({ where: { id: req.params.id } }))) {
      throw new AppError('Филиал не найден', 404, 'NOT_FOUND');
    }
    try {
      const classroom = await prisma.classroom.create({ data: { ...body, branchId: req.params.id } });
      await audit(req.user!.id, 'CREATE', 'Classroom', classroom.id);
      res.status(201).json(ok(classroom));
    } catch (err) {
      if (isUniqueError(err)) throw new AppError('Аудитория с таким названием уже есть в филиале', 409, 'CLASSROOM_EXISTS');
      throw err;
    }
  })
);

router.patch(
  '/classrooms/:classroomId',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = classroomSchema.partial().parse(req.body);
    if (!(await prisma.classroom.findUnique({ where: { id: req.params.classroomId } }))) {
      throw new AppError('Аудитория не найдена', 404, 'NOT_FOUND');
    }
    try {
      const classroom = await prisma.classroom.update({ where: { id: req.params.classroomId }, data: body });
      await audit(req.user!.id, 'UPDATE', 'Classroom', classroom.id, body);
      res.json(ok(classroom));
    } catch (err) {
      if (isUniqueError(err)) throw new AppError('Аудитория с таким названием уже есть в филиале', 409, 'CLASSROOM_EXISTS');
      throw err;
    }
  })
);

router.delete(
  '/classrooms/:classroomId',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const classroom = await prisma.classroom.findUnique({
      where: { id: req.params.classroomId },
      include: { _count: { select: { lessons: { where: { status: 'SCHEDULED', startsAt: { gte: new Date() } } } } } },
    });
    if (!classroom) throw new AppError('Аудитория не найдена', 404, 'NOT_FOUND');
    if (classroom._count.lessons > 0) {
      throw new AppError('В аудитории запланированы занятия — сначала перенесите их', 409, 'CLASSROOM_IN_USE');
    }
    await prisma.classroom.delete({ where: { id: classroom.id } });
    await audit(req.user!.id, 'DELETE', 'Classroom', classroom.id);
    res.json(ok({ success: true }));
  })
);

export default router;
