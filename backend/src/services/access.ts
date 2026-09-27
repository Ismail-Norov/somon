import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

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

export async function checkScheduleConflict(params: {
  groupId: string;
  teacherId?: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeLessonId?: string;
}) {
  if (params.endsAt <= params.startsAt) {
    throw new AppError('Время окончания должно быть позже начала', 400, 'INVALID_TIME');
  }

  const groupLessons = await prisma.lesson.findMany({
    where: {
      groupId: params.groupId,
      status: { not: 'CANCELLED' },
      id: params.excludeLessonId ? { not: params.excludeLessonId } : undefined,
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
    },
  });
  if (groupLessons.length) {
    throw new AppError('Конфликт расписания у группы', 409, 'SCHEDULE_CONFLICT');
  }

  if (params.teacherId) {
    const teacherGroups = await prisma.group.findMany({
      where: { teacherId: params.teacherId },
      select: { id: true },
    });
    const ids = teacherGroups.map((g) => g.id);
    const teacherLessons = await prisma.lesson.findMany({
      where: {
        groupId: { in: ids },
        status: { not: 'CANCELLED' },
        id: params.excludeLessonId ? { not: params.excludeLessonId } : undefined,
        startsAt: { lt: params.endsAt },
        endsAt: { gt: params.startsAt },
      },
    });
    if (teacherLessons.length) {
      throw new AppError('Конфликт расписания у преподавателя', 409, 'SCHEDULE_CONFLICT');
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
