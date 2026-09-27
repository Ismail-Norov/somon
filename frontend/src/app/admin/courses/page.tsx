'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { statusLabel } from '@/lib/format';

type Course = {
  id: string;
  title: string;
  level: string;
  status: string;
  category?: { name: string };
  _count?: { groups: number };
};

type Category = { id: string; name: string };

export default function AdminCoursesPage() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApiData<Course[]>(
    `/api/courses${q ? `?q=${encodeURIComponent(q)}` : ''}`
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    shortDesc: '',
    description: '',
    categoryId: '',
    level: 'BEGINNER',
    durationWeeks: 8,
    lessonsCount: 12,
    maxStudents: 16,
    status: 'PUBLISHED',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Category[]>('/api/courses/meta/categories').then(setCategories).catch(() => undefined);
  }, []);

  async function createCourse(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/courses', {
        method: 'POST',
        json: { ...form, categoryId: form.categoryId || null },
      });
      setOpen(false);
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  async function archive(id: string) {
    await api(`/api/courses/${id}/archive`, { method: 'PATCH' });
    reload();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Курсы</h1>
          <p className="page-sub">Каталог образовательных программ</p>
        </div>
        <Button onClick={() => setOpen(true)}>Создать курс</Button>
      </div>
      <Input
        placeholder="Поиск"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 320, marginBottom: '1rem' }}
      />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Название</th>
              <th>Категория</th>
              <th>Уровень</th>
              <th>Группы</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.category?.name || '—'}</td>
                <td>{statusLabel[c.level]}</td>
                <td>{c._count?.groups ?? 0}</td>
                <td>
                  <Badge tone={c.status === 'PUBLISHED' ? 'success' : 'warning'}>{statusLabel[c.status]}</Badge>
                </td>
                <td>
                  {c.status !== 'ARCHIVED' && (
                    <Button variant="secondary" onClick={() => archive(c.id)}>
                      Архивировать
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Новый курс" onClose={() => setOpen(false)}>
        <form onSubmit={createCourse}>
          <Field label="Название">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Краткое описание">
            <Input value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} />
          </Field>
          <Field label="Полное описание">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Категория">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Уровень">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="BEGINNER">Начальный</option>
              <option value="INTERMEDIATE">Средний</option>
              <option value="ADVANCED">Продвинутый</option>
            </Select>
          </Field>
          <Field label="Статус">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">Черновик</option>
              <option value="PUBLISHED">Опубликован</option>
            </Select>
          </Field>
          {msg && <p className="error-text">{msg}</p>}
          <Button type="submit">Создать</Button>
        </form>
      </Modal>
    </div>
  );
}
