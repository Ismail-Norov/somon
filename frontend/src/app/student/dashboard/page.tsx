'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';

type Dash = {
  greeting: string;
  courses: {
    course: { id: string; title: string };
    group: { code: string };
    progressPercent: number;
    attendancePercent: number;
    lessonsPercent: number;
    assignmentsPercent: number;
  }[];
  upcomingLessons: { 
    id: string; 
    title: string; 
    startsAt: string; 
    endsAt: string;
    format: string;
    room?: string;
    meetingUrl?: string;
    group: { course: { title: string }; code: string };
    teacher?: { user: { firstName: string; lastName: string } };
  }[];
  deadlines: { id: string; title: string; deadline: string; course: { title: string } }[];
  averageGrade: number | null;
  attendancePercent: number;
  notifications: { id: string; title: string; body?: string; createdAt: string; readAt?: string | null }[];
  overallProgress: number;
  activeAssignments: number;
  unreadNotifications: number;
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<Dash>('/api/analytics/student');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Нет данных" />;

  const primaryCourse = data.courses[0];
  const nextLesson = data.upcomingLessons[0];

  return (
    <div>
      <div className="row space-between" style={{ marginBottom: '1.5rem' }}>
        <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: user?.photoUrl 
                ? `url(${user.photoUrl}) center/cover` 
                : 'linear-gradient(145deg, var(--brand), var(--brand-dark))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 700,
            }}
          >
            {!user?.photoUrl && (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Добро пожаловать, {user?.firstName}!</h1>
            <p className="page-sub" style={{ margin: 0 }}>Ваш учебный кабинет в Somon</p>
          </div>
        </div>
        <Link href="/student/profile">
          <Badge tone="brand">Профиль</Badge>
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label">Активные курсы</div>
          <div className="stat-value">{data.courses.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Средняя оценка</div>
          <div className="stat-value">{data.averageGrade ?? '—'}</div>
        </div>
        <div className="card">
          <div className="stat-label">Посещаемость</div>
          <div className="stat-value">{data.attendancePercent}%</div>
        </div>
        <div className="card">
          <div className="stat-label">Общий прогресс</div>
          <div className="stat-value">{data.overallProgress}%</div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label">Активные задания</div>
          <div className="stat-value">{data.activeAssignments}</div>
        </div>
        <div className="card">
          <div className="stat-label">Непрочитанные уведомления</div>
          <div className="stat-value">{data.unreadNotifications}</div>
        </div>
        <div className="card">
          <div className="stat-label">Дедлайны</div>
          <div className="stat-value">{data.deadlines.length}</div>
        </div>
      </div>

      {nextLesson && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(145deg, var(--brand-soft), #fff)' }}>
          <div className="row space-between">
            <div>
              <h3 style={{ color: 'var(--brand-dark)', marginBottom: '0.5rem' }}>Ближайшее занятие</h3>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>{nextLesson.title}</strong>
              </p>
              <p style={{ marginBottom: '0.25rem' }}>
                Курс: {nextLesson.group.course.title} · Группа: {nextLesson.group.code}
              </p>
              <p style={{ marginBottom: '0.25rem' }}>
                Дата: {formatDateTime(nextLesson.startsAt)} — {formatDateTime(nextLesson.endsAt)}
              </p>
              {nextLesson.teacher && (
                <p style={{ marginBottom: '0.25rem' }}>
                  Преподаватель: {nextLesson.teacher?.user.firstName} {nextLesson.teacher?.user.lastName}
                </p>
              )}
              <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <Badge tone={nextLesson.format === 'ONLINE' ? 'success' : 'info'}>
                  {nextLesson.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}
                </Badge>
                {nextLesson.format === 'ONLINE' && nextLesson.meetingUrl && (
                  <a href={nextLesson.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <Badge tone="brand">Перейти к занятию</Badge>
                  </a>
                )}
                {nextLesson.format === 'OFFLINE' && nextLesson.room && (
                  <Badge>Аудитория: {nextLesson.room}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <h3>Мои курсы</h3>
          <div className="stack">
            {data.courses.map((c) => (
              <Link key={c.course.id} href={`/student/courses/${c.course.id}`} style={{ textDecoration: 'none' }}>
                <div className="row space-between">
                  <div>
                    <strong>{c.course.title}</strong>
                    <div className="hint">{c.group.code}</div>
                  </div>
                  <Badge tone="brand">{c.progressPercent}%</Badge>
                </div>
                <ProgressBar value={c.progressPercent} />
                <div className="row" style={{ fontSize: '0.85rem', color: 'var(--muted)', gap: '1rem' }}>
                  <span>Занятия: {c.lessonsPercent}%</span>
                  <span>Задания: {c.assignmentsPercent}%</span>
                  <span>Посещаемость: {c.attendancePercent}%</span>
                </div>
              </Link>
            ))}
            {!data.courses.length && <p>Пока нет курсов. Запишитесь в каталоге.</p>}
          </div>
        </div>

        <div className="card">
          <h3>Дедлайны</h3>
          <div className="stack">
            {data.deadlines.map((d) => (
              <div key={d.id}>
                <strong>{d.title}</strong>
                <p style={{ margin: 0 }}>
                  {d.course.title} · до {formatDateTime(d.deadline)}
                </p>
              </div>
            ))}
            {!data.deadlines.length && <p>Нет ближайших дедлайнов</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row space-between">
            <h3>Уведомления</h3>
            {data.unreadNotifications > 0 && (
              <Badge tone="danger">{data.unreadNotifications} новых</Badge>
            )}
          </div>
          <div className="stack">
            {data.notifications.slice(0, 5).map((n) => (
              <div key={n.id} style={{ opacity: n.readAt ? 0.6 : 1 }}>
                <strong>{n.title}</strong>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{n.body}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {formatDateTime(n.createdAt)}
                </p>
              </div>
            ))}
            {data.notifications.length === 0 && <p>Нет уведомлений</p>}
            {data.notifications.length > 5 && (
              <Link href="/student/notifications" style={{ textAlign: 'center', color: 'var(--brand)' }}>
                Показать все уведомления
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Ближайшие занятия</h3>
          <div className="stack">
            {data.upcomingLessons.slice(1).map((l) => (
              <div key={l.id}>
                <strong>{l.title}</strong>
                <p style={{ margin: 0 }}>
                  {l.group.course.title} · {formatDateTime(l.startsAt)}
                </p>
                <Badge tone={l.format === 'ONLINE' ? 'success' : 'info'}>
                  {l.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}
                </Badge>
              </div>
            ))}
            {data.upcomingLessons.length <= 1 && <p>Нет других ближайших занятий</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
