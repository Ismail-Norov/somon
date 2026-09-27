'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { statusLabel } from '@/lib/format';

type Group = {
  id: string;
  code: string;
  status: string;
  course: { title: string };
  _count: { groupStudents: number };
};

export default function TeacherGroupsPage() {
  const { data, loading, error, reload } = useApiData<Group[]>('/api/groups');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">Мои группы</h1>
      <p className="page-sub">Рабочие учебные группы</p>
      {!data?.length && <EmptyState title="Групп нет" />}
      <div className="grid grid-2">
        {data?.map((g) => (
          <Link key={g.id} href={`/teacher/groups/${g.id}`} className="card">
            <div className="row space-between">
              <h3>{g.code}</h3>
              <Badge tone="brand">{statusLabel[g.status]}</Badge>
            </div>
            <p>{g.course.title}</p>
            <p style={{ marginBottom: 0 }}>Студентов: {g._count.groupStudents}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
