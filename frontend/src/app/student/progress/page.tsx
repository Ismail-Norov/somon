'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { ProgressInfo } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { ProgressBreakdown } from '@/components/cabinet/ProgressBreakdown';
import { StatCard } from '@/components/cabinet/StatCard';

type Data = {
  stats: { averageGrade: number | null; attendancePercent: number; progressPercent: number; assignmentsDone: number; assignmentsTotal: number };
  progress: { overall: number; lessons: number; assignments: number; attendance: number };
  courses: (ProgressInfo & { course: { id: string; title: string }; group: { id: string; code: string }; lessonsRemaining: number })[];
  gradeTrend: number[];
};

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="muted">Недостаточно оценок для графика.</p>;
  const w = 320;
  const h = 90;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 5) * (h - 10) - 5).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Динамика оценок">
      <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function StudentProgressPage() {
  const { data, loading, error, reload } = useApiData<Data>('/api/analytics/student');

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Мой прогресс" subtitle="Прогресс обновляется автоматически после каждого занятия, отметки посещаемости и сданного задания." />

      <div className="grid grid-4">
        <StatCard icon="📈" label="Общий прогресс" value={`${Math.round(data.stats.progressPercent)}%`} tone="info" />
        <StatCard icon="⭐" label="Средний балл" value={data.stats.averageGrade !== null ? `${data.stats.averageGrade} / 5` : '—'} tone="warning" />
        <StatCard icon="✅" label="Посещаемость" value={`${Math.round(data.stats.attendancePercent)}%`} tone="success" />
        <StatCard icon="📝" label="Задания" value={`${data.stats.assignmentsDone}/${data.stats.assignmentsTotal}`} hint="сдано / всего" />
      </div>

      <div className="layout-2-1">
        <section className="card">
          <h2 className="card-title">Из чего складывается прогресс</h2>
          <ProgressBreakdown
            overall={data.progress.overall}
            lessons={data.progress.lessons}
            assignments={data.progress.assignments}
            attendance={data.progress.attendance}
          />
        </section>
        <section className="card">
          <h2 className="card-title">Динамика оценок</h2>
          <Trend values={data.gradeTrend} />
          <small className="muted">Последние {data.gradeTrend.length} оценок в пересчёте на 5-балльную шкалу</small>
        </section>
      </div>

      <h2 style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>По курсам</h2>
      {data.courses.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Нет активных курсов"
          action={<ButtonLink href="/student/catalog">Выбрать курс</ButtonLink>}
        />
      ) : (
        <div className="grid grid-2">
          {data.courses.map((c) => (
            <section key={c.group.id} className="card">
              <div className="row space-between" style={{ marginBottom: '0.75rem' }}>
                <Link href={`/student/courses/${c.course.id}`} className="text-link" style={{ fontSize: '1.05rem' }}>
                  {c.course.title}
                </Link>
                <Badge tone="brand">{c.group.code}</Badge>
              </div>
              <ProgressBreakdown
                overall={c.progressPercent}
                lessons={c.lessonsPercent}
                assignments={c.assignmentsPercent}
                attendance={c.attendancePercent}
                details={{
                  lessons: `Проведено ${c.lessonsCompleted} из ${c.lessonsTotal}, осталось ${c.lessonsRemaining}`,
                  assignments: `Сдано ${c.assignmentsDone} из ${c.assignmentsTotal}${c.overdueAssignments ? `, просрочено ${c.overdueAssignments}` : ''}`,
                  attendance: c.attendanceMarked ? `Посещено ${c.attendancePresent} из ${c.attendanceMarked} отмеченных` : 'Отметок пока нет',
                }}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
