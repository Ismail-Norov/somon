'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/States';
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar';

export default function TeacherSchedulePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ScheduleCalendar role="TEACHER" />
    </Suspense>
  );
}
