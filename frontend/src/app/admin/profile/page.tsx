'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateLong, statusLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { PhotoUploader } from '@/components/cabinet/PhotoUploader';
import { PasswordChangeCard } from '@/components/cabinet/PasswordChangeCard';

export default function AdminProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName, lastName: user.lastName });
  }, [user]);

  const submit = async (e: FormEvent) => {
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
  };

  if (!user) return null;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Профиль администратора" subtitle="Личные данные и безопасность аккаунта" />
      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Фото профиля</h2>
            <PhotoUploader />
          </section>
          <form className="card" onSubmit={submit}>
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
            </div>
            <Field label="Email">
              <Input value={user.email} disabled />
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
              <dd>{formatDateLong(user.createdAt)}</dd>
            </dl>
          </section>
          <PasswordChangeCard />
        </aside>
      </div>
    </div>
  );
}
