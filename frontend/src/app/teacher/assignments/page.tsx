'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, statusLabel } from '@/lib/format';

type Assignment = {
  id: string;
  title: string;
  deadline?: string;
  status: string;
  group?: { id: string; code: string };
  course: { title: string };
  _count?: { submissions: number };
};

export default function TeacherAssignmentsPage() {
  const { data, loading, error, reload } = useApiData<Assignment[]>('/api/assignments');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <h1 className="page-title">Задания</h1>
      <p className="page-sub">Управление заданиями групп</p>
      {!data?.length && <EmptyState title="Заданий нет" />}
      <div className="stack">
        {data?.map((a) => (
          <div className="card row space-between" key={a.id}>
            <div>
              <strong>{a.title}</strong>
              <p style={{ margin: 0 }}>
                {a.course.title} · {a.group?.code} · до {formatDateTime(a.deadline)} · ответов:{' '}
                {a._count?.submissions ?? 0}
              </p>
            </div>
            <div className="row">
              <Badge>{statusLabel[a.status]}</Badge>
              {a.group && (
                <Link href={`/teacher/groups/${a.group.id}`}>
                  <Badge tone="brand">к группе</Badge>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
