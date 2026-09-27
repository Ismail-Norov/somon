'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { fullName, statusLabel } from '@/lib/format';

type CourseItem = {
  id: string;
  title: string;
  shortDesc?: string;
  group?: {
    id: string;
    code: string;
    status: string;
    teacher?: { user: { firstName: string; lastName: string } };
  };
};

export default function StudentCoursesPage() {
  const { data, loading, error, reload } = useApiData<CourseItem[]>('/api/courses');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Мои курсы</h1>
          <p className="page-sub">Активные программы обучения</p>
        </div>
        <Link href="/courses">
          <Button variant="secondary">Каталог курсов</Button>
        </Link>
      </div>
      {!data?.length && (
        <EmptyState
          title="Вы ещё не записаны на курсы"
          description="Выберите курс в каталоге и группу"
          action={
            <Link href="/courses">
              <Button>Открыть каталог</Button>
            </Link>
          }
        />
      )}
      <div className="grid grid-2">
        {data?.map((c) => (
          <Link key={c.id} href={`/student/courses/${c.id}`} className="card">
            <h3>{c.title}</h3>
            <p>{c.shortDesc}</p>
            <div className="row">
              <Badge tone="brand">{c.group?.code}</Badge>
              <Badge>{statusLabel[c.group?.status || ''] || c.group?.status}</Badge>
            </div>
            <p style={{ marginBottom: 0 }}>Преподаватель: {fullName(c.group?.teacher?.user)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
