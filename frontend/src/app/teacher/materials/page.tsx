'use client';

import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

type Material = { id: string; title: string; type: string; topic?: string };

export default function TeacherMaterialsPage() {
  const { data, loading, error, reload } = useApiData<Material[]>('/api/materials');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <h1 className="page-title">Материалы</h1>
      <p className="page-sub">Материалы ваших курсов. Создание — в карточке группы.</p>
      {!data?.length && <EmptyState title="Материалов нет" />}
      <div className="stack">
        {data?.map((m) => (
          <div className="card row space-between" key={m.id}>
            <div>
              <strong>{m.title}</strong>
              <p style={{ margin: 0 }}>{m.topic || 'Без темы'}</p>
            </div>
            <Badge>{m.type}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
