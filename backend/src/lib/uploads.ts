import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || 'uploads');
/** Files under here are never served statically; they go through /api/files with an access check. */
export const PRIVATE_ROOT = path.join(UPLOAD_ROOT, 'private');

type FileKind = { mimes: string[]; signature?: (head: Buffer) => boolean };

const startsWith = (bytes: number[]) => (head: Buffer) => bytes.every((b, i) => head[i] === b);
const ZIP = startsWith([0x50, 0x4b, 0x03, 0x04]);
const OLE = startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isText = (head: Buffer) => !head.includes(0);

/** Whitelist: extension -> accepted MIME types + magic-byte check. Anything else is rejected. */
export const FILE_KINDS: Record<string, FileKind> = {
  '.pdf': { mimes: ['application/pdf'], signature: startsWith([0x25, 0x50, 0x44, 0x46]) },
  '.doc': { mimes: ['application/msword'], signature: OLE },
  '.docx': { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], signature: ZIP },
  '.xls': { mimes: ['application/vnd.ms-excel'], signature: OLE },
  '.xlsx': { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], signature: ZIP },
  '.ppt': { mimes: ['application/vnd.ms-powerpoint'], signature: OLE },
  '.pptx': { mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], signature: ZIP },
  '.zip': { mimes: ['application/zip', 'application/x-zip-compressed'], signature: ZIP },
  '.rar': {
    mimes: ['application/vnd.rar', 'application/x-rar-compressed', 'application/x-rar'],
    signature: startsWith([0x52, 0x61, 0x72, 0x21]),
  },
  '.jpg': { mimes: ['image/jpeg', 'image/pjpeg'], signature: startsWith([0xff, 0xd8, 0xff]) },
  '.jpeg': { mimes: ['image/jpeg', 'image/pjpeg'], signature: startsWith([0xff, 0xd8, 0xff]) },
  '.png': { mimes: ['image/png'], signature: startsWith([0x89, 0x50, 0x4e, 0x47]) },
  '.gif': { mimes: ['image/gif'], signature: startsWith([0x47, 0x49, 0x46, 0x38]) },
  '.webp': { mimes: ['image/webp'], signature: (h) => h.subarray(8, 12).toString('ascii') === 'WEBP' },
  '.txt': { mimes: ['text/plain'], signature: isText },
};

// Some browsers / OSes report archives and office files as a generic binary type.
const GENERIC_MIMES = new Set(['application/octet-stream', 'binary/octet-stream']);

export const EXTENSION_SETS = {
  submission: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.txt'],
  assignment: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.txt'],
  material: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.jpg', '.jpeg', '.png', '.txt'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  general: ['.pdf', '.docx', '.pptx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt'],
} as const;

export const MAX_FILE_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);

export type StoredFile = {
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  absPath: string;
};

function decodeOriginalName(name: string) {
  // multer/busboy decodes the header as latin1; restore UTF-8 (Cyrillic) names.
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  const clean = (decoded.includes('\uFFFD') ? name : decoded).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return clean.slice(-180) || 'file';
}

export function createUploader(options: {
  /** Sub-directory under uploads/ (use 'private/...' for access-checked files). */
  dir: string;
  extensions: readonly string[];
  maxMb?: number;
  maxFiles?: number;
}) {
  const dest = path.join(UPLOAD_ROOT, options.dir);
  fs.mkdirSync(dest, { recursive: true });
  const allowed = new Set(options.extensions);
  const maxMb = options.maxMb ?? MAX_FILE_MB;

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dest),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: options.maxFiles ?? 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const kind = FILE_KINDS[ext];
      if (!allowed.has(ext) || !kind) {
        const list = [...allowed].map((e) => e.slice(1).toUpperCase()).join(', ');
        return cb(new AppError(`Недопустимый тип файла. Разрешены: ${list}`, 400, 'INVALID_FILE_TYPE') as unknown as Error);
      }
      if (!kind.mimes.includes(file.mimetype) && !GENERIC_MIMES.has(file.mimetype)) {
        return cb(new AppError('Тип содержимого файла не совпадает с расширением', 400, 'INVALID_MIME') as unknown as Error);
      }
      cb(null, true);
    },
  });
}

async function readHead(absPath: string) {
  const fh = await fsp.open(absPath, 'r');
  try {
    const buf = Buffer.alloc(1024);
    const { bytesRead } = await fh.read(buf, 0, 1024, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Verifies magic bytes of already-saved files; removes all of them if any is invalid. */
export async function verifyUploadedFiles(files: Express.Multer.File[]): Promise<StoredFile[]> {
  const result: StoredFile[] = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    const kind = FILE_KINDS[ext];
    const head = await readHead(file.path);
    if (!kind || (kind.signature && !kind.signature(head))) {
      await removeFiles(files.map((f) => f.path));
      throw new AppError(`Файл «${decodeOriginalName(file.originalname)}» повреждён или не соответствует формату`, 400, 'INVALID_FILE_CONTENT');
    }
    const rel = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
    result.push({
      url: `/uploads/${rel}`,
      originalName: decodeOriginalName(file.originalname),
      size: file.size,
      mimeType: kind.mimes[0],
      absPath: file.path,
    });
  }
  return result;
}

export async function removeFiles(absPaths: string[]) {
  await Promise.all(absPaths.map((p) => fsp.unlink(p).catch(() => undefined)));
}

/** Resolves an /uploads/... URL to an absolute path, refusing anything outside the upload root. */
export function resolveUploadUrl(url: string) {
  if (!url.startsWith('/uploads/')) return null;
  const abs = path.resolve(UPLOAD_ROOT, url.slice('/uploads/'.length));
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return abs;
}

export async function deleteUploadUrl(url?: string | null) {
  if (!url) return;
  const abs = resolveUploadUrl(url);
  if (abs) await fsp.unlink(abs).catch(() => undefined);
}

/** Runs multer, then signature verification, attaching `req.storedFiles`. */
export function handleUpload(
  uploader: multer.Multer,
  mode: { single: string } | { array: string; max: number }
) {
  const mw = 'single' in mode ? uploader.single(mode.single) : uploader.array(mode.array, mode.max);
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, async (err?: unknown) => {
      if (err) return next(err);
      try {
        const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
        req.storedFiles = await verifyUploadedFiles(files);
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}

export function sendStoredFile(res: Response, url: string, originalName: string, disposition: 'inline' | 'attachment') {
  const abs = resolveUploadUrl(url);
  if (!abs || !fs.existsSync(abs)) throw new AppError('Файл не найден', 404, 'FILE_NOT_FOUND');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(originalName)}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
  );
  res.sendFile(abs);
}

declare global {
  namespace Express {
    interface Request {
      storedFiles?: StoredFile[];
    }
  }
}
