'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { LessonCard, Material, StoredFileInfo, UploadRules } from '@/lib/types';
import { formatBytes, formatDate, materialTypeLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { MaterialCard } from '@/components/cabinet/MaterialCard';
import { FilePicker, fileIcon } from '@/components/cabinet/Files';

type GroupOption = { id: string; code: string; courseId: string; course: { title: string } };
type UploadedFile = { url: string; originalName: string; size: number; mimeType: string };

type FormState = {
  id?: string;
  groupId: string;
  lessonId: string;
  title: string;
  topic: string;
  description: string;
  type: string;
  videoUrl: string;
  linkUrl: string;
  existingFiles: StoredFileInfo[];
  removeFileIds: string[];
};

const emptyForm = (groupId = ''): FormState => ({
  groupId,
  lessonId: '',
  title: '',
  topic: '',
  description: '',
  type: '',
  videoUrl: '',
  linkUrl: '',
  existingFiles: [],
  removeFileIds: [],
});

const isHttp = (v: string) => !v || /^https?:\/\/\S+$/i.test(v.trim());

function MaterialsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [groupFilter, setGroupFilter] = useState(params.get('groupId') ?? '');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const groups = useApiData<GroupOption[]>('/api/groups');
  const list = useApiData<Material[]>(`/api/materials?${new URLSearchParams({ ...(groupFilter ? { groupId: groupFilter } : {}), ...(typeFilter ? { type: typeFilter } : {}) })}`);
  const rules = useApiData<{ material: UploadRules }>('/api/uploads/rules');

  const [form, setForm] = useState<FormState | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Material | null>(null);
  const lessons = useApiData<LessonCard[]>(form?.groupId ? `/api/lessons?groupId=${form.groupId}` : null);

  useEffect(() => {
    if (params.get('create') === '1' && groups.data) {
      setNewFiles([]);
      setForm(emptyForm(params.get('groupId') ?? groups.data[0]?.id ?? ''));
      router.replace('/teacher/materials');
    }
  }, [params, groups.data, router]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list.data ?? [];
    return (list.data ?? []).filter((m) => [m.title, m.topic, m.description].some((v) => v?.toLowerCase().includes(term)));
  }, [list.data, q]);

  const ownGroupIds = new Set(groups.data?.map((g) => g.id));
  const canEdit = (m: Material) => m.authorId === user?.id || (m.groupId ? ownGroupIds.has(m.groupId) : false);

  const openCreate = () => {
    setNewFiles([]);
    setFormError('');
    setForm(emptyForm(groupFilter || groups.data?.[0]?.id || ''));
  };

  const openEdit = (m: Material) => {
    setNewFiles([]);
    setFormError('');
    setForm({
      id: m.id,
      groupId: m.groupId ?? '',
      lessonId: m.lessonId ?? '',
      title: m.title,
      topic: m.topic ?? '',
      description: m.description ?? '',
      type: m.type,
      videoUrl: m.videoUrl ?? '',
      linkUrl: m.linkUrl ?? '',
      existingFiles: m.files ?? [],
      removeFileIds: [],
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.groupId) return setFormError('Выберите группу');
    if (!form.title.trim()) return setFormError('Укажите название');
    if (!isHttp(form.videoUrl) || !isHttp(form.linkUrl)) return setFormError('Ссылки должны начинаться с http:// или https://');
    const keptFiles = form.existingFiles.filter((f) => !form.removeFileIds.includes(f.id)).length;
    if (!newFiles.length && !keptFiles && !form.videoUrl.trim() && !form.linkUrl.trim() && !form.description.trim()) {
      return setFormError('Добавьте файл, ссылку, видео или описание');
    }
    setSaving(true);
    setFormError('');
    try {
      let files: UploadedFile[] = [];
      if (newFiles.length) {
        const fd = new FormData();
        newFiles.forEach((f) => fd.append('files', f));
        const up = await api<{ files: UploadedFile[] }>('/api/uploads/material', { method: 'POST', body: fd });
        files = up.files.map(({ url, originalName, size, mimeType }) => ({ url, originalName, size, mimeType }));
      }
      const payload = {
        groupId: form.groupId,
        lessonId: form.lessonId || null,
        title: form.title.trim(),
        topic: form.topic.trim() || null,
        description: form.description.trim() || null,
        ...(form.type ? { type: form.type } : {}),
        videoUrl: form.videoUrl.trim(),
        linkUrl: form.linkUrl.trim(),
        files,
      };
      if (form.id) {
        await api(`/api/materials/${form.id}`, { method: 'PATCH', json: { ...payload, removeFileIds: form.removeFileIds } });
      } else {
        await api('/api/materials', { method: 'POST', json: payload });
      }
      setMsg({ tone: 'success', text: form.id ? 'Материал обновлён' : 'Материал добавлен, студенты группы получили уведомление' });
      setForm(null);
      list.reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить материал');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Material) => {
    try {
      await api(`/api/materials/${m.id}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: 'Материал удалён' });
      list.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleRemove = (fileId: string) =>
    form &&
    setForm({
      ...form,
      removeFileIds: form.removeFileIds.includes(fileId) ? form.removeFileIds.filter((x) => x !== fileId) : [...form.removeFileIds, fileId],
    });

  const materialRules = rules.data?.material;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Материалы"
        subtitle="Файлы, видео и ссылки для ваших групп"
        back={{ href: '/teacher/dashboard', label: 'Назад на главную' }}
        actions={
          <Button onClick={openCreate} disabled={!groups.data?.length}>
            + Добавить материал
          </Button>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или тема" />
        </Field>
        <Field label="Группа">
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Все группы</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} · {g.course.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Тип">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Все типы</option>
            {Object.entries(materialTypeLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !items.length ? (
        <EmptyState icon="📂" title="Материалов нет" description="Добавьте конспект, презентацию, видео или полезную ссылку." />
      ) : (
        <div className="grid grid-2">
          {items.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              actions={
                canEdit(m) ? (
                  <span className="row" style={{ gap: '0.35rem' }}>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(m)}>
                      Изменить
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(m)}>
                      Удалить
                    </Button>
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <Modal open={Boolean(form)} title={form?.id ? 'Редактирование материала' : 'Новый материал'} onClose={() => !saving && setForm(null)}>
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
                  <option value="">Без привязки</option>
                  {lessons.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatDate(l.startsAt)} · {l.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Название">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </Field>
              <Field label="Тема">
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} maxLength={200} />
              </Field>
              <Field label="Тип">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">Определить автоматически</option>
                  {Object.entries(materialTypeLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Описание">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} />
            </Field>
            <div className="form-grid">
              <Field label="Ссылка на видео" hint="YouTube, Vimeo и т. п.">
                <Input type="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="Полезная ссылка">
                <Input type="url" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://" />
              </Field>
            </div>
            {form.existingFiles.length > 0 && (
              <Field label="Прикреплённые файлы">
                <ul className="file-list">
                  {form.existingFiles.map((f) => {
                    const removed = form.removeFileIds.includes(f.id);
                    return (
                      <li key={f.id} className="file-item" style={removed ? { opacity: 0.5 } : undefined}>
                        <span className="file-icon" aria-hidden>
                          {fileIcon(f.originalName)}
                        </span>
                        <span className="file-meta">
                          <strong style={removed ? { textDecoration: 'line-through' } : undefined}>{f.originalName}</strong>
                          <small>{formatBytes(f.size)}</small>
                        </span>
                        <span className="file-actions">
                          <Button size="sm" variant="ghost" onClick={() => toggleRemove(f.id)}>
                            {removed ? 'Вернуть' : 'Удалить'}
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Field>
            )}
            {materialRules && (
              <Field label={form.id ? 'Добавить файлы' : 'Файлы'}>
                <FilePicker
                  files={newFiles}
                  onChange={setNewFiles}
                  extensions={materialRules.extensions}
                  maxFileMb={materialRules.maxFileMb}
                  maxFiles={materialRules.maxFiles ?? 10}
                  disabled={saving}
                />
              </Field>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : form.id ? 'Сохранить' : 'Опубликовать'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Удалить материал?" onClose={() => setConfirmDelete(null)}>
        {confirmDelete && (
          <div className="stack">
            <p>Материал «{confirmDelete.title}» и все его файлы будут удалены.</p>
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

export default function TeacherMaterialsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MaterialsInner />
    </Suspense>
  );
}
