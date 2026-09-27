'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef, ProgressInfo } from '@/lib/types';
import { fullName } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';

type Overview = {
  activeGroups: number;
  studentCount: number;
  pendingReview: number;
  activeAssignments: number;
  averageAttendance: number;
  averageGrade: number | null;
  averageProgress: number;
  lowAttendance: { student?: { id: string; user: PersonRef }; percent: number; groupCode: string; groupId: string }[];
  groupStats: {
    group: { id: string; code: string; course: { title: string } };
    students: number;
    progressPercent: number;
    attendancePercent: number;
    averageGrade: number | null;
  }[];
};

type GroupAnalytics = {
  group: { id: string; code: string; groupStudents: { student: { id: string; user: PersonRef }; progress: ProgressInfo | null }[] };
  analytics: { gradeDistribution: Record<string, number>; gradesCount: number };
};

export default function TeacherAnalyticsPage() {
  const { data, loading, error, reload } = useApiData<Overview>('/api/analytics/teacher');
  const [groupId, setGroupId] = useState('');
  const detail = useApiData<GroupAnalytics>(groupId ? `/api/analytics/teacher/group/${groupId}` : null);

  useEffect(() => {
    if (!groupId && data?.groupStats.length) setGroupId(data.groupStats[0].group.id);
  }, [data, groupId]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Нет данных'} onRetry={reload} />;

  const dist = detail.data?.analytics.gradeDistribution ?? {};
  const distMax = Math.max(1, ...Object.values(dist));
  const ranked = [...(detail.data?.group.groupStudents ?? [])].sort((a, b) => (b.progress?.progressPercent ?? 0) - (a.progress?.progressPercent ?? 0));
  const atRisk = ranked.filter((r) => (r.progress?.progressPercent ?? 0) < 50 || (r.progress?.overdueAssignments ?? 0) > 0);

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Аналитика" subtitle="Успеваемость, посещаемость и прогресс ваших групп" back={{ href: '/teacher/dashboard', label: 'Назад на главную' }} />

      <div className="grid grid-4">
        <StatCard icon="👥" label="Активных групп" value={data.activeGroups} hint={`Студентов: ${data.studentCount}`} />
        <StatCard icon="📈" label="Средний прогресс" value={`${Math.round(data.averageProgress)}%`} tone="info" />
        <StatCard icon="✅" label="Средняя посещаемость" value={`${Math.round(data.averageAttendance)}%`} tone="success" />
        <StatCard icon="⭐" label="Средний балл" value={data.averageGrade != null ? `${data.averageGrade} / 5` : '—'} tone="warning" />
      </div>

      {!data.groupStats.length ? (
        <EmptyState icon="📊" title="Нет активных групп" />
      ) : (
        <section className="card">
          <h2 className="card-title">Сравнение групп</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Группа</th>
                  <th>Студентов</th>
                  <th style={{ minWidth: 150 }}>Прогресс</th>
                  <th style={{ minWidth: 150 }}>Посещаемость</th>
                  <th>Средний балл</th>
                </tr>
              </thead>
              <tbody>
                {data.groupStats.map((g) => (
                  <tr key={g.group.id}>
                    <td>
                      <Link href={`/teacher/groups/${g.group.id}`} className="text-link">
                        <strong>{g.group.code}</strong>
                      </Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {g.group.course.title}
                      </div>
                    </td>
                    <td>{g.students}</td>
                    <td>
                      <ProgressBar value={g.progressPercent} />
                      <small>{Math.round(g.progressPercent)}%</small>
                    </td>
                    <td>
                      <ProgressBar value={g.attendancePercent} />
                      <small>{Math.round(g.attendancePercent)}%</small>
                    </td>
                    <td>{g.averageGrade ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.groupStats.length > 0 && (
        <>
          <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Подробно по группе</h2>
            <div style={{ minWidth: 240 }}>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Группа">
                {data.groupStats.map((g) => (
                  <option key={g.group.id} value={g.group.id}>
                    {g.group.code} · {g.group.course.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {detail.loading ? (
            <LoadingState />
          ) : detail.error ? (
            <ErrorState message={detail.error} onRetry={detail.reload} />
          ) : detail.data ? (
            <div className="grid grid-2">
              <section className="card">
                <h2 className="card-title">Распределение оценок (по 5-балльной шкале)</h2>
                {detail.data.analytics.gradesCount === 0 ? (
                  <p className="muted">Оценок пока нет</p>
                ) : (
                  <div className="bar-chart" role="img" aria-label="Распределение оценок">
                    {['1', '2', '3', '4', '5'].map((k) => (
                      <div key={k} className="bar-chart-col">
                        <strong style={{ color: 'var(--ink)' }}>{dist[k] ?? 0}</strong>
                        <div className="bar-chart-bar" style={{ height: `${((dist[k] ?? 0) / distMax) * 100}%` }} />
                        <span>{k}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h2 className="card-title">Требуют внимания</h2>
                {atRisk.length === 0 ? (
                  <p className="muted">Все студенты группы в хорошем темпе 👍</p>
                ) : (
                  atRisk.map((r) => (
                    <Link key={r.student.id} href={`/teacher/groups/${groupId}/students/${r.student.id}`} className="list-row">
                      <Avatar user={r.student.user} size={32} />
                      <span style={{ flex: 1 }}>{fullName(r.student.user)}</span>
                      <Badge tone="warning">{`${Math.round(r.progress?.progressPercent ?? 0)}%`}</Badge>
                      {(r.progress?.overdueAssignments ?? 0) > 0 && <Badge tone="danger">{`Просрочено: ${r.progress?.overdueAssignments}`}</Badge>}
                    </Link>
                  ))
                )}
              </section>

              <section className="card" style={{ gridColumn: '1 / -1' }}>
                <h2 className="card-title">Рейтинг по прогрессу</h2>
                {ranked.length === 0 ? (
                  <p className="muted">В группе нет студентов</p>
                ) : (
                  ranked.map((r, i) => (
                    <Link key={r.student.id} href={`/teacher/groups/${groupId}/students/${r.student.id}`} className="list-row">
                      <span className="muted" style={{ width: 24 }}>
                        {i + 1}
                      </span>
                      <Avatar user={r.student.user} size={32} />
                      <span style={{ flex: 1, minWidth: 120 }}>{fullName(r.student.user)}</span>
                      <span style={{ width: 160 }}>
                        <ProgressBar value={r.progress?.progressPercent ?? 0} />
                      </span>
                      <strong style={{ width: 48, textAlign: 'right' }}>{Math.round(r.progress?.progressPercent ?? 0)}%</strong>
                    </Link>
                  ))
                )}
              </section>
            </div>
          ) : null}
        </>
      )}

      {data.lowAttendance.length > 0 && (
        <section className="card">
          <h2 className="card-title">Низкая посещаемость (ниже 70%)</h2>
          {data.lowAttendance.map((l) => (
            <Link key={`${l.groupId}-${l.student?.id}`} href={`/teacher/groups/${l.groupId}/students/${l.student?.id}`} className="list-row">
              <Avatar user={l.student?.user} size={32} />
              <span style={{ flex: 1 }}>{fullName(l.student?.user)}</span>
              <span className="muted">{l.groupCode}</span>
              <Badge tone="danger">{`${l.percent}%`}</Badge>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
