'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { LessonCard, PersonRef } from '@/lib/types';
import { formatDateTime, fullName } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { LessonCardView } from '@/components/cabinet/LessonCard';
import { StatCard } from '@/components/cabinet/StatCard';

type Dash = {
  activeGroups: number;
  studentCount: number;
  lessonsToday: number;
  todayLessons: LessonCard[];
  upcomingLessons: LessonCard[];
  pendingReview: number;
  toReview: {
    id: string;
    submittedAt: string;
    attemptCount: number;
    student: { user: PersonRef };
    assignment: { id: string; title: string; deadline?: string | null; group: { code: string } };
  }[];
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

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<Dash>('/api/analytics/teacher');

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const lessons = data.todayLessons.length ? data.todayLessons : data.upcomingLessons.slice(0, 3);

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div className="card welcome-card">
        <h1 className="page-title">Здравствуйте, {user?.firstName}!</h1>
        <p>
          Сегодня {data.lessonsToday ? `${data.lessonsToday} занят.` : 'занятий нет'}
          {data.pendingReview ? ` · работ на проверке: ${data.pendingReview}` : ' · все работы проверены'}.
        </p>
      </div>

      <div className="grid grid-4">
        <StatCard icon="👥" label="Активные группы" value={data.activeGroups} href="/teacher/groups" />
        <StatCard icon="🎓" label="Студентов" value={data.studentCount} tone="info" />
        <StatCard icon="🗓️" label="Занятий сегодня" value={data.lessonsToday} tone="success" href="/teacher/schedule" />
        <StatCard
          icon="📥"
          label="Работы на проверке"
          value={data.pendingReview}
          tone={data.pendingReview ? 'warning' : 'success'}
          href="/teacher/review"
        />
        <StatCard icon="✅" label="Средняя посещаемость" value={`${Math.round(data.averageAttendance)}%`} tone="success" href="/teacher/attendance" />
        <StatCard icon="⭐" label="Средний балл" value={data.averageGrade !== null ? `${data.averageGrade} / 5` : '—'} tone="warning" href="/teacher/grades" />
        <StatCard icon="📝" label="Активные задания" value={data.activeAssignments} href="/teacher/assignments" />
        <StatCard icon="📈" label="Средний прогресс" value={`${Math.round(data.averageProgress)}%`} tone="info" href="/teacher/analytics" />
      </div>

      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">{data.todayLessons.length ? 'Занятия сегодня' : 'Ближайшие занятия'}</h2>
              <Link href="/teacher/schedule" className="text-link">
                Расписание
              </Link>
            </div>
            {lessons.length === 0 ? (
              <EmptyState icon="🗓️" title="Запланированных занятий нет" />
            ) : (
              lessons.map((l) => (
                <div key={l.id}>
                  <LessonCardView lesson={l} />
                  <div style={{ margin: '-0.4rem 0 0.6rem 72px' }}>
                    <Link href={`/teacher/attendance?lessonId=${l.id}`} className="text-link" style={{ fontSize: '0.88rem' }}>
                      Отметить посещаемость →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Работы на проверке</h2>
              <Link href="/teacher/review" className="text-link">
                Все работы
              </Link>
            </div>
            {data.toReview.length === 0 ? (
              <EmptyState icon="🎉" title="Все работы проверены" />
            ) : (
              <ul className="list-plain">
                {data.toReview.map((s) => {
                  const late = s.assignment.deadline && new Date(s.submittedAt) > new Date(s.assignment.deadline);
                  return (
                    <li key={s.id} className="list-row">
                      <div className="row" style={{ gap: '0.6rem', minWidth: 0 }}>
                        <Avatar user={s.student.user} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <strong>{fullName(s.student.user)}</strong>
                          <div className="muted" style={{ fontSize: '0.85rem' }}>
                            {s.assignment.title} · {s.assignment.group.code} · {formatDateTime(s.submittedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: '0.4rem' }}>
                        {s.attemptCount > 1 && <Badge tone="info">Попытка {s.attemptCount}</Badge>}
                        {late && <Badge tone="warning">После срока</Badge>}
                        <ButtonLink href={`/teacher/review/${s.id}`} size="sm">
                          Проверить
                        </ButtonLink>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Мои группы</h2>
            {data.groupStats.length === 0 ? (
              <p className="muted">Активных групп нет.</p>
            ) : (
              <div className="stack">
                {data.groupStats.map((g) => (
                  <Link key={g.group.id} href={`/teacher/groups/${g.group.id}`} className="stack" style={{ gap: '0.3rem' }}>
                    <div className="row space-between">
                      <strong>{g.group.code}</strong>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {g.students} студ.
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {g.group.course.title}
                    </span>
                    <ProgressBar value={g.progressPercent} />
                    <small className="muted">
                      Прогресс {Math.round(g.progressPercent)}% · посещаемость {Math.round(g.attendancePercent)}% · балл {g.averageGrade ?? '—'}
                    </small>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Низкая посещаемость</h2>
            {data.lowAttendance.length === 0 ? (
              <p className="muted">У всех студентов посещаемость выше 70%.</p>
            ) : (
              <ul className="list-plain">
                {data.lowAttendance.map((r, i) =>
                  r.student ? (
                    <li key={`${r.student.id}-${i}`} className="list-row">
                      <Link href={`/teacher/groups/${r.groupId}/students/${r.student.id}`} className="row" style={{ gap: '0.5rem' }}>
                        <Avatar user={r.student.user} size={30} />
                        <span>
                          {fullName(r.student.user)} <span className="muted">· {r.groupCode}</span>
                        </span>
                      </Link>
                      <Badge tone="danger">{r.percent}%</Badge>
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
