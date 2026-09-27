import { prisma } from '../lib/prisma';
import { formatTime, relativeDay } from '../lib/time';
import { notifyUsers } from './notifications';

const REMINDER_HOURS = Number(process.env.LESSON_REMINDER_HOURS || 3);

/**
 * Sends one reminder per lesson to its students and teacher shortly before it starts.
 * `reminderSentAt` is claimed atomically so parallel runs never send duplicates.
 */
export async function sendLessonReminders(now = new Date()) {
  const lessons = await prisma.lesson.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_HOURS * 3600 * 1000) },
    },
    include: {
      group: {
        select: {
          code: true,
          teacher: { select: { userId: true } },
          course: { select: { title: true } },
          groupStudents: { where: { status: 'ACTIVE' }, select: { student: { select: { userId: true } } } },
        },
      },
      teacher: { select: { userId: true } },
      branch: { select: { name: true, address: true } },
    },
  });

  let sent = 0;
  for (const lesson of lessons) {
    const claimed = await prisma.lesson.updateMany({ where: { id: lesson.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;

    const when = `${relativeDay(lesson.startsAt, now)} в ${formatTime(lesson.startsAt)}`;
    const place =
      lesson.format === 'ONLINE'
        ? lesson.meetingUrl
          ? 'Онлайн — ссылка в расписании'
          : 'Онлайн'
        : [lesson.branch?.name, lesson.branch?.address, lesson.room].filter(Boolean).join(', ') || 'Офлайн';
    const body = `«${lesson.title}» · ${place}`;

    await notifyUsers(
      lesson.group.groupStudents.map((gs) => gs.student.userId),
      'REMINDER',
      `${when} у вас занятие «${lesson.group.course.title}»`,
      body,
      `/student/schedule?lessonId=${lesson.id}`
    );
    const teacherUser = lesson.teacher?.userId ?? lesson.group.teacher?.userId;
    if (teacherUser) {
      await notifyUsers([teacherUser], 'REMINDER', `${when} занятие группы ${lesson.group.code}`, body, `/teacher/schedule?lessonId=${lesson.id}`);
    }
    sent++;
  }
  return sent;
}
