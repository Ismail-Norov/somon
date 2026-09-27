'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import type { BranchWithRooms, ScheduleLesson } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/States';
import { dayKey } from './calendar-utils';

export type GroupOption = { id: string; code: string; format?: string; teacherId?: string | null; course: { id?: string; title: string } };
export type TeacherOption = { id: string; user: { firstName: string; lastName: string } };

type Props = {
  lesson?: ScheduleLesson | null;
  defaultDate?: Date | null;
  isAdmin: boolean;
  groups: GroupOption[];
  branches: BranchWithRooms[];
  teachers: TeacherOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const combine = (day: string, time: string) => new Date(`${day}T${time}`);

function initialState(lesson: ScheduleLesson | null | undefined, defaultDate: Date | null | undefined, groups: GroupOption[]) {
  if (lesson) {
    const s = new Date(lesson.startsAt);
    return {
      groupId: lesson.groupId,
      title: lesson.title,
      day: dayKey(s),
      start: hhmm(s),
      end: hhmm(new Date(lesson.endsAt)),
      format: lesson.format,
      teacherId: lesson.teacherId ?? '',
      branchId: lesson.branchId ?? '',
      classroomId: lesson.classroomId ?? '',
      meetingUrl: lesson.meetingUrl ?? '',
      comment: lesson.comment ?? '',
      repeat: false,
      repeatWeeks: '4',
    };
  }
  const group = groups[0];
  return {
    groupId: group?.id ?? '',
    title: '',
    day: dayKey(defaultDate ?? new Date()),
    start: '15:00',
    end: '16:30',
    format: group?.format ?? 'OFFLINE',
    teacherId: '',
    branchId: '',
    classroomId: '',
    meetingUrl: '',
    comment: '',
    repeat: false,
    repeatWeeks: '4',
  };
}

/** Mount only while open: the initial state is taken from props once. */
export function LessonForm({ lesson, defaultDate, isAdmin, groups, branches, teachers, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => initialState(lesson, defaultDate, groups));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const branch = branches.find((b) => b.id === form.branchId);
  const needsPlace = form.format !== 'ONLINE';
  const needsLink = form.format !== 'OFFLINE';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = combine(form.day, form.start);
    const endsAt = combine(form.day, form.end);
    if (!form.groupId) return setError('Выберите группу');
    if (!form.title.trim()) return setError('Укажите тему занятия');
    if (Number.isNaN(+startsAt) || Number.isNaN(+endsAt)) return setError('Укажите дату и время');
    if (endsAt <= startsAt) return setError('Время окончания должно быть позже начала');
    if (form.format === 'OFFLINE' && !form.branchId) return setError('Для офлайн-занятия выберите филиал');
    if (form.meetingUrl && !/^https?:\/\/\S+$/i.test(form.meetingUrl.trim())) return setError('Ссылка должна начинаться с http:// или https://');

    const payload: Record<string, unknown> = {
      groupId: form.groupId,
      title: form.title.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      format: form.format,
      branchId: needsPlace ? form.branchId || null : null,
      classroomId: needsPlace ? form.classroomId || null : null,
      meetingUrl: needsLink ? form.meetingUrl.trim() : '',
      comment: form.comment.trim() || null,
    };
    if (isAdmin) payload.teacherId = form.teacherId || null;
    if (!lesson && form.repeat) payload.repeatWeeks = Math.min(26, Math.max(1, Number(form.repeatWeeks) || 1));

    setSaving(true);
    setError('');
    try {
      if (lesson) {
        await api(`/api/lessons/${lesson.id}`, { method: 'PATCH', json: payload });
        const moved = +new Date(lesson.startsAt) !== +startsAt || +new Date(lesson.endsAt) !== +endsAt;
        onSaved(moved ? 'Занятие перенесено, участники получили уведомление' : 'Занятие сохранено');
      } else {
        await api('/api/lessons', { method: 'POST', json: payload });
        onSaved(payload.repeatWeeks ? `Создано занятий: ${payload.repeatWeeks}` : 'Занятие добавлено в расписание');
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить занятие');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={lesson ? 'Изменить / перенести занятие' : 'Новое занятие'} onClose={() => !saving && onClose()}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="form-grid">
          <Field label="Группа">
            <Select
              value={form.groupId}
              onChange={(e) => {
                const g = groups.find((x) => x.id === e.target.value);
                set({ groupId: e.target.value, ...(lesson ? {} : { format: g?.format ?? form.format }) });
              }}
              required
            >
              <option value="">Выберите группу</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.course.title}
                </option>
              ))}
            </Select>
          </Field>
          {isAdmin && (
            <Field label="Преподаватель">
              <Select value={form.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
                <option value="">Преподаватель группы</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.lastName} {t.user.firstName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Тема занятия">
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} placeholder="Например: JavaScript — функции" />
        </Field>
        <div className="form-grid">
          <Field label="Дата">
            <Input type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} required />
          </Field>
          <Field label="Начало">
            <Input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} required />
          </Field>
          <Field label="Окончание">
            <Input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} required />
          </Field>
        </div>
        <Field label="Формат">
          <div className="segmented" role="radiogroup">
            {[
              ['OFFLINE', '🏫 Офлайн'],
              ['ONLINE', '💻 Онлайн'],
              ['HYBRID', '🔀 Смешанный'],
            ].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={form.format === k} className={form.format === k ? 'active' : ''} onClick={() => set({ format: k })}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        {needsPlace && (
          <div className="form-grid">
            <Field label={form.format === 'OFFLINE' ? 'Филиал' : 'Филиал (для очной части)'}>
              <Select value={form.branchId} onChange={(e) => set({ branchId: e.target.value, classroomId: '' })} required={form.format === 'OFFLINE'}>
                <option value="">Не выбран</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Аудитория">
              <Select value={form.classroomId} onChange={(e) => set({ classroomId: e.target.value })} disabled={!branch}>
                <option value="">{branch ? 'Не выбрана' : 'Сначала выберите филиал'}</option>
                {branch?.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.capacity ? ` · до ${c.capacity} чел.` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {branch && needsPlace && <small className="muted">📍 {branch.address}</small>}
        {needsLink && (
          <Field label="Ссылка на онлайн-занятие" hint="Zoom, Google Meet, Teams и т. п. Можно добавить позже">
            <Input type="url" value={form.meetingUrl} onChange={(e) => set({ meetingUrl: e.target.value })} placeholder="https://meet.google.com/..." />
          </Field>
        )}
        <Field label="Комментарий">
          <Textarea rows={2} value={form.comment} onChange={(e) => set({ comment: e.target.value })} maxLength={2000} placeholder="Что взять с собой, что повторить и т. п." />
        </Field>
        {!lesson && (
          <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: '0.4rem' }}>
              <input type="checkbox" checked={form.repeat} onChange={(e) => set({ repeat: e.target.checked })} />
              Повторять каждую неделю
            </label>
            {form.repeat && (
              <span className="row" style={{ gap: '0.4rem' }}>
                <Input type="number" min={2} max={26} value={form.repeatWeeks} onChange={(e) => set({ repeatWeeks: e.target.value })} style={{ width: 80 }} />
                <span className="muted">занятий</span>
              </span>
            )}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохраняем...' : lesson ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
