import type { Prisma } from '@prisma/client';

/** User fields safe to show to other authenticated users of the system. */
export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  photoUrl: true,
  role: true,
} satisfies Prisma.UserSelect;

/** User fields safe to expose on the public (unauthenticated) website. */
export const siteUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
} satisfies Prisma.UserSelect;

const teacherRef = { select: { id: true, position: true, user: { select: publicUserSelect } } } as const;

/** Everything needed to render a lesson card: where (branch/classroom or link), who and which group. */
export const lessonCardInclude = {
  group: {
    select: {
      id: true,
      code: true,
      format: true,
      course: { select: { id: true, title: true } },
      teacher: teacherRef,
    },
  },
  teacher: teacherRef,
  branch: { select: { id: true, name: true, address: true } },
  classroom: { select: { id: true, name: true } },
} satisfies Prisma.LessonInclude;
