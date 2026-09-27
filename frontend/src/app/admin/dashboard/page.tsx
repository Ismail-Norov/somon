'use client';

import { useApiData } from '@/lib/useApiData';
import { ErrorState, LoadingState } from '@/components/ui/States';

type AdminDash = {
  users: { total: number; active: number };
  students: number;
  teachers: number;
  courses: { active: number; archived: number };
  groups: { current: number; completed: number };
  lessons: { today: number; week: number };
  assignments: { total: number; pendingReview: number };
  attendancePercent: number;
  averageGrade: number | null;
  teacherLoad: { id: string; name: string; groups: number }[];
};

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApiData<AdminDash>('/api/analytics/admin');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const cards = [
    ['Пользователи', `${data.users.active} / ${data.users.total}`],
    ['Студенты', String(data.students)],
    ['Преподаватели', String(data.teachers)],
    ['Курсы', `${data.courses.active} акт. / ${data.courses.archived} арх.`],
    ['Группы', `${data.groups.current} тек. / ${data.groups.completed} зав.`],
    ['Занятия', `${data.lessons.today} сегодня / ${data.lessons.week} неделя`],
    ['Задания', `${data.assignments.pendingReview} на проверке / ${data.assignments.total}`],
    ['Посещаемость', `${data.attendancePercent}%`],
  ];

  return (
    <div>
      <h1 className="page-title">Dashboard администратора</h1>
      <p className="page-sub">Состояние образовательного центра Somon</p>
      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: '1.35rem' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Нагрузка преподавателей</h3>
        <div className="stack">
          {data.teacherLoad.map((t) => (
            <div className="row space-between" key={t.id}>
              <span>{t.name}</span>
              <strong>{t.groups} групп</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
