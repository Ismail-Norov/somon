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
