'use client';

import { AppShell } from '@/components/layout/AppShell';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="TEACHER">{children}</AppShell>;
}
