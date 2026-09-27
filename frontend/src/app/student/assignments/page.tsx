'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Assignment } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { studentAssignmentState } from '@/lib/assignments';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Filter = 'active' | 'review' | 'graded' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Нужно сдать' },
  { key: 'review', label: 'На проверке' },
  { key: 'graded', label: 'Проверенные' },
  { key: 'all', label: 'Все' },
];

export default function StudentAssignmentsPage() {
  const { data, loading, error, reload } = useApiData<Assignment[]>('/api/assignments');
  const [filter, setFilter] = useState<Filter>('active');

  const rows = useMemo(() => (data ?? []).map((a) => ({ a, state: studentAssignmentState(a) })), [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { active: 0, review: 0, graded: 0, all: rows.length };
    rows.forEach((r) => (c[r.state.key] += 1));
    return c;
  }, [rows]);
  const visible = rows.filter((r) => filter === 'all' || r.state.key === filter);

  return (
    <div>
      <PageHeader title="Задания" subtitle="Сдавайте работы текстом, файлами или вместе, следите за статусом и оценками." />

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} {counts[f.key] > 0 && <span className="muted">({counts[f.key]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={filter === 'active' ? '🎉' : '📝'}
          title={filter === 'active' ? 'Все задания сданы' : 'Здесь пока пусто'}
          description={filter === 'active' ? 'Новые задания появятся, когда преподаватель их опубликует.' : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Задание</th>
                <th>Курс / группа</th>
                <th>Срок сдачи</th>
                <th>Статус</th>
                <th>Оценка</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ a, state }) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/student/assignments/${a.id}`} className="text-link">
                      {a.title}
                    </Link>
                    {state.sub && state.sub.attemptCount > 1 && (
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        Попыток: {state.sub.attemptCount}
                      </div>
                    )}
                  </td>
                  <td>
                    {a.course?.title}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {a.group?.code}
                    </div>
                  </td>
                  <td>{a.deadline ? formatDateTime(a.deadline) : 'Без срока'}</td>
                  <td>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </td>
                  <td>{state.sub?.grade ? `${state.sub.grade.score}/${state.sub.grade.maxScore}` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ButtonLink href={`/student/assignments/${a.id}`} size="sm" variant={state.key === 'active' ? 'primary' : 'secondary'}>
                      {state.key === 'active' ? 'Сдать' : 'Открыть'}
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
