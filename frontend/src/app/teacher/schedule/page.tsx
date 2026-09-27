'use client';

import { useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, statusLabel } from '@/lib/format';

type Lesson = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  format: string;
  room?: string;
  meetingUrl?: string;
  status: string;
  group: { code: string; course: { title: string } };
};

type Filter = 'all' | 'upcoming' | 'past' | 'today';

export default function TeacherSchedulePage() {
  const { data, loading, error, reload } = useApiData<Lesson[]>('/api/lessons');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filteredLessons = useMemo(() => {
    if (!data) return [];
    
    const lessons = data.filter((l) => {
      const lessonDate = new Date(l.startsAt);
      const lessonDay = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), lessonDate.getDate());
      
      if (selectedDate) {
        return lessonDay.getTime() === new Date(selectedDate).getTime();
      }
      
      switch (filter) {
        case 'upcoming':
          return lessonDate >= now;
        case 'past':
          return lessonDate < now;
        case 'today':
          return lessonDay.getTime() === today.getTime();
        default:
          return true;
      }
    });

    return lessons.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [data, filter, selectedDate, now, today]);

  const calendarDays = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [now]);

  const hasLessonOnDay = (date: Date) => {
    if (!data) return false;
    return data.some((l) => {
      const lessonDate = new Date(l.startsAt);
      return (
        lessonDate.getDate() === date.getDate() &&
        lessonDate.getMonth() === date.getMonth() &&
        lessonDate.getFullYear() === date.getFullYear()
      );
    });
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return (
    <div>
      <h1 className="page-title">Расписание</h1>
      <p className="page-sub">Занятия ваших групп</p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className={`tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => { setFilter('all'); setSelectedDate(null); }}
          >
            Все
          </button>
          <button
            className={`tab ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => { setFilter('upcoming'); setSelectedDate(null); }}
          >
            Предстоящие
          </button>
          <button
            className={`tab ${filter === 'today' ? 'active' : ''}`}
            onClick={() => { setFilter('today'); setSelectedDate(null); }}
          >
            Сегодня
          </button>
          <button
            className={`tab ${filter === 'past' ? 'active' : ''}`}
            onClick={() => { setFilter('past'); setSelectedDate(null); }}
          >
            Прошедшие
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>
            {months[now.getMonth()]} {now.getFullYear()}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.25rem',
              maxWidth: 400,
            }}
          >
            {days.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.5rem',
                  color: 'var(--muted)',
                }}
              >
                {day}
              </div>
            ))}
            {calendarDays.map((date, i) => {
              if (!date) {
                return <div key={i} style={{ padding: '0.5rem' }} />;
              }
              const isToday = date.getTime() === today.getTime();
              const isSelected = selectedDate && date.getTime() === new Date(selectedDate).getTime();
              const hasLesson = hasLessonOnDay(date);

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDate(date.toISOString());
                    setFilter('all');
                  }}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: isSelected ? 'var(--brand)' : isToday ? 'var(--brand-soft)' : '#fff',
                    color: isSelected ? '#fff' : isToday ? 'var(--brand-dark)' : 'inherit',
                    cursor: 'pointer',
                    fontWeight: isToday ? 600 : 400,
                    position: 'relative',
                  }}
                >
                  {date.getDate()}
                  {hasLesson && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: isSelected ? '#fff' : 'var(--brand)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!filteredLessons.length && <EmptyState title="Занятий нет" />}
      
      {filteredLessons.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тема</th>
                <th>Группа</th>
                <th>Формат</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredLessons.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div>
                      <strong>{formatDateTime(l.startsAt)}</strong>
                      <div className="hint">{formatDateTime(l.endsAt)}</div>
                    </div>
                  </td>
                  <td>
                    <strong>{l.title}</strong>
                    {l.format === 'ONLINE' && l.meetingUrl && (
                      <div>
                        <a
                          href={l.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.85rem', color: 'var(--brand)' }}
                        >
                          Перейти к занятию
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>
                      <strong>{l.group.course.title}</strong>
                      <div className="hint">{l.group.code}</div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={l.format === 'ONLINE' ? 'success' : 'info'}>
                      {l.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}
                    </Badge>
                    {l.format === 'OFFLINE' && l.room && (
                      <div className="hint">Аудитория: {l.room}</div>
                    )}
                  </td>
                  <td>
                    <Badge>{statusLabel[l.status]}</Badge>
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