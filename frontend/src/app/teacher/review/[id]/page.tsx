'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { emitNotificationsChanged } from '@/lib/events';
import { useApiData } from '@/lib/useApiData';
import type { Submission } from '@/lib/types';
import { formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { FileList, SingleFile } from '@/components/cabinet/Files';

type ReviewSubmission = Submission & {
  assignment: {
    id: string;
    title: string;
    description?: string | null;
    criteria?: string | null;
    deadline?: string | null;
    maxScore: number;
    allowResubmit: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    course: { id: string; title: string };
    group?: { id: string; code: string } | null;
  };
};

export default function TeacherReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, loading, error, reload } = useApiData<ReviewSubmission>(`/api/assignments/submissions/${id}`);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'grade' | 'return' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!s) return;
    setScore(s.grade ? String(s.grade.score) : '');
    setComment(s.grade?.comment ?? '');
    emitNotificationsChanged();
  }, [s]);

  if (loading) return <LoadingState />;
  if (error || !s) return <ErrorState message={error || 'Работа не найдена'} onRetry={reload} />;

  const a = s.assignment;
  const attempts = s.attempts ?? [];
  const late = Boolean(s.submittedAt && a.deadline && new Date(s.submittedAt) > new Date(a.deadline));
  const scoreNum = Number(score.replace(',', '.'));
  const scoreInvalid = score === '' || Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > a.maxScore;

  const grade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scoreInvalid) {
      setMsg({ tone: 'error', text: `Укажите балл от 0 до ${a.maxScore}` });
      return;
    }
    setBusy('grade');
    setMsg(null);
    try {
      await api('/api/grades', {
        method: 'POST',
        json: { submissionId: s.id, studentId: s.studentId, score: scoreNum, comment: comment.trim() || null },
      });
      setMsg({ tone: 'success', text: 'Работа принята и оценена. Студент получил уведомление.' });
      emitNotificationsChanged();
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить оценку' });
    } finally {
      setBusy(null);
    }
  };

  const sendBack = async () => {
    if (!comment.trim()) {
      setMsg({ tone: 'error', text: 'Напишите в комментарии, что нужно исправить' });
      return;
    }
    setBusy('return');
    setMsg(null);
    try {
      await api(`/api/assignments/submissions/${s.id}/return`, { method: 'POST', json: { comment: comment.trim() } });
      setMsg({ tone: 'success', text: 'Работа возвращена на доработку. Студент сможет отправить новую попытку.' });
      emitNotificationsChanged();
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось вернуть работу' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader back={{ href: '/teacher/review', label: 'Назад к работам на проверке' }} title={a.title} subtitle={`${a.course.title}${a.group ? ` · ${a.group.code}` : ''}`} />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="layout-2-1">
        <div className="stack">
          <section className="card row" style={{ gap: '0.9rem', flexWrap: 'wrap' }}>
            <Avatar user={s.student?.user} size={52} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong>{fullName(s.student?.user)}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {s.student?.user.email}
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Отправлено: {formatDateTime(s.submittedAt)} {a.deadline && `· срок ${formatDateTime(a.deadline)}`}
              </div>
            </div>
            <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
              <Badge tone={s.status === 'GRADED' ? 'success' : s.status === 'RETURNED' ? 'warning' : 'info'}>{statusLabel[s.status] ?? s.status}</Badge>
              {late && <Badge tone="warning">С опозданием</Badge>}
              {s.attemptCount > 1 && <Badge>{`Попыток: ${s.attemptCount}`}</Badge>}
            </div>
          </section>

          <section className="card stack">
            <h2 className="card-title">Ответ студента</h2>
            {attempts.length === 0 ? (
              <>
                {s.text && <p className="pre-wrap">{s.text}</p>}
                {s.fileUrl && <SingleFile name={s.fileName || 'Файл ответа'} path={`/api/files/submission-legacy/${s.id}`} />}
                {!s.text && !s.fileUrl && <p className="muted">Ответ пустой</p>}
              </>
            ) : (
              attempts.map((att, i) => (
                <div key={att.id} className={`attempt ${i === 0 ? 'attempt-current' : ''}`}>
                  <div className="row space-between" style={{ marginBottom: '0.4rem' }}>
                    <strong>
                      Попытка {att.number}
                      {i === 0 && attempts.length > 1 && ' · последняя'}
                    </strong>
                    <span className="muted" style={{ fontSize: '0.82rem' }}>
                      {formatDateTime(att.submittedAt)}
                    </span>
                  </div>
                  {att.text ? <p className="pre-wrap" style={{ margin: '0 0 0.5rem' }}>{att.text}</p> : <p className="muted">Без текста</p>}
                  <FileList files={att.files} basePath="/api/files/submission" />
                </div>
              ))
            )}
          </section>

          {s.feedback && s.status === 'RETURNED' && (
            <div className="feedback feedback-warning">
              <strong>Возвращено на доработку {s.returnedAt && formatDateTime(s.returnedAt)}</strong>
              <p className="pre-wrap" style={{ margin: '0.3rem 0 0' }}>{s.feedback}</p>
            </div>
          )}
        </div>

        <div className="stack">
          <form className="card stack" onSubmit={grade}>
            <h2 className="card-title">{s.grade ? 'Изменить оценку' : 'Оценка'}</h2>
            {s.grade && (
              <div className="feedback">
                Текущая оценка: <strong>{`${s.grade.score} / ${s.grade.maxScore}`}</strong>
                {s.grade.teacher && <span className="muted"> · {fullName(s.grade.teacher.user)}</span>}
              </div>
            )}
            <Field label={`Балл (максимум ${a.maxScore})`} error={score !== '' && scoreInvalid ? `От 0 до ${a.maxScore}` : undefined}>
              <Input type="number" min={0} max={a.maxScore} step="0.5" value={score} onChange={(e) => setScore(e.target.value)} required />
            </Field>
            <Field label="Комментарий студенту" hint="Обязателен при возврате на доработку">
              <Textarea rows={5} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
            </Field>
            <Button type="submit" disabled={busy !== null}>
              {busy === 'grade' ? 'Сохраняем...' : s.grade ? 'Сохранить оценку' : 'Принять и оценить'}
            </Button>
            {s.status !== 'RETURNED' && (
              <Button variant="secondary" onClick={sendBack} disabled={busy !== null}>
                {busy === 'return' ? 'Возвращаем...' : 'Вернуть на доработку'}
              </Button>
            )}
          </form>

          <section className="card stack">
            <h2 className="card-title">Задание</h2>
            {a.description && <p className="pre-wrap" style={{ margin: 0 }}>{a.description}</p>}
            {a.criteria && (
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Критерии оценки</strong>
                <p className="pre-wrap muted" style={{ margin: '0.2rem 0 0' }}>{a.criteria}</p>
              </div>
            )}
            {a.attachmentUrl && <SingleFile name={a.attachmentName || 'Инструкция'} path={`/api/files/assignment/${a.id}`} />}
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Повторная сдача: {a.allowResubmit ? 'разрешена' : 'запрещена'}
            </div>
            <Link href={`/teacher/assignments/${a.id}`} className="text-link">
              Все ответы по заданию →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
