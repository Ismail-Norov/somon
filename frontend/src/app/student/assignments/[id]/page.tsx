'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { Assignment, UploadRules } from '@/lib/types';
import { formatDateTime, fullName } from '@/lib/format';
import { studentAssignmentState } from '@/lib/assignments';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { FileList, FilePicker, SingleFile } from '@/components/cabinet/Files';

const DEFAULT_RULES: UploadRules = {
  extensions: ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'ZIP', 'RAR', 'JPG', 'JPEG', 'PNG', 'TXT'],
  accept: '',
  maxFileMb: 20,
  maxFiles: 5,
};

export default function StudentAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<Assignment>(`/api/assignments/${id}`);
  const { data: rules } = useApiData<{ submission: UploadRules }>('/api/uploads/rules');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Задание не найдено'} onRetry={reload} />;

  const a = data;
  const state = studentAssignmentState(a);
  const sub = state.sub;
  const sent = Boolean(sub?.submittedAt);
  const canSubmit = !sent || a.allowResubmit || sub?.status === 'RETURNED';
  const rule = rules?.submission ?? DEFAULT_RULES;
  const teacher = a.group?.teacher;
  const attempts = sub?.attempts ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!text.trim() && files.length === 0) {
      setMessage({ tone: 'error', text: 'Добавьте текст ответа или прикрепите хотя бы один файл.' });
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      if (text.trim()) form.append('text', text.trim());
      files.forEach((f) => form.append('files', f));
      await api(`/api/assignments/${a.id}/submissions`, { method: 'POST', body: form });
      setText('');
      setFiles([]);
      setMessage({ tone: 'success', text: 'Работа отправлена на проверку. Преподаватель получил уведомление.' });
      await reload();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось отправить работу' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/student/assignments', label: 'Назад к заданиям' }}
        title={a.title}
        subtitle={`${a.course?.title ?? ''}${a.group ? ` · группа ${a.group.code}` : ''}`}
        actions={<Badge tone={state.tone}>{state.label}</Badge>}
      />

      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Описание задания</h2>
            {a.description ? <p className="pre-wrap" style={{ color: 'var(--ink-2)' }}>{a.description}</p> : <p>Описание не добавлено.</p>}
            {a.criteria && (
              <>
                <h3 style={{ fontSize: '0.95rem' }}>Критерии оценки</h3>
                <p className="pre-wrap">{a.criteria}</p>
              </>
            )}
            {a.attachmentUrl && (
              <>
                <h3 style={{ fontSize: '0.95rem' }}>Файл с инструкцией</h3>
                <SingleFile name={a.attachmentName || 'Инструкция'} path={`/api/files/assignment/${a.id}`} />
              </>
            )}
          </section>

          {sub?.status === 'GRADED' && sub.grade && (
            <section className="card">
              <h2 className="card-title">Результат проверки</h2>
              <div className="row" style={{ gap: '1.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <div className="stat-label">Оценка</div>
                  <div className="stat-value">
                    {sub.grade.score} / {sub.grade.maxScore}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Проверено</div>
                  <strong>{formatDateTime(sub.grade.updatedAt)}</strong>
                </div>
              </div>
              <div className="feedback">
                <strong>Комментарий преподавателя</strong>
                <p className="pre-wrap" style={{ margin: '0.25rem 0 0' }}>{sub.grade.comment || 'Без комментария.'}</p>
                {sub.grade.teacher && <small className="muted">{fullName(sub.grade.teacher.user)}</small>}
              </div>
            </section>
          )}

          {sub?.status === 'RETURNED' && (
            <section className="card">
              <h2 className="card-title">Работа возвращена на доработку</h2>
              <div className="feedback feedback-warning">
                <p className="pre-wrap" style={{ margin: 0 }}>{sub.feedback || 'Преподаватель попросил доработать ответ.'}</p>
                {sub.returnedAt && <small className="muted">{formatDateTime(sub.returnedAt)}</small>}
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="card-title">{sent ? 'Отправить новую версию' : 'Сдать работу'}</h2>
            {message && (
              <Alert tone={message.tone} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            {!canSubmit ? (
              <Alert tone="info">Работа отправлена. Повторная сдача этого задания отключена преподавателем.</Alert>
            ) : (
              <form onSubmit={submit}>
                {state.overdue && (
                  <Alert tone="warning">Срок сдачи прошёл. Работу можно отправить, но преподаватель увидит, что она сдана после дедлайна.</Alert>
                )}
                {sub?.status === 'GRADED' && (
                  <Alert tone="info">Работа уже проверена. Новая версия будет отправлена на повторную проверку.</Alert>
                )}
                <Field label="Текст ответа" hint="Можно отправить только текст, только файлы или всё вместе.">
                  <Textarea
                    rows={6}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Опишите решение, добавьте ссылки на репозиторий или комментарии для преподавателя"
                    disabled={sending}
                  />
                </Field>
                <Field label="Файлы">
                  <FilePicker
                    files={files}
                    onChange={setFiles}
                    extensions={rule.extensions}
                    maxFileMb={rule.maxFileMb}
                    maxFiles={rule.maxFiles ?? 5}
                    disabled={sending}
                  />
                </Field>
                <Button type="submit" disabled={sending}>
                  {sending ? 'Отправляем...' : sent ? 'Отправить новую версию' : 'Отправить на проверку'}
                </Button>
              </form>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">История отправок</h2>
            {attempts.length === 0 && !sub?.fileUrl ? (
              <p className="muted">Вы ещё не отправляли работу по этому заданию.</p>
            ) : (
              <div className="stack">
                {attempts.map((at, i) => (
                  <div key={at.id} className={`attempt ${i === 0 ? 'attempt-current' : ''}`}>
                    <div className="row space-between" style={{ marginBottom: '0.5rem' }}>
                      <strong>Попытка №{at.number}</strong>
                      <span className="row" style={{ gap: '0.4rem' }}>
                        {i === 0 && <Badge tone="brand">Текущая версия</Badge>}
                        {a.deadline && new Date(at.submittedAt) > new Date(a.deadline) && <Badge tone="warning">После срока</Badge>}
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          {formatDateTime(at.submittedAt)}
                        </span>
                      </span>
                    </div>
                    {at.text && <p className="pre-wrap" style={{ color: 'var(--ink-2)', fontSize: '0.92rem' }}>{at.text}</p>}
                    <FileList files={at.files} basePath="/api/files/submission" />
                  </div>
                ))}
                {attempts.length === 0 && sub?.fileUrl && (
                  <SingleFile name={sub.fileName || 'Файл'} path={`/api/files/submission-legacy/${sub.id}`} />
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Детали</h2>
            <dl className="kv">
              <dt>Срок сдачи</dt>
              <dd style={{ color: state.overdue && state.key === 'active' ? 'var(--danger)' : undefined }}>
                {a.deadline ? formatDateTime(a.deadline) : 'Без срока'}
              </dd>
              <dt>Макс. балл</dt>
              <dd>{a.maxScore}</dd>
              <dt>Повторная сдача</dt>
              <dd>{a.allowResubmit ? 'Разрешена' : 'Запрещена'}</dd>
              {a.lesson && (
                <>
                  <dt>Занятие</dt>
                  <dd>{a.lesson.title}</dd>
                </>
              )}
              {teacher && (
                <>
                  <dt>Преподаватель</dt>
                  <dd>{fullName(teacher.user)}</dd>
                </>
              )}
              <dt>Попыток</dt>
              <dd>{sub?.attemptCount ?? 0}</dd>
            </dl>
          </section>
          <section className="card">
            <h2 className="card-title">Требования к файлам</h2>
            <p style={{ fontSize: '0.9rem' }}>
              Форматы: {rule.extensions.join(', ')}. Размер одного файла — до {rule.maxFileMb} МБ, не больше {rule.maxFiles ?? 5} файлов за раз.
            </p>
            <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>Исполняемые файлы (EXE, BAT, JS и т.п.) загрузить нельзя.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
