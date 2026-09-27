'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthLayout } from '@/components/public/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { ApiRequestError } from '@/lib/api';
import { dashboardPath, useAuth } from '@/lib/auth';

const DEMO = [
  { label: 'Администратор', email: 'admin@somon.local' },
  { label: 'Преподаватель', email: 'teacher1@somon.local' },
  { label: 'Студент', email: 'student1@somon.local' },
];

function safeNext(role: string) {
  const next = new URLSearchParams(window.location.search).get('next');
  // only same-origin relative paths, never protocol-relative "//host"
  return next && next.startsWith('/') && !next.startsWith('//') ? next : dashboardPath(role);
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      router.replace(safeNext(user.role));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} noValidate={false}>
        <h1>Вход в Somon</h1>
        <p>Войдите в личный кабинет студента, преподавателя или администратора.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label="Пароль">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <Button variant="secondary" onClick={() => setShow((s) => !s)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
              {show ? 'Скрыть' : 'Показать'}
            </Button>
          </div>
        </Field>
        <Button type="submit" size="lg" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Вход...' : 'Войти'}
        </Button>
        <p className="auth-switch">
          Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
        </p>
        <div className="demo-accounts">
          <p>Демо-аккаунты (пароль Somon123!):</p>
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword('Somon123!');
              }}
            >
              {d.label} — {d.email}
            </button>
          ))}
        </div>
      </form>
    </AuthLayout>
  );
}
