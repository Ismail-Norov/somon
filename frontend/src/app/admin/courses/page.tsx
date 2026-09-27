'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError, fileUrl, uploadFile } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatPrice, fullName, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Course = {
  id: string;
  title: string;
  shortDesc?: string | null;
  description?: string | null;
  categoryId?: string | null;
  level: string;
  format: string;
  status: string;
  durationWeeks?: number | null;
  lessonsCount?: number | null;
  maxStudents: number;
  price?: number | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
  teachers: { id: string; user: PersonRef }[];
  _count: { groups: number; enrollments: number };
};

type Category = { id: string; name: string };

type CourseForm = {
  id?: string;
  title: string;
  shortDesc: string;
  description: string;
  categoryId: string;
  level: string;
  format: string;
  status: string;
  durationWeeks: string;
  lessonsCount: string;
  maxStudents: string;
  price: string;
  imageUrl: string;
};

const emptyForm: CourseForm = {
  title: '',
  shortDesc: '',
  description: '',
  categoryId: '',
  level: 'BEGINNER',
  format: 'HYBRID',
  status: 'DRAFT',
  durationWeeks: '8',
  lessonsCount: '16',
  maxStudents: '16',
  price: '',
  imageUrl: '',
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const STATUS_TONE: Record<string, 'success' | 'warning' | 'default'> = { PUBLISHED: 'success', DRAFT: 'warning', ARCHIVED: 'default' };

const optionalInt = (v: string) => (v.trim() ? Number(v) : null);

export default function AdminCoursesPage() {
  const { data, loading, error, reload } = useApiData<Course[]>('/api/courses');
  const { data: categories } = useApiData<Category[]>('/api/courses/meta/categories');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<CourseForm | null>(null);
  const [archive, setArchive] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((c) => (!status || c.status === status) && (!needle || c.title.toLowerCase().includes(needle)));
  }, [data, q, status]);

  const openEdit = (c: Course) => {
    setFormError('');
    setForm({
      id: c.id,
      title: c.title,
      shortDesc: c.shortDesc ?? '',
      description: c.description ?? '',
      categoryId: c.categoryId ?? '',
      level: c.level,
      format: c.format,
      status: c.status,
      durationWeeks: c.durationWeeks ? String(c.durationWeeks) : '',
      lessonsCount: c.lessonsCount ? String(c.lessonsCount) : '',
      maxStudents: String(c.maxStudents),
      price: c.price != null ? String(c.price) : '',
      imageUrl: c.imageUrl ?? '',
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const nums = { durationWeeks: optionalInt(form.durationWeeks), lessonsCount: optionalInt(form.lessonsCount), maxStudents: Number(form.maxStudents) };
    if (Object.values(nums).some((n) => n !== null && (!Number.isInteger(n) || n <= 0))) {
      return setFormError('Длительность, количество занятий и вместимость — целые положительные числа.');
    }
    const price = form.price.trim() ? Number(form.price.replace(',', '.')) : null;
    if (price !== null && (Number.isNaN(price) || price < 0)) return setFormError('Стоимость — неотрицательное число.');
    setSaving(true);
    setFormError('');
    const json = {
      title: form.title.trim(),
      shortDesc: form.shortDesc.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      level: form.level,
      format: form.format,
      status: form.status,
      ...nums,
      price,
      imageUrl: form.imageUrl || null,
    };
    try {
      await api(form.id ? `/api/courses/${form.id}` : '/api/courses', { method: form.id ? 'PATCH' : 'POST', json });
      setMsg({
        tone: 'success',
        text: json.status === 'PUBLISHED' ? 'Курс сохранён и опубликован на сайте.' : 'Курс сохранён. Опубликуйте его, чтобы он появился на сайте.',
      });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const setCourseStatus = async (c: Course, next: string) => {
    try {
      await api(`/api/courses/${c.id}`, { method: 'PATCH', json: { status: next } });
      setMsg({ tone: 'success', text: next === 'PUBLISHED' ? `Курс «${c.title}» опубликован.` : `Курс «${c.title}» переведён в черновики.` });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const doArchive = async () => {
    if (!archive) return;
    setSaving(true);
    try {
      await api(`/api/courses/${archive.id}/archive`, { method: 'PATCH' });
      setMsg({ tone: 'success', text: `Курс «${archive.title}» перемещён в архив и скрыт с сайта.` });
      setArchive(null);
      reload();
    } catch (err) {
      setArchive(null);
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось архивировать' });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file?: File) => {
    if (imageRef.current) imageRef.current.value = '';
    if (!file || !form) return;
    if (!IMAGE_TYPES.includes(file.type)) return setFormError('Выберите изображение JPG, PNG, GIF или WEBP.');
    setUploading(true);
    setFormError('');
    try {
      const res = await uploadFile('/api/uploads/public', file);
      setForm((f) => (f ? { ...f, imageUrl: res.fileUrl } : f));
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось загрузить изображение');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Курсы"
        subtitle="Каталог образовательных программ. Опубликованные курсы видны на сайте и студентам"
        actions={
          <>
            <ButtonLink href="/courses" variant="secondary">
              Каталог на сайте
            </ButtonLink>
            <Button
              onClick={() => {
                setFormError('');
                setForm(emptyForm);
              }}
            >
              + Курс
            </Button>
          </>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название курса" />
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            <option value="PUBLISHED">Опубликованные</option>
            <option value="DRAFT">Черновики</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
      </div>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📚" title={data?.length ? 'Ничего не найдено' : 'Курсов пока нет'} description="Создайте первый курс — он появится в каталоге после публикации." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Курс</th>
                <th>Параметры</th>
                <th>Преподаватели</th>
                <th>Группы</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person-cell">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(c.imageUrl)} alt="" className="news-thumb" style={{ width: 56, height: 40 }} />
                      ) : null}
                      <span>
                        <strong>{c.title}</strong>
                        <small>{c.category?.name || 'Без категории'}</small>
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {statusLabel[c.level]} · {statusLabel[c.format] ?? c.format}
                    <div className="muted">
                      {[c.durationWeeks ? `${c.durationWeeks} нед.` : null, c.lessonsCount ? `${c.lessonsCount} зан.` : null, formatPrice(c.price)].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td>
                    <div className="badge-row">
                      {c.teachers.length ? c.teachers.map((t) => <Badge key={t.id}>{fullName(t.user)}</Badge>) : <span className="muted">—</span>}
                    </div>
                  </td>
                  <td>
                    {c._count.groups}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      студентов: {c._count.enrollments}
                    </div>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[c.status] ?? 'default'}>{statusLabel[c.status] ?? c.status}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                        Изменить
                      </Button>
                      {c.status === 'DRAFT' && (
                        <Button size="sm" variant="ghost" onClick={() => setCourseStatus(c, 'PUBLISHED')}>
                          Опубликовать
                        </Button>
                      )}
                      {c.status === 'PUBLISHED' && (
                        <ButtonLink size="sm" variant="ghost" href={`/courses/${c.id}`}>
                          На сайте
                        </ButtonLink>
                      )}
                      {c.status === 'ARCHIVED' ? (
                        <Button size="sm" variant="ghost" onClick={() => setCourseStatus(c, 'DRAFT')}>
                          Восстановить
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setArchive(c)}>
                          В архив
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(form)} size="lg" title={form?.id ? 'Редактирование курса' : 'Новый курс'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Название">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="Краткое описание" hint="Показывается в карточке курса, например: HTML, CSS, JavaScript, React">
              <Input value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} maxLength={300} />
            </Field>
            <Field label="Полное описание">
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Категория">
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Без категории</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
              <Field label="Формат">
                <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="OFFLINE">Офлайн</option>
                  <option value="ONLINE">Онлайн</option>
                  <option value="HYBRID">Смешанный</option>
                </Select>
              </Field>
              <Field label="Длительность, недель">
                <Input type="number" min={1} value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} />
              </Field>
              <Field label="Количество занятий">
                <Input type="number" min={1} value={form.lessonsCount} onChange={(e) => setForm({ ...form, lessonsCount: e.target.value })} />
              </Field>
              <Field label="Макс. студентов в группе">
                <Input type="number" min={1} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} required />
              </Field>
              <Field label="Стоимость, сомони" hint="Пусто — не показывать">
                <Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Статус">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="DRAFT">Черновик</option>
                  <option value="PUBLISHED">Опубликован</option>
                  <option value="ARCHIVED">Архив</option>
                </Select>
              </Field>
            </div>
            <Field label="Обложка">
              <div className="row" style={{ gap: '0.5rem' }}>
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(form.imageUrl)} alt="" className="news-thumb" />
                )}
                <Button size="sm" variant="secondary" onClick={() => imageRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Загрузка...' : form.imageUrl ? 'Заменить' : 'Загрузить'}
                </Button>
                {form.imageUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, imageUrl: '' })}>
                    Убрать
                  </Button>
                )}
                <input ref={imageRef} type="file" hidden accept={IMAGE_TYPES.join(',')} onChange={(e) => uploadImage(e.target.files?.[0])} />
              </div>
            </Field>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Преподавателей курса назначают в разделе «Преподаватели», группы — в разделе «Группы».
            </p>
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
        open={Boolean(archive)}
        title="Архивировать курс?"
        confirmLabel="В архив"
        busy={saving}
        onClose={() => setArchive(null)}
        onConfirm={doArchive}
        message={<p style={{ margin: 0 }}>Курс «{archive?.title}» исчезнет с сайта и из списка доступных курсов. Группы и история обучения сохранятся.</p>}
      />
    </div>
  );
}
