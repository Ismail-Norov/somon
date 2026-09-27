import { Router } from 'express';
import { z } from 'zod';
import { CourseLevel, CourseStatus, LearningFormat, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';

const router = Router();

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const courses = await prisma.course.findMany({
      where: {
        status: CourseStatus.PUBLISHED,
        OR: q
          ? [{ title: { contains: q } }, { shortDesc: { contains: q } }]
          : undefined,
      },
      include: {
        category: true,
        groups: {
          where: { status: { in: ['ENROLLMENT', 'ACTIVE', 'PLANNED'] } },
          include: {
            teacher: { include: { user: true } },
            _count: { select: { groupStudents: true } },
          },
        },
      },
      orderBy: { title: 'asc' },
    });
    res.json(ok(courses));
  })
);

router.get(
  '/public/:id',
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, status: CourseStatus.PUBLISHED },
      include: {
        category: true,
        groups: {
          where: { status: { in: ['ENROLLMENT', 'ACTIVE', 'PLANNED'] } },
          include: {
            teacher: { include: { user: true } },
            _count: { select: { groupStudents: true } },
          },
        },
      },
    });
    if (!course) throw new AppError('Курс не найден', 404, 'NOT_FOUND');
    res.json(ok(course));
  })
);



router.use(requireAuth);

router.get(
  '/meta/categories',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(ok(categories));
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = req.query.status as CourseStatus | undefined;

    if (req.user!.role === Role.ADMIN) {
      const courses = await prisma.course.findMany({
        where: {
          status: status || undefined,
          OR: q ? [{ title: { contains: q } }] : undefined,
        },
        include: {
          category: true,
          _count: { select: { groups: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return res.json(ok(courses));
    }

    if (req.user!.role === Role.TEACHER) {
      const courses = await prisma.course.findMany({
        where: {
          groups: { some: { teacherId: req.user!.teacherId } },
        },
        include: { category: true, groups: { where: { teacherId: req.user!.teacherId } } },
      });
      return res.json(ok(courses));
    }

    // student: own courses
    const links = await prisma.groupStudent.findMany({
      where: { studentId: req.user!.studentId, status: 'ACTIVE' },
      include: {
        group: {
          include: {
            course: { include: { category: true } },
            teacher: { include: { user: true } },
          },
        },
      },
    });
    res.json(
      ok(
        links.map((l) => ({
          ...l.group.course,
          group: {
            id: l.group.id,
            code: l.group.code,
            status: l.group.status,
            teacher: l.group.teacher,
          },
        }))
      )
    );
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        groups: {
          include: {
            teacher: { include: { user: true } },
            _count: { select: { groupStudents: true } },
          },
        },
        materials: { orderBy: { sortOrder: 'asc' } },
        assignments: true,
      },
    });
    if (!course) throw new AppError('Курс не найден', 404, 'NOT_FOUND');
    res.json(ok(course));
  })
);

const courseSchema = z.object({
  title: z.string().min(1).max(200),
  shortDesc: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  durationWeeks: z.number().int().positive().optional().nullable(),
  lessonsCount: z.number().int().positive().optional().nullable(),
  level: z.nativeEnum(CourseLevel).optional(),
  maxStudents: z.number().int().positive().optional(),
  status: z.nativeEnum(CourseStatus).optional(),
  format: z.nativeEnum(LearningFormat).optional(),
  imageUrl: z.string().optional().nullable(),
});

router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = courseSchema.parse(req.body);
    const course = await prisma.course.create({ data: body });
    await audit(req.user!.id, 'CREATE', 'Course', course.id);
    res.status(201).json(ok(course));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = courseSchema.partial().parse(req.body);
    const course = await prisma.course.update({ where: { id: req.params.id }, data: body });
    await audit(req.user!.id, 'UPDATE', 'Course', course.id, body);
    res.json(ok(course));
  })
);

router.patch(
  '/:id/archive',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { status: CourseStatus.ARCHIVED },
    });
    await audit(req.user!.id, 'ARCHIVE', 'Course', course.id);
    res.json(ok(course));
  })
);

export default router;
