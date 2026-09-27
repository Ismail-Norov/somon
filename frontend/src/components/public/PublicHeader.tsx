'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { dashboardPath, useAuth } from '@/lib/auth';
import { ButtonLink } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export const PUBLIC_NAV = [
  { href: '/', label: 'Главная' },
  { href: '/courses', label: 'Курсы' },
  { href: '/about', label: 'О центре' },
  { href: '/teachers', label: 'Преподаватели' },
  { href: '/news', label: 'Новости' },
  { href: '/materials', label: 'Материалы' },
  { href: '/contacts', label: 'Контакты' },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`logo ${light ? 'logo-light' : ''}`} aria-label="Somon — на главную">
      <span className="logo-mark" aria-hidden>
        S
      </span>
      <span>Somon</span>
    </Link>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Logo />
        <nav className={`public-nav ${open ? 'open' : ''}`} aria-label="Основная навигация">
          {PUBLIC_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
          <div className="public-nav-auth">
            {!loading && user ? (
              <Link href={dashboardPath(user.role)} className="cabinet-link">
                <Avatar user={user} size={32} />
                <span>Личный кабинет</span>
              </Link>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary" size="sm">
                  Войти
                </ButtonLink>
                <ButtonLink href="/register" size="sm">
                  Регистрация
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
        <button
          type="button"
          className="burger"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
