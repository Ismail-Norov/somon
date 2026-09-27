'use client';

import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, statusLabel } from '@/lib/format';

type Row = {
  id: string;
  status: string;
  note?: string;
  lesson: { title: string; startsAt: string; group: { course: { title: string }; code: string } };
};

export default function StudentAttendancePage() {
  const { data, loading, error, reload } = useApiData<Row[]>('/api/attendance');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">Посещаемость</h1>
      <p className="page-sub">История отметок по занятиям</p>
      {!data?.length && <EmptyState title="Записей посещаемости нет" />}
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
            {data?.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.lesson.startsAt)}</td>
                <td>{r.lesson.title}</td>
                <td>
                  {r.lesson.group.course.title} · {r.lesson.group.code}
                </td>
                <td>
                  <Badge
                    tone={
                      r.status === 'PRESENT'
                        ? 'success'
                        : r.status === 'LATE'
                          ? 'warning'
                          : r.status === 'EXCUSED'
                            ? 'info'
                            : 'danger'
                    }
                  >
                    {statusLabel[r.status] || r.status}
                  </Badge>
                </td>
                <td>{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
