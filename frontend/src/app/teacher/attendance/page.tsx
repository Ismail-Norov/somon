'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { LessonCard, PersonRef } from '@/lib/types';
import { formatDate, formatDateTime, formatTimeRange, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type GroupOption = { id: string; code: string; course: { title: string } };
type LessonDetail = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  groupId: string;
  group: { id: string; code: string; groupStudents: { student: { id: string; user: PersonRef } }[] };
  attendance: { studentId: string; status: Status; note?: string | null }[];
};

const STATUSES: { key: Status; label: string; short: string; tone: string }[] = [
  { key: 'PRESENT', label: 'Присутствовал', short: 'Был', tone: 'success' },
  { key: 'LATE', label: 'Опоздал', short: 'Опоздал', tone: 'warning' },
  { key: 'ABSENT', label: 'Отсутствовал', short: 'Не был', tone: 'danger' },
  { key: 'EXCUSED', label: 'Уважительная причина', short: 'Уваж.', tone: 'info' },
];

function dayKey(d: string | Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function pickDefaultLesson(lessons: LessonCard[]) {
  const now = Date.now();
  const active = lessons.filter((l) => l.status !== 'CANCELLED');
  const started = active.filter((l) => new Date(l.startsAt).getTime() <= now);
  return (started[started.length - 1] ?? active[0])?.id ?? '';
}

function AttendanceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [groupId, setGroupId] = useState(params.get('groupId') ?? '');
  const [lessonId, setLessonId] = useState(params.get('lessonId') ?? '');
  const [date, setDate] = useState('');

  const groups = useApiData<GroupOption[]>('/api/groups');
  const lessons = useApiData<LessonCard[]>(groupId ? `/api/lessons?groupId=${groupId}` : null);
  const lesson = useApiData<LessonDetail>(lessonId ? `/api/lessons/${lessonId}` : null);

  const [marks, setMarks] = useState<Record<string, { status: Status; note: string }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!groupId && groups.data?.length && !params.get('lessonId')) setGroupId(groups.data[0].id);
  }, [groups.data, groupId, params]);

  useEffect(() => {
    if (lesson.data && lesson.data.groupId !== groupId) setGroupId(lesson.data.groupId);
  }, [lesson.data, groupId]);

  useEffect(() => {
    if (!lessonId && lessons.data?.length) setLessonId(pickDefaultLesson(lessons.data));
  }, [lessons.data, lessonId]);

  useEffect(() => {
    if (!lesson.data) return;
    const existing = new Map(lesson.data.attendance.map((a) => [a.studentId, a]));
    const next: Record<string, { status: Status; note: string }> = {};
    for (const gs of lesson.data.group.groupStudents) {
      const a = existing.get(gs.student.id);
      next[gs.student.id] = { status: a?.status ?? 'PRESENT', note: a?.note ?? '' };
    }
    setMarks(next);
    setMsg(null);
  }, [lesson.data]);

  const visibleLessons = useMemo(
    () => (lessons.data ?? []).filter((l) => !date || dayKey(l.startsAt) === date),
    [lessons.data, date]
  );

  const selectGroup = (id: string) => {
    setGroupId(id);
    setLessonId('');
    setDate('');
    router.replace(`/teacher/attendance?groupId=${id}`);
  };

  const selectLesson = (id: string) => {
    setLessonId(id);
    router.replace(`/teacher/attendance?groupId=${groupId}&lessonId=${id}`);
  };

  const setAll = (status: Status) =>
    setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status }])));

  const save = async () => {
    if (!lesson.data) return;
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/attendance/bulk', {
        method: 'POST',
        json: {
          lessonId: lesson.data.id,
          items: Object.entries(marks).map(([studentId, v]) => ({ studentId, status: v.status, note: v.note || null })),
        },
      });
      setMsg({ tone: 'success', text: 'Посещаемость сохранена. Прогресс студентов пересчитан автоматически.' });
      lesson.reload();
      lessons.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить' });
    } finally {
      setSaving(false);
    }
  };

  const counts = STATUSES.map((s) => ({ ...s, n: Object.values(marks).filter((m) => m.status === s.key).length }));
  const students = lesson.data?.group.groupStudents ?? [];
  const alreadyMarked = (lesson.data?.attendance.length ?? 0) > 0;
  const isFuture = lesson.data ? new Date(lesson.data.startsAt).getTime() > Date.now() + 3600000 : false;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Посещаемость"
        subtitle="Выберите группу и занятие, отметьте студентов и сохраните"
        back={groupId ? { href: `/teacher/groups/${groupId}`, label: 'Назад к группе' } : { href: '/teacher/groups', label: 'Назад к группам' }}
      />

      {groups.loading ? (
        <LoadingState />
      ) : groups.error ? (
        <ErrorState message={groups.error} onRetry={groups.reload} />
      ) : !groups.data?.length ? (
        <EmptyState icon="👥" title="У вас пока нет групп" />
      ) : (
        <div className="card form-grid">
          <Field label="Группа">
            <Select value={groupId} onChange={(e) => selectGroup(e.target.value)}>
              {!groupId && <option value="">Выберите группу</option>}
              {groups.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.course.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Занятие">
            <Select value={lessonId} onChange={(e) => selectLesson(e.target.value)} disabled={!visibleLessons.length}>
              {!visibleLessons.length && <option value="">Нет занятий{date ? ' в этот день' : ''}</option>}
              {visibleLessons.length > 0 && !visibleLessons.some((l) => l.id === lessonId) && <option value="">Выберите занятие</option>}
              {visibleLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatDate(l.startsAt)} {formatTimeRange(l.startsAt, l.endsAt)} · {l.title}
                  {l.status === 'CANCELLED' ? ' (отменено)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {lessonId &&
        (lesson.loading ? (
          <LoadingState />
        ) : lesson.error ? (
          <ErrorState message={lesson.error} onRetry={lesson.reload} />
        ) : lesson.data ? (
          <section className="card stack">
            <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 className="card-title" style={{ marginBottom: '0.2rem' }}>
                  {lesson.data.title}
                </h2>
                <span className="muted">
                  {lesson.data.group.code} · {formatDateTime(lesson.data.startsAt)}
                </span>
              </div>
              <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                <Badge tone={lesson.data.status === 'COMPLETED' ? 'success' : lesson.data.status === 'CANCELLED' ? 'danger' : 'info'}>
                  {statusLabel[lesson.data.status] ?? lesson.data.status}
                </Badge>
                {alreadyMarked && <Badge tone="brand">Уже отмечено</Badge>}
              </div>
            </div>

            {lesson.data.status === 'CANCELLED' && <Alert tone="warning">Занятие отменено — отметка посещаемости не требуется.</Alert>}
            {isFuture && <Alert tone="info">Занятие ещё не началось. Отметку можно сохранить заранее, но лучше сделать это во время занятия.</Alert>}

            {students.length === 0 ? (
              <EmptyState icon="🎓" title="В группе нет студентов" />
            ) : (
              <>
                <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="muted">Отметить всех:</span>
                  {STATUSES.map((s) => (
                    <Button key={s.key} size="sm" variant="secondary" onClick={() => setAll(s.key)}>
                      {s.label}
                    </Button>
                  ))}
                </div>

                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Студент</th>
                        <th>Статус</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(({ student }) => {
                        const mark = marks[student.id];
                        return (
                          <tr key={student.id}>
                            <td>
                              <div className="row" style={{ gap: '0.6rem' }}>
                                <Avatar user={student.user} size={34} />
                                <strong>{fullName(student.user)}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="segmented attendance-status" role="radiogroup" aria-label={`Статус: ${fullName(student.user)}`}>
                                {STATUSES.map((s) => (
                                  <button
                                    key={s.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={mark?.status === s.key}
                                    title={s.label}
                                    className={`${mark?.status === s.key ? `active status-${s.tone}` : ''}`}
                                    onClick={() => setMarks((m) => ({ ...m, [student.id]: { note: m[student.id]?.note ?? '', status: s.key } }))}
                                  >
                                    {s.short}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={{ minWidth: 180 }}>
                              <Input
                                value={mark?.note ?? ''}
                                placeholder="Необязательно"
                                maxLength={300}
                                onChange={(e) =>
                                  setMarks((m) => ({ ...m, [student.id]: { status: m[student.id]?.status ?? 'PRESENT', note: e.target.value } }))
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                    {counts.map((c) => (
                      <Badge key={c.key} tone={c.tone as 'success' | 'warning' | 'danger' | 'info'}>
                        {c.label}: {c.n}
                      </Badge>
                    ))}
                  </div>
                  <Button onClick={save} disabled={saving || lesson.data.status === 'CANCELLED'}>
                    {saving ? 'Сохраняем...' : alreadyMarked ? 'Обновить посещаемость' : 'Сохранить посещаемость'}
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null)}
    </div>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AttendanceInner />
    </Suspense>
  );
}
