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
      include: {
        student: {
          include: {
            groupStudents: {
              where: { status: 'ACTIVE' },
              select: { group: { select: { id: true, code: true, course: { select: { id: true, title: true } } } } },
            },
          },
        },
        teacher: true,
      },
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
          phone: u.student?.phone ?? u.teacher?.phone ?? null,          studentId: u.student?.id,
          teacherId: u.teacher?.id,
          groups: u.student?.groupStudents.map((gs) => gs.group) ?? [],
        }))
      )
    );
  })
);

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === '' || /^\+?[\d\s()-]{6,}$/.test(v), 'Некорректный номер телефона');

const teacherFields = {
  specialization: z.string().trim().max(120).optional(),
  position: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  isPublic: z.boolean().optional(),
  courseIds: z.array(z.string()).max(50).optional(),
};

async function validCourseIds(ids?: string[]) {
  if (!ids) return undefined;
  const unique = [...new Set(ids)];
  const found = await prisma.course.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) throw new AppError('Некоторые курсы не найдены', 400, 'COURSE_NOT_FOUND');
  return unique.map((id) => ({ id }));
}

const createSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
  password: z.string().min(6, 'Пароль — минимум 6 символов'),
  firstName: z.string().trim().min(1, 'Укажите имя').max(60),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(60),
  role: z.nativeEnum(Role),
  phone: phoneSchema.optional(),
  ...teacherFields,
});

function teacherData(body: { phone?: string; specialization?: string; position?: string; bio?: string; isPublic?: boolean }) {
  return {
    phone: body.phone === undefined ? undefined : body.phone || null,
    specialization: body.specialization === undefined ? undefined : body.specialization || null,
    position: body.position === undefined ? undefined : body.position || null,
    bio: body.bio === undefined ? undefined : body.bio || null,
    isPublic: body.isPublic,
  };
}

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
    const courses = body.role === Role.TEACHER ? await validCourseIds(body.courseIds) : undefined;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        student:
          body.role === Role.STUDENT ? { create: { phone: body.phone || null } } : undefined,
        teacher:
          body.role === Role.TEACHER
            ? { create: { ...teacherData(body), courses: courses ? { connect: courses } : undefined } }
            : undefined,
      },
      include: { teacher: { select: { id: true } }, student: { select: { id: true } } },
    });
    await audit(req.user!.id, 'CREATE', 'User', user.id);
    res.status(201).json(
      ok({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        teacherId: user.teacher?.id,
        studentId: user.student?.id,
      })
    );
  })
);

const patchSchema = z.object({
  firstName: z.string().trim().min(1, 'Укажите имя').max(60).optional(),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(60).optional(),
  email: z.string().trim().email('Некорректный email').optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(Role).optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(6, 'Пароль — минимум 6 символов').optional(),
  ...teacherFields,
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

    const email = body.email?.toLowerCase();
    if (email && email !== existing.email && (await prisma.user.findUnique({ where: { email } }))) {
      throw new AppError('Email уже занят', 409, 'EMAIL_TAKEN');
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email,
        status: body.status,
        role: body.role,
        passwordHash,
      },
    });

    if (body.role === Role.STUDENT && !existing.student) {
      await prisma.student.create({ data: { userId: id, phone: body.phone || null } });
    }
    const courses = await validCourseIds(body.courseIds);
    if (body.role === Role.TEACHER && !existing.teacher) {
      await prisma.teacher.create({
        data: { userId: id, ...teacherData(body), courses: courses ? { connect: courses } : undefined },
      });
    }

    if (existing.student && body.phone !== undefined) {
      await prisma.student.update({ where: { id: existing.student.id }, data: { phone: body.phone || null } });
    }
    if (existing.teacher) {
      await prisma.teacher.update({
        where: { id: existing.teacher.id },
        data: { ...teacherData(body), courses: courses ? { set: courses } : undefined },
      });
    }

    const { password: _password, ...auditBody } = body;
    await audit(req.user!.id, 'UPDATE', 'User', id, { ...auditBody, passwordChanged: !!body.password });
    res.json(
      ok({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      })
    );
  })
);

/** Hard delete is only allowed for accounts without learning history; otherwise archive. */
router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user!.id) {
      throw new AppError('Нельзя удалить собственный аккаунт', 400, 'SELF_LOCKOUT');
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teacher: { include: { _count: { select: { groups: true, lessons: true, grades: true } } } },
        student: {
          include: {
            _count: { select: { groupStudents: true, submissions: true, grades: true, attendance: true } },
          },
        },
      },
    });
    if (!user) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    const t = user.teacher?._count;
    const s = user.student?._count;
    const hasHistory =
      (t && t.groups + t.lessons + t.grades > 0) ||
      (s && s.groupStudents + s.submissions + s.grades + s.attendance > 0);
    if (hasHistory) {
      throw new AppError(
        'У пользователя есть учебные данные (группы, занятия, оценки). Используйте архивирование.',
        409,
        'USER_HAS_DATA'
      );
    }
    await prisma.user.delete({ where: { id } });
    await removePhoto(user.photoUrl);
    await audit(req.user!.id, 'DELETE', 'User', id, { email: user.email, role: user.role });
    res.json(ok({ success: true }));
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
          courses: { select: { id: true, title: true } },
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

router.patch(
  '/me/password',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        currentPassword: z.string().min(1, 'Введите текущий пароль'),
        newPassword: z.string().min(6, 'Новый пароль — минимум 6 символов').max(100),
      })
      .parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    });
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw new AppError('Текущий пароль указан неверно', 400, 'WRONG_PASSWORD');
    }
    if (body.currentPassword === body.newPassword) {
      throw new AppError('Новый пароль совпадает с текущим', 400, 'SAME_PASSWORD');
    }
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10) },
    });
    await audit(req.user!.id, 'CHANGE_PASSWORD', 'User', req.user!.id);
    res.json(ok({ success: true }));
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

router.get(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const exists = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    const user = await loadProfile(req.params.id);
    const applications = user.student
      ? await prisma.courseApplication.findMany({
          where: { studentId: user.student.id },
          include: { course: { select: { id: true, title: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    res.json(ok({ ...user, applications }));
  })
);

// Admin: set/remove photo of any user (e.g. teacher cards on the public site)
router.post(
  '/:id/photo',
  requireRole(Role.ADMIN),
  handleUpload(photoUploader, { single: 'photo' }),
  asyncHandler(async (req, res) => {
    const file = req.storedFiles?.[0];
    if (!file) throw new AppError('Выберите изображение', 400, 'NO_FILE');
    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { photoUrl: true } });
    if (!current) {
      await deleteUploadUrl(file.url);
      throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { photoUrl: file.url },
      select: { photoUrl: true },
    });
    await removePhoto(current.photoUrl);
    await audit(req.user!.id, 'UPDATE_PHOTO', 'User', req.params.id);
    res.json(ok({ photoUrl: updated.photoUrl }));
  })
);

router.delete(
  '/:id/photo',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { photoUrl: true } });
    if (!current) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    if (current.photoUrl) {
      await prisma.user.update({ where: { id: req.params.id }, data: { photoUrl: null } });
      await removePhoto(current.photoUrl);
    }
    res.json(ok({ success: true }));
  })
);

export default router;
