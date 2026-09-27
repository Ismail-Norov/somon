'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui/States';

type Course = {
  id: string;
  title: string;
  shortDesc?: string;
  level: string;
  durationWeeks?: number;
  lessonsCount?: number;
  category?: { name: string };
  groups: { id: string; code: string; _count: { groupStudents: number }; capacity: number }[];
};

type Teacher = {
  id: string;
  user: { firstName: string; lastName: string; status: string };
  specialization?: string;
  bio?: string;
};

type StatItem = {
  label: string;
  value: string;
};

export default function LandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [coursesData, teachersData] = await Promise.all([
          api<Course[]>('/api/courses/public'),
          api<Teacher[]>('/api/teachers/public'),
        ]);
        setCourses(coursesData);
        setTeachers(teachersData);
        
        // Calculate stats from real data
        setStats([
          { label: 'Студентов', value: '50+' },
          { label: 'Курсов', value: coursesData.length.toString() },
          { label: 'Преподавателей', value: teachersData.length.toString() },
          { label: 'Направлений', value: '5+' },
        ]);
      } catch (e) {
        setError('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <header className="public-header">
        <Link href="/" className="brand">
          Somon
        </Link>
        <nav className="public-nav">
          <Link href="/">Главная</Link>
          <Link href="/courses">Курсы</Link>
          <a href="#about">О центре</a>
          <a href="#teachers">Преподаватели</a>
          <a href="#news">Новости</a>
          <a href="#materials">Материалы</a>
          <a href="#contacts">Контакты</a>
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <h1>Учись. Развивайся. Достигай большего вместе с Somon.</h1>
          <p className="hero-description">
            Современный образовательный центр с практическим подходом к обучению. 
            Web-разработка, дизайн, аналитика данных и многое другое под руководством опытных преподавателей.
          </p>
          <div className="hero-buttons">
            <Link href="/courses">
              <Button>Смотреть курсы</Button>
            </Link>
            <a href="#about">
              <Button variant="secondary">Подробнее о Somon</Button>
            </a>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-card">
            <h2>Начните обучение сегодня</h2>
            <p>Присоединяйтесь к сообществу студентов и получите современные навыки для успешной карьеры.</p>
          </div>
        </div>
      </section>

      <section className="section" id="courses">
        <div className="section-header">
          <h2>Наши курсы</h2>
          <p>Выберите направление и начните обучение с лучшими преподавателями</p>
        </div>
        <div className="grid grid-3">
          {courses.slice(0, 6).map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="course-card">
              <div className="course-level">
                <span className="badge">{course.level}</span>
                <span className="badge">{course.category?.name || 'Общий'}</span>
              </div>
              <h3>{course.title}</h3>
              <p className="course-desc">{course.shortDesc}</p>
              <div className="course-meta">
                <span>📚 {course.lessonsCount || 0} занятий</span>
                <span>⏱ {course.durationWeeks || 0} недель</span>
              </div>
              <div className="course-footer">
                <span>Групп: {course.groups.length}</span>
                <Button variant="secondary" size="sm">Подробнее</Button>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/courses">
            <Button>Все курсы</Button>
          </Link>
        </div>
      </section>

      <section className="section section-alt" id="about">
        <div className="section-header">
          <h2>О Somon</h2>
          <p>Почему выбирают нас для обучения</p>
        </div>
        <div className="grid grid-4">
          {[
            { icon: '🎯', title: 'Практика', desc: 'Студенты не только изучают теорию, но и выполняют практические задания и проекты' },
            { icon: '👨‍🏫', title: 'Опытные преподаватели', desc: 'Обучение проводят специалисты по соответствующим направлениям с реальным опытом' },
            { icon: '📊', title: 'Прогресс', desc: 'Студент может отслеживать собственные результаты и динамику обучения' },
            { icon: '💻', title: 'Современный формат', desc: 'Очное и онлайн-обучение для вашего удобства и гибкости' },
          ].map(({ icon, title, desc }) => (
            <div className="feature-card" key={title}>
              <div className="feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="statistics">
        <div className="section-header">
          <h2>Достижения Somon</h2>
          <p>Наши результаты в цифрах</p>
        </div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-alt" id="results">
        <div className="section-header">
          <h2>Что получает студент после обучения</h2>
          <p>Наши выпускники успешно работают в ведущих компаниях</p>
        </div>
        <div className="grid grid-3">
          {[
            { title: 'Новые знания', desc: 'Глубокое понимание выбранной области и современных технологий' },
            { title: 'Практический опыт', desc: 'Реальные проекты и задания для портфолио' },
            { title: 'Выполненные проекты', desc: 'Портфолио работ для демонстрации работодателям' },
            { title: 'Оценки и результаты', desc: 'Честная оценка знаний и прозрачный прогресс' },
            { title: 'Поддержка', desc: 'Помощь на всех этапах обучения от преподавателей' },
            { title: 'Карьерные возможности', desc: 'Помощь в трудоустройстве и карьерном росте' },
          ].slice(0, 6).map(({ title, desc }) => (
            <div className="result-card" key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="teachers">
        <div className="section-header">
          <h2>Наши преподаватели</h2>
          <p>Профессионалы с реальным опытом в своей области</p>
        </div>
        <div className="grid grid-3">
          {teachers.slice(0, 6).map((teacher) => (
            <div className="teacher-card" key={teacher.id}>
              <div className="teacher-avatar">
                {teacher.user.firstName[0]}{teacher.user.lastName[0]}
              </div>
              <h3>{teacher.user.firstName} {teacher.user.lastName}</h3>
              <p className="teacher-role">{teacher.specialization || 'Преподаватель'}</p>
              <p className="teacher-bio">{teacher.bio || 'Опытный преподаватель с большим практическим опытом'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-alt" id="news">
        <div className="section-header">
          <h2>Новости Somon</h2>
          <p>Последние события и объявления образовательного центра</p>
        </div>
        <div className="news-grid">
          <div className="news-card">
            <div className="news-date">Сентябрь 2024</div>
            <h3>Открыт набор на новые курсы</h3>
            <p>Мы запускаем новые группы по веб-разработке и аналитике данных. Запишитесь сейчас!</p>
            <Button variant="secondary" size="sm">Подробнее</Button>
          </div>
          <div className="news-card">
            <div className="news-date">Сентябрь 2024</div>
            <h3>Расширенение направления дизайна</h3>
            <p>Добавляем курсы по UI/UX дизайну и графическому дизайну для расширения наших образовательных программ.</p>
            <Button variant="secondary" size="sm">Подробнее</Button>
          </div>
          <div className="news-card">
            <div className="news-date">Август 2024</div>
            <h3>Первые выпускники</h3>
            <p>Поздравляем наших первых студентов с успешным завершением курса веб-разработки!</p>
            <Button variant="secondary" size="sm">Подробнее</Button>
          </div>
        </div>
      </section>

      <section className="section" id="materials">
        <div className="section-header">
          <h2>Открытые материалы</h2>
          <p>Библиотека полезных ресурсов для самостоятельного обучения</p>
        </div>
        <div className="materials-grid">
          <div className="material-card">
            <div className="material-type">📄 PDF</div>
            <h3>Основы веб-разработки</h3>
            <p>Введение в HTML, CSS и JavaScript для начинающих</p>
            <Button variant="secondary" size="sm">Открыть</Button>
          </div>
          <div className="material-card">
            <div className="material-type">🎥 Видео</div>
            <h3>Git и GitHub для начинающих</h3>
            <p>Полный гайд по системе контроля версий</p>
            <Button variant="secondary" size="sm">Смотреть</Button>
          </div>
          <div className="material-card">
            <div className="material-type">📊 Инфографика</div>
            <h3>Путь в IT</h3>
            <p>Карта развития карьеры в технологической сфере</p>
            <Button variant="secondary" size="sm">Открыть</Button>
          </div>
        </div>
      </section>

      <section className="section" id="contacts">
        <div className="section-header">
          <h2>Контакты</h2>
          <p>Свяжитесь с нами для получения дополнительной информации</p>
        </div>
        <div className="contacts-grid">
          <div className="contact-card">
            <h3>📍 Адрес</h3>
            <p>г. Душанбе, пр. Рудаки 123</p>
            <p>Филиал №1 образовательного центра</p>
          </div>
          <div className="contact-card">
            <h3>📞 Телефон</h3>
            <p>+992 37 123 45 67</p>
            <p>+992 37 987 65 43</p>
          </div>
          <div className="contact-card">
            <h3>✉️ Email</h3>
            <p>info@somon.tj</p>
            <p>admissions@somon.tj</p>
          </div>
          <div className="contact-card">
            <h3>🕐 Время работы</h3>
            <p>Пн-Пт: 9:00 - 18:00</p>
            <p>Сб: 10:00 - 16:00</p>
          </div>
        </div>
        <div className="social-links">
          <a href="#" className="social-link">Instagram</a>
          <a href="#" className="social-link">Facebook</a>
          <a href="#" className="social-link">Telegram</a>
          <a href="#" className="social-link">YouTube</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <strong>Somon</strong>
            <p>Веб-приложение для управления образовательным центром</p>
          </div>
          <div className="footer-nav">
            <Link href="/">Главная</Link>
            <Link href="/courses">Курсы</Link>
            <a href="#about">О центре</a>
            <a href="#teachers">Преподаватели</a>
            <a href="#contacts">Контакты</a>
          </div>
          <div className="footer-legal">
            <p>© 2024 Somon. Все права защищены.</p>
            <p>demo@somon.local</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
