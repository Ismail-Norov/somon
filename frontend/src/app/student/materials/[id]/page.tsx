'use client';

import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import type { Material } from '@/lib/types';
import { formatDate, formatDateTime, fullName, materialTypeLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { FileList } from '@/components/cabinet/Files';
import { MaterialLinks } from '@/components/cabinet/MaterialCard';

export default function StudentMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const { data: m, loading, error, reload } = useApiData<Material>(`/api/materials/${id}`);

  if (loading) return <LoadingState />;
  if (error || !m) return <ErrorState message={error || 'Материал не найден'} onRetry={reload} />;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/student/materials', label: 'Назад к материалам' }}
        title={m.title}
        subtitle={[m.course?.title, m.group ? `группа ${m.group.code}` : null].filter(Boolean).join(' · ')}
        actions={<Badge tone="brand">{materialTypeLabel[m.type] ?? m.type}</Badge>}
      />
      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Описание</h2>
            <p className="pre-wrap" style={{ color: 'var(--ink-2)' }}>{m.description || 'Описание не добавлено.'}</p>
            <MaterialLinks material={m} track />
          </section>
          <section className="card">
            <h2 className="card-title">Файлы</h2>
            {m.files.length ? (
              <FileList files={m.files} basePath="/api/files/material-file" />
            ) : (
              <p className="muted">К материалу не прикреплены файлы.</p>
            )}
          </section>
        </div>
        <aside className="card">
          <h2 className="card-title">О материале</h2>
          <dl className="kv">
            <dt>Автор</dt>
            <dd>{m.author ? fullName(m.author) : '—'}</dd>
            <dt>Курс</dt>
            <dd>{m.course?.title ?? '—'}</dd>
            {m.topic && (
              <>
                <dt>Тема</dt>
                <dd>{m.topic}</dd>
              </>
            )}
            {m.lesson && (
              <>
                <dt>Занятие</dt>
                <dd>
                  {m.lesson.title}
                  {m.lesson.startsAt && <div className="muted">{formatDateTime(m.lesson.startsAt)}</div>}
                </dd>
              </>
            )}
            <dt>Опубликовано</dt>
            <dd>{formatDate(m.publishedAt)}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
