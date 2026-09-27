'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, fullName } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';

type Grade = {
  id: string;
  score: number;
  maxScore: number;
  comment?: string | null;
  updatedAt: string;
  teacher?: { user: PersonRef } | null;
  lesson?: { id: string; title: string; group: { code: string } } | null;
  submission?: {
    assignment: { id: string; title: string; course: { id: string; title: string }; group?: { code: string } | null };
  } | null;
};

function tone(g: Grade) {
  const r = g.score / g.maxScore;
  return r >= 0.8 ? 'success' : r >= 0.6 ? 'warning' : 'danger';
}

export default function StudentGradesPage() {
  const { data, loading, error, reload } = useApiData<Grade[]>('/api/grades');
  const [course, setCourse] = useState('');

  const courses = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach((g) => g.submission && m.set(g.submission.assignment.course.id, g.submission.assignment.course.title));
    return [...m.entries()];
  }, [data]);

  const rows = (data ?? []).filter((g) => !course || g.submission?.assignment.course.id === course);
  const avg = rows.length ? rows.reduce((s, g) => s + (g.score / g.maxScore) * 5, 0) / rows.length : null;
  const best = rows.filter((g) => g.score / g.maxScore >= 0.9).length;

  return (
    <div>
      <PageHeader title="Оценки" subtitle="Все оценки за задания и занятия с комментариями преподавателей." />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState icon="⭐" title="Оценок пока нет" description="Когда преподаватель проверит вашу работу, оценка появится здесь." />
      ) : (
        <div className="stack" style={{ gap: '1rem' }}>
          <div className="grid grid-3">
            <StatCard icon="⭐" label="Средний балл" value={avg !== null ? `${avg.toFixed(1)} / 5` : '—'} tone="warning" />
            <StatCard icon="📋" label="Всего оценок" value={rows.length} />
            <StatCard icon="🏆" label="Отличных результатов" value={best} tone="success" hint="90% и выше от максимума" />
          </div>
          {courses.length > 1 && (
            <div style={{ maxWidth: 320 }}>
              <Select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Курс">
                <option value="">Все курсы</option>
                {courses.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>За что</th>
                  <th>Курс</th>
                  <th>Оценка</th>
                  <th>Комментарий преподавателя</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td>
                      {g.submission ? (
                        <Link href={`/student/assignments/${g.submission.assignment.id}`} className="text-link">
                          {g.submission.assignment.title}
                        </Link>
                      ) : (
                        <span>Занятие: {g.lesson?.title ?? '—'}</span>
                      )}
                    </td>
                    <td>{g.submission?.assignment.course.title ?? g.lesson?.group.code ?? '—'}</td>
                    <td>
                      <Badge tone={tone(g)}>
                        {g.score}/{g.maxScore}
                      </Badge>
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      {g.comment ? <span className="pre-wrap">{g.comment}</span> : <span className="muted">—</span>}
                      {g.teacher && (
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {fullName(g.teacher.user)}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(g.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
