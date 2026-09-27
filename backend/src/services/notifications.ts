import { prisma } from '../lib/prisma';

export async function notifyUser(userId: string, type: string, title: string, body?: string) {
  return prisma.notification.create({
    data: { userId, type, title, body },
  });
}

export async function notifyUsers(userIds: string[], type: string, title: string, body?: string) {
  if (!userIds.length) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body })),
  });
}

export async function getGroupStudentUserIds(groupId: string) {
  const rows = await prisma.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    include: { student: { include: { user: true } } },
  });
  return rows.map((r) => r.student.userId);
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
