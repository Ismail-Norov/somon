'use client';

import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import type { Branch, SiteSettings } from '@/lib/types';

const SOCIALS = [
  { key: 'social.instagram', label: 'Instagram' },
  { key: 'social.telegram', label: 'Telegram' },
  { key: 'social.facebook', label: 'Facebook' },
  { key: 'social.youtube', label: 'YouTube' },
];

export default function ContactsPage() {
  const { data, loading, error, reload } = useApiData<{ settings: SiteSettings; branches: Branch[] }>(
    '/api/public/contacts'
  );
  const s = data?.settings;
  const socials = SOCIALS.filter((x) => s?.[x.key]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Контакты"
        title="Свяжитесь с Somon"
        description="Позвоните, напишите или приходите в любой из наших филиалов — поможем выбрать курс."
      />
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container stack" style={{ gap: '2.5rem' }}>
          {loading && <LoadingState />}
          {error && <ErrorState onRetry={reload} />}
          {s && (
            <div className="grid grid-4">
              <div className="contact-card">
                <h3>📞 Телефон</h3>
                <a href={`tel:${s['contact.phone']}`}>{s['contact.phone']}</a>
              </div>
              <div className="contact-card">
                <h3>✉️ Email</h3>
                <a href={`mailto:${s['contact.email']}`}>{s['contact.email']}</a>
              </div>
              <div className="contact-card">
                <h3>📍 Главный офис</h3>
                <p>{s['contact.address']}</p>
              </div>
              <div className="contact-card">
                <h3>🕐 Время работы</h3>
                <p>{s['contact.workHours']}</p>
              </div>
            </div>
          )}

          {data && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Филиалы</h2>
              {data.branches.length === 0 ? (
                <EmptyState title="Информация о филиалах скоро появится" />
              ) : (
                <div className="grid grid-2">
                  {data.branches.map((b) => (
                    <div className="branch-card" key={b.id}>
                      <h3>{b.name}</h3>
                      {b.description && <p style={{ margin: 0 }}>{b.description}</p>}
                      <dl>
                        <dt>Адрес</dt>
                        <dd>{b.address}</dd>
                        {b.phone && (
                          <>
                            <dt>Телефон</dt>
                            <dd>
                              <a href={`tel:${b.phone}`}>{b.phone}</a>
                            </dd>
                          </>
                        )}
                        {b.workHours && (
                          <>
                            <dt>Время работы</dt>
                            <dd>{b.workHours}</dd>
                          </>
                        )}
                        {b._count && b._count.classrooms > 0 && (
                          <>
                            <dt>Аудиторий</dt>
                            <dd>{b._count.classrooms}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {socials.length > 0 && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Мы в социальных сетях</h2>
              <div className="social-links">
                {socials.map((x) => (
                  <ButtonLink key={x.key} href={s![x.key]} variant="secondary" external>
                    {x.label}
                  </ButtonLink>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
