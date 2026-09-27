import { Router } from 'express';
import { z } from 'zod';
import { MaterialType, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertTeacherOwnsGroup } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUsers } from '../services/notifications';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId as string | undefined;
    const groupId = req.query.groupId as string | undefined;

    if (req.user!.role === Role.STUDENT) {
      const links = await prisma.groupStudent.findMany({
        where: { studentId: req.user!.studentId, status: 'ACTIVE' },
        include: { group: true },
      });
      const courseIds = [...new Set(links.map((l) => l.group.courseId))];
      const materials = await prisma.material.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      });
      return res.json(ok(materials));
    }

    if (req.user!.role === Role.TEACHER) {
      const groups = await prisma.group.findMany({
        where: { teacherId: req.user!.teacherId },
      });
      const courseIds = [...new Set(groups.map((g) => g.courseId))];
      const materials = await prisma.material.findMany({
        where: {
          courseId: courseId ? courseId : { in: courseIds },
        },
        orderBy: { publishedAt: 'desc' },
      });
      return res.json(ok(materials));
    }

    const materials = await prisma.material.findMany({
      where: { courseId, groupId },
      orderBy: { publishedAt: 'desc' },
    });
    res.json(ok(materials));
  })
);

const materialSchema = z.object({
  courseId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  topic: z.string().optional().nullable(),
  type: z.nativeEnum(MaterialType).optional(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = materialSchema.parse(req.body);
    if (req.user!.role === Role.TEACHER && body.groupId) {
      await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    }

    const material = await prisma.material.create({
      data: {
        ...body,
        authorId: req.user!.id,
      },
    });

    if (body.groupId) {
      const userIds = await getGroupStudentUserIds(body.groupId);
      await notifyUsers(userIds, 'MATERIAL', 'Новый материал', material.title);
    } else if (body.courseId) {
      const groups = await prisma.group.findMany({ where: { courseId: body.courseId } });
      const allIds: string[] = [];
      for (const g of groups) {
        allIds.push(...(await getGroupStudentUserIds(g.id)));
      }
      await notifyUsers([...new Set(allIds)], 'MATERIAL', 'Новый материал', material.title);
    }

    await audit(req.user!.id, 'CREATE', 'Material', material.id);
    res.status(201).json(ok(material));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = materialSchema.partial().parse(req.body);
    const material = await prisma.material.update({ where: { id: req.params.id }, data: body });
    await audit(req.user!.id, 'UPDATE', 'Material', material.id);
    res.json(ok(material));
  })
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    await prisma.material.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'DELETE', 'Material', req.params.id);
    res.json(ok({ success: true }));
  })
);

export default router;
