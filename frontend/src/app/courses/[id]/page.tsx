'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicShell } from '@/components/public/PublicShell';
import { Avatar } from '@/components/ui/Avatar';
import { BackLink } from '@/components/ui/BackLink';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { formatDate, formatPrice, fullName, lessonsLabel, statusLabel, weeksLabel } from '@/lib/format';
import type { PublicCourse } from '@/lib/types';

export default function PublicCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { data: course, loading, error, reload } = useApiData<PublicCourse>(`/api/courses/public/${params.id}`);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(groupId?: string) {
    setMsg(null);
    if (!user) {
      router.push(`/login?next=/courses/${params.id}`);
      return;
    }
    if (user.role !== 'STUDENT') {
      setMsg({ tone: 'error', text: 'Подать заявку может только студент.' });
      return;
    }
    setBusy(true);
    try {
      await api('/api/student/applications', {
        method: 'POST',
        json: { courseId: params.id, groupId: groupId ?? null },
      });
      setMsg({ tone: 'success', text: 'Заявка отправлена. Администратор рассмотрит её и добавит вас в группу.' });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof ApiRequestError ? e.message : 'Не удалось отправить заявку' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          <BackLink href="/courses" label="Назад к курсам" />
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {course && (
            <div className="detail-layout">
              <div className="stack" style={{ gap: '1.25rem' }}>
                <div>
                  <div className="row" style={{ marginBottom: '0.75rem' }}>
                    {course.category && <Badge tone="brand">{course.category.name}</Badge>}
                    <Badge tone="info">{statusLabel[course.level]}</Badge>
                    <Badge>{statusLabel[course.format]}</Badge>
                  </div>
                  <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
                    {course.title}
                  </h1>
                  <p style={{ fontSize: '1.1rem' }}>{course.shortDesc}</p>
                </div>

                <div className="card">
                  <h2 className="card-title">О курсе</h2>
                  <p style={{ color: 'var(--ink-2)', whiteSpace: 'pre-line', margin: 0 }}>
                    {course.description || course.shortDesc}
                  </p>
                </div>

                {course.teachers.length > 0 && (
                  <div className="card">
                    <h2 className="card-title">Преподаватели</h2>
                    <div className="stack">
                      {course.teachers.map((t) => (
                        <div className="row" key={t.id}>
                          <Avatar user={t.user} size={48} />
                          <div>
                            <strong>{fullName(t.user)}</strong>
                            <p style={{ margin: 0 }}>{t.position || t.specialization}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card">
                  <h2 className="card-title">Группы и набор</h2>
                  {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                  {course.groups.length === 0 ? (
                    <p style={{ margin: 0 }}>Сейчас нет открытых групп. Оставьте заявку — мы сообщим о старте.</p>
                  ) : (
                    <div className="stack">
                      {course.groups.map((g) => (
                        <div className="row space-between" key={g.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                          <div>
                            <strong>{g.name || g.code}</strong>{' '}
                            <Badge tone={g.status === 'ENROLLMENT' ? 'success' : 'default'}>{statusLabel[g.status]}</Badge>
                            <p style={{ margin: '0.25rem 0 0' }}>
                              {g.teacher ? `${fullName(g.teacher.user)} · ` : ''}
                              Старт: {formatDate(g.startDate)} · {statusLabel[g.format]} · свободно мест: {g.seatsLeft}
                            </p>
                          </div>
                          <Button size="sm" disabled={busy || g.seatsLeft === 0} onClick={() => apply(g.id)}>
                            {g.seatsLeft === 0 ? 'Мест нет' : 'Подать заявку'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="detail-aside card">
                <ul className="fact-list">
                  {weeksLabel(course.durationWeeks) && (
                    <li>
                      <span>Длительность</span>
                      <span>{weeksLabel(course.durationWeeks)}</span>
                    </li>
                  )}
                  {lessonsLabel(course.lessonsCount) && (
                    <li>
                      <span>Занятий</span>
                      <span>{lessonsLabel(course.lessonsCount)}</span>
                    </li>
                  )}
                  <li>
                    <span>Уровень</span>
                    <span>{statusLabel[course.level]}</span>
                  </li>
                  <li>
                    <span>Формат</span>
                    <span>{statusLabel[course.format]}</span>
                  </li>
                  {formatPrice(course.price) && (
                    <li>
                      <span>Стоимость</span>
                      <span>{formatPrice(course.price)}</span>
                    </li>
                  )}
                </ul>
                {user && user.role !== 'STUDENT' ? (
                  <p style={{ margin: 0 }}>Заявки на обучение подают студенты.</p>
                ) : (
                  <Button size="lg" style={{ width: '100%' }} disabled={busy} onClick={() => apply()}>
                    Подать заявку на курс
                  </Button>
                )}
                {!user && (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', textAlign: 'center' }}>
                    Нужен аккаунт — <ButtonLink href="/register" variant="ghost" size="sm">зарегистрируйтесь</ButtonLink>
                  </p>
                )}
              </aside>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
