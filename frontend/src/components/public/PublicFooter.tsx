'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SiteSettings } from '@/lib/types';
import { Logo, PUBLIC_NAV } from './PublicHeader';

const SOCIALS = [
  { key: 'social.instagram', label: 'Instagram' },
  { key: 'social.telegram', label: 'Telegram' },
  { key: 'social.facebook', label: 'Facebook' },
  { key: 'social.youtube', label: 'YouTube' },
];

export function PublicFooter() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    api<SiteSettings>('/api/public/settings')
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  const socials = SOCIALS.filter((s) => settings?.[s.key]);

  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="footer-brand">
          <Logo light />
          <p>{settings?.['site.fullName'] || 'Веб-приложение для управления образовательным центром Somon'}</p>
          {socials.length > 0 && (
            <div className="footer-socials">
              {socials.map((s) => (
                <a key={s.key} href={settings![s.key]} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4>Разделы</h4>
          <nav className="footer-nav">
            {PUBLIC_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h4>Контакты</h4>
          <div className="footer-contacts">
            {settings?.['contact.phone'] && <a href={`tel:${settings['contact.phone']}`}>{settings['contact.phone']}</a>}
            {settings?.['contact.email'] && <a href={`mailto:${settings['contact.email']}`}>{settings['contact.email']}</a>}
            {settings?.['contact.address'] && <span>{settings['contact.address']}</span>}
            {settings?.['contact.workHours'] && <span>{settings['contact.workHours']}</span>}
          </div>
        </div>
      </div>
      <div className="public-footer-bottom">© {new Date().getFullYear()} Somon. Все права защищены.</div>
    </footer>
  );
}
