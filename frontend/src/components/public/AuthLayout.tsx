'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { dashboardPath, useAuth } from '@/lib/auth';
import { Logo } from './PublicHeader';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const checked = useRef(false);

  // Only bounce users who were already signed in when the page opened;
  // a fresh login redirects itself (and may honour ?next=).
  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (user) router.replace(dashboardPath(user.role));
  }, [user, loading, router]);

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Logo light />
        <div>
          <h2>Учись. Развивайся. Достигай большего.</h2>
          <p>Личный кабинет Somon — всё обучение в одном месте:</p>
          <ul>
            <li>расписание онлайн- и офлайн-занятий</li>
            <li>материалы, видео и задания курса</li>
            <li>оценки и комментарии преподавателя</li>
            <li>прогресс и история активности</li>
          </ul>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>Веб-приложение для управления образовательным центром Somon</p>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <BackLink href="/" label="Вернуться на главную" />
          {children}
        </div>
      </main>
    </div>
  );
}
