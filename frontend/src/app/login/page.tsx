'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ApiRequestError } from '@/lib/api';
import { dashboardPath, useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@somon.local');
  const [password, setPassword] = useState('Somon123!');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      router.push(dashboardPath(user.role));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <form className="card" style={{ width: 'min(420px, 100%)' }} onSubmit={onSubmit}>
        <Link href="/" className="brand" style={{ color: 'var(--brand)', fontWeight: 800, fontSize: '1.4rem' }}>
          Somon
        </Link>
        <h1 className="page-title" style={{ marginTop: '1rem' }}>
          Вход
        </h1>
        <p className="page-sub">Войдите в учебный кабинет</p>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Пароль">
          <div className="row">
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <Button type="button" variant="secondary" onClick={() => setShow((s) => !s)}>
              {show ? 'Скрыть' : 'Показать'}
            </Button>
          </div>
        </Field>
        {error && <p className="error-text">{error}</p>}
        <Button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Вход...' : 'Войти'}
        </Button>
        <p style={{ marginTop: '1rem' }}>
          Нет аккаунта? <Link href="/register">Регистрация</Link>
        </p>
      </form>
    </div>
  );
}
