'use client';

import { PublicShell } from '@/components/public/PublicShell';
import { CourseCard, NewsCard, PublicMaterialCard, TeacherCard } from '@/components/public/Cards';
import { ABOUT_FEATURES, LEARNING_RESULTS } from '@/components/public/content';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import { useAuth, dashboardPath } from '@/lib/auth';
import type { Branch, NewsItem, PublicCourse, PublicMaterial, PublicStat, PublicTeacher, SiteSettings } from '@/lib/types';

type Overview = {
  settings: SiteSettings;
  stats: PublicStat[];
  courses: PublicCourse[];
  teachers: PublicTeacher[];
  news: NewsItem[];
  materials: PublicMaterial[];
  branches: Branch[];
};

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden>
      <div className="hero-panel hero-panel-main">
        <header>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Общий прогресс</p>
            <h4 style={{ margin: 0 }}>Web-разработка</h4>
          </div>
          <div className="hero-progress-ring">
            <span>78%</span>
          </div>
        </header>
        <div className="hero-bars">
          {[
            ['Занятия', 80],
            ['Задания', 75],
            ['Посещаемость', 85],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="row space-between">
                <span>{label}</span>
                <strong>{value}%</strong>
              </div>
              <div className="progress">
                <span style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-panel hero-panel-grade">
        <span style={{ fontSize: '1.6rem' }}>🏅</span>
        <div>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>Задание проверено</p>
          <strong>5 / 5</strong>
        </div>
      </div>
      <div className="hero-panel hero-panel-lesson">
        <p>Ближайшее занятие · сегодня</p>
        <h4 style={{ margin: '0.35rem 0' }}>JavaScript: функции</h4>
        <p>15:00–16:30 · 🟢 Онлайн</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<Overview>('/api/public/overview');
  const settings = data?.settings;

  return (
    <PublicShell>
      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="eyebrow">Образовательный центр Somon</span>
            <h1>
              Учись. Развивайся. <em>Достигай большего</em> вместе с Somon.
            </h1>
            <p className="hero-description">
              {settings?.['site.description'] ||
                'Современный образовательный центр с практическим подходом: программирование, дизайн, аналитика данных и цифровые профессии.'}
            </p>
            <div className="hero-buttons">
              <ButtonLink href="/courses" size="lg">
                Смотреть курсы
              </ButtonLink>
              <ButtonLink href="/about" variant="secondary" size="lg">
                Подробнее о Somon
              </ButtonLink>
            </div>
            <div className="hero-points">
              <span>✓ Практика с первого занятия</span>
              <span>✓ Онлайн и офлайн</span>
              <span>✓ Прогресс в личном кабинете</span>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {loading && <LoadingState />}
      {error && (
        <div className="container section">
          <ErrorState onRetry={reload} />
        </div>
      )}

      {data && (
        <>
          <section className="section" id="courses">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Наши курсы</span>
                <h2>Выберите направление обучения</h2>
                <p>Все курсы ведут практикующие преподаватели. Программы обновляются администратором центра.</p>
              </div>
              {data.courses.length === 0 ? (
                <EmptyState title="Курсы скоро появятся" description="Мы готовим новые программы обучения." />
              ) : (
                <div className="grid grid-3">
                  {data.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}
              <div className="section-footer">
                <ButtonLink href="/courses" variant="secondary">
                  Все курсы и фильтры →
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className="section section-alt" id="about">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">О Somon</span>
                <h2>Кто мы и как учим</h2>
                <p>{settings?.['about.text']}</p>
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

          <section className="section" id="stats">
            <div className="container">
              <div className="stats-band">
                {data.stats.map((s) => (
                  <div className="stat" key={s.key}>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section section-alt" id="results">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Результаты обучения</span>
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

          <section className="section" id="teachers">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Преподаватели</span>
                <h2>Наши преподаватели</h2>
                <p>Специалисты с реальным опытом работы в своей области.</p>
              </div>
              {data.teachers.length === 0 ? (
                <EmptyState title="Информация о преподавателях скоро появится" />
              ) : (
                <div className="grid grid-3">
                  {data.teachers.map((t) => (
                    <TeacherCard key={t.id} teacher={t} />
                  ))}
                </div>
              )}
              <div className="section-footer">
                <ButtonLink href="/teachers" variant="secondary">
                  Все преподаватели →
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className="section section-alt" id="news">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Новости</span>
                <h2>Новости Somon</h2>
                <p>Новые курсы, наборы в группы, мероприятия и достижения студентов.</p>
              </div>
              {data.news.length === 0 ? (
                <EmptyState title="Новостей пока нет" />
              ) : (
                <div className="grid grid-3">
                  {data.news.map((n) => (
                    <NewsCard key={n.id} item={n} />
                  ))}
                </div>
              )}
              <div className="section-footer">
                <ButtonLink href="/news" variant="secondary">
                  Все новости →
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className="section" id="materials">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Библиотека</span>
                <h2>Открытые материалы</h2>
                <p>Статьи, видео и полезные ресурсы для самостоятельного обучения.</p>
              </div>
              {data.materials.length === 0 ? (
                <EmptyState title="Материалов пока нет" />
              ) : (
                <div className="grid grid-3">
                  {data.materials.map((m) => (
                    <PublicMaterialCard key={m.id} material={m} />
                  ))}
                </div>
              )}
              <div className="section-footer">
                <ButtonLink href="/materials" variant="secondary">
                  Вся библиотека →
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className="section section-alt" id="contacts">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">Контакты</span>
                <h2>Приходите знакомиться</h2>
              </div>
              <div className="grid grid-4">
                <div className="contact-card">
                  <h3>📞 Телефон</h3>
                  <a href={`tel:${settings?.['contact.phone']}`}>{settings?.['contact.phone']}</a>
                </div>
                <div className="contact-card">
                  <h3>✉️ Email</h3>
                  <a href={`mailto:${settings?.['contact.email']}`}>{settings?.['contact.email']}</a>
                </div>
                <div className="contact-card">
                  <h3>📍 Адрес</h3>
                  <p>{settings?.['contact.address']}</p>
                  {data.branches.length > 1 && <p className="muted">и ещё {data.branches.length - 1} филиал(а)</p>}
                </div>
                <div className="contact-card">
                  <h3>🕐 Время работы</h3>
                  <p>{settings?.['contact.workHours']}</p>
                </div>
              </div>
              <div className="section-footer">
                <ButtonLink href="/contacts" variant="secondary">
                  Все контакты и филиалы →
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="cta">
                <div>
                  <h2>Готовы начать обучение?</h2>
                  <p>Создайте аккаунт, выберите курс и подайте заявку — администратор свяжется с вами.</p>
                </div>
                {user ? (
                  <ButtonLink href={dashboardPath(user.role)} variant="light" size="lg">
                    Перейти в личный кабинет
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/register" variant="light" size="lg">
                    Зарегистрироваться
                  </ButtonLink>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </PublicShell>
  );
}
