import { Router } from 'express';
import { Role } from '@prisma/client';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { createUploader, EXTENSION_SETS, handleUpload, MAX_FILE_MB } from '../lib/uploads';

const router = Router();
router.use(requireAuth);

const generalUploader = createUploader({ dir: 'files', extensions: EXTENSION_SETS.general });
const assignmentUploader = createUploader({ dir: 'private/assignments', extensions: EXTENSION_SETS.assignment });
const materialUploader = createUploader({ dir: 'private/materials', extensions: EXTENSION_SETS.material, maxFiles: 10 });
const publicUploader = createUploader({
  dir: 'public',
  extensions: [...EXTENSION_SETS.image, '.pdf', '.docx', '.pptx', '.xlsx', '.zip'],
});

function firstFile(req: Express.Request) {
  const file = req.storedFiles?.[0];
  if (!file) throw new AppError('Файл не загружен', 400, 'NO_FILE');
  return { url: file.url, fileUrl: file.url, fileName: file.originalName, size: file.size, mimeType: file.mimeType };
}

router.get(
  '/rules',
  asyncHandler(async (_req, res) => {
    const describe = (list: readonly string[]) => ({
      extensions: list.map((e) => e.slice(1).toUpperCase()),
      accept: list.join(','),
      maxFileMb: MAX_FILE_MB,
    });
    res.json(
      ok({
        submission: { ...describe(EXTENSION_SETS.submission), maxFiles: 5 },
        assignment: describe(EXTENSION_SETS.assignment),
        material: { ...describe(EXTENSION_SETS.material), maxFiles: 10 },
        image: describe(EXTENSION_SETS.image),
      })
    );
  })
);

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  handleUpload(generalUploader, { single: 'file' }),
  asyncHandler(async (req, res) => {
    res.status(201).json(ok(firstFile(req)));
  })
);

/** Instruction file attached to an assignment by the teacher (served via /api/files/assignment/:id). */
router.post(
  '/assignment',
  requireRole(Role.ADMIN, Role.TEACHER),
  handleUpload(assignmentUploader, { single: 'file' }),
  asyncHandler(async (req, res) => {
    res.status(201).json(ok(firstFile(req)));
  })
);

router.post(
  '/material',
  requireRole(Role.ADMIN, Role.TEACHER),
  handleUpload(materialUploader, { array: 'files', max: 10 }),
  asyncHandler(async (req, res) => {
    const files = (req.storedFiles ?? []).map((f) => ({
      url: f.url,
      fileUrl: f.url,
      fileName: f.originalName,
      originalName: f.originalName,
      size: f.size,
      mimeType: f.mimeType,
    }));
    if (!files.length) throw new AppError('Файл не загружен', 400, 'NO_FILE');
    res.status(201).json(ok({ ...files[0], files }));
  })
);

/** Files for the public site (news images, open materials). */
router.post(
  '/public',
  requireRole(Role.ADMIN),
  handleUpload(publicUploader, { single: 'file' }),
  asyncHandler(async (req, res) => {
    res.status(201).json(ok(firstFile(req)));
  })
);

export default router;
