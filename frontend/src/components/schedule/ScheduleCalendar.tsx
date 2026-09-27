'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { BranchWithRooms, LessonDetail, Role, ScheduleLesson } from '@/lib/types';
import { fullName, statusLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Alert, ErrorState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import {
  addDays,
  CalendarView,
  DAY_END_HOUR,
  DAY_START_HOUR,
  dayKey,
  layoutColumns,
  parseDayKey,
  sameDay,
  shiftCursor,
  startOfDay,
  timeLabel,
  timePosition,
  viewRange,
  viewTitle,
  WEEKDAYS_SHORT,
} from './calendar-utils';
import { LessonDetails } from './LessonDetails';
import { GroupOption, LessonForm, TeacherOption } from './LessonForm';

type Filters = { courseId: string; groupId: string; teacherId: string; format: string; branchId: string };
const EMPTY_FILTERS: Filters = { courseId: '', groupId: '', teacherId: '', format: '', branchId: '' };

const SUBTITLE: Record<Role, string> = {
  STUDENT: 'Ваши занятия по всем курсам',
  TEACHER: 'Занятия ваших групп',
  ADMIN: 'Все занятия учебного центра',
};

function placeShort(l: ScheduleLesson) {
  if (l.format === 'ONLINE') return 'Онлайн';
  return [l.branch?.name, l.classroom?.name ?? l.room].filter(Boolean).join(' · ') || statusLabel[l.format];
}

function eventClass(l: ScheduleLesson) {
  return `cal-event cal-${l.format.toLowerCase()} ${l.status === 'CANCELLED' ? 'cal-cancelled' : ''} ${l.status === 'COMPLETED' ? 'cal-done' : ''}`;
}

export function ScheduleCalendar({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const isAdmin = role === 'ADMIN';
  const canCreate = role !== 'STUDENT';

  const [view, setView] = useState<CalendarView>((params.get('view') as CalendarView) || 'month');
  const [cursor, setCursor] = useState<Date>(() => parseDayKey(params.get('date') ?? '') ?? startOfDay(new Date()));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openLesson, setOpenLesson] = useState<string | null>(params.get('lessonId'));
  const [form, setForm] = useState<{ open: boolean; lesson: ScheduleLesson | null; date: Date | null }>({ open: false, lesson: null, date: null });
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!params.get('view') && window.matchMedia('(max-width: 640px)').matches) setView('day');
  }, [params]);

  const groups = useApiData<GroupOption[]>('/api/groups');
  const branches = useApiData<BranchWithRooms[]>('/api/branches');
  const teachers = useApiData<TeacherOption[]>(isAdmin ? '/api/teachers' : null);

  const range = useMemo(() => viewRange(view, cursor), [view, cursor]);
  const query = useMemo(() => {
    const q = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
    Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
    return q.toString();
  }, [range, filters]);
  const lessons = useApiData<ScheduleLesson[]>(`/api/lessons?${query}`);

  const syncUrl = useCallback(
    (next: { view?: CalendarView; cursor?: Date; lessonId?: string | null }) => {
      const q = new URLSearchParams();
      q.set('view', next.view ?? view);
      q.set('date', dayKey(next.cursor ?? cursor));
      const lessonId = next.lessonId === undefined ? openLesson : next.lessonId;
      if (lessonId) q.set('lessonId', lessonId);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [view, cursor, openLesson, pathname, router]
  );

  useEffect(() => {
    const id = params.get('lessonId');
    if (!id || params.get('date')) return;
    api<ScheduleLesson>(`/api/lessons/${id}`)
      .then((l) => setCursor(startOfDay(new Date(l.startsAt))))
      .catch(() => undefined);
  }, [params]);

  const go = (next: { view?: CalendarView; cursor?: Date }) => {
    if (next.view) setView(next.view);
    if (next.cursor) setCursor(next.cursor);
    syncUrl(next);
  };

  const openDetails = (id: string | null) => {
    setOpenLesson(id);
    syncUrl({ lessonId: id });
  };

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    groups.data?.forEach((g) => g.course.id && map.set(g.course.id, g.course.title));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [groups.data]);
  const groupOptions = (groups.data ?? []).filter((g) => !filters.courseId || g.course.id === filters.courseId);
  const manageableGroups = useMemo(
    () => (isAdmin ? groups.data ?? [] : (groups.data ?? []).filter((g) => g.teacherId === user?.teacherId)),
    [isAdmin, groups.data, user?.teacherId]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleLesson[]>();
    for (const l of lessons.data ?? []) {
      const k = dayKey(new Date(l.startsAt));
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return map;
  }, [lessons.data]);

  const canManage = (l: LessonDetail) => isAdmin || (role === 'TEACHER' && l.group.teacherId === user?.teacherId);

  const afterChange = (message: string) => {
    setMsg(message);
    setForm({ open: false, lesson: null, date: null });
    openDetails(null);
    lessons.reload();
  };

  const setFilter = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const days = view === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Расписание"
        subtitle={SUBTITLE[role]}
        actions={
          canCreate && manageableGroups.length > 0 ? (
            <Button onClick={() => setForm({ open: true, lesson: null, date: cursor })}>+ Занятие</Button>
          ) : undefined
        }
      />

      {msg && (
        <Alert tone="success" onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      )}

      <div className="card cal-toolbar">
        <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => go({ cursor: shiftCursor(view, cursor, -1) })} aria-label="Назад">
            ‹
          </Button>
          <Button variant="secondary" size="sm" onClick={() => go({ cursor: startOfDay(new Date()) })}>
            Сегодня
          </Button>
          <Button variant="secondary" size="sm" onClick={() => go({ cursor: shiftCursor(view, cursor, 1) })} aria-label="Вперёд">
            ›
          </Button>
          <strong className="cal-title">{viewTitle(view, cursor)}</strong>
        </div>
        <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={dayKey(cursor)}
            onChange={(e) => {
              const d = parseDayKey(e.target.value);
              if (d) go({ cursor: d });
            }}
            aria-label="Перейти к дате"
          />
          <div className="segmented" role="tablist">
            {(
              [
                ['month', 'Месяц'],
                ['week', 'Неделя'],
                ['day', 'День'],
              ] as [CalendarView, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'active' : ''} onClick={() => go({ view: k })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cal-filters">
        <Select value={filters.courseId} onChange={(e) => setFilter({ courseId: e.target.value, groupId: '' })} aria-label="Курс">
          <option value="">Все курсы</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </Select>
        {role !== 'STUDENT' && (
          <Select value={filters.groupId} onChange={(e) => setFilter({ groupId: e.target.value })} aria-label="Группа">
            <option value="">Все группы</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code}
              </option>
            ))}
          </Select>
        )}
        {isAdmin && (
          <Select value={filters.teacherId} onChange={(e) => setFilter({ teacherId: e.target.value })} aria-label="Преподаватель">
            <option value="">Все преподаватели</option>
            {teachers.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {fullName(t.user)}
              </option>
            ))}
          </Select>
        )}
        <Select value={filters.format} onChange={(e) => setFilter({ format: e.target.value })} aria-label="Формат">
          <option value="">Любой формат</option>
          <option value="OFFLINE">Офлайн</option>
          <option value="ONLINE">Онлайн</option>
          <option value="HYBRID">Смешанный</option>
        </Select>
        <Select value={filters.branchId} onChange={(e) => setFilter({ branchId: e.target.value })} aria-label="Филиал">
          <option value="">Все филиалы</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Сбросить ({activeFilters})
          </Button>
        )}
      </div>

      <div className="cal-legend">
        <span className="cal-dot cal-offline" /> Офлайн
        <span className="cal-dot cal-online" /> Онлайн
        <span className="cal-dot cal-hybrid" /> Смешанный
        <span className="cal-dot cal-cancelled" /> Отменено
        {lessons.loading && <span className="muted">· загрузка...</span>}
      </div>

      {lessons.error ? (
        <ErrorState message={lessons.error} onRetry={lessons.reload} />
      ) : view === 'month' ? (
        <div className="cal-month" role="grid" aria-label={viewTitle(view, cursor)}>
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="cal-weekday" role="columnheader">
              {d}
            </div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const day = addDays(range.from, i);
            const items = byDay.get(dayKey(day)) ?? [];
            const outside = day.getMonth() !== cursor.getMonth();
            return (
              <div key={i} className={`cal-cell ${outside ? 'cal-outside' : ''} ${sameDay(day, now) ? 'cal-today' : ''}`} role="gridcell">
                <div className="cal-cell-head">
                  <button type="button" className="cal-daynum" onClick={() => go({ view: 'day', cursor: day })} aria-label={day.toLocaleDateString('ru-RU')}>
                    {day.getDate()}
                  </button>
                  {canCreate && manageableGroups.length > 0 && (
                    <button type="button" className="cal-add" onClick={() => setForm({ open: true, lesson: null, date: day })} aria-label="Добавить занятие">
                      +
                    </button>
                  )}
                </div>
                {items.slice(0, 3).map((l) => (
                  <button key={l.id} type="button" className={`cal-chip ${eventClass(l)}`} onClick={() => openDetails(l.id)} title={`${l.group.course.title} · ${l.title}`}>
                    <span className="cal-chip-time">{timeLabel(new Date(l.startsAt))}</span> {l.group.course.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <button type="button" className="cal-more" onClick={() => go({ view: 'day', cursor: day })}>
                    ещё {items.length - 3}
                  </button>
                )}
                {items.length > 0 && <span className="cal-count">{items.length}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`cal-grid ${view === 'day' ? 'cal-grid-day' : ''}`} style={{ ['--cal-days' as string]: days.length }}>
          <div className="cal-grid-head">
            <div />
            {days.map((d) => (
              <button
                key={d.toISOString()}
                type="button"
                className={`cal-grid-day-head ${sameDay(d, now) ? 'cal-today' : ''}`}
                onClick={() => view === 'week' && go({ view: 'day', cursor: d })}
              >
                <span>{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</span>
                <strong>{d.getDate()}</strong>
              </button>
            ))}
          </div>
          <div className="cal-grid-body">
            <div className="cal-hours">
              {hours.map((h) => (
                <div key={h} className="cal-hour-label">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((d) => {
              const items = byDay.get(dayKey(d)) ?? [];
              const showNow = sameDay(d, now) && now.getHours() >= DAY_START_HOUR && now.getHours() < DAY_END_HOUR;
              return (
                <div key={d.toISOString()} className="cal-col" onDoubleClick={() => canCreate && manageableGroups.length > 0 && setForm({ open: true, lesson: null, date: d })}>
                  {hours.map((h) => (
                    <div key={h} className="cal-hour-line" />
                  ))}
                  {showNow && <div className="cal-now" style={{ top: `${timePosition(now, now).top}%` }} />}
                  {layoutColumns(items).map(({ item: l, col, cols }) => {
                    const pos = timePosition(new Date(l.startsAt), new Date(l.endsAt));
                    const teacher = l.teacher ?? l.group.teacher;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className={eventClass(l)}
                        style={{ top: `${pos.top}%`, height: `${pos.height}%`, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                        onClick={() => openDetails(l.id)}
                        title={`${l.group.course.title} · ${l.title}`}
                      >
                        <span className="cal-event-time">
                          {timeLabel(new Date(l.startsAt))}–{timeLabel(new Date(l.endsAt))}
                        </span>
                        <strong>{l.group.course.title}</strong>
                        <span>{l.title}</span>
                        <span className="cal-event-meta">
                          {l.group.code} · {placeShort(l)}
                        </span>
                        {view === 'day' && teacher && <span className="cal-event-meta">Преподаватель: {fullName(teacher.user)}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!lessons.loading && !lessons.error && !(lessons.data ?? []).length && (
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          {activeFilters ? 'По выбранным фильтрам занятий нет' : 'В этом периоде занятий нет'}
        </p>
      )}

      <LessonDetails
        lessonId={openLesson}
        role={role}
        canManage={canManage}
        onClose={() => openDetails(null)}
        onEdit={(l) => {
          setOpenLesson(null);
          setForm({ open: true, lesson: l, date: null });
        }}
        onChanged={afterChange}
      />

      {canCreate && form.open && (
        <LessonForm
          lesson={form.lesson}
          defaultDate={form.date}
          isAdmin={isAdmin}
          groups={manageableGroups}
          branches={branches.data ?? []}
          teachers={teachers.data ?? []}
          onClose={() => setForm({ open: false, lesson: null, date: null })}
          onSaved={afterChange}
        />
      )}
    </div>
  );
}
