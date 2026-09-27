'use client';

import { useEffect, useState } from 'react';
import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { NewsCard } from '@/components/public/Cards';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import type { NewsItem } from '@/lib/types';

export default function NewsPage() {
  const [category, setCategory] = useState('');
  const { data, loading, error, reload } = useApiData<{ items: NewsItem[]; categories: string[] }>(
    `/api/public/news${category ? `?category=${encodeURIComponent(category)}` : ''}`
  );
  const [allCategories, setAllCategories] = useState<string[]>([]);
  useEffect(() => {
    if (data && allCategories.length === 0) setAllCategories(data.categories);
  }, [data, allCategories.length]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Новости"
        title="Новости Somon"
        description="Открытие курсов, наборы в группы, мероприятия и достижения наших студентов."
      />
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          {allCategories.length > 0 && (
            <div className="filter-chips">
              <button type="button" className={`filter-chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>
                Все
              </button>
              {allCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`filter-chip ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {loading && <LoadingState />}
          {error && <ErrorState onRetry={reload} />}
          {data && data.items.length === 0 && <EmptyState title="Новостей пока нет" />}
          {data && data.items.length > 0 && (
            <div className="grid grid-3">
              {data.items.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
