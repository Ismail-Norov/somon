import { Router } from 'express';
import { z } from 'zod';
import { MaterialType, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  assertCanEditMaterial,
  assertCanReadMaterial,
  assertTeacherOwnsGroup,
  studentMaterialWhere,
  teacherMaterialWhere,
} from '../services/access';
import { audit, getGroupStudentUserIds, notifyUsers } from '../services/notifications';
import { logActivity } from '../services/activity';
import { deleteUploadUrl } from '../lib/uploads';

const router = Router();
router.use(requireAuth);

const materialInclude = {
  course: { select: { id: true, title: true } },
  group: { select: { id: true, code: true } },
  lesson: { select: { id: true, title: true, startsAt: true } },
  author: { select: publicUserSelect },
  files: { select: { id: true, originalName: true, size: true, mimeType: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.MaterialInclude;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const courseId = (req.query.courseId as string | undefined) || undefined;
    const groupId = (req.query.groupId as string | undefined) || undefined;
    const lessonId = (req.query.lessonId as string | undefined) || undefined;
    const typeParam = req.query.type as string | undefined;
    const type = typeParam && typeParam in MaterialType ? (typeParam as MaterialType) : undefined;
    const q = String(req.query.q || '').trim();

    const filters: Prisma.MaterialWhereInput = {
      courseId,
      groupId,
      lessonId,
      type,
      ...(q ? { OR: [{ title: { contains: q } }, { topic: { contains: q } }, { description: { contains: q } }] } : {}),
    };

    let scope: Prisma.MaterialWhereInput = {};
    if (req.user!.role === Role.STUDENT) scope = await studentMaterialWhere(req.user!.studentId);
    if (req.user!.role === Role.TEACHER) scope = await teacherMaterialWhere(req.user!.teacherId, req.user!.id);

    const materials = await prisma.material.findMany({
      where: { AND: [scope, filters] },
      include: materialInclude,
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    });
    res.json(ok(materials));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findUnique({ where: { id: req.params.id }, include: materialInclude });
    if (!material) throw new AppError('Материал не найден', 404, 'NOT_FOUND');
    await assertCanReadMaterial(req.user!, material.id);
    if (req.user!.role === Role.STUDENT) {
      await logActivity(req.user!.studentId, 'MATERIAL_VIEW', `Открыт материал «${material.title}»`, {
        materialId: material.id,
      });
    }
    res.json(ok(material));
  })
);

const httpUrl = z
  .string()
  .trim()
  .url('Некорректная ссылка')
  .refine((v) => /^https?:\/\//i.test(v), 'Ссылка должна начинаться с http:// или https://');

const fileInput = z.object({
  url: z.string().startsWith('/uploads/private/materials/', 'Файл должен быть загружен через форму'),
  originalName: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(120),
});

const materialSchema = z.object({
  courseId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  title: z.string().trim().min(1, 'Укажите название').max(200),
  description: z.string().max(5000).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  type: z.nativeEnum(MaterialType).optional(),
  linkUrl: httpUrl.optional().nullable().or(z.literal('')),
  videoUrl: httpUrl.optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().optional(),
  files: z.array(fileInput).max(10).optional(),
});

async function resolveTargets(
  user: Express.Request['user'],
  body: { groupId?: string | null; courseId?: string | null; lessonId?: string | null }
) {
  let courseId = body.courseId || null;
  const groupId = body.groupId || null;
  if (user!.role === Role.TEACHER && !groupId) {
    throw new AppError('Выберите группу — преподаватель добавляет материалы только для своих групп', 400, 'GROUP_REQUIRED');
  }
  if (groupId) {
    const group =
      user!.role === Role.TEACHER
        ? await assertTeacherOwnsGroup(user!.teacherId, groupId)
        : await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    courseId = group.courseId;
  }
  if (!courseId) throw new AppError('Укажите курс или группу', 400, 'COURSE_REQUIRED');
  if (body.lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: body.lessonId }, include: { group: true } });
    if (!lesson || (groupId ? lesson.groupId !== groupId : lesson.group.courseId !== courseId)) {
      throw new AppError('Занятие не относится к выбранной группе', 400, 'LESSON_MISMATCH');
    }
  }
  return { courseId, groupId, lessonId: body.lessonId || null };
}

async function notifyAboutMaterial(material: { id: string; title: string; groupId: string | null; courseId: string | null }) {
  let userIds: string[] = [];
  if (material.groupId) userIds = await getGroupStudentUserIds(material.groupId);
  else if (material.courseId) {
    const groups = await prisma.group.findMany({ where: { courseId: material.courseId }, select: { id: true } });
    for (const g of groups) userIds.push(...(await getGroupStudentUserIds(g.id)));
  }
  await notifyUsers(userIds, 'MATERIAL', 'Новый материал', material.title, `/student/materials/${material.id}`);
}

function inferType(body: { type?: MaterialType; videoUrl?: string | null; linkUrl?: string | null; files?: unknown[] }) {
  if (body.type) return body.type;
  if (body.videoUrl) return MaterialType.VIDEO;
  if (body.files?.length) return MaterialType.PDF;
  if (body.linkUrl) return MaterialType.LINK;
  return MaterialType.NOTE;
}

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = materialSchema.parse(req.body);
    const targets = await resolveTargets(req.user, body);
    const files = body.files ?? [];

    const material = await prisma.material.create({
      data: {
        ...targets,
        title: body.title,
        description: body.description,
        topic: body.topic,
        type: inferType(body),
        linkUrl: body.linkUrl || null,
        videoUrl: body.videoUrl || null,
        sortOrder: body.sortOrder,
        fileUrl: files[0]?.url ?? null,
        fileName: files[0]?.originalName ?? null,
        authorId: req.user!.id,
        files: { create: files },
      },
      include: materialInclude,
    });

    await notifyAboutMaterial(material);
    await audit(req.user!.id, 'CREATE', 'Material', material.id);
    res.status(201).json(ok(material));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = materialSchema
      .partial()
      .extend({ removeFileIds: z.array(z.string()).optional() })
      .parse(req.body);
    const existing = await prisma.material.findUnique({ where: { id: req.params.id }, include: { files: true } });
    if (!existing) throw new AppError('Материал не найден', 404, 'NOT_FOUND');
    await assertCanEditMaterial(req.user!, existing);

    const retarget = body.groupId !== undefined || body.courseId !== undefined || body.lessonId !== undefined;
    const targets = retarget
      ? await resolveTargets(req.user, {
          groupId: body.groupId === undefined ? existing.groupId : body.groupId,
          courseId: body.courseId === undefined ? existing.courseId : body.courseId,
          lessonId: body.lessonId === undefined ? existing.lessonId : body.lessonId,
        })
      : {};

    const toRemove = existing.files.filter((f) => body.removeFileIds?.includes(f.id));
    const { files, removeFileIds: _r, groupId: _g, courseId: _c, lessonId: _l, linkUrl, videoUrl, ...rest } = body;

    const material = await prisma.$transaction(async (tx) => {
      if (toRemove.length) await tx.materialFile.deleteMany({ where: { id: { in: toRemove.map((f) => f.id) } } });
      if (files?.length) await tx.materialFile.createMany({ data: files.map((f) => ({ ...f, materialId: existing.id })) });
      const first = await tx.materialFile.findFirst({ where: { materialId: existing.id }, orderBy: { createdAt: 'asc' } });
      return tx.material.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...targets,
          linkUrl: linkUrl === undefined ? undefined : linkUrl || null,
          videoUrl: videoUrl === undefined ? undefined : videoUrl || null,
          fileUrl: first?.url ?? (existing.files.length ? null : existing.fileUrl),
          fileName: first?.originalName ?? (existing.files.length ? null : existing.fileName),
        },
        include: materialInclude,
      });
    });
    await Promise.all(toRemove.map((f) => deleteUploadUrl(f.url)));

    await audit(req.user!.id, 'UPDATE', 'Material', material.id);
    res.json(ok(material));
  })
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id }, include: { files: true } });
    if (!existing) throw new AppError('Материал не найден', 404, 'NOT_FOUND');
    await assertCanEditMaterial(req.user!, existing);
    await prisma.material.delete({ where: { id: existing.id } });
    const urls = new Set([...existing.files.map((f) => f.url), existing.fileUrl].filter(Boolean) as string[]);
    await Promise.all([...urls].filter((u) => u.startsWith('/uploads/private/')).map((u) => deleteUploadUrl(u)));
    await audit(req.user!.id, 'DELETE', 'Material', existing.id);
    res.json(ok({ success: true }));
  })
);

export default router;
