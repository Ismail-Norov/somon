import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';

const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));

const newsSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional().nullable(),
  body: z.string().min(1),
  category: z.string().min(1).max(80).optional(),
  imageUrl: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.news.findMany({
      include: { author: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ok(items));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = newsSchema.parse(req.body);
    const item = await prisma.news.create({
      data: {
        ...body,
        authorId: req.user!.id,
        publishedAt: body.isPublished ? new Date() : null,
      },
    });
    await audit(req.user!.id, 'CREATE', 'News', item.id);
    res.status(201).json(ok(item));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = newsSchema.partial().parse(req.body);
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Новость не найдена', 404, 'NOT_FOUND');
    const becomesPublished = body.isPublished === true && !existing.isPublished;
    const item = await prisma.news.update({
      where: { id: existing.id },
      data: {
        ...body,
        publishedAt: becomesPublished ? new Date() : undefined,
      },
    });
    await audit(req.user!.id, 'UPDATE', 'News', item.id, body);
    res.json(ok(item));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.news.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'DELETE', 'News', req.params.id);
    res.json(ok({ success: true }));
  })
);

export default router;
