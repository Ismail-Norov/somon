'use client';

import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatDate, statusLabel } from '@/lib/format';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApiData<UserRow[]>(
    `/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: 'Somon123!',
    firstName: '',
    lastName: '',
    role: 'STUDENT',
  });
  const [msg, setMsg] = useState('');

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/users', { method: 'POST', json: form });
      setOpen(false);
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  async function block(id: string) {
    await api(`/api/users/${id}`, { method: 'PATCH', json: { status: 'BLOCKED' } });
    reload();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Пользователи</h1>
          <p className="page-sub">Управление учётными записями</p>
        </div>
        <Button onClick={() => setOpen(true)}>Создать</Button>
      </div>
      <Input
        placeholder="Поиск по имени или email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360, marginBottom: '1rem' }}
      />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Создан</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.email}</td>
                <td>
                  <Badge tone="brand">{statusLabel[u.role]}</Badge>
                </td>
                <td>
                  <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{statusLabel[u.status]}</Badge>
                </td>
                <td>{formatDate(u.createdAt)}</td>
                <td>
                  {u.status === 'ACTIVE' && (
                    <Button variant="secondary" onClick={() => block(u.id)}>
                      Блокировать
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Новый пользователь" onClose={() => setOpen(false)}>
        <form onSubmit={createUser}>
          <Field label="Имя">
            <Input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Фамилия">
            <Input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Пароль">
            <Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Роль">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="STUDENT">Студент</option>
              <option value="TEACHER">Преподаватель</option>
              <option value="ADMIN">Администратор</option>
            </Select>
          </Field>
          {msg && <p className="error-text">{msg}</p>}
          <Button type="submit">Создать</Button>
        </form>
      </Modal>
    </div>
  );
}
