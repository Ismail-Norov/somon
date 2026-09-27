'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { dashboardPath, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';

type NavItem = { href: string; label: string };

const studentNav: NavItem[] = [
  { href: '/student/dashboard', label: 'Главная' },
  { href: '/student/courses', label: 'Мои курсы' },
  { href: '/student/schedule', label: 'Расписание' },
  { href: '/student/assignments', label: 'Задания' },
  { href: '/student/grades', label: 'Оценки' },
  { href: '/student/materials', label: 'Материалы' },
  { href: '/student/attendance', label: 'Посещаемость' },
  { href: '/student/notifications', label: 'Уведомления' },
  { href: '/student/profile', label: 'Профиль' },
];

const teacherNav: NavItem[] = [
  { href: '/teacher/dashboard', label: 'Главная' },
  { href: '/teacher/groups', label: 'Мои группы' },
  { href: '/teacher/schedule', label: 'Расписание' },
  { href: '/teacher/assignments', label: 'Задания' },
  { href: '/teacher/materials', label: 'Материалы' },
  { href: '/teacher/analytics', label: 'Аналитика' },
  { href: '/teacher/notifications', label: 'Уведомления' },
  { href: '/teacher/profile', label: 'Профиль' },
];

const adminNav: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/courses', label: 'Курсы' },
  { href: '/admin/groups', label: 'Группы' },
  { href: '/admin/schedule', label: 'Расписание' },
  { href: '/admin/statistics', label: 'Статистика' },
  { href: '/admin/settings', label: 'Настройки' },
];

export function AppShell({
  role,
  children,
}: {
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const nav = role === 'ADMIN' ? adminNav : role === 'TEACHER' ? teacherNav : studentNav;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== role) {
      router.replace(dashboardPath(user.role));
    }
  }, [user, loading, role, router]);

  useEffect(() => {
    if (!user) return;
    api<{ unreadCount: number }>('/api/notifications')
      .then((d) => setUnread(d.unreadCount || 0))
      .catch(() => undefined);
  }, [user, pathname]);

  if (loading || !user || user.role !== role) {
    return <LoadingState />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="row space-between">
          <div className="brand">Somon</div>
          <button className="mobile-toggle" type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <nav>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname.startsWith(item.href) ? 'active' : ''}
              onClick={() => setOpen(false)}
            >
              {item.label}
              {item.label === 'Уведомления' && unread > 0 ? ` (${unread})` : ''}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="row">
            <Button variant="secondary" className="mobile-toggle" type="button" onClick={() => setOpen(true)}>
              Меню
            </Button>
            <strong>
              {user.firstName} {user.lastName}
            </strong>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
          >
            Выйти
          </Button>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
