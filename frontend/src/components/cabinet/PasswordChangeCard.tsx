'use client';

import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';

const empty = { currentPassword: '', newPassword: '', confirm: '' };

export function PasswordChangeCard() {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword.length < 6) return setMsg({ tone: 'error', text: 'Новый пароль — минимум 6 символов.' });
    if (form.newPassword !== form.confirm) return setMsg({ tone: 'error', text: 'Пароли не совпадают.' });
    setSaving(true);
    try {
      await api('/api/users/me/password', {
        method: 'PATCH',
        json: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm(empty);
      setMsg({ tone: 'success', text: 'Пароль изменён.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить пароль' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="card-title">Смена пароля</h2>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      <Field label="Текущий пароль">
        <Input
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          required
        />
      </Field>
      <Field label="Новый пароль" hint="Минимум 6 символов">
        <Input
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          required
        />
      </Field>
      <Field label="Повторите новый пароль">
        <Input
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          required
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={saving}>
        {saving ? 'Сохраняем...' : 'Изменить пароль'}
      </Button>
    </form>
  );
}
