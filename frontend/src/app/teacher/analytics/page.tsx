'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { ErrorState, LoadingState } from '@/components/ui/States';

type Dash = {
  groupStats: {
    group: { id: string; code: string; course: { title: string } };
    averageGrade: number | null;
    students: number;
  }[];
};

export default function TeacherAnalyticsPage() {
  const { data, loading, error, reload } = useApiData<Dash>('/api/analytics/teacher');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <h1 className="page-title">Аналитика</h1>
      <p className="page-sub">Сводка по вашим группам</p>
      <div className="grid grid-2">
        {data?.groupStats.map((g) => (
          <Link key={g.group.id} href={`/teacher/groups/${g.group.id}`} className="card">
            <h3>{g.group.code}</h3>
            <p>{g.group.course.title}</p>
            <div className="row space-between">
              <span>Студенты: {g.students}</span>
              <strong>Ср. оценка: {g.averageGrade ?? '—'}</strong>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
