import { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { AuthUser } from '../middleware/auth';

export async function assertTeacherOwnsGroup(teacherId: string | undefined, groupId: string) {
  if (!teacherId) throw new AppError('Профиль преподавателя не найден', 403, 'FORBIDDEN');
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');
  if (group.teacherId !== teacherId) {
    throw new AppError('Нет доступа к этой группе', 403, 'FORBIDDEN');
  }
  return group;
}

export async function assertStudentInGroup(studentId: string | undefined, groupId: string) {
  if (!studentId) throw new AppError('Профиль студента не найден', 403, 'FORBIDDEN');
  const link = await prisma.groupStudent.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
  });
  if (!link || link.status !== 'ACTIVE') {
    throw new AppError('Студент не состоит в группе', 403, 'FORBIDDEN');
  }
  return link;
}

export async function activeGroupIdsOfStudent(studentId: string | undefined) {
  if (!studentId) return [];
  const links = await prisma.groupStudent.findMany({
    where: { studentId, status: 'ACTIVE' },
    select: { groupId: true, group: { select: { courseId: true } } },
  });
  return links.map((l) => l.groupId);
}

/** Material visibility for students: materials of their groups, or course-wide ones (no group) of their courses. */
export async function studentMaterialWhere(studentId: string | undefined): Promise<Prisma.MaterialWhereInput> {
  if (!studentId) return { id: '__none__' };
  const links = await prisma.groupStudent.findMany({
    where: { studentId, status: 'ACTIVE' },
    select: { groupId: true, group: { select: { courseId: true } } },
  });
  const groupIds = links.map((l) => l.groupId);
  const courseIds = [...new Set(links.map((l) => l.group.courseId))];
  return {
    OR: [{ groupId: { in: groupIds } }, { groupId: null, courseId: { in: courseIds } }],
  };
}

/** Teachers see materials of their own groups, course-wide materials of courses they teach, and their own. */
export async function teacherMaterialWhere(teacherId: string | undefined, userId: string): Promise<Prisma.MaterialWhereInput> {
  if (!teacherId) return { authorId: userId };
  const groups = await prisma.group.findMany({ where: { teacherId }, select: { id: true, courseId: true } });
  const groupIds = groups.map((g) => g.id);
  const courseIds = [...new Set(groups.map((g) => g.courseId))];
  return {
    OR: [{ groupId: { in: groupIds } }, { groupId: null, courseId: { in: courseIds } }, { authorId: userId }],
  };
}

export async function assertCanReadMaterial(user: AuthUser, materialId: string) {
  if (user.role === Role.ADMIN) return;
  const where =
    user.role === Role.STUDENT
      ? await studentMaterialWhere(user.studentId)
      : await teacherMaterialWhere(user.teacherId, user.id);
  const count = await prisma.material.count({ where: { AND: [{ id: materialId }, where] } });
  if (!count) throw new AppError('Нет доступа к материалу', 403, 'FORBIDDEN');
}

/** Teacher may modify only materials of own groups (or ones they authored). */
export async function assertCanEditMaterial(user: AuthUser, material: { groupId: string | null; authorId: string | null }) {
  if (user.role === Role.ADMIN) return;
  if (user.role !== Role.TEACHER) throw new AppError('Недостаточно прав', 403, 'FORBIDDEN');
  if (material.groupId) {
    await assertTeacherOwnsGroup(user.teacherId, material.groupId);
    return;
  }
  if (material.authorId !== user.id) throw new AppError('Нет доступа к материалу', 403, 'FORBIDDEN');
}

export async function assertCanReadSubmission(user: AuthUser, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { studentId: true, assignment: { select: { groupId: true } } },
  });
  if (!submission) throw new AppError('Работа не найдена', 404, 'NOT_FOUND');
  if (user.role === Role.ADMIN) return submission;
  if (user.role === Role.STUDENT) {
    if (submission.studentId !== user.studentId) throw new AppError('Нет доступа к работе', 403, 'FORBIDDEN');
    return submission;
  }
  if (!submission.assignment.groupId) throw new AppError('Нет доступа к работе', 403, 'FORBIDDEN');
  await assertTeacherOwnsGroup(user.teacherId, submission.assignment.groupId);
  return submission;
}

/** Lessons conducted by the teacher: explicitly assigned, or of their groups when no substitute is set. */
export function lessonsOfTeacherWhere(teacherId: string): Prisma.LessonWhereInput {
  return { OR: [{ teacherId }, { teacherId: null, group: { teacherId } }] };
}

function describeConflict(l: { title: string; startsAt: Date; endsAt: Date; group: { code: string } }) {
  const t = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: process.env.APP_TIMEZONE || undefined });
  const day = l.startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: process.env.APP_TIMEZONE || undefined });
  return `«${l.title}» (${l.group.code}, ${day} ${t(l.startsAt)}–${t(l.endsAt)})`;
}

/** Rejects overlapping lessons of the same group, teacher or classroom. `teacherId` is the teacher who conducts the lesson. */
export async function checkScheduleConflict(params: {
  groupId: string;
  teacherId?: string | null;
  classroomId?: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeLessonId?: string;
}) {
  if (params.endsAt <= params.startsAt) {
    throw new AppError('Время окончания должно быть позже начала', 400, 'INVALID_TIME');
  }
  if (params.endsAt.getTime() - params.startsAt.getTime() > 12 * 3600 * 1000) {
    throw new AppError('Занятие не может длиться дольше 12 часов', 400, 'INVALID_TIME');
  }

  const overlap: Prisma.LessonWhereInput = {
    status: { not: 'CANCELLED' },
    id: params.excludeLessonId ? { not: params.excludeLessonId } : undefined,
    startsAt: { lt: params.endsAt },
    endsAt: { gt: params.startsAt },
  };
  const select = { title: true, startsAt: true, endsAt: true, group: { select: { code: true } } } as const;

  const groupClash = await prisma.lesson.findFirst({ where: { ...overlap, groupId: params.groupId }, select });
  if (groupClash) {
    throw new AppError(`У группы в это время уже есть занятие ${describeConflict(groupClash)}`, 409, 'SCHEDULE_CONFLICT');
  }

  if (params.teacherId) {
    const teacherClash = await prisma.lesson.findFirst({ where: { AND: [overlap, lessonsOfTeacherWhere(params.teacherId)] }, select });
    if (teacherClash) {
      throw new AppError(`Преподаватель в это время ведёт занятие ${describeConflict(teacherClash)}`, 409, 'SCHEDULE_CONFLICT');
    }
  }

  if (params.classroomId) {
    const roomClash = await prisma.lesson.findFirst({ where: { ...overlap, classroomId: params.classroomId }, select });
    if (roomClash) {
      throw new AppError(`Аудитория в это время занята: ${describeConflict(roomClash)}`, 409, 'SCHEDULE_CONFLICT');
    }
  }
}

export async function markOverdueAssignments() {
  const now = new Date();
  await prisma.assignment.updateMany({
    where: {
      status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
      deadline: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });

  const overdueAssignments = await prisma.assignment.findMany({
    where: { deadline: { lt: now }, status: 'OVERDUE' },
    select: { id: true },
  });
  const ids = overdueAssignments.map((a) => a.id);
  if (ids.length) {
    await prisma.submission.updateMany({
      where: {
        assignmentId: { in: ids },
        status: { in: ['DRAFT'] },
      },
      data: { status: 'OVERDUE' },
    });
  }
}
