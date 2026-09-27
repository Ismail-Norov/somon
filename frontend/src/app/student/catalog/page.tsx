'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PublicCourse } from '@/lib/types';
import { formatDate, formatPrice, fullName, statusLabel, weeksLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Application = { id: string; courseId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string; course: { title: string } };
type Profile = { student: { groupStudents: { status: string; group: { course: { id: string } } }[] } | null };

const APP_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;

export default function StudentCatalogPage() {
  const courses = useApiData<PublicCourse[]>('/api/courses/public');
  const apps = useApiData<Application[]>('/api/student/applications');
  const profile = useApiData<Profile>('/api/users/me/profile');
  const [target, setTarget] = useState<PublicCourse | null>(null);
  const [groupId, setGroupId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const myCourseIds = new Set(
    (profile.data?.student?.groupStudents ?? []).filter((g) => g.status === 'ACTIVE').map((g) => g.group.course.id)
  );
  const pendingByCourse = new Map((apps.data ?? []).filter((a) => a.status === 'PENDING').map((a) => [a.courseId, a]));

  const openApply = (c: PublicCourse) => {
    setTarget(c);
    setGroupId(c.groups.find((g) => g.seatsLeft > 0)?.id ?? '');
    setMessage('');
  };

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSending(true);
    try {
      await api('/api/student/applications', {
        method: 'POST',
        json: { courseId: target.id, groupId: groupId || null, message: message.trim() || undefined },
      });
      setNotice({ tone: 'success', text: `Заявка на курс «${target.title}» отправлена. Администратор рассмотрит её и добавит вас в группу.` });
      setTarget(null);
      apps.reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось отправить заявку' });
      setTarget(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Доступные курсы" subtitle="Выберите новый курс и подайте заявку — после одобрения вы появитесь в группе." />
      {notice && (
        <Alert tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {(apps.data?.length ?? 0) > 0 && (
        <section className="card">
          <h2 className="card-title">Мои заявки</h2>
          <ul className="list-plain">
            {apps.data!.map((a) => (
              <li key={a.id} className="list-row">
                <span>
                  <strong>{a.course.title}</strong> <span className="muted">· {formatDate(a.createdAt)}</span>
                </span>
                <Badge tone={APP_TONE[a.status]}>{statusLabel[a.status]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.loading ? (
        <LoadingState />
      ) : courses.error ? (
        <ErrorState message={courses.error} onRetry={courses.reload} />
      ) : !courses.data?.length ? (
        <EmptyState icon="🧭" title="Сейчас нет открытых курсов" />
      ) : (
        <div className="grid grid-3">
          {courses.data.map((c) => {
            const mine = myCourseIds.has(c.id);
            const pending = pendingByCourse.get(c.id);
            const openGroups = c.groups.filter((g) => g.seatsLeft > 0);
            return (
              <article key={c.id} className="card stack" style={{ gap: '0.6rem' }}>
                <div className="row" style={{ gap: '0.35rem' }}>
                  {c.category && <Badge tone="brand">{c.category.name}</Badge>}
                  <Badge>{statusLabel[c.level] ?? c.level}</Badge>
                  <Badge tone="info">{statusLabel[c.format] ?? c.format}</Badge>
                </div>
                <Link href={`/courses/${c.id}`} className="text-link" style={{ fontSize: '1.05rem' }}>
                  {c.title}
                </Link>
                {c.shortDesc && <p style={{ margin: 0, fontSize: '0.9rem' }}>{c.shortDesc}</p>}
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {[weeksLabel(c.durationWeeks), formatPrice(c.price), c.teachers[0] ? fullName(c.teachers[0].user) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {openGroups.length ? `Открытых групп: ${openGroups.length}` : 'Набор в группы пока не открыт'}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  {mine ? (
                    <Badge tone="success">Вы учитесь на этом курсе</Badge>
                  ) : pending ? (
                    <Badge tone="warning">Заявка на рассмотрении</Badge>
                  ) : (
                    <Button size="sm" onClick={() => openApply(c)}>
                      Подать заявку
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!target} title={target ? `Заявка: ${target.title}` : ''} onClose={() => setTarget(null)}>
        {target && (
          <form onSubmit={apply}>
            <Field label="Группа" hint="Можно оставить выбор администратору">
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Любая подходящая группа</option>
                {target.groups.map((g) => (
                  <option key={g.id} value={g.id} disabled={g.seatsLeft <= 0}>
                    {g.code} · {statusLabel[g.format] ?? g.format}
                    {g.startDate ? ` · старт ${formatDate(g.startDate)}` : ''}
                    {g.seatsLeft <= 0 ? ' · мест нет' : ` · мест: ${g.seatsLeft}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Комментарий (необязательно)">
              <Textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Удобное время, вопросы по курсу" />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={sending}>
                Отмена
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? 'Отправляем...' : 'Отправить заявку'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
