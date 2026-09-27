import { Router } from 'express';
import { CourseStatus, MaterialType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { siteUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { getSettings } from '../lib/settings';
import { publicCourseInclude, serializePublicCourse } from './courses';
import { listPublicTeachers } from './teachers';

const router = Router();

async function computeStats() {
  const settings = await getSettings();
  const [students, courses, teachers, categories] = await Promise.all([
    prisma.student.count({ where: { user: { status: 'ACTIVE' } } }),
    prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
    prisma.teacher.count({ where: { user: { status: 'ACTIVE' } } }),
    prisma.category.count({ where: { courses: { some: { status: CourseStatus.PUBLISHED } } } }),
  ]);
  const pick = (override: string, real: number) => (override.trim() ? override.trim() : String(real));
  return [
    { key: 'students', label: 'студентов', value: pick(settings['stats.students'], students) },
    { key: 'courses', label: 'курсов', value: pick(settings['stats.courses'], courses) },
    { key: 'teachers', label: 'преподавателей', value: pick(settings['stats.teachers'], teachers) },
    { key: 'directions', label: 'направлений', value: pick(settings['stats.directions'], categories) },
  ];
}

const newsListSelect = {
  id: true,
  title: true,
  summary: true,
  category: true,
  imageUrl: true,
  publishedAt: true,
} as const;

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [settings, stats, courses, teachers, news, materials, branches] = await Promise.all([
      getSettings(),
      computeStats(),
      prisma.course.findMany({
        where: { status: CourseStatus.PUBLISHED },
        include: publicCourseInclude,
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      listPublicTeachers(6),
      prisma.news.findMany({
        where: { isPublished: true },
        select: newsListSelect,
        orderBy: { publishedAt: 'desc' },
        take: 3,
      }),
      prisma.publicMaterial.findMany({
        where: { isPublic: true },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      }),
      prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json(
      ok({
        settings,
        stats,
        courses: courses.map(serializePublicCourse),
        teachers,
        news,
        materials,
        branches,
      })
    );
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(ok(await computeStats()));
  })
);

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(ok(await getSettings()));
  })
);

router.get(
  '/news',
  asyncHandler(async (req, res) => {
    const category = (req.query.category as string | undefined) || undefined;
    const items = await prisma.news.findMany({
      where: { isPublished: true, category },
      select: newsListSelect,
      orderBy: { publishedAt: 'desc' },
    });
    const categories = await prisma.news.findMany({
      where: { isPublished: true },
      distinct: ['category'],
      select: { category: true },
    });
    res.json(ok({ items, categories: categories.map((c) => c.category) }));
  })
);

router.get(
  '/news/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.news.findFirst({
      where: { id: req.params.id, isPublished: true },
      include: { author: { select: siteUserSelect } },
    });
    if (!item) throw new AppError('Новость не найдена', 404, 'NOT_FOUND');
    res.json(ok(item));
  })
);

router.get(
  '/materials',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const category = (req.query.category as string | undefined) || undefined;
    const typeParam = req.query.type as string | undefined;
    const type =
      typeParam && (Object.values(MaterialType) as string[]).includes(typeParam)
        ? (typeParam as MaterialType)
        : undefined;
    const items = await prisma.publicMaterial.findMany({
      where: {
        isPublic: true,
        category,
        type,
        OR: q ? [{ title: { contains: q } }, { description: { contains: q } }] : undefined,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    const categories = await prisma.publicMaterial.findMany({
      where: { isPublic: true },
      distinct: ['category'],
      select: { category: true },
    });
    res.json(ok({ items, categories: categories.map((c) => c.category) }));
  })
);

router.get(
  '/contacts',
  asyncHandler(async (_req, res) => {
    const [settings, branches] = await Promise.all([
      getSettings(),
      prisma.branch.findMany({
        where: { isActive: true },
        include: { _count: { select: { classrooms: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json(ok({ settings, branches }));
  })
);

export default router;
