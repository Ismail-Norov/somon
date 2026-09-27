import { Router } from 'express';
import { z } from 'zod';
import { CourseLevel, CourseStatus, GroupStatus, LearningFormat, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect, siteUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';

const router = Router();

export const publicCourseInclude = {
  category: true,
  groups: {
    where: { status: { in: ['ENROLLMENT', 'ACTIVE', 'PLANNED'] as GroupStatus[] } },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      capacity: true,
      format: true,
      startDate: true,
      endDate: true,
      teacher: {
        select: { id: true, specialization: true, position: true, user: { select: siteUserSelect } },
      },
      _count: { select: { groupStudents: { where: { status: 'ACTIVE' as const } } } },
    },
    orderBy: { startDate: 'asc' as const },
  },
  teachers: {
    where: { isPublic: true, user: { status: 'ACTIVE' as const } },
    select: { id: true, specialization: true, position: true, user: { select: siteUserSelect } },
  },
} satisfies Prisma.CourseInclude;

type PublicCourseRow = Prisma.CourseGetPayload<{ include: typeof publicCourseInclude }>;

export function serializePublicCourse(course: PublicCourseRow) {
  const teachers = new Map<string, NonNullable<PublicCourseRow['groups'][number]['teacher']>>();
  for (const g of course.groups) {
    if (g.teacher) teachers.set(g.teacher.id, g.teacher);
  }
  for (const t of course.teachers) teachers.set(t.id, t);
  return {
    ...course,
    teachers: [...teachers.values()],
    groups: course.groups.map((g) => ({
      ...g,
      seatsLeft: Math.max(0, g.capacity - g._count.groupStudents),
    })),
  };
}

const DURATION_RANGES: Record<string, { gte?: number; lte?: number }> = {
  short: { lte: 4 },
  medium: { gte: 5, lte: 8 },
  long: { gte: 9 },
};

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const categoryId = (req.query.categoryId as string | undefined) || undefined;
    const level = req.query.level as string | undefined;
    const format = req.query.format as string | undefined;
    const duration = DURATION_RANGES[String(req.query.duration || '')];

    const courses = await prisma.course.findMany({
      where: {
        status: CourseStatus.PUBLISHED,
        categoryId,
        level: level && level in CourseLevel ? (level as CourseLevel) : undefined,
        format: format && format in LearningFormat ? (format as LearningFormat) : undefined,
        durationWeeks: duration,
        OR: q
          ? [{ title: { contains: q } }, { shortDesc: { contains: q } }, { description: { contains: q } }]
          : undefined,
      },
      include: publicCourseInclude,
      orderBy: { title: 'asc' },
    });
    res.json(ok(courses.map(serializePublicCourse)));
  })
);

router.get(
  '/public/meta',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { courses: { some: { status: CourseStatus.PUBLISHED } } },
      orderBy: { name: 'asc' },
    });
    res.json(ok({ categories }));
  })
);

router.get(
  '/public/:id',
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, status: CourseStatus.PUBLISHED },
      include: publicCourseInclude,
    });
    if (!course) throw new AppError('Курс не найден', 404, 'NOT_FOUND');
    res.json(ok(serializePublicCourse(course)));
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
          teachers: { select: { id: true, user: { select: publicUserSelect } } },
          _count: { select: { groups: true, enrollments: { where: { status: 'ACTIVE' } } } },
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
            teacher: { include: { user: { select: publicUserSelect } } },
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
            teacher: { include: { user: { select: publicUserSelect } } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
          },
        },
        materials: { orderBy: { sortOrder: 'asc' } },
        assignments: true,
      },
    });
    if (!course) throw new AppError('Курс не найден', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      const own = course.groups.some((g) => g.teacherId === req.user!.teacherId);
      if (!own) throw new AppError('Нет доступа к курсу', 403, 'FORBIDDEN');
    }
    if (req.user!.role === Role.STUDENT) {
      const link = await prisma.groupStudent.findFirst({
        where: { studentId: req.user!.studentId, status: 'ACTIVE', group: { courseId: course.id } },
      });
      if (!link) throw new AppError('Нет доступа к курсу', 403, 'FORBIDDEN');
    }
    res.json(ok(course));
  })
);

const courseSchema = z.object({
  price: z.number().nonnegative().optional().nullable(),
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
