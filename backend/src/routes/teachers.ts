import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.teacher.findMany({
      where: { user: { status: 'ACTIVE' } },
      include: { user: { select: { firstName: true, lastName: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(teachers));
  })
);

router.use(requireAuth);

router.get(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
        _count: { select: { groups: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(teachers));
  })
);

router.get(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
        groups: {
          include: {
            course: { select: { title: true } },
            _count: { select: { groupStudents: true } },
          },
        },
      },
    });
    if (!teacher) throw new Error('Преподаватель не найден');
    res.json(ok(teacher));
  })
);

export default router;
