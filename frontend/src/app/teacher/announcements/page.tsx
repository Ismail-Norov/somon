'use client';

import { useApiData } from '@/lib/useApiData';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { AnnouncementsPanel } from '@/components/cabinet/AnnouncementsPanel';

export default function TeacherAnnouncementsPage() {
  const groups = useApiData<{ id: string; code: string }[]>('/api/groups');

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Объявления"
        subtitle="Сообщения для студентов ваших групп — они придут им в уведомления"
        back={{ href: '/teacher/dashboard', label: 'Назад на главную' }}
      />
      {groups.loading ? (
        <LoadingState />
      ) : groups.error ? (
        <ErrorState message={groups.error} onRetry={groups.reload} />
      ) : !groups.data?.length ? (
        <EmptyState icon="👥" title="У вас пока нет групп" />
      ) : (
        <AnnouncementsPanel groups={groups.data} />
      )}
    </div>
  );
}
