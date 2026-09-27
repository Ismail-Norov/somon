import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for photo uploads
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads', 'photos');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.user!.id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Разрешены только изображения (JPG, PNG, GIF)', 400, 'INVALID_FILE_TYPE') as unknown as Error);
    }
  },
});

router.use(requireAuth);

router.get(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const role = req.query.role as Role | undefined;
    const status = req.query.status as UserStatus | undefined;

    const users = await prisma.user.findMany({
      where: {
        role: role || undefined,
        status: status || undefined,
        OR: q
          ? [
              { email: { contains: q } },
              { firstName: { contains: q } },
              { lastName: { contains: q } },
            ]
          : undefined,
      },
      include: { student: true, teacher: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      ok(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          studentId: u.student?.id,
          teacherId: u.teacher?.id,
        }))
      )
    );
  })
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  specialization: z.string().optional(),
});

router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const email = body.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError('Email уже занят', 409, 'EMAIL_TAKEN');
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        student:
          body.role === Role.STUDENT ? { create: { phone: body.phone } } : undefined,
        teacher:
          body.role === Role.TEACHER
            ? { create: { specialization: body.specialization } }
            : undefined,
      },
    });
    await audit(req.user!.id, 'CREATE', 'User', user.id);
    res.status(201).json(ok(user));
  })
);

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(Role).optional(),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  password: z.string().min(6).optional(),
});

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = patchSchema.parse(req.body);
    const id = req.params.id;
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { student: true, teacher: true },
    });
    if (!existing) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    if (id === req.user!.id && ((body.status && body.status !== 'ACTIVE') || (body.role && body.role !== Role.ADMIN))) {
      throw new AppError('Нельзя заблокировать себя или снять с себя роль администратора', 400, 'SELF_LOCKOUT');
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        status: body.status,
        role: body.role,
        passwordHash,
      },
    });

    if (body.role === Role.STUDENT && !existing.student) {
      await prisma.student.create({ data: { userId: id, phone: body.phone } });
    }
    if (body.role === Role.TEACHER && !existing.teacher) {
      await prisma.teacher.create({ data: { userId: id, specialization: body.specialization } });
    }

    if (existing.student && body.phone !== undefined) {
      await prisma.student.update({ where: { id: existing.student.id }, data: { phone: body.phone } });
    }
    if (existing.teacher && body.specialization !== undefined) {
      await prisma.teacher.update({
        where: { id: existing.teacher.id },
        data: { specialization: body.specialization },
      });
    }

    await audit(req.user!.id, 'UPDATE', 'User', id, body);
    res.json(ok(user));
  })
);

router.patch(
  '/:id/archive',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      throw new AppError('Нельзя архивировать собственный аккаунт', 400, 'SELF_LOCKOUT');
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: UserStatus.ARCHIVED },
    });
    await audit(req.user!.id, 'ARCHIVE', 'User', user.id);
    res.json(ok(user));
  })
);

router.get(
  '/me/profile',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { student: true, teacher: true },
    });
    res.json(ok(user));
  })
);

const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
});

router.patch(
  '/me/profile',
  asyncHandler(async (req, res) => {
    const body = profileSchema.parse(req.body);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName: body.firstName, lastName: body.lastName },
    });
    if (req.user!.studentId && body.phone !== undefined) {
      await prisma.student.update({
        where: { id: req.user!.studentId },
        data: { phone: body.phone },
      });
    }
    if (req.user!.teacherId) {
      await prisma.teacher.update({
        where: { id: req.user!.teacherId },
        data: { specialization: body.specialization, bio: body.bio },
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { student: true, teacher: true },
    });
    res.json(ok(user));
  })
);

// Upload user photo
router.post(
  '/me/photo',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Файл не загружен', 400, 'NO_FILE');
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    // Delete old photo if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { photoUrl: true },
    });

    if (currentUser?.photoUrl) {
      const oldPath = path.resolve(process.env.UPLOAD_DIR || 'uploads', currentUser.photoUrl.replace('/uploads/', ''));
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    }

    // Update user with new photo URL
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { photoUrl },
      select: { photoUrl: true },
    });

    res.json(ok({ photoUrl: updatedUser.photoUrl }));
  })
);

// Delete user photo
router.delete(
  '/me/photo',
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { photoUrl: true },
    });

    if (currentUser?.photoUrl) {
      const oldPath = path.resolve(process.env.UPLOAD_DIR || 'uploads', currentUser.photoUrl.replace('/uploads/', ''));
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        // Ignore if file doesn't exist
      }

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { photoUrl: null },
      });
    }

    res.json(ok({ success: true }));
  })
);

export default router;
