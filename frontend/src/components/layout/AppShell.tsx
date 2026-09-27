'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { dashboardPath, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { statusLabel } from '@/lib/format';
import { NOTIFICATIONS_EVENT } from '@/lib/events';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingState } from '@/components/ui/States';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
type NavItem = { href: string; label: string; icon: string; badge?: 'notifications' | 'review' };
type NavSection = { title?: string; items: NavItem[] };

const NAV: Record<Role, NavSection[]> = {
  STUDENT: [
    {
      items: [
        { href: '/student/dashboard', label: 'Главная', icon: '🏠' },
        { href: '/student/courses', label: 'Мои курсы', icon: '📚' },
        { href: '/student/schedule', label: 'Расписание', icon: '🗓️' },
        { href: '/student/assignments', label: 'Задания', icon: '📝' },
        { href: '/student/materials', label: 'Материалы', icon: '📂' },
      ],
    },
    {
      title: 'Успеваемость',
      items: [
        { href: '/student/progress', label: 'Мой прогресс', icon: '📈' },
        { href: '/student/grades', label: 'Оценки', icon: '⭐' },
        { href: '/student/attendance', label: 'Посещаемость', icon: '✅' },
        { href: '/student/activity', label: 'Активность', icon: '🕒' },
      ],
    },
    {
      title: 'Ещё',
      items: [
        { href: '/student/catalog', label: 'Доступные курсы', icon: '🧭' },
        { href: '/student/notifications', label: 'Уведомления', icon: '🔔', badge: 'notifications' },
        { href: '/student/profile', label: 'Профиль', icon: '👤' },
      ],
    },
  ],
  TEACHER: [
    {
      items: [
        { href: '/teacher/dashboard', label: 'Главная', icon: '🏠' },
        { href: '/teacher/groups', label: 'Мои группы', icon: '👥' },
        { href: '/teacher/schedule', label: 'Расписание', icon: '🗓️' },
        { href: '/teacher/attendance', label: 'Посещаемость', icon: '✅' },
      ],
    },
    {
      title: 'Обучение',
      items: [
        { href: '/teacher/review', label: 'Работы на проверке', icon: '📥', badge: 'review' },
        { href: '/teacher/assignments', label: 'Задания', icon: '📝' },
        { href: '/teacher/grades', label: 'Оценки', icon: '⭐' },
        { href: '/teacher/materials', label: 'Материалы', icon: '📂' },
      ],
    },
    {
      title: 'Ещё',
      items: [
        { href: '/teacher/announcements', label: 'Объявления', icon: '📢' },
        { href: '/teacher/analytics', label: 'Аналитика', icon: '📊' },
        { href: '/teacher/notifications', label: 'Уведомления', icon: '🔔', badge: 'notifications' },
        { href: '/teacher/profile', label: 'Профиль', icon: '👤' },
      ],
    },
  ],
  ADMIN: [
    {
      items: [
        { href: '/admin/dashboard', label: 'Главная', icon: '🏠' },
        { href: '/admin/users', label: 'Пользователи', icon: '👤' },
        { href: '/admin/courses', label: 'Курсы', icon: '📚' },
        { href: '/admin/groups', label: 'Группы', icon: '👥' },
        { href: '/admin/schedule', label: 'Расписание', icon: '🗓️' },
      ],
    },
    {
      title: 'Центр',
      items: [
        { href: '/admin/branches', label: 'Филиалы', icon: '🏫' },
        { href: '/admin/statistics', label: 'Статистика', icon: '📊' },
        { href: '/admin/settings', label: 'Настройки', icon: '⚙️' },
      ],
    },
  ],
};

const NOTIFICATIONS_PATH: Record<Role, string> = {
  STUDENT: '/student/notifications',
  TEACHER: '/teacher/notifications',
  ADMIN: '/admin/dashboard',
};

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ notifications: 0, review: 0 });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (loading || leaving) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user.role !== role) router.replace(dashboardPath(user.role));
  }, [user, loading, role, router, pathname, leaving]);

  const loadCounts = useCallback(() => {
    if (!user) return;
    api<{ unreadCount: number }>('/api/notifications?unread=true')
      .then((d) => setCounts((c) => ({ ...c, notifications: d.unreadCount || 0 })))
      .catch(() => undefined);
    if (user.role === 'TEACHER') {
      api<unknown[]>('/api/assignments/submissions/review')
        .then((d) => setCounts((c) => ({ ...c, review: d.length })))
        .catch(() => undefined);
    }
  }, [user]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts, pathname]);

  useEffect(() => {
    const timer = window.setInterval(loadCounts, 60_000);
    window.addEventListener(NOTIFICATIONS_EVENT, loadCounts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_EVENT, loadCounts);
    };
  }, [loadCounts]);

  useEffect(() => setOpen(false), [pathname]);

  const onLogout = async () => {
    setLeaving(true);
    await logout();
    router.replace('/login');
  };

  if (loading || !user || user.role !== role) {
    return <LoadingState label={leaving ? 'Выходим...' : 'Загрузка...'} />;
  }

  const sections = NAV[role];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Меню кабинета">
        <div className="row space-between">
          <Link href={dashboardPath(role)} className="brand">
            Somon
          </Link>
          <button className="mobile-toggle" type="button" onClick={() => setOpen(false)} aria-label="Закрыть меню">
            ✕
          </button>
        </div>
        <nav>
          {sections.map((section, i) => (
            <div key={section.title ?? i} className="stack" style={{ gap: '0.2rem' }}>
              {section.title && <div className="sidebar-section">{section.title}</div>}
              {section.items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
                    <span className="row" style={{ gap: '0.6rem' }}>
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </span>
                    {count > 0 && <span className="nav-count">{count > 99 ? '99+' : count}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link href="/">← На сайт Somon</Link>
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="row" style={{ minWidth: 0 }}>
            <button type="button" className="topbar-burger" onClick={() => setOpen(true)} aria-label="Открыть меню">
              ☰
            </button>
            <span className="topbar-title">Личный кабинет · {statusLabel[role]}</span>
          </div>
          <div className="row" style={{ gap: '0.9rem' }}>
            <Link
              href={NOTIFICATIONS_PATH[role]}
              className="bell"
              aria-label={`Уведомления${counts.notifications ? `: ${counts.notifications} непрочитанных` : ''}`}
            >
              🔔
              {counts.notifications > 0 && (
                <span className="bell-count">{counts.notifications > 99 ? '99+' : counts.notifications}</span>
              )}
            </Link>
            <Link href={role === 'ADMIN' ? '/admin/settings' : `/${role.toLowerCase()}/profile`} className="topbar-user">
              <Avatar user={user} size={38} />
              <span className="topbar-user-text">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <small>{statusLabel[role]}</small>
              </span>
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
