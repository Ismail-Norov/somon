'use client';

import { FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, fullName, statusLabel } from '@/lib/format';

type Detail = {
  course: { title: string; description?: string };
  group: { code: string };
  teacher?: { user: { firstName: string; lastName: string } };
  progress: { progressPercent: number; attendancePercent: number; assignmentsPercent: number };
  averageGrade: number | null;
  nextLesson?: { title: string; startsAt: string; format: string; meetingUrl?: string; room?: string } | null;
  materials: { id: string; title: string; topic?: string; type: string; fileUrl?: string; fileName?: string; videoUrl?: string }[];
  assignments: {
    id: string;
    title: string;
    description?: string;
    deadline?: string;
    status: string;
    attachmentUrl?: string;
    attachmentName?: string;
    submission?: { 
      status: string; 
      grade?: { score: number; maxScore: number };
      text?: string;
      fileUrl?: string;
      fileName?: string;
    } | null;
  }[];
};

export default function StudentCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<Detail>(
    `/api/analytics/student/course/${params.id}`
  );
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submissionForm, setSubmissionForm] = useState({ text: '', file: null as File | null });
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedAssignment) return;
    setSubmitting(true);
    setMsg('');
    try {
      let fileUrl = null;
      let fileName = null;

      if (submissionForm.file) {
        const formData = new FormData();
        formData.append('file', submissionForm.file);
        const uploadResponse = await api<{ fileUrl: string; fileName: string }>('/api/uploads/assignment', {
          method: 'POST',
          body: formData,
        });
        fileUrl = uploadResponse.fileUrl;
        fileName = uploadResponse.fileName;
      }

      await api(`/api/assignments/${selectedAssignment}/submissions`, {
        method: 'POST',
        json: {
          text: submissionForm.text,
          fileUrl,
          fileName,
        },
      });

      setSubmissionOpen(false);
      setSubmissionForm({ text: '', file: null });
      setSelectedAssignment(null);
      reload();
      setMsg('Ответ отправлен');
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Не найдено'} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">{data.course.title}</h1>
      <p className="page-sub">
        Группа {data.group.code} · {fullName(data.teacher?.user)}
      </p>

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="stat-label">Прогресс</div>
          <div className="stat-value">{data.progress.progressPercent}%</div>
          <ProgressBar value={data.progress.progressPercent} />
        </div>
        <div className="card">
          <div className="stat-label">Средний балл</div>
          <div className="stat-value">{data.averageGrade ?? '—'}</div>
        </div>
        <div className="card">
          <div className="stat-label">Посещаемость</div>
          <div className="stat-value">{data.progress.attendancePercent}%</div>
        </div>
      </div>

      {data.nextLesson && (
        <div className="card" style={{ marginBottom: '1rem', background: 'linear-gradient(145deg, var(--brand-soft), #fff)' }}>
          <h3>Ближайшее занятие</h3>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>{data.nextLesson.title}</strong>
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            {formatDateTime(data.nextLesson.startsAt)}
          </p>
          <div className="row" style={{ gap: '0.5rem' }}>
            <Badge tone={data.nextLesson.format === 'ONLINE' ? 'success' : 'info'}>
              {data.nextLesson.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}
            </Badge>
            {data.nextLesson.format === 'ONLINE' && data.nextLesson.meetingUrl && (
              <a href={data.nextLesson.meetingUrl} target="_blank" rel="noopener noreferrer">
                <Badge tone="brand">Перейти к занятию</Badge>
              </a>
            )}
            {data.nextLesson.format === 'OFFLINE' && data.nextLesson.room && (
              <Badge>Аудитория: {data.nextLesson.room}</Badge>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>Материалы</h3>
          <div className="stack">
            {data.materials.map((m) => (
              <div key={m.id} className="card" style={{ padding: '1rem' }}>
                <div className="row space-between">
                  <strong>{m.title}</strong>
                  <Badge>{m.type}</Badge>
                </div>
                {m.topic && <p className="hint">{m.topic}</p>}
                {m.fileUrl && (
                  <a 
                    href={m.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.9rem', color: 'var(--brand)' }}
                  >
                    📎 Скачать: {m.fileName || 'Файл'}
                  </a>
                )}
                {m.videoUrl && (
                  <a 
                    href={m.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.9rem', color: 'var(--brand)' }}
                  >
                    🎥 Смотреть видео
                  </a>
                )}
              </div>
            ))}
            {!data.materials.length && <p>Материалов пока нет</p>}
          </div>
        </div>
        <div className="card">
          <h3>Задания</h3>
          <div className="stack">
            {data.assignments.map((a) => {
              const st = a.submission?.status || a.status;
              return (
                <div key={a.id} className="card" style={{ padding: '1rem' }}>
                  <div className="row space-between">
                    <strong>{a.title}</strong>
                    <Badge
                      tone={
                        st === 'GRADED'
                          ? 'success'
                          : st === 'OVERDUE'
                            ? 'danger'
                            : st === 'SUBMITTED'
                              ? 'info'
                              : 'warning'
                      }
                    >
                      {statusLabel[st] || st}
                    </Badge>
                  </div>
                  {a.description && <p className="hint">{a.description}</p>}
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    до {formatDateTime(a.deadline)}
                    {a.submission?.grade
                      ? ` · ${a.submission.grade.score}/${a.submission.grade.maxScore}`
                      : ''}
                  </p>
                  {a.attachmentUrl && (
                    <a 
                      href={a.attachmentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.85rem', color: 'var(--brand)' }}
                    >
                      📎 Вложение: {a.attachmentName || 'Файл'}
                    </a>
                  )}
                  {a.submission && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {a.submission.text && <p>Ответ: {a.submission.text}</p>}
                      {a.submission.fileUrl && (
                        <a href={a.submission.fileUrl} target="_blank" rel="noopener noreferrer">
                          📎 Ваш файл: {a.submission.fileName || 'Файл'}
                        </a>
                      )}
                    </div>
                  )}
                  {st !== 'GRADED' && st !== 'SUBMITTED' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedAssignment(a.id);
                        setSubmissionOpen(true);
                      }}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Ответить
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {submissionOpen && selectedAssignment && (
        <div className="card" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, maxWidth: 480, padding: '1.5rem' }}>
          <h3>Ответ на задание</h3>
          {msg && <p style={{ marginBottom: '1rem' }}>{msg}</p>}
          <form onSubmit={handleSubmit}>
            <Field label="Текст ответа">
              <Textarea
                value={submissionForm.text}
                onChange={(e) => setSubmissionForm({ ...submissionForm, text: e.target.value })}
                placeholder="Введите ваш ответ..."
              />
            </Field>
            <Field label="Файл (опционально)">
              <Input
                type="file"
                onChange={(e) => setSubmissionForm({ ...submissionForm, file: e.target.files?.[0] || null })}
              />
              <div className="hint">PDF, DOC, DOCX, ZIP до 10MB</div>
            </Field>
            <div className="row" style={{ gap: '0.5rem' }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Отправка...' : 'Отправить'}
              </Button>
              <Button variant="secondary" onClick={() => setSubmissionOpen(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
