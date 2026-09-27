'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiRequestError, uploadFile } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { Assignment, LessonCard, UploadRules } from '@/lib/types';
import { formatDate, formatDateTime, fromDateTimeInput, toDateTimeInput } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { FilePicker } from '@/components/cabinet/Files';

type GroupOption = { id: string; code: string; course: { title: string }; _count?: { groupStudents: number } };
type StatusFilter = 'all' | 'active' | 'DRAFT' | 'OVERDUE';

type FormState = {
  id?: string;
  groupId: string;
  lessonId: string;
  title: string;
  description: string;
  criteria: string;
  publishAt: string;
  deadline: string;
  maxScore: string;
  allowResubmit: boolean;
  draft: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
};

const emptyForm = (groupId = ''): FormState => ({
  groupId,
  lessonId: '',
  title: '',
  description: '',
  criteria: '',
  publishAt: '',
  deadline: '',
  maxScore: '10',
  allowResubmit: true,
  draft: false,
  attachmentUrl: null,
  attachmentName: null,
});

function assignmentBadge(a: Assignment) {
  if (a.status === 'DRAFT') return <Badge>Черновик</Badge>;
  if (a.publishAt && new Date(a.publishAt) > new Date()) return <Badge tone="info">{`Публикация ${formatDate(a.publishAt)}`}</Badge>;
  if (a.status === 'OVERDUE' || (a.deadline && new Date(a.deadline) < new Date())) return <Badge tone="warning">Срок прошёл</Badge>;
  return <Badge tone="success">Опубликовано</Badge>;
}

function AssignmentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [groupFilter, setGroupFilter] = useState(params.get('groupId') ?? '');
  const [status, setStatus] = useState<StatusFilter>('all');
  const groups = useApiData<GroupOption[]>('/api/groups');
  const list = useApiData<Assignment[]>(`/api/assignments${groupFilter ? `?groupId=${groupFilter}` : ''}`);
  const rules = useApiData<{ assignment: UploadRules }>('/api/uploads/rules');

  const [form, setForm] = useState<FormState | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Assignment | null>(null);

  const lessons = useApiData<LessonCard[]>(form?.groupId ? `/api/lessons?groupId=${form.groupId}` : null);

  useEffect(() => {
    if (params.get('create') === '1' && groups.data) {
      setForm(emptyForm(params.get('groupId') ?? groups.data[0]?.id ?? ''));
      router.replace('/teacher/assignments');
    }
  }, [params, groups.data, router]);

  const items = useMemo(() => {
    const now = new Date();
    return (list.data ?? []).filter((a) => {
      const overdue = a.status === 'OVERDUE' || Boolean(a.deadline && new Date(a.deadline) < now);
      if (status === 'DRAFT') return a.status === 'DRAFT';
      if (status === 'OVERDUE') return a.status !== 'DRAFT' && overdue;
      if (status === 'active') return a.status !== 'DRAFT' && !overdue;
      return true;
    });
  }, [list.data, status]);

  const studentsIn = (groupId?: string | null) => groups.data?.find((g) => g.id === groupId)?._count?.groupStudents;

  const openEdit = (a: Assignment) => {
    setFile([]);
    setFormError('');
    setForm({
      id: a.id,
      groupId: a.groupId ?? '',
      lessonId: a.lessonId ?? '',
      title: a.title,
      description: a.description ?? '',
      criteria: a.criteria ?? '',
      publishAt: toDateTimeInput(a.publishAt),
      deadline: toDateTimeInput(a.deadline),
      maxScore: String(a.maxScore),
      allowResubmit: a.allowResubmit,
      draft: a.status === 'DRAFT',
      attachmentUrl: a.attachmentUrl ?? null,
      attachmentName: a.attachmentName ?? null,
    });
  };

  const openCreate = () => {
    setFile([]);
    setFormError('');
    setForm(emptyForm(groupFilter || groups.data?.[0]?.id || ''));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const maxScore = Number(form.maxScore);
    if (!form.groupId) return setFormError('Выберите группу');
    if (!form.title.trim()) return setFormError('Укажите название задания');
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) return setFormError('Максимальный балл — от 1 до 1000');
    if (form.publishAt && form.deadline && new Date(form.deadline) <= new Date(form.publishAt)) {
      return setFormError('Срок сдачи должен быть позже даты публикации');
    }
    setSaving(true);
    setFormError('');
    try {
      let attachmentUrl = form.attachmentUrl;
      let attachmentName = form.attachmentName;
      if (file[0]) {
        const up = await uploadFile<{ url: string; fileName: string }>('/api/uploads/assignment', file[0]);
        attachmentUrl = up.url;
        attachmentName = up.fileName;
      }
      const payload = {
        groupId: form.groupId,
        lessonId: form.lessonId || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        criteria: form.criteria.trim() || null,
        publishAt: fromDateTimeInput(form.publishAt),
        deadline: fromDateTimeInput(form.deadline),
        maxScore,
        allowResubmit: form.allowResubmit,
        status: form.draft ? 'DRAFT' : 'PUBLISHED',
        attachmentUrl,
        attachmentName,
      };
      if (form.id) {
        await api(`/api/assignments/${form.id}`, { method: 'PATCH', json: payload });
      } else {
        await api('/api/assignments', { method: 'POST', json: payload });
      }
      setMsg({
        tone: 'success',
        text: form.id
          ? 'Задание обновлено'
          : form.draft
            ? 'Черновик сохранён — студенты его не видят'
            : form.publishAt && new Date(form.publishAt) > new Date()
              ? 'Задание создано и будет опубликовано в указанное время'
              : 'Задание опубликовано, студенты группы получили уведомление',
      });
      setForm(null);
      list.reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить задание');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Assignment) => {
    try {
      await api(`/api/assignments/${a.id}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: 'Задание удалено' });
      list.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const assignmentRules = rules.data?.assignment;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Задания"
        subtitle="Создание и публикация заданий для ваших групп"
        back={{ href: '/teacher/dashboard', label: 'Назад на главную' }}
        actions={
          <Button onClick={openCreate} disabled={!groups.data?.length}>
            + Новое задание
          </Button>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="segmented" role="tablist">
          {(
            [
              ['all', 'Все'],
              ['active', 'Активные'],
              ['OVERDUE', 'Срок прошёл'],
              ['DRAFT', 'Черновики'],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="Группа">
            <option value="">Все группы</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} · {g.course.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !items.length ? (
        <EmptyState icon="📝" title="Заданий нет" description="Создайте первое задание — студенты группы получат уведомление." />
      ) : (
        <div className="stack">
          {items.map((a) => {
            const total = studentsIn(a.groupId);
            const submitted = a._count?.submissions ?? 0;
            return (
              <article key={a.id} className="card">
                <div className="row space-between" style={{ alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Link href={`/teacher/assignments/${a.id}`} className="text-link">
                      <strong style={{ fontSize: '1.05rem' }}>{a.title}</strong>
                    </Link>
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      {a.course?.title} · {a.group?.code}
                      {a.lesson && ` · ${a.lesson.title}`}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Срок: {a.deadline ? formatDateTime(a.deadline) : 'без срока'} · макс. балл {a.maxScore}
                      {!a.allowResubmit && ' · без пересдачи'}
                    </div>
                  </div>
                  <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
                    {assignmentBadge(a)}
                    {Boolean(a.pendingReview) && <Badge tone="info">{`На проверке: ${a.pendingReview}`}</Badge>}
                    <Badge>{`Сдали: ${submitted}${total !== undefined ? ` / ${total}` : ''}`}</Badge>
                  </div>
                </div>
                <div className="row" style={{ gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <ButtonLink href={`/teacher/assignments/${a.id}`} size="sm">
                    Ответы студентов
                  </ButtonLink>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>
                    Изменить
                  </Button>
                  {submitted === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(a)}>
                      Удалить
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(form)} title={form?.id ? 'Редактирование задания' : 'Новое задание'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="form-grid">
              <Field label="Группа">
                <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value, lessonId: '' })} required>
                  <option value="">Выберите группу</option>
                  {groups.data?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} · {g.course.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Занятие (необязательно)">
                <Select value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })} disabled={!form.groupId}>
                  <option value="">Без привязки к занятию</option>
                  {lessons.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatDate(l.startsAt)} · {l.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Название">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="Описание / условие задания">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Критерии оценки">
              <Textarea rows={3} value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Дата публикации" hint="Пусто — сразу">
                <Input type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} />
              </Field>
              <Field label="Срок сдачи">
                <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </Field>
              <Field label="Максимальный балл">
                <Input type="number" min={1} max={1000} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} required />
              </Field>
            </div>
            <Field label="Файл с инструкцией (необязательно)">
              <div className="stack" style={{ gap: '0.5rem' }}>
                {form.attachmentUrl && !file.length && (
                  <div className="row space-between">
                    <span>📎 {form.attachmentName || 'Файл'}</span>
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, attachmentUrl: null, attachmentName: null })}>
                      Убрать
                    </Button>
                  </div>
                )}
                {assignmentRules && (
                  <FilePicker files={file} onChange={setFile} extensions={assignmentRules.extensions} maxFileMb={assignmentRules.maxFileMb} maxFiles={1} disabled={saving} />
                )}
              </div>
            </Field>
            <label className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={form.allowResubmit} onChange={(e) => setForm({ ...form, allowResubmit: e.target.checked })} />
              Разрешить повторную сдачу
            </label>
            <label className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.checked })} />
              Сохранить как черновик (студенты не увидят)
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : form.id ? 'Сохранить' : form.draft ? 'Сохранить черновик' : 'Опубликовать'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Удалить задание?" onClose={() => setConfirmDelete(null)}>
        {confirmDelete && (
          <div className="stack">
            <p>
              Задание «{confirmDelete.title}» будет удалено без возможности восстановления.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
                Отмена
              </Button>
              <Button variant="danger" onClick={() => remove(confirmDelete)}>
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function TeacherAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AssignmentsInner />
    </Suspense>
  );
}
