'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { PublicMaterialCard } from '@/components/public/Cards';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import { materialTypeLabel } from '@/lib/format';
import type { PublicMaterial } from '@/lib/types';

export default function PublicMaterialsPage() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set('q', debouncedQ);
    if (category) p.set('category', category);
    if (type) p.set('type', type);
    const s = p.toString();
    return `/api/public/materials${s ? `?${s}` : ''}`;
  }, [debouncedQ, category, type]);

  const { data, loading, error, reload } = useApiData<{ items: PublicMaterial[]; categories: string[] }>(path);
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    if (data && categories.length === 0) setCategories(data.categories);
  }, [data, categories.length]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Библиотека"
        title="Открытые материалы"
        description="Статьи, PDF, презентации, видео и полезные ссылки для самостоятельного обучения. Часть материалов доступна студентам курсов в личном кабинете."
      />
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          <div className="filters" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
            <Input type="search" placeholder="Поиск материала..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Категория">
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Тип">
              <option value="">Любой тип</option>
              {Object.entries(materialTypeLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          {loading && <LoadingState />}
          {error && <ErrorState onRetry={reload} />}
          {data && data.items.length === 0 && <EmptyState title="Материалов пока нет" description="Попробуйте изменить фильтры." />}
          {data && data.items.length > 0 && (
            <div className="grid grid-3">
              {data.items.map((m) => (
                <PublicMaterialCard key={m.id} material={m} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
