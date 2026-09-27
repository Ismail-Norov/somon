'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, statusLabel } from '@/lib/format';

type Lesson = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room?: string;
  status: string;
  group: { id: string; code: string; course: { title: string }; teacher?: { user: { firstName: string; lastName: string } } };
};

type Group = { id: string; code: string; course: { title: string } };

export default function AdminSchedulePage() {
  const { data, loading, error, reload } = useApiData<Lesson[]>('/api/lessons');
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Lesson | null>(null);
  const [form, setForm] = useState({
    groupId: '',
    title: '',
    startsAt: '',
    endsAt: '',
    room: '',
    status: 'SCHEDULED',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Group[]>('/api/groups').then(setGroups).catch(() => undefined);
  }, []);

  async function createLesson(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const startsAt = new Date(form.startsAt).toISOString();
      const endsAt = new Date(form.endsAt).toISOString();
      if (edit) {
        await api(`/api/lessons/${edit.id}`, {
          method: 'PATCH',
          json: { ...form, startsAt, endsAt },
        });
      } else {
        await api('/api/lessons', {
          method: 'POST',
          json: { ...form, startsAt, endsAt },
        });
      }
      setOpen(false);
      setEdit(null);
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Расписание</h1>
          <p className="page-sub">Занятия центра</p>
        </div>
        <Button
          onClick={() => {
            setEdit(null);
            setForm({ groupId: '', title: '', startsAt: '', endsAt: '', room: '', status: 'SCHEDULED' });
            setOpen(true);
          }}
        >
          Создать занятие
        </Button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тема</th>
              <th>Группа</th>
              <th>Формат/ауд.</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => (
              <tr key={l.id}>
                <td>{formatDateTime(l.startsAt)}</td>
                <td>{l.title}</td>
                <td>
                  {l.group.course.title} · {l.group.code}
                </td>
                <td>{l.room || '—'}</td>
                <td>
                  <Badge>{statusLabel[l.status]}</Badge>
                </td>
                <td>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEdit(l);
                      setForm({
                        groupId: l.group.id,
                        title: l.title,
                        startsAt: l.startsAt.slice(0, 16),
                        endsAt: l.endsAt.slice(0, 16),
                        room: l.room || '',
                        status: l.status,
                      });
                      setOpen(true);
                    }}
                  >
                    Перенести
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={edit ? 'Изменить занятие' : 'Новое занятие'} onClose={() => setOpen(false)}>
        <form onSubmit={createLesson}>
          <Field label="Группа">
            <Select required value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">Выберите</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.course.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тема">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Начало">
            <Input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </Field>
          <Field label="Окончание">
            <Input
              type="datetime-local"
              required
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </Field>
          <Field label="Аудитория">
            <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </Field>
          <Field label="Статус">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="SCHEDULED">Запланировано</option>
              <option value="COMPLETED">Проведено</option>
              <option value="CANCELLED">Отменено</option>
            </Select>
          </Field>
          {msg && <p className="error-text">{msg}</p>}
          <Button type="submit">{edit ? 'Сохранить' : 'Создать'}</Button>
        </form>
      </Modal>
    </div>
  );
}
