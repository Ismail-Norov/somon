'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { formatDateLong, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { PhotoUploader } from '@/components/cabinet/PhotoUploader';
import { PasswordChangeCard } from '@/components/cabinet/PasswordChangeCard';

type Profile = {
  createdAt: string;
  teacher: {
    groups: { id: string; code: string; status: string; course: { title: string }; _count: { groupStudents: number } }[];
    courses: { id: string; title: string }[];
  } | null;
};

export default function TeacherProfilePage() {
  const { user, refresh } = useAuth();
  const { data: profile } = useApiData<Profile>('/api/users/me/profile');
  const [form, setForm] = useState({ firstName: '', lastName: '', position: '', specialization: '', phone: '', bio: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        position: user.position || '',
        specialization: user.specialization || '',
        phone: user.phone || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/users/me/profile', { method: 'PATCH', json: form });
      await refresh();
      setMsg({ tone: 'success', text: 'Изменения сохранены.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Профиль преподавателя" subtitle="Эти данные видят студенты и посетители сайта на странице преподавателей." />
      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Фото профиля</h2>
            <PhotoUploader />
          </section>
          <form className="card" onSubmit={onSubmit}>
            <h2 className="card-title">Данные</h2>
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
              <Field label="Должность">
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Старший преподаватель" />
              </Field>
              <Field label="Специализация">
                <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </Field>
              <Field label="Телефон">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Email" hint="Email меняет администратор">
                <Input value={user.email} disabled />
              </Field>
            </div>
            <Field label="О себе">
              <Textarea rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={2000} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </form>
        </div>
        <aside className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Аккаунт</h2>
            <dl className="kv">
              <dt>Роль</dt>
              <dd>{statusLabel[user.role]}</dd>
              <dt>Дата регистрации</dt>
              <dd>{formatDateLong(profile?.createdAt ?? user.createdAt)}</dd>
            </dl>
          </section>
          {!!profile?.teacher?.courses?.length && (
            <section className="card">
              <h2 className="card-title">Мои курсы</h2>
              <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                {profile.teacher.courses.map((c) => (
                  <Badge key={c.id} tone="brand">
                    {c.title}
                  </Badge>
                ))}
              </div>
            </section>
          )}
          <section className="card">
            <h2 className="card-title">Мои группы</h2>
            {!profile?.teacher?.groups.length ? (
              <p className="muted">Активных групп нет.</p>
            ) : (
              <ul className="list-plain">
                {profile.teacher.groups.map((g) => (
                  <li key={g.id} className="list-row">
                    <div>
                      <strong>{g.code}</strong>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {g.course.title} · {g._count.groupStudents} студ.
                      </div>
                    </div>
                    <Badge tone={g.status === 'ACTIVE' ? 'success' : 'info'}>{statusLabel[g.status] ?? g.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <PasswordChangeCard />
        </aside>
      </div>
    </div>
  );
}
