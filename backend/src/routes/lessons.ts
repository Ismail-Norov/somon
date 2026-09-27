import { Router } from 'express';
import { z } from 'zod';
import { LearningFormat, LessonStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { lessonCardInclude, publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthUser } from '../middleware/auth';
import { assertStudentInGroup, assertTeacherOwnsGroup, checkScheduleConflict, lessonsOfTeacherWhere } from '../services/access';
import { audit, getGroupStudentUserIds, notifyUsers } from '../services/notifications';
import { formatDateTime, formatTime } from '../lib/time';

const router = Router();
router.use(requireAuth);

const listInclude = {
  ...lessonCardInclude,
  _count: { select: { attendance: true, materials: true } },
} satisfies Prisma.LessonInclude;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (k: string) => (typeof req.query[k] === 'string' && req.query[k] ? String(req.query[k]) : undefined);
    const from = q('from') ? new Date(q('from')!) : undefined;
    const to = q('to') ? new Date(q('to')!) : undefined;
    const format = q('format') && q('format')! in LearningFormat ? (q('format') as LearningFormat) : undefined;
    const status = q('status') && q('status')! in LessonStatus ? (q('status') as LessonStatus) : undefined;

    const and: Prisma.LessonWhereInput[] = [];
    if (req.user!.role === Role.TEACHER) {
      and.push({ OR: [{ teacherId: req.user!.teacherId }, { group: { teacherId: req.user!.teacherId } }] });
    } else if (req.user!.role === Role.STUDENT) {
      and.push({ group: { groupStudents: { some: { studentId: req.user!.studentId, status: 'ACTIVE' } } } });
    }
    if (q('groupId')) and.push({ groupId: q('groupId') });
    if (q('courseId')) and.push({ group: { courseId: q('courseId') } });
    if (q('teacherId')) and.push(lessonsOfTeacherWhere(q('teacherId')!));
    if (q('branchId')) and.push({ branchId: q('branchId') });
    if (q('classroomId')) and.push({ classroomId: q('classroomId') });
    if (format) and.push({ format });
    if (status) and.push({ status });
    if (from || to) and.push({ startsAt: { gte: from, lte: to } });

    const lessons = await prisma.lesson.findMany({
      where: { AND: and },
      include: listInclude,
      orderBy: { startsAt: 'asc' },
      take: 2000,
    });
    res.json(ok(lessons));
  })
);

async function assertCanSeeLesson(user: AuthUser, lesson: { groupId: string; teacherId: string | null; group: { teacherId: string | null } }) {
  if (user.role === Role.ADMIN) return;
  if (user.role === Role.TEACHER) {
    if (lesson.group.teacherId === user.teacherId || lesson.teacherId === user.teacherId) return;
    throw new AppError('Нет доступа к этому занятию', 403, 'FORBIDDEN');
  }
  await assertStudentInGroup(user.studentId, lesson.groupId);
}

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        group: {
          include: {
            course: { select: { id: true, title: true } },
            teacher: { include: { user: { select: publicUserSelect } } },
            groupStudents: {
              where: { status: 'ACTIVE' },
              include: { student: { include: { user: { select: publicUserSelect } } } },
              orderBy: { student: { user: { lastName: 'asc' } } },
            },
          },
        },
        teacher: { include: { user: { select: publicUserSelect } } },
        branch: { select: { id: true, name: true, address: true, phone: true } },
        classroom: { select: { id: true, name: true, capacity: true } },
        attendance: true,
        materials: {
          select: { id: true, title: true, type: true, videoUrl: true, linkUrl: true, files: { select: { id: true, originalName: true, size: true, mimeType: true } } },
          orderBy: { publishedAt: 'desc' },
        },
        assignments: {
          select: { id: true, title: true, deadline: true, status: true, publishAt: true, maxScore: true },
          orderBy: { deadline: 'asc' },
        },
      },
    });
    if (!lesson) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');
    await assertCanSeeLesson(req.user!, lesson);

    if (req.user!.role === Role.STUDENT) {
      const now = new Date();
      return res.json(
        ok({
          ...lesson,
          group: { ...lesson.group, groupStudents: [] },
          attendance: lesson.attendance.filter((a) => a.studentId === req.user!.studentId),
          assignments: lesson.assignments.filter((a) => a.status !== 'DRAFT' && (!a.publishAt || a.publishAt <= now)),
        })
      );
    }
    res.json(ok(lesson));
  })
);

const httpUrl = z
  .string()
  .trim()
  .url('Некорректная ссылка')
  .refine((v) => /^https?:\/\//i.test(v), 'Ссылка должна начинаться с http:// или https://');

const lessonSchema = z.object({
  groupId: z.string(),
  title: z.string().trim().min(1, 'Укажите тему занятия').max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  format: z.nativeEnum(LearningFormat).optional(),
  teacherId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  classroomId: z.string().optional().nullable(),
  room: z.string().max(60).optional().nullable(),
  meetingUrl: httpUrl.optional().nullable().or(z.literal('')),
  comment: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(LessonStatus).optional(),
});

type PlaceInput = {
  format: LearningFormat;
  branchId: string | null;
  classroomId: string | null;
  room: string | null;
  meetingUrl: string | null;
};

/** Normalises the lesson location: classroom implies its branch, online lessons have no room, offline ones no link. */
async function resolvePlace(input: PlaceInput, opts: { requirePlace: boolean; allowInactive: boolean }) {
  let { branchId, classroomId, room, meetingUrl } = input;
  if (input.format === 'ONLINE') {
    branchId = null;
    classroomId = null;
    room = null;
  }
  if (input.format === 'OFFLINE') meetingUrl = null;

  if (classroomId) {
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) throw new AppError('Аудитория не найдена', 400, 'CLASSROOM_NOT_FOUND');
    if (branchId && classroom.branchId !== branchId) {
      throw new AppError('Аудитория не относится к выбранному филиалу', 400, 'CLASSROOM_MISMATCH');
    }
    branchId = classroom.branchId;
    room = classroom.name;
  }
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new AppError('Филиал не найден', 400, 'BRANCH_NOT_FOUND');
    if (!branch.isActive && !opts.allowInactive) throw new AppError('Филиал неактивен', 400, 'BRANCH_INACTIVE');
  }
  if (opts.requirePlace && input.format === 'OFFLINE' && !branchId) {
    throw new AppError('Для офлайн-занятия выберите филиал', 400, 'BRANCH_REQUIRED');
  }
  return { branchId, classroomId, room, meetingUrl };
}

async function resolveTeacher(user: AuthUser, requested: string | null | undefined) {
  if (!requested) return null;
  if (user.role !== Role.ADMIN) {
    throw new AppError('Назначать другого преподавателя может только администратор', 403, 'FORBIDDEN');
  }
  const teacher = await prisma.teacher.findUnique({ where: { id: requested } });
  if (!teacher) throw new AppError('Преподаватель не найден', 400, 'TEACHER_NOT_FOUND');
  return teacher.id;
}

async function teacherUserId(teacherId: string | null | undefined) {
  if (!teacherId) return null;
  const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { userId: true } });
  return t?.userId ?? null;
}

function placeText(l: { format: LearningFormat; room: string | null; meetingUrl: string | null }, branchName?: string | null) {
  if (l.format === 'ONLINE') return 'онлайн';
  const where = [branchName, l.room].filter(Boolean).join(', ');
  return l.format === 'HYBRID' ? `смешанный формат${where ? ` · ${where}` : ''}` : where || 'офлайн';
}

/** Notifies the group's students and the conducting teacher, each with a link to their own schedule. */
async function notifyLessonAudience(
  lesson: { id: string; groupId: string },
  teacherIds: (string | null | undefined)[],
  type: string,
  title: string,
  body: string
) {
  const studentIds = await getGroupStudentUserIds(lesson.groupId);
  await notifyUsers(studentIds, type, title, body, `/student/schedule?lessonId=${lesson.id}`);
  const teacherUsers = (await Promise.all([...new Set(teacherIds.filter(Boolean))].map((id) => teacherUserId(id)))).filter(Boolean) as string[];
  await notifyUsers(teacherUsers, type, title, body, `/teacher/schedule?lessonId=${lesson.id}`);
}

router.post(
  '/',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = lessonSchema.extend({ repeatWeeks: z.number().int().min(1).max(26).optional() }).parse(req.body);
    const group = await prisma.group.findUnique({ where: { id: body.groupId }, include: { course: { select: { title: true } } } });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);

    const teacherId = await resolveTeacher(req.user!, body.teacherId);
    const format = body.format ?? group.format;
    const place = await resolvePlace(
      {
        format,
        branchId: body.branchId ?? null,
        classroomId: body.classroomId ?? null,
        room: body.room ?? null,
        meetingUrl: body.meetingUrl || null,
      },
      { requirePlace: true, allowInactive: false }
    );

    const firstStart = new Date(body.startsAt);
    const duration = new Date(body.endsAt).getTime() - firstStart.getTime();
    const weeks = body.repeatWeeks ?? 1;
    const slots = Array.from({ length: weeks }, (_, i) => {
      const startsAt = new Date(firstStart.getTime() + i * 7 * 86400000);
      return { startsAt, endsAt: new Date(startsAt.getTime() + duration) };
    });
    for (const slot of slots) {
      await checkScheduleConflict({
        groupId: group.id,
        teacherId: teacherId ?? group.teacherId,
        classroomId: place.classroomId,
        ...slot,
      });
    }

    const created = await prisma.$transaction(
      slots.map((slot) =>
        prisma.lesson.create({
          data: {
            groupId: group.id,
            teacherId,
            title: body.title,
            ...slot,
            format,
            ...place,
            comment: body.comment || null,
            status: body.status,
          },
          include: listInclude,
        })
      )
    );

    const first = created[0];
    if (first.status !== 'CANCELLED' && first.endsAt > new Date()) {
      const when = `${formatDateTime(first.startsAt)}–${formatTime(first.endsAt)}`;
      await notifyLessonAudience(
        first,
        [teacherId ?? group.teacherId],
        'LESSON',
        created.length > 1 ? `Новые занятия: ${group.course.title}` : `Новое занятие: ${group.course.title}`,
        created.length > 1
          ? `«${first.title}» · ${group.code} · еженедельно, ${created.length} занятий, первое ${when}`
          : `«${first.title}» · ${group.code} · ${when} · ${placeText(first, first.branch?.name)}`
      );
    }

    await audit(req.user!.id, 'CREATE', 'Lesson', first.id, { count: created.length });
    res.status(201).json(ok(created.length > 1 ? { lesson: first, lessons: created, count: created.length } : first));
  })
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const body = lessonSchema
      .partial()
      .extend({ cancelReason: z.string().max(500).optional().nullable() })
      .parse(req.body);
    const existing = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: { group: true, branch: { select: { name: true } } },
    });
    if (!existing) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');

    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
      if (body.groupId && body.groupId !== existing.groupId) await assertTeacherOwnsGroup(req.user!.teacherId, body.groupId);
    }

    const groupId = body.groupId || existing.groupId;
    const group = groupId === existing.groupId ? existing.group : await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    const teacherId = body.teacherId === undefined ? existing.teacherId : await resolveTeacher(req.user!, body.teacherId);
    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : existing.endsAt;
    const status = body.status ?? existing.status;
    const format = body.format ?? existing.format;
    const placeTouched = ['format', 'branchId', 'classroomId', 'room', 'meetingUrl'].some((k) => k in body);
    const place = placeTouched
      ? await resolvePlace(
          {
            format,
            branchId: body.branchId === undefined ? existing.branchId : body.branchId,
            classroomId: body.classroomId === undefined ? existing.classroomId : body.classroomId,
            room: body.room === undefined ? existing.room : body.room,
            meetingUrl: body.meetingUrl === undefined ? existing.meetingUrl : body.meetingUrl || null,
          },
          { requirePlace: true, allowInactive: true }
        )
      : { branchId: existing.branchId, classroomId: existing.classroomId, room: existing.room, meetingUrl: existing.meetingUrl };

    const timeChanged = startsAt.getTime() !== existing.startsAt.getTime() || endsAt.getTime() !== existing.endsAt.getTime();
    const effectiveTeacher = teacherId ?? group.teacherId;
    const prevTeacher = existing.teacherId ?? existing.group.teacherId;
    if (status !== 'CANCELLED' && (timeChanged || groupId !== existing.groupId || effectiveTeacher !== prevTeacher || place.classroomId !== existing.classroomId || existing.status === 'CANCELLED')) {
      await checkScheduleConflict({ groupId, teacherId: effectiveTeacher, classroomId: place.classroomId, startsAt, endsAt, excludeLessonId: existing.id });
    }

    const lesson = await prisma.lesson.update({
      where: { id: existing.id },
      data: {
        groupId,
        teacherId,
        title: body.title,
        startsAt,
        endsAt,
        format,
        ...place,
        comment: body.comment === undefined ? undefined : body.comment || null,
        status,
        reminderSentAt: timeChanged || (existing.status === 'CANCELLED' && status === 'SCHEDULED') ? null : undefined,
      },
      include: listInclude,
    });

    const relevant = lesson.endsAt > new Date() || existing.endsAt > new Date();
    if (relevant) {
      const heading = `«${lesson.title}» · ${group.code}`;
      const teachers = [effectiveTeacher, prevTeacher];
      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        await notifyLessonAudience(
          lesson,
          teachers,
          'SCHEDULE',
          'Занятие отменено',
          `${heading} · ${formatDateTime(existing.startsAt)}${body.cancelReason ? ` · Причина: ${body.cancelReason}` : ''}`
        );
      } else if (existing.status === 'CANCELLED' && status === 'SCHEDULED') {
        await notifyLessonAudience(lesson, teachers, 'SCHEDULE', 'Занятие восстановлено', `${heading} · ${formatDateTime(startsAt)}`);
      } else if (status !== 'CANCELLED') {
        const placeChanged =
          place.branchId !== existing.branchId || place.classroomId !== existing.classroomId || place.meetingUrl !== existing.meetingUrl || format !== existing.format;
        if (timeChanged) {
          await notifyLessonAudience(
            lesson,
            teachers,
            'SCHEDULE',
            'Занятие перенесено',
            `${heading}: с ${formatDateTime(existing.startsAt)} на ${formatDateTime(startsAt)}–${formatTime(endsAt)}`
          );
        } else if (placeChanged) {
          await notifyLessonAudience(lesson, teachers, 'SCHEDULE', 'Изменилось место занятия', `${heading} · ${formatDateTime(startsAt)} · ${placeText(lesson, lesson.branch?.name)}`);
        }
        if (effectiveTeacher !== prevTeacher) {
          const newUser = await teacherUserId(effectiveTeacher);
          if (newUser) {
            await notifyUsers([newUser], 'SCHEDULE', 'Вам назначено занятие', `${heading} · ${formatDateTime(startsAt)}`, `/teacher/schedule?lessonId=${lesson.id}`);
          }
        }
      }
    }

    await audit(req.user!.id, 'UPDATE', 'Lesson', lesson.id, body);
    res.json(ok(lesson));
  })
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const existing = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: { group: true, _count: { select: { attendance: true, grades: true } } },
    });
    if (!existing) throw new AppError('Занятие не найдено', 404, 'NOT_FOUND');
    if (req.user!.role === Role.TEACHER) await assertTeacherOwnsGroup(req.user!.teacherId, existing.groupId);
    if (existing._count.attendance > 0 || existing._count.grades > 0) {
      throw new AppError('По занятию уже есть посещаемость или оценки — отмените его вместо удаления', 409, 'LESSON_HAS_DATA');
    }
    await prisma.lesson.delete({ where: { id: existing.id } });
    if (existing.status !== 'CANCELLED' && existing.startsAt > new Date()) {
      const studentIds = await getGroupStudentUserIds(existing.groupId);
      await notifyUsers(studentIds, 'SCHEDULE', 'Занятие удалено из расписания', `«${existing.title}» · ${existing.group.code} · ${formatDateTime(existing.startsAt)}`, '/student/schedule');
    }
    await audit(req.user!.id, 'DELETE', 'Lesson', existing.id);
    res.json(ok({ success: true }));
  })
);

export default router;
