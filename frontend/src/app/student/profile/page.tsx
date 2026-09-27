'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, formatDateLong, fullName, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { PhotoUploader } from '@/components/cabinet/PhotoUploader';

type Profile = {
  createdAt: string;
  student: {
    phone?: string | null;
    groupStudents: {
      id: string;
      status: string;
      joinedAt: string;
      group: {
        id: string;
        code: string;
        status: string;
        startDate?: string | null;
        endDate?: string | null;
        course: { id: string; title: string };
        teacher?: { user: PersonRef } | null;
      };
    }[];
  } | null;
};

export default function StudentProfilePage() {
  const { user, refresh } = useAuth();
  const { data: profile, loading, reload } = useApiData<Profile>('/api/users/me/profile');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/users/me/profile', { method: 'PATCH', json: form });
      await Promise.all([refresh(), reload()]);
      setMsg({ tone: 'success', text: 'Изменения сохранены.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;
  const groups = profile?.student?.groupStudents ?? [];

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Профиль" subtitle="Личные данные, фото и ваши группы." />

      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Фото профиля</h2>
            <PhotoUploader />
          </section>

          <form className="card" onSubmit={onSubmit}>
            <h2 className="card-title">Личные данные</h2>
            {msg && (
              <Alert tone={msg.tone} onClose={() => setMsg(null)}>
                {msg.text}
              </Alert>
            )}
            <div className="grid grid-2">
              <Field label="Имя">
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Фамилия">
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required maxLength={60} />
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Email" hint="Email меняет администратор">
                <Input value={user.email} disabled />
              </Field>
              <Field label="Телефон">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+992 90 000 00 00"
                />
              </Field>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </form>
        </div>

        <aside className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Аккаунт</h2>
            <dl className="kv">
              <dt>Имя</dt>
              <dd>{fullName(user)}</dd>
              <dt>Роль</dt>
              <dd>{statusLabel[user.role]}</dd>
              <dt>Дата регистрации</dt>
              <dd>{formatDateLong(profile?.createdAt ?? user.createdAt)}</dd>
            </dl>
          </section>
          <section className="card">
            <h2 className="card-title">Мои группы и курсы</h2>
            {loading ? (
              <LoadingState />
            ) : groups.length === 0 ? (
              <p className="muted">
                Вы пока не состоите в группах. <Link href="/student/catalog" className="text-link">Выбрать курс</Link>
              </p>
            ) : (
              <ul className="list-plain">
                {groups.map((gs) => (
                  <li key={gs.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/student/courses/${gs.group.course.id}`} className="text-link">
                        {gs.group.course.title}
                      </Link>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        Группа {gs.group.code}
                        {gs.group.teacher ? ` · ${fullName(gs.group.teacher.user)}` : ''}
                      </div>
                      <small className="muted">
                        {gs.group.startDate ? `${formatDate(gs.group.startDate)} — ${formatDate(gs.group.endDate)}` : `В группе с ${formatDate(gs.joinedAt)}`}
                      </small>
                    </div>
                    <Badge tone={gs.status === 'ACTIVE' ? 'success' : 'default'}>{gs.status === 'ACTIVE' ? 'Учусь' : 'Завершено'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
