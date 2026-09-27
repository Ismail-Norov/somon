'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, fullName } from '@/lib/format';

type Dash = {
  activeGroups: number;
  studentCount: number;
  upcomingLessons: { 
    id: string; 
    title: string; 
    startsAt: string; 
    endsAt: string;
    format: string;
    room?: string;
    meetingUrl?: string;
    group: { code: string; course: { title: string } };
  }[];
  toReview: { 
    id: string; 
    assignment: { title: string; deadline: string }; 
    student: { user: { firstName: string; lastName: string } };
    group: { code: string; course: { title: string } };
  }[];
  lowAttendance: { percent: number; groupCode: string; student: { user: { firstName: string; lastName: string } } }[];
  groupStats: { 
    group: { id: string; code: string; course: { title: string } }; 
    averageGrade: number | null; 
    students: number;
    attendancePercent: number;
  }[];
  lessonsToday: number;
  activeAssignments: number;
  averageAttendance: number;
  averageGrade: number;
};

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<Dash>('/api/analytics/teacher');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Нет данных" />;

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
            <p className="page-sub" style={{ margin: 0 }}>Кабинет преподавателя</p>
          </div>
        </div>
        <Link href="/teacher/profile">
          <Badge tone="brand">Профиль</Badge>
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label">Активные группы</div>
          <div className="stat-value">{data.activeGroups}</div>
        </div>
        <div className="card">
          <div className="stat-label">Студенты</div>
          <div className="stat-value">{data.studentCount}</div>
        </div>
        <div className="card">
          <div className="stat-label">Занятий сегодня</div>
          <div className="stat-value">{data.lessonsToday}</div>
        </div>
        <div className="card">
          <div className="stat-label">Работ на проверке</div>
          <div className="stat-value">{data.toReview.length}</div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label">Активные задания</div>
          <div className="stat-value">{data.activeAssignments}</div>
        </div>
        <div className="card">
          <div className="stat-label">Средняя посещаемость</div>
          <div className="stat-value">{data.averageAttendance}%</div>
        </div>
        <div className="card">
          <div className="stat-label">Средняя оценка</div>
          <div className="stat-value">{data.averageGrade ? Math.round(data.averageGrade * 10) / 10 : '—'}</div>
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
                Группа: {nextLesson.group.code} · Курс: {nextLesson.group.course.title}
              </p>
              <p style={{ marginBottom: '0.25rem' }}>
                Дата: {formatDateTime(nextLesson.startsAt)} — {formatDateTime(nextLesson.endsAt)}
              </p>
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
          <h3>Мои группы</h3>
          <div className="stack">
            {data.groupStats.map((g) => (
              <Link key={g.group.id} href={`/teacher/groups/${g.group.id}`} style={{ textDecoration: 'none' }}>
                <div className="row space-between">
                  <div>
                    <strong>{g.group.code}</strong>
                    <div className="hint">{g.group.course.title}</div>
                  </div>
                  <Badge tone="brand">{g.students} студ.</Badge>
                </div>
                <div className="row" style={{ fontSize: '0.85rem', color: 'var(--muted)', gap: '1rem' }}>
                  <span>Средняя оценка: {g.averageGrade ? Math.round(g.averageGrade * 10) / 10 : '—'}</span>
                  <span>Посещаемость: {Math.round(g.attendancePercent * 10) / 10}%</span>
                </div>
              </Link>
            ))}
            {!data.groupStats.length && <p>У вас пока нет групп</p>}
          </div>
        </div>

        <div className="card">
          <h3>Задания на проверку</h3>
          <div className="stack">
            {data.toReview.map((s) => (
              <div key={s.id} className="row space-between">
                <div>
                  <strong>{s.assignment.title}</strong>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    {s.group.course.title} · {s.group.code}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Студент: {fullName(s.student.user)} · до {formatDateTime(s.assignment.deadline)}
                  </p>
                </div>
                <Badge tone="warning">Проверить</Badge>
              </div>
            ))}
            {!data.toReview.length && <p>Очередь пуста</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Ближайшие занятия</h3>
          <div className="stack">
            {data.upcomingLessons.slice(1).map((l) => (
              <div key={l.id}>
                <strong>{l.title}</strong>
                <p style={{ margin: 0 }}>
                  {l.group.course.title} · {l.group.code} · {formatDateTime(l.startsAt)}
                </p>
                <Badge tone={l.format === 'ONLINE' ? 'success' : 'info'}>
                  {l.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}
                </Badge>
              </div>
            ))}
            {data.upcomingLessons.length <= 1 && <p>Нет других ближайших занятий</p>}
          </div>
        </div>

        <div className="card">
          <h3>Студенты с низкой посещаемостью</h3>
          <div className="stack">
            {data.lowAttendance.map((x, i) => (
              <div key={i}>
                <strong>{fullName(x.student.user)}</strong>
                <p style={{ margin: 0 }}>
                  {x.groupCode} · {x.percent}%
                </p>
              </div>
            ))}
            {!data.lowAttendance.length && <p>Проблемных студентов нет</p>}
          </div>
        </div>
      </div>
    </div>
  );
}