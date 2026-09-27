'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { statusLabel } from '@/lib/format';

type Course = {
  id: string;
  title: string;
  shortDesc?: string;
  level: string;
  durationWeeks?: number;
  category?: { name: string };
  groups: { id: string; code: string; _count: { groupStudents: number }; capacity: number }[];
};

export default function PublicCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    api<Course[]>(`/api/courses/public${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      <header className="public-header">
        <Link href="/" className="brand">
          Somon
        </Link>
        <nav className="public-nav">
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        </nav>
      </header>
      <section className="section">
        <h1 className="page-title">Курсы Somon</h1>
        <p className="page-sub">Опубликованные программы образовательного центра</p>
        <input
          className="input"
          style={{ maxWidth: 360, marginBottom: '1rem' }}
          placeholder="Поиск..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && courses.length === 0 && (
          <EmptyState title="Курсы не найдены" description="Попробуйте другой запрос" />
        )}
        <div className="grid grid-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="card">
              <div className="row space-between">
                <h3>{c.title}</h3>
                <Badge tone="brand">{statusLabel[c.level] || c.level}</Badge>
              </div>
              <p>{c.shortDesc}</p>
              <p style={{ marginBottom: 0 }}>
                {c.category?.name || 'Без категории'} · групп: {c.groups.length}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
