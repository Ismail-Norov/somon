'use client';

import { useApiData } from '@/lib/useApiData';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { AnnouncementsPanel } from '@/components/cabinet/AnnouncementsPanel';

type GroupOption = { id: string; code: string; status: string };

export default function AdminAnnouncementsPage() {
  const { data, loading, error, reload } = useApiData<GroupOption[]>('/api/groups');
  const groups = (data ?? []).filter((g) => g.status !== 'ARCHIVED');

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Объявления" subtitle="Объявления для групп. Студенты выбранной группы получают уведомление" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !groups.length ? (
        <EmptyState icon="📢" title="Групп пока нет" description="Создайте группу, чтобы отправлять объявления." />
      ) : (
        <AnnouncementsPanel groups={groups} />
      )}
    </div>
  );
}
