import { prisma } from '../lib/prisma';

export async function notifyUser(userId: string, type: string, title: string, body?: string, link?: string) {
  return prisma.notification.create({
    data: { userId, type, title, body, link },
  });
}

export async function notifyUsers(userIds: string[], type: string, title: string, body?: string, link?: string) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, type, title, body, link })),
  });
}

export async function getGroupStudentUserIds(groupId: string) {
  const rows = await prisma.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { student: { select: { userId: true } } },
  });
  return rows.map((r) => r.student.userId);
}

export async function getGroupTeacherUserId(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { teacher: { select: { userId: true } } },
  });
  return group?.teacher?.userId ?? null;
}

export async function getStudentUserId(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
  return student?.userId ?? null;
}

export async function audit(
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}
