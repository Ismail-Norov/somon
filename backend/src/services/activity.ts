import { prisma } from '../lib/prisma';

export async function logActivity(
  studentId: string | undefined | null,
  type: string,
  title: string,
  meta?: unknown
) {
  if (!studentId) return;
  try {
    await prisma.studentActivity.create({
      data: {
        studentId,
        type,
        title,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (e) {
    // Model might not be available
  }
}

export async function ensureAchievements(studentId: string) {
  try {
    const defs = [
      { code: 'FIRST_SUBMISSION', title: 'Первое выполненное задание', description: 'Отправили первую работу' },
      { code: 'TEN_LESSONS', title: '10 посещённых занятий', description: 'Регулярно приходите на занятия' },
      { code: 'EXCELLENT', title: 'Отличный результат', description: 'Получили оценку 5' },
      { code: 'PERFECT_MONTH', title: '100% посещаемость', description: 'Не пропустили занятия' },
      { code: 'ALL_ASSIGNMENTS', title: 'Все задания выполнены', description: 'Закрыли все задания курса' },
      { code: 'FIRST_COURSE', title: 'Завершён первый курс', description: 'Дошли до конца программы' },
    ];

    for (const d of defs) {
      await prisma.achievement.upsert({
        where: { code: d.code },
        create: d,
        update: { title: d.title, description: d.description },
      });
    }

    const submissions = await prisma.submission.count({
      where: { studentId, status: { in: ['SUBMITTED', 'REVIEWING', 'GRADED'] } },
    });
    if (submissions >= 1) await grant(studentId, 'FIRST_SUBMISSION');

    const present = await prisma.attendance.count({
      where: { studentId, status: { in: ['PRESENT', 'LATE', 'EXCUSED'] } },
    });
    if (present >= 10) await grant(studentId, 'TEN_LESSONS');

    const excellent = await prisma.grade.count({ where: { studentId, score: { gte: 5 } } });
    if (excellent >= 1) await grant(studentId, 'EXCELLENT');

    const allAtt = await prisma.attendance.findMany({ where: { studentId } });
    if (
      allAtt.length >= 5 &&
      allAtt.every((a) => ['PRESENT', 'LATE', 'EXCUSED'].includes(a.status))
    ) {
      await grant(studentId, 'PERFECT_MONTH');
    }
  } catch (e) {
    // Models might not be available
  }
}

async function grant(studentId: string, code: string) {
  try {
    const achievement = await prisma.achievement.findUnique({ where: { code } });
    if (!achievement) return;
    await prisma.studentAchievement.upsert({
      where: {
        studentId_achievementId: { studentId, achievementId: achievement.id },
      },
      create: { studentId, achievementId: achievement.id },
      update: {},
    });
  } catch (e) {
    // Models might not be available
  }
}
