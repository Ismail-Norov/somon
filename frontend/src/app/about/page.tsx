'use client';

import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { ABOUT_FEATURES, LEARNING_RESULTS, TEACHING_DIRECTIONS } from '@/components/public/content';
import { ButtonLink } from '@/components/ui/Button';
import { useApiData } from '@/lib/useApiData';
import type { PublicStat, SiteSettings } from '@/lib/types';

export default function AboutPage() {
  const settings = useApiData<SiteSettings>('/api/public/settings');
  const stats = useApiData<PublicStat[]>('/api/public/stats');

  return (
    <PublicShell>
      <PageHero
        eyebrow="О центре"
        title="Somon — образовательный центр практических навыков"
        description={settings.data?.['site.description']}
      />

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: 'center', gap: '2.5rem' }}>
          <div>
            <h2>Наш подход</h2>
            <p style={{ fontSize: '1.05rem' }}>{settings.data?.['about.text']}</p>
            <p>
              Каждый курс — это расписание занятий, материалы, домашние задания с проверкой преподавателем и прозрачный
              прогресс в личном кабинете. Обучение проходит очно в наших филиалах или онлайн.
            </p>
            <div className="row">
              <ButtonLink href="/courses">Выбрать курс</ButtonLink>
              <ButtonLink href="/contacts" variant="secondary">
                Контакты
              </ButtonLink>
            </div>
          </div>
          <div className="grid grid-2">
            {TEACHING_DIRECTIONS.map((d) => (
              <div className="feature-card" key={d.title}>
                <div className="feature-icon" aria-hidden>
                  {d.icon}
                </div>
                <h3>{d.title}</h3>
                <p>{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {stats.data && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="stats-band">
              {stats.data.map((s) => (
                <div className="stat" key={s.key}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <h2>Почему Somon</h2>
          </div>
          <div className="grid grid-3">
            {ABOUT_FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon" aria-hidden>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Что получает студент после обучения</h2>
          </div>
          <div className="grid grid-3">
            {LEARNING_RESULTS.map((r) => (
              <div className="result-card" key={r.title}>
                <div className="feature-icon" aria-hidden>
                  {r.icon}
                </div>
                <div>
                  <h3>{r.title}</h3>
                  <p>{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
