import { Router, Request } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { sendStoredFile } from '../lib/uploads';
import {
  assertCanReadMaterial,
  assertCanReadSubmission,
  assertStudentInGroup,
  assertTeacherOwnsGroup,
} from '../services/access';
import { logActivity } from '../services/activity';

/**
 * Access-checked file delivery. Private uploads are never served statically.
 * `?download=1` forces "Save as", otherwise PDFs/images open in the browser.
 */
const router = Router();
router.use(requireAuth);

const INLINE_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain']);

function disposition(req: Request, mimeType?: string | null) {
  if (req.query.download === '1') return 'attachment' as const;
  return mimeType && INLINE_MIMES.has(mimeType) ? ('inline' as const) : ('attachment' as const);
}

function mimeFromName(name?: string | null) {
  const ext = (name || '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'txt') return 'text/plain';
  return null;
}

router.get(
  '/submission/:fileId',
  asyncHandler(async (req, res) => {
    const file = await prisma.submissionFile.findUnique({
      where: { id: req.params.fileId },
      include: { attempt: { select: { submissionId: true } } },
    });
    if (!file) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
    await assertCanReadSubmission(req.user!, file.attempt.submissionId);
    sendStoredFile(res, file.url, file.originalName, disposition(req, file.mimeType));
  })
);

/** Legacy single-file submissions (before attempts were introduced). */
router.get(
  '/submission-legacy/:submissionId',
  asyncHandler(async (req, res) => {
    await assertCanReadSubmission(req.user!, req.params.submissionId);
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: req.params.submissionId } });
    if (!submission.fileUrl) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
    const name = submission.fileName || 'file';
    sendStoredFile(res, submission.fileUrl, name, disposition(req, mimeFromName(name)));
  })
);

router.get(
  '/assignment/:assignmentId',
  asyncHandler(async (req, res) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!assignment?.attachmentUrl) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
    if (req.user!.role !== Role.ADMIN) {
      if (!assignment.groupId) throw new AppError('Нет доступа', 403, 'FORBIDDEN');
      if (req.user!.role === Role.TEACHER) await assertTeacherOwnsGroup(req.user!.teacherId, assignment.groupId);
      else {
        await assertStudentInGroup(req.user!.studentId, assignment.groupId);
        if (assignment.status === 'DRAFT') throw new AppError('Нет доступа', 403, 'FORBIDDEN');
      }
    }
    const name = assignment.attachmentName || 'instruction';
    sendStoredFile(res, assignment.attachmentUrl, name, disposition(req, mimeFromName(name)));
  })
);

router.get(
  '/material-file/:fileId',
  asyncHandler(async (req, res) => {
    const file = await prisma.materialFile.findUnique({
      where: { id: req.params.fileId },
      include: { material: { select: { id: true, title: true } } },
    });
    if (!file) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
    await assertCanReadMaterial(req.user!, file.materialId);
    if (req.user!.role === Role.STUDENT && req.query.download === '1') {
      await logActivity(req.user!.studentId, 'MATERIAL_DOWNLOAD', `Скачан материал «${file.material.title}»`, {
        materialId: file.materialId,
      });
    }
    sendStoredFile(res, file.url, file.originalName, disposition(req, file.mimeType));
  })
);

router.get(
  '/material/:materialId',
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
    if (!material?.fileUrl) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
    await assertCanReadMaterial(req.user!, material.id);
    if (req.user!.role === Role.STUDENT && req.query.download === '1') {
      await logActivity(req.user!.studentId, 'MATERIAL_DOWNLOAD', `Скачан материал «${material.title}»`, {
        materialId: material.id,
      });
    }
    const name = material.fileName || material.title;
    sendStoredFile(res, material.fileUrl, name, disposition(req, mimeFromName(name)));
  })
);

export default router;
