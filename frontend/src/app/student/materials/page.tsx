'use client';

import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { API_URL } from '@/lib/api';

type Material = {
  id: string;
  title: string;
  description?: string;
  topic?: string;
  type: string;
  fileUrl?: string;
  publishedAt: string;
};

export default function StudentMaterialsPage() {
  const { data, loading, error, reload } = useApiData<Material[]>('/api/materials');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">Материалы</h1>
      <p className="page-sub">Учебные ресурсы ваших курсов</p>
      {!data?.length && <EmptyState title="Материалов нет" />}
      <div className="stack">
        {data?.map((m) => (
          <div className="card row space-between" key={m.id}>
            <div>
              <strong>{m.title}</strong>
              <p style={{ margin: '0.25rem 0' }}>
                {m.topic || 'Без темы'} · {formatDateTime(m.publishedAt)}
              </p>
              <p style={{ margin: 0 }}>{m.description}</p>
            </div>
            <div className="row">
              <Badge>{m.type}</Badge>
              {m.fileUrl && (
                <a href={`${API_URL}${m.fileUrl}`} target="_blank" rel="noreferrer">
                  Открыть
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
