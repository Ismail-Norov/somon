import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
]);

const ASSIGNMENT_ALLOWED = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.xlsx',
  '.xls',
  '.zip',
  '.rar',
  '.txt',
]);

const MATERIAL_ALLOWED = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.txt',
]);

const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-\u0400-\u04FF]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) {
      return cb(new AppError('Недопустимый тип файла', 400, 'INVALID_FILE_TYPE') as unknown as Error);
    }
    cb(null, true);
  },
});

const assignmentUpload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ASSIGNMENT_ALLOWED.has(ext)) {
      return cb(new AppError('Для заданий разрешены только PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, RAR, TXT', 400, 'INVALID_FILE_TYPE') as unknown as Error);
    }
    cb(null, true);
  },
});

const materialUpload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!MATERIAL_ALLOWED.has(ext)) {
      return cb(new AppError('Для материалов разрешены только PDF, DOC, DOCX, PPT, PPTX, TXT', 400, 'INVALID_FILE_TYPE') as unknown as Error);
    }
    cb(null, true);
  },
});

router.post(
  '/',
  requireAuth,
  requireRole(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Файл не загружен', 400, 'NO_FILE');
    res.status(201).json(
      ok({
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        size: req.file.size,
      })
    );
  })
);

router.post(
  '/assignment',
  requireAuth,
  requireRole(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  assignmentUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Файл не загружен', 400, 'NO_FILE');
    res.status(201).json(
      ok({
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        size: req.file.size,
      })
    );
  })
);

router.post(
  '/material',
  requireAuth,
  requireRole(Role.ADMIN, Role.TEACHER),
  materialUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Файл не загружен', 400, 'NO_FILE');
    res.status(201).json(
      ok({
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        size: req.file.size,
      })
    );
  })
);

export default router;
