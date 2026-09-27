'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Material, PublicMaterial } from '@/lib/types';
import { PublicMaterialCard } from '@/components/public/Cards';
import { materialTypeLabel } from '@/lib/format';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { MaterialCard } from '@/components/cabinet/MaterialCard';

export default function StudentMaterialsPage() {
  const [tab, setTab] = useState<'course' | 'library'>('course');
  return (
    <div>
      <PageHeader title="Материалы" subtitle="Конспекты, презентации, видео и ссылки от преподавателей ваших групп и библиотека Somon." />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'course'} className={`tab ${tab === 'course' ? 'active' : ''}`} onClick={() => setTab('course')}>
          Материалы курсов
        </button>
        <button type="button" role="tab" aria-selected={tab === 'library'} className={`tab ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>
          Библиотека Somon
        </button>
      </div>
      {tab === 'course' ? <CourseMaterials /> : <Library />}
    </div>
  );
}

function Library() {
  const { data, loading, error, reload } = useApiData<PublicMaterial[]>('/api/student/library');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState icon="📚" title="Материалов пока нет" description="Здесь появятся открытые материалы Somon и материалы для студентов ваших курсов." />;
  return (
    <div className="grid grid-3">
      {data.map((m) => (
        <PublicMaterialCard key={m.id} material={m} />
      ))}
    </div>
  );
}

function CourseMaterials() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [courseId, setCourseId] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debounced) params.set('q', debounced);
  if (courseId) params.set('courseId', courseId);
  if (type) params.set('type', type);
  const qs = params.toString();

  const { data, loading, error, reload } = useApiData<Material[]>(`/api/materials${qs ? `?${qs}` : ''}`);
  const { data: all } = useApiData<Material[]>('/api/materials');

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    (all ?? []).forEach((m) => m.course && map.set(m.course.id, m.course.title));
    return [...map.entries()];
  }, [all]);

  return (
    <div>
      <div className="card filters" style={{ marginBottom: '1rem' }}>
        <Input placeholder="Поиск по названию или теме" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" />
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Курс">
          <option value="">Все курсы</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Тип">
          <option value="">Все типы</option>
          {Object.entries(materialTypeLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon="📂"
          title={qs ? 'Ничего не найдено' : 'Материалов пока нет'}
          description={qs ? 'Попробуйте изменить фильтры.' : 'Преподаватель ещё не добавил материалы для вашей группы.'}
        />
      ) : (
        <div className="grid grid-2">
          {data.map((m) => (
            <MaterialCard key={m.id} material={m} href={`/student/materials/${m.id}`} track />
          ))}
        </div>
      )}
    </div>
  );
}
