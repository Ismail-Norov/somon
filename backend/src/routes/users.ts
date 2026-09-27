import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { audit } from '../services/notifications';
import { createUploader, deleteUploadUrl, EXTENSION_SETS, handleUpload } from '../lib/uploads';
import { publicUserSelect } from '../lib/selects';

const router = Router();

const PHOTO_MAX_MB = 5;
const photoUploader = createUploader({ dir: 'photos', extensions: EXTENSION_SETS.image, maxMb: PHOTO_MAX_MB });

async function removePhoto(url?: string | null) {
  if (url?.startsWith('/uploads/photos/')) await deleteUploadUrl(url);
}

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
          photoUrl: u.photoUrl,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          phone: u.student?.phone ?? u.teacher?.phone ?? null,
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

async function loadProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      student: {
        include: {
          groupStudents: {
            where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
            include: {
              group: {
                select: {
                  id: true,
                  code: true,
                  status: true,
                  format: true,
                  startDate: true,
                  endDate: true,
                  course: { select: { id: true, title: true } },
                  teacher: { select: { id: true, user: { select: publicUserSelect } } },
                },
              },
            },
            orderBy: { joinedAt: 'desc' },
          },
        },
      },
      teacher: {
        include: {
          groups: {
            where: { status: { in: ['PLANNED', 'ENROLLMENT', 'ACTIVE'] } },
            select: {
              id: true,
              code: true,
              status: true,
              course: { select: { id: true, title: true } },
              _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
            },
          },
        },
      },
    },
  });
  return user;
}

router.get(
  '/me/profile',
  asyncHandler(async (req, res) => {
    res.json(ok(await loadProfile(req.user!.id)));
  })
);

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === '' || /^\+?[\d\s()-]{6,}$/.test(v), 'Некорректный номер телефона');

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Укажите имя').max(60).optional(),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(60).optional(),
  phone: phoneSchema.optional(),
  specialization: z.string().trim().max(120).optional(),
  position: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
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
        data: { phone: body.phone || null },
      });
    }
    if (req.user!.teacherId) {
      await prisma.teacher.update({
        where: { id: req.user!.teacherId },
        data: {
          specialization: body.specialization,
          position: body.position,
          bio: body.bio,
          phone: body.phone === undefined ? undefined : body.phone || null,
        },
      });
    }
    res.json(ok(await loadProfile(req.user!.id)));
  })
);

// Upload user photo
router.post(
  '/me/photo',
  handleUpload(photoUploader, { single: 'photo' }),
  asyncHandler(async (req, res) => {
    const file = req.storedFiles?.[0];
    if (!file) throw new AppError('Выберите изображение', 400, 'NO_FILE');

    const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { photoUrl: true } });
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { photoUrl: file.url },
      select: { photoUrl: true },
    });
    await removePhoto(current?.photoUrl);
    res.json(ok({ photoUrl: updated.photoUrl }));
  })
);

router.delete(
  '/me/photo',
  asyncHandler(async (req, res) => {
    const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { photoUrl: true } });
    if (current?.photoUrl) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { photoUrl: null } });
      await removePhoto(current.photoUrl);
    }
    res.json(ok({ success: true }));
  })
);

export default router;
