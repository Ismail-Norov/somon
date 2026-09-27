'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { CourseCard } from '@/components/public/Cards';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import { plural } from '@/lib/format';
import type { PublicCourse } from '@/lib/types';

type Filters = { q: string; categoryId: string; level: string; format: string; duration: string };
const EMPTY: Filters = { q: '', categoryId: '', level: '', format: '', duration: '' };

const QUICK = [
  { key: 'level', value: 'BEGINNER', label: 'Начальный' },
  { key: 'level', value: 'INTERMEDIATE', label: 'Средний' },
  { key: 'level', value: 'ADVANCED', label: 'Продвинутый' },
  { key: 'format', value: 'ONLINE', label: 'Онлайн' },
  { key: 'format', value: 'OFFLINE', label: 'Офлайн' },
] as const;

export default function PublicCoursesPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [debouncedQ, setDebouncedQ] = useState('');
  const meta = useApiData<{ categories: { id: string; name: string }[] }>('/api/courses/public/meta');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.level) params.set('level', filters.level);
    if (filters.format) params.set('format', filters.format);
    if (filters.duration) params.set('duration', filters.duration);
    const s = params.toString();
    return `/api/courses/public${s ? `?${s}` : ''}`;
  }, [debouncedQ, filters.categoryId, filters.level, filters.format, filters.duration]);

  const { data: courses, loading, error, reload } = useApiData<PublicCourse[]>(query);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Каталог"
        title="Курсы Somon"
        description="Выберите направление, уровень и удобный формат обучения. Все курсы ведут практикующие преподаватели."
      />
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          <div className="filters">
            <Input
              type="search"
              placeholder="Поиск курса..."
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              aria-label="Поиск курса"
            />
            <Select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Категория">
              <option value="">Все категории</option>
              {meta.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={filters.level} onChange={(e) => set({ level: e.target.value })} aria-label="Уровень">
              <option value="">Любой уровень</option>
              <option value="BEGINNER">Начальный</option>
              <option value="INTERMEDIATE">Средний</option>
              <option value="ADVANCED">Продвинутый</option>
            </Select>
            <Select value={filters.format} onChange={(e) => set({ format: e.target.value })} aria-label="Формат">
              <option value="">Любой формат</option>
              <option value="ONLINE">Онлайн</option>
              <option value="OFFLINE">Офлайн</option>
              <option value="HYBRID">Смешанный</option>
            </Select>
            <Select value={filters.duration} onChange={(e) => set({ duration: e.target.value })} aria-label="Длительность">
              <option value="">Любая длительность</option>
              <option value="short">до 1 месяца</option>
              <option value="medium">1–2 месяца</option>
              <option value="long">более 2 месяцев</option>
            </Select>
          </div>

          <div className="filter-chips">
            {QUICK.map((chip) => {
              const active = filters[chip.key] === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  className={`filter-chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => set({ [chip.key]: active ? '' : chip.value } as Partial<Filters>)}
                >
                  {chip.label}
                </button>
              );
            })}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
                Сбросить фильтры
              </Button>
            )}
          </div>

          {loading && <LoadingState />}
          {error && <ErrorState onRetry={reload} />}
          {!loading && !error && courses && (
            <>
              <p className="results-count">
                Найдено {courses.length} {plural(courses.length, ['курс', 'курса', 'курсов'])}
              </p>
              {courses.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="Курсы не найдены"
                  description="Попробуйте изменить запрос или сбросить фильтры."
                  action={
                    <Button variant="secondary" onClick={() => setFilters(EMPTY)}>
                      Сбросить фильтры
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-3">
                  {courses.map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
