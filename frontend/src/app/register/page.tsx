'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/student/dashboard');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <form className="card" style={{ width: 'min(480px, 100%)' }} onSubmit={onSubmit}>
        <Link href="/" style={{ color: 'var(--brand)', fontWeight: 800, fontSize: '1.4rem' }}>
          Somon
        </Link>
        <h1 className="page-title" style={{ marginTop: '1rem' }}>
          Регистрация студента
        </h1>
        <Field label="Имя">
          <Input
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Фамилия">
          <Input
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Телефон">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Пароль" hint="Минимум 6 символов">
          <Input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="error-text">{error}</p>}
        <Button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Создание...' : 'Создать аккаунт'}
        </Button>
        <p style={{ marginTop: '1rem' }}>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
