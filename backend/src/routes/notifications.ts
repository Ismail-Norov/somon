import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        readAt: unreadOnly ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json(ok({ items: notifications, unreadCount }));
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { readAt: new Date() },
    });
    res.json(ok({ updated: n.count }));
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json(ok({ updated: n.count }));
  })
);

export default router;
