'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fullName, statusLabel } from '@/lib/format';

type CourseDetail = {
  id: string;
  title: string;
  description?: string;
  shortDesc?: string;
  level: string;
  durationWeeks?: number;
  category?: { name: string };
  groups: {
    id: string;
    code: string;
    capacity: number;
    status: string;
    _count: { groupStudents: number };
    teacher?: { user: { firstName: string; lastName: string } };
  }[];
};

export default function PublicCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<CourseDetail>(`/api/courses/public/${params.id}`)
      .then(setCourse)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function enroll(groupId: string) {
    setMsg('');
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      await api(`/api/groups/${groupId}/enroll`, { method: 'POST', json: {} });
      setMsg('Вы записаны в группу');
      router.push('/student/courses');
    } catch (e) {
      setMsg(e instanceof ApiRequestError ? e.message : 'Не удалось записаться');
    }
  }

  if (loading) return <LoadingState />;
  if (error || !course) return <ErrorState message={error || 'Не найдено'} />;

  return (
    <div>
      <header className="public-header">
        <Link href="/" className="brand">
          Somon
        </Link>
        <Link href="/courses">К каталогу</Link>
      </header>
      <section className="section">
        <h1 className="page-title">{course.title}</h1>
        <p className="page-sub">{course.shortDesc}</p>
        <div className="row" style={{ marginBottom: '1rem' }}>
          <Badge tone="brand">{statusLabel[course.level]}</Badge>
          <Badge>{course.category?.name}</Badge>
          {course.durationWeeks ? <Badge tone="info">{course.durationWeeks} нед.</Badge> : null}
        </div>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--ink)' }}>{course.description}</p>
        </div>
        <h2>Доступные группы</h2>
        {msg && <p className="error-text">{msg}</p>}
        <div className="stack">
          {course.groups.map((g) => (
            <div className="card row space-between" key={g.id}>
              <div>
                <strong>{g.code}</strong>
                <p style={{ margin: 0 }}>
                  Преподаватель: {fullName(g.teacher?.user)} · {g._count.groupStudents}/{g.capacity} ·{' '}
                  {statusLabel[g.status]}
                </p>
              </div>
              <Button onClick={() => enroll(g.id)}>Записаться</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
