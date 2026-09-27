'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError, fileUrl, uploadFile } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { Material } from '@/lib/types';
import { formatDate, materialTypeIcon, materialTypeLabel, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { MaterialCard } from '@/components/cabinet/MaterialCard';

type SiteMaterial = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  type: string;
  level: string;
  fileUrl?: string | null;
  fileName?: string | null;
  linkUrl?: string | null;
  videoUrl?: string | null;
  isPublic: boolean;
  courseId?: string | null;
  course?: { id: string; title: string } | null;
  publishedAt: string;
  author?: { firstName: string; lastName: string } | null;
};

type SiteForm = {
  id?: string;
  title: string;
  description: string;
  category: string;
  type: string;
  level: string;
  fileUrl: string;
  fileName: string;
  linkUrl: string;
  videoUrl: string;
  isPublic: boolean;
  courseId: string;
};

type CourseOption = { id: string; title: string; status: string };

const emptyForm: SiteForm = {
  title: '',
  description: '',
  category: '',
  type: 'NOTE',
  level: 'BEGINNER',
  fileUrl: '',
  fileName: '',
  linkUrl: '',
  videoUrl: '',
  isPublic: true,
  courseId: '',
};

const FILE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.pptx,.xlsx,.zip';

function guessType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'docx') return 'DOCX';
  if (ext === 'pptx') return 'PPTX';
  if (ext === 'xlsx') return 'XLSX';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'IMAGE';
  return null;
}

export default function AdminMaterialsPage() {
  const [tab, setTab] = useState<'site' | 'course'>('site');
  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Материалы" subtitle="Открытая библиотека сайта Somon и учебные материалы всех групп" />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'site'} className={`tab ${tab === 'site' ? 'active' : ''}`} onClick={() => setTab('site')}>
          Материалы сайта
        </button>
        <button type="button" role="tab" aria-selected={tab === 'course'} className={`tab ${tab === 'course' ? 'active' : ''}`} onClick={() => setTab('course')}>
          Материалы курсов
        </button>
      </div>
      {tab === 'site' ? <SiteMaterials /> : <CourseMaterials />}
    </div>
  );
}

function SiteMaterials() {
  const { data, loading, error, reload } = useApiData<SiteMaterial[]>('/api/public-materials');
  const { data: courses } = useApiData<CourseOption[]>('/api/courses');
  const [q, setQ] = useState('');
  const [access, setAccess] = useState('');
  const [form, setForm] = useState<SiteForm | null>(null);
  const [confirm, setConfirm] = useState<SiteMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((m) => {
      if (access === 'public' && !m.isPublic) return false;
      if (access === 'course' && m.isPublic) return false;
      return !needle || [m.title, m.category, m.description].filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
    });
  }, [data, q, access]);

  const categories = useMemo(() => [...new Set((data ?? []).map((m) => m.category))], [data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.isPublic && !form.courseId) return setFormError('Выберите курс, студентам которого доступен материал.');
    setSaving(true);
    setFormError('');
    const { id, ...rest } = form;
    const json = {
      ...rest,
      title: rest.title.trim(),
      category: rest.category.trim(),
      description: rest.description.trim() || null,
      fileUrl: rest.fileUrl || null,
      fileName: rest.fileName || null,
      linkUrl: rest.linkUrl.trim() || null,
      videoUrl: rest.videoUrl.trim() || null,
      courseId: rest.courseId || null,
    };
    try {
      await api(id ? `/api/public-materials/${id}` : '/api/public-materials', { method: id ? 'PATCH' : 'POST', json });
      setMsg({ tone: 'success', text: id ? 'Материал сохранён.' : 'Материал добавлен в библиотеку.' });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !form) return;
    setUploading(true);
    setFormError('');
    try {
      const res = await uploadFile('/api/uploads/public', file);
      setForm((f) => (f ? { ...f, fileUrl: res.fileUrl, fileName: res.fileName, type: guessType(res.fileName) ?? f.type } : f));
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await api(`/api/public-materials/${confirm.id}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: 'Материал удалён.' });
      setConfirm(null);
      reload();
    } catch (err) {
      setConfirm(null);
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, категория" />
        </Field>
        <Field label="Доступ">
          <Select value={access} onChange={(e) => setAccess(e.target.value)}>
            <option value="">Все</option>
            <option value="public">Публичные</option>
            <option value="course">Только для студентов курса</option>
          </Select>
        </Field>
        <div className="field" style={{ alignSelf: 'end', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            onClick={() => {
              setFormError('');
              setForm(emptyForm);
            }}
          >
            + Материал
          </Button>
          <ButtonLink href="/materials" variant="secondary">
            На сайте
          </ButtonLink>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📚" title={data?.length ? 'Ничего не найдено' : 'Материалов пока нет'} description="Статьи, PDF, презентации, видео и полезные ссылки для раздела «Материалы» на сайте." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Материал</th>
                <th>Категория</th>
                <th>Содержимое</th>
                <th>Доступ</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="person-cell">
                      <span style={{ fontSize: '1.4rem' }} aria-hidden>
                        {materialTypeIcon[m.type] ?? '📘'}
                      </span>
                      <span>
                        <strong>{m.title}</strong>
                        <small>
                          {materialTypeLabel[m.type] ?? m.type} · {statusLabel[m.level] ?? m.level}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{m.category}</td>
                  <td>
                    <div className="badge-row">
                      {m.fileUrl && (
                        <a className="text-link" href={fileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer">
                          📎 {m.fileName || 'Файл'}
                        </a>
                      )}
                      {m.videoUrl && <Badge tone="info">Видео</Badge>}
                      {m.linkUrl && <Badge>Ссылка</Badge>}
                      {!m.fileUrl && !m.videoUrl && !m.linkUrl && <span className="muted">Текст</span>}
                    </div>
                  </td>
                  <td>
                    {m.isPublic ? <Badge tone="success">Публичный</Badge> : <Badge tone="warning">Студенты: {m.course?.title ?? 'курс'}</Badge>}
                  </td>
                  <td>{formatDate(m.publishedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setFormError('');
                          setForm({
                            id: m.id,
                            title: m.title,
                            description: m.description ?? '',
                            category: m.category,
                            type: m.type,
                            level: m.level,
                            fileUrl: m.fileUrl ?? '',
                            fileName: m.fileName ?? '',
                            linkUrl: m.linkUrl ?? '',
                            videoUrl: m.videoUrl ?? '',
                            isPublic: m.isPublic,
                            courseId: m.courseId ?? '',
                          });
                        }}
                      >
                        Изменить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(m)}>
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(form)} size="lg" title={form?.id ? 'Редактирование материала' : 'Новый материал сайта'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Название">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </Field>
            <div className="form-grid">
              <Field label="Категория">
                <Input list="material-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required maxLength={80} placeholder="Программирование" />
                <datalist id="material-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Тип">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(materialTypeLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Уровень">
                <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  <option value="BEGINNER">Начальный</option>
                  <option value="INTERMEDIATE">Средний</option>
                  <option value="ADVANCED">Продвинутый</option>
                </Select>
              </Field>
            </div>
            <Field label="Описание">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
            </Field>
            <Field label="Файл" hint="PDF, DOCX, PPTX, XLSX, ZIP или изображение">
              <div className="row" style={{ gap: '0.5rem' }}>
                {form.fileUrl ? (
                  <a className="text-link" href={fileUrl(form.fileUrl)} target="_blank" rel="noopener noreferrer">
                    📎 {form.fileName || 'Файл'}
                  </a>
                ) : (
                  <span className="muted">Файл не прикреплён</span>
                )}
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Загрузка...' : form.fileUrl ? 'Заменить' : 'Выбрать файл'}
                </Button>
                {form.fileUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, fileUrl: '', fileName: '' })}>
                    Убрать
                  </Button>
                )}
                <input ref={fileRef} type="file" hidden accept={FILE_ACCEPT} onChange={(e) => upload(e.target.files?.[0])} />
              </div>
            </Field>
            <div className="form-grid">
              <Field label="Ссылка на видео" hint="YouTube, RuTube и т.п.">
                <Input type="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="Ссылка">
                <Input type="url" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://" />
              </Field>
            </div>
            <Field label="Доступ">
              <Select value={form.isPublic ? 'public' : 'course'} onChange={(e) => setForm({ ...form, isPublic: e.target.value === 'public' })}>
                <option value="public">Публичный — виден всем на сайте</option>
                <option value="course">Только студентам выбранного курса</option>
              </Select>
            </Field>
            <Field label={form.isPublic ? 'Связанный курс (необязательно)' : 'Курс'}>
              <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required={!form.isPublic}>
                <option value="">{form.isPublic ? 'Без курса' : 'Выберите курс'}</option>
                {(courses ?? [])
                  .filter((c) => c.status !== 'ARCHIVED' || c.id === form.courseId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirm)}
        title="Удалить материал?"
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        message={<p style={{ margin: 0 }}>Материал «{confirm?.title}» и прикреплённый файл будут удалены.</p>}
      />
    </>
  );
}

function CourseMaterials() {
  const { data: courses } = useApiData<CourseOption[]>('/api/courses');
  const [courseId, setCourseId] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApiData<Material[]>(`/api/materials${courseId ? `?courseId=${courseId}` : ''}`);
  const [confirm, setConfirm] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((m) => !needle || [m.title, m.topic, m.group?.code].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)));
  }, [data, q]);

  const remove = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await api(`/api/materials/${confirm.id}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: 'Материал удалён.' });
      setConfirm(null);
      reload();
    } catch (err) {
      setConfirm(null);
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, тема, группа" />
        </Field>
        <Field label="Курс">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Все курсы</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
        Учебные материалы добавляют преподаватели в своих группах. Администратор может просматривать файлы и удалять материалы.
      </p>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📂" title="Материалов пока нет" />
      ) : (
        <div className="grid grid-2">
          {rows.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              actions={
                <Button size="sm" variant="ghost" onClick={() => setConfirm(m)}>
                  Удалить
                </Button>
              }
            />
          ))}
        </div>
      )}
      <ConfirmModal
        open={Boolean(confirm)}
        title="Удалить материал?"
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        message={<p style={{ margin: 0 }}>Материал «{confirm?.title}» и его файлы станут недоступны студентам группы.</p>}
      />
    </>
  );
}
