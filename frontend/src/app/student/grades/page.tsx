'use client';

import { useApiData } from '@/lib/useApiData';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, fullName } from '@/lib/format';

type Grade = {
  id: string;
  score: number;
  maxScore: number;
  comment?: string;
  createdAt: string;
  teacher?: { user: { firstName: string; lastName: string } };
  submission?: { assignment?: { title: string; course?: { title: string } } };
};

export default function StudentGradesPage() {
  const { data, loading, error, reload } = useApiData<Grade[]>('/api/grades');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">Оценки</h1>
      <p className="page-sub">Результаты и комментарии преподавателя</p>
      {!data?.length && <EmptyState title="Оценок пока нет" />}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Задание</th>
              <th>Курс</th>
              <th>Балл</th>
              <th>Преподаватель</th>
              <th>Комментарий</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((g) => (
              <tr key={g.id}>
                <td>{g.submission?.assignment?.title || '—'}</td>
                <td>{g.submission?.assignment?.course?.title || '—'}</td>
                <td>
                  <strong>
                    {g.score}/{g.maxScore}
                  </strong>
                </td>
                <td>{fullName(g.teacher?.user)}</td>
                <td>{g.comment || '—'}</td>
                <td>{formatDateTime(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
