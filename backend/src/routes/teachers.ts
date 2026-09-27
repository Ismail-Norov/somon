import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { siteUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

export async function listPublicTeachers(take?: number, id?: string) {
  const teachers = await prisma.teacher.findMany({
    where: { id, isPublic: true, user: { status: 'ACTIVE' } },
    select: {
      id: true,
      specialization: true,
      position: true,
      bio: true,
      user: { select: siteUserSelect },
      groups: {
        where: { course: { status: 'PUBLISHED' }, status: { not: 'ARCHIVED' } },
        select: { course: { select: { id: true, title: true } } },
      },
      courses: { where: { status: 'PUBLISHED' }, select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'asc' },
    take,
  });
  return teachers.map(({ groups, courses: assigned, ...t }) => {
    const courses = new Map<string, { id: string; title: string }>();
    for (const c of assigned) courses.set(c.id, c);
    for (const g of groups) courses.set(g.course.id, g.course);
    return { ...t, courses: [...courses.values()] };
  });
}

router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    res.json(ok(await listPublicTeachers()));
  })
);

router.get(
  '/public/:id',
  asyncHandler(async (req, res) => {
    const [teacher] = await listPublicTeachers(1, req.params.id);
    if (!teacher) throw new AppError('Преподаватель не найден', 404, 'NOT_FOUND');
    res.json(ok(teacher));
  })
);

router.use(requireAuth);

router.get(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, photoUrl: true } },
        groups: {
          where: { status: { not: 'ARCHIVED' } },
          select: {
            id: true,
            code: true,
            status: true,
            course: { select: { id: true, title: true } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
          },
          orderBy: { code: 'asc' },
        },
        courses: { select: { id: true, title: true, status: true } },
        _count: { select: { groups: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const upcoming = await prisma.lesson.findMany({
      where: { startsAt: { gte: now }, status: 'SCHEDULED' },
      select: { teacherId: true, group: { select: { teacherId: true } } },
    });
    const upcomingByTeacher = new Map<string, number>();
    for (const l of upcoming) {
      const tid = l.teacherId ?? l.group.teacherId;
      if (tid) upcomingByTeacher.set(tid, (upcomingByTeacher.get(tid) ?? 0) + 1);
    }
    res.json(ok(teachers.map((t) => ({ ...t, upcomingLessons: upcomingByTeacher.get(t.id) ?? 0 }))));
  })
);

router.get(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.TEACHER && req.user!.teacherId !== req.params.id) {
      throw new AppError('Нет доступа', 403, 'FORBIDDEN');
    }
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true, photoUrl: true } },
        groups: {
          include: {
            course: { select: { title: true } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });
    if (!teacher) throw new AppError('Преподаватель не найден', 404, 'NOT_FOUND');
    res.json(ok(teacher));
  })
);

export default router;
