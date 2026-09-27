import { Router } from 'express';
import { z } from 'zod';
import { CourseLevel, MaterialType, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';
import { deleteUploadUrl } from '../lib/uploads';

/** Admin management of open materials shown on the public site (/materials). */
const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Ссылка должна начинаться с http:// или https://');

const materialSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1, 'Укажите категорию').max(80),
  type: z.nativeEnum(MaterialType).optional(),
  level: z.nativeEnum(CourseLevel).optional(),
  fileUrl: z
    .string()
    .refine((v) => v === '' || v.startsWith('/uploads/public/'), 'Файл должен быть загружен через форму')
    .optional()
    .nullable(),
  fileName: z.string().max(255).optional().nullable(),
  linkUrl: httpUrl.optional().nullable(),
  videoUrl: httpUrl.optional().nullable(),
  isPublic: z.boolean().optional(),
  courseId: z.string().optional().nullable(),
});

type MaterialInput = Partial<z.infer<typeof materialSchema>>;

function normalize(body: MaterialInput) {
  const nullable = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
  return {
    ...body,
    description: nullable(body.description),
    fileUrl: nullable(body.fileUrl),
    fileName: body.fileUrl === '' || body.fileUrl === null ? null : nullable(body.fileName),
    linkUrl: nullable(body.linkUrl),
    videoUrl: nullable(body.videoUrl),
    courseId: nullable(body.courseId),
  };
}

async function assertCourse(courseId: string | null | undefined) {
  if (!courseId) return;
  if (!(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
    throw new AppError('Курс не найден', 400, 'COURSE_NOT_FOUND');
  }
}

async function removeFile(url: string | null | undefined) {
  if (url?.startsWith('/uploads/public/')) await deleteUploadUrl(url);
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.publicMaterial.findMany({
      include: {
        author: { select: { firstName: true, lastName: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = normalize(materialSchema.parse(req.body));
    if (!data.fileUrl && !data.linkUrl && !data.videoUrl && !data.description) {
      throw new AppError('Добавьте файл, ссылку, видео или описание', 400, 'EMPTY_MATERIAL');
    }
    await assertCourse(data.courseId);
    const item = await prisma.publicMaterial.create({
      data: { ...data, title: data.title!, category: data.category!, authorId: req.user!.id },
    });
    await audit(req.user!.id, 'CREATE', 'PublicMaterial', item.id);
    res.status(201).json(ok(item));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.publicMaterial.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Материал не найден', 404, 'NOT_FOUND');
    const data = normalize(materialSchema.partial().parse(req.body));
    await assertCourse(data.courseId);
    const item = await prisma.publicMaterial.update({ where: { id: existing.id }, data });
    if (data.fileUrl !== undefined && existing.fileUrl && existing.fileUrl !== data.fileUrl) {
      await removeFile(existing.fileUrl);
    }
    await audit(req.user!.id, 'UPDATE', 'PublicMaterial', item.id);
    res.json(ok(item));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.publicMaterial.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Материал не найден', 404, 'NOT_FOUND');
    await prisma.publicMaterial.delete({ where: { id: existing.id } });
    await removeFile(existing.fileUrl);
    await audit(req.user!.id, 'DELETE', 'PublicMaterial', existing.id);
    res.json(ok({ success: true }));
  })
);

export default router;
