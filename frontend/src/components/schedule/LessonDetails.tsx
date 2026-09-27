'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { LessonDetail, Role } from '@/lib/types';
import { formatDateLong, formatDateTime, formatTimeRange, fullName, materialTypeIcon, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';

type Props = {
  lessonId: string | null;
  role: Role;
  canManage: (lesson: LessonDetail) => boolean;
  onClose: () => void;
  onEdit: (lesson: LessonDetail) => void;
  onChanged: (message: string) => void;
};

const FORMAT_ICON: Record<string, string> = { ONLINE: '💻', OFFLINE: '🏫', HYBRID: '🔀' };

export function LessonDetails({ lessonId, role, canManage, onClose, onEdit, onChanged }: Props) {
  const { data: l, loading, error, reload } = useApiData<LessonDetail>(lessonId ? `/api/lessons/${lessonId}` : null);
  const [mode, setMode] = useState<'view' | 'cancel' | 'delete'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const close = () => {
    setMode('view');
    setReason('');
    setActionError('');
    onClose();
  };

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setActionError('');
    try {
      await fn();
      setMode('view');
      setReason('');
      onChanged(message);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Не удалось выполнить действие');
    } finally {
      setBusy(false);
    }
  };

  const teacher = l ? l.teacher ?? l.group.teacher : null;
  const online = l && l.format !== 'OFFLINE';
  const offline = l && l.format !== 'ONLINE';
  const ended = l ? new Date(l.endsAt) < new Date() : false;
  const manage = l ? canManage(l) : false;
  const materialHref = (id: string) => (role === 'STUDENT' ? `/student/materials/${id}` : role === 'TEACHER' ? '/teacher/materials' : undefined);
  const assignmentHref = (id: string) => (role === 'STUDENT' ? `/student/assignments/${id}` : role === 'TEACHER' ? `/teacher/assignments/${id}` : undefined);

  return (
    <Modal open={Boolean(lessonId)} title={l ? l.group.course.title : 'Занятие'} onClose={close}>
      {loading ? (
        <LoadingState />
      ) : error || !l ? (
        <ErrorState message={error || 'Занятие не найдено'} onRetry={reload} />
      ) : (
        <div className="stack">
          <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
            <Badge tone={l.format === 'ONLINE' ? 'info' : l.format === 'OFFLINE' ? 'brand' : 'default'}>
              {FORMAT_ICON[l.format]} {statusLabel[l.format] ?? l.format}
            </Badge>
            <Badge tone={l.status === 'CANCELLED' ? 'danger' : l.status === 'COMPLETED' ? 'success' : 'info'}>{statusLabel[l.status] ?? l.status}</Badge>
          </div>
          <h3 style={{ margin: 0 }}>{l.title}</h3>

          <dl className="kv">
            <dt>Дата</dt>
            <dd>{formatDateLong(l.startsAt)}</dd>
            <dt>Время</dt>
            <dd>{formatTimeRange(l.startsAt, l.endsAt)}</dd>
            <dt>Преподаватель</dt>
            <dd>{teacher ? fullName(teacher.user) : '—'}</dd>
            <dt>Группа</dt>
            <dd>{l.group.code}</dd>
            {offline && (
              <>
                <dt>Филиал</dt>
                <dd>{l.branch?.name ?? 'Учебный центр Somon'}</dd>
                {l.branch?.address && (
                  <>
                    <dt>Адрес</dt>
                    <dd>{l.branch.address}</dd>
                  </>
                )}
                <dt>Аудитория</dt>
                <dd>{l.classroom?.name ?? l.room ?? '—'}</dd>
              </>
            )}
            {online && (
              <>
                <dt>Ссылка</dt>
                <dd>
                  {l.meetingUrl ? (
                    <a href={l.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-link" style={{ wordBreak: 'break-all' }}>
                      {l.meetingUrl}
                    </a>
                  ) : (
                    <span className="muted">появится перед занятием</span>
                  )}
                </dd>
              </>
            )}
          </dl>

          {l.comment && (
            <div className="feedback">
              <strong>Комментарий</strong>
              <p className="pre-wrap" style={{ margin: '0.25rem 0 0' }}>{l.comment}</p>
            </div>
          )}

          {l.materials.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Материалы</strong>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                {l.materials.map((m) => {
                  const href = materialHref(m.id);
                  return (
                    <li key={m.id}>
                      {materialTypeIcon[m.type] ?? '📘'}{' '}
                      {href ? (
                        <Link href={href} className="text-link">
                          {m.title}
                        </Link>
                      ) : (
                        m.title
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {l.assignments.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Задания</strong>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                {l.assignments.map((a) => {
                  const href = assignmentHref(a.id);
                  return (
                    <li key={a.id}>
                      {href ? (
                        <Link href={href} className="text-link">
                          {a.title}
                        </Link>
                      ) : (
                        a.title
                      )}
                      {a.deadline && <span className="muted"> · до {formatDateTime(a.deadline)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {actionError && <Alert tone="error">{actionError}</Alert>}

          {mode === 'cancel' && (
            <div className="card stack" style={{ background: 'var(--warning-bg)' }}>
              <Field label="Причина отмены (увидят студенты)">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </Field>
              <div className="row" style={{ gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => setMode('view')} disabled={busy}>
                  Назад
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api(`/api/lessons/${l.id}`, { method: 'PATCH', json: { status: 'CANCELLED', cancelReason: reason.trim() || null } }),
                      'Занятие отменено, участники получили уведомление'
                    )
                  }
                >
                  {busy ? 'Отменяем...' : 'Отменить занятие'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'delete' && (
            <div className="card stack" style={{ background: 'var(--danger-bg)' }}>
              <span>Удалить занятие из расписания без возможности восстановления?</span>
              <div className="row" style={{ gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => setMode('view')} disabled={busy}>
                  Назад
                </Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => api(`/api/lessons/${l.id}`, { method: 'DELETE' }), 'Занятие удалено')}>
                  Удалить
                </Button>
              </div>
            </div>
          )}

          {mode === 'view' && (
            <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
              {online && l.meetingUrl && l.status !== 'CANCELLED' && !ended && (
                <ButtonLink href={l.meetingUrl} external>
                  Перейти к занятию
                </ButtonLink>
              )}
              {role === 'TEACHER' && l.status !== 'CANCELLED' && new Date(l.startsAt) <= new Date(Date.now() + 86400000) && (
                <ButtonLink href={`/teacher/attendance?lessonId=${l.id}`} variant="secondary">
                  Отметить посещаемость
                </ButtonLink>
              )}
              {manage && (
                <>
                  <Button variant="secondary" onClick={() => onEdit(l)}>
                    Изменить / перенести
                  </Button>
                  {l.status === 'CANCELLED' ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run(() => api(`/api/lessons/${l.id}`, { method: 'PATCH', json: { status: 'SCHEDULED' } }), 'Занятие восстановлено')}
                    >
                      Восстановить
                    </Button>
                  ) : (
                    !ended && (
                      <Button variant="ghost" onClick={() => setMode('cancel')}>
                        Отменить занятие
                      </Button>
                    )
                  )}
                  {role === 'ADMIN' && (l._count?.attendance ?? l.attendance.length) === 0 && (
                    <Button variant="ghost" onClick={() => setMode('delete')}>
                      Удалить
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
