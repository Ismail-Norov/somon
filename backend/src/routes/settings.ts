import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSettings, saveSettings, SETTING_KEYS, type SettingKey } from '../lib/settings';
import { audit } from '../services/notifications';

const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));

const settingsSchema = z.object(
  Object.fromEntries(SETTING_KEYS.map((k) => [k, z.string().max(2000).optional()])) as Record<
    SettingKey,
    z.ZodOptional<z.ZodString>
  >
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(ok(await getSettings()));
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const settings = await saveSettings(body);
    await audit(req.user!.id, 'UPDATE', 'SiteSetting', undefined, Object.keys(body));
    res.json(ok(settings));
  })
);

export default router;
