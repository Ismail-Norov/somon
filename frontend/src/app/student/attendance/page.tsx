'use client';

import { useApiData } from '@/lib/useApiData';
import { formatDateTime, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';

type Row = {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string | null;
  lesson: { title: string; startsAt: string; group: { course: { title: string }; code: string } };
};

const TONE = { PRESENT: 'success', LATE: 'warning', EXCUSED: 'info', ABSENT: 'danger' } as const;

export default function StudentAttendancePage() {
  const { data, loading, error, reload } = useApiData<Row[]>('/api/attendance');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const rows = [...(data ?? [])].sort((a, b) => +new Date(b.lesson.startsAt) - +new Date(a.lesson.startsAt));
  const count = (s: Row['status']) => rows.filter((r) => r.status === s).length;
  const present = count('PRESENT') + count('LATE') + count('EXCUSED');
  const percent = rows.length ? Math.round((present / rows.length) * 100) : 0;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Посещаемость" subtitle="История отметок по всем занятиям ваших групп." />
      {!rows.length ? (
        <EmptyState icon="✅" title="Отметок пока нет" description="Преподаватель отмечает посещаемость на каждом занятии." />
      ) : (
        <>
          <div className="grid grid-4">
            <StatCard icon="📊" label="Посещаемость" value={`${percent}%`} tone="success" hint="Опоздания и уважительные причины засчитываются" />
            <StatCard icon="✅" label="Присутствовал" value={count('PRESENT')} tone="success" />
            <StatCard icon="⏰" label="Опоздания" value={count('LATE')} tone="warning" />
            <StatCard icon="❌" label="Пропуски" value={count('ABSENT')} tone="danger" hint={count('EXCUSED') ? `Уважительных: ${count('EXCUSED')}` : undefined} />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Занятие</th>
                  <th>Курс</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.lesson.startsAt)}</td>
                    <td>{r.lesson.title}</td>
                    <td>
                      {r.lesson.group.course.title} · {r.lesson.group.code}
                    </td>
                    <td>
                      <Badge tone={TONE[r.status]}>{statusLabel[r.status] || r.status}</Badge>
                    </td>
                    <td>{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
