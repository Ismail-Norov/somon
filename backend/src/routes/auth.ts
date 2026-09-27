import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from '../middleware/auth';
import { audit } from '../services/notifications';

const router = Router();

const userTeacherSelect = { id: true, specialization: true, bio: true, position: true, phone: true } as const;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().optional(),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        photoUrl: true,
        createdAt: true,
        passwordHash: true,
        student: { select: { id: true, phone: true } },
        teacher: { select: userTeacherSelect },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Неверный email или пароль', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new AppError('Неверный email или пароль', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(res, token);

    res.json(
      ok({
        token,
        user: serializeUser(user),
      })
    );
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError('Пользователь с таким email уже существует', 409, 'EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: Role.STUDENT,
        student: { create: { phone: body.phone } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        photoUrl: true,
        createdAt: true,
        student: { select: { id: true, phone: true } },
        teacher: { select: userTeacherSelect },
      },
    });

    await audit(user.id, 'REGISTER', 'User', user.id);
    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(res, token);
    res.status(201).json(ok({ token, user: serializeUser(user) }));
  })
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    res.json(ok({ success: true }));
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        photoUrl: true,
        createdAt: true,
        student: { select: { id: true, phone: true } },
        teacher: { select: userTeacherSelect },
      },
    });
    if (!user) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    res.json(ok({ user: serializeUser(user) }));
  })
);

function serializeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  photoUrl: string | null;
  createdAt: Date;
  student?: { id: string; phone: string | null } | null;
  teacher?: {
    id: string;
    specialization: string | null;
    bio: string | null;
    position: string | null;
    phone: string | null;
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt,
    studentId: user.student?.id ?? null,
    teacherId: user.teacher?.id ?? null,
    phone: user.student?.phone ?? user.teacher?.phone ?? null,
    specialization: user.teacher?.specialization ?? null,
    position: user.teacher?.position ?? null,
    bio: user.teacher?.bio ?? null,
  };
}

export default router;
