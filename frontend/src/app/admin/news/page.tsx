'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError, fileUrl, uploadFile } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, fullName } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type News = {
  id: string;
  title: string;
  summary?: string | null;
  body: string;
  category: string;
  imageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: PersonRef | null;
};

type NewsForm = { id?: string; title: string; summary: string; body: string; category: string; imageUrl: string; isPublished: boolean };

const CATEGORIES = ['Новости центра', 'Новый курс', 'Набор в группу', 'Мероприятия', 'Достижения студентов'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const emptyForm: NewsForm = { title: '', summary: '', body: '', category: CATEGORIES[0], imageUrl: '', isPublished: true };

export default function AdminNewsPage() {
  const { data, loading, error, reload } = useApiData<News[]>('/api/news');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<NewsForm | null>(null);
  const [confirm, setConfirm] = useState<News | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((n) => {
      if (filter === 'published' && !n.isPublished) return false;
      if (filter === 'draft' && n.isPublished) return false;
      return !needle || n.title.toLowerCase().includes(needle) || n.category.toLowerCase().includes(needle);
    });
  }, [data, filter, q]);

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...(data ?? []).map((n) => n.category)])], [data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError('');
    const { id, ...rest } = form;
    const json = {
      ...rest,
      title: rest.title.trim(),
      summary: rest.summary.trim() || null,
      body: rest.body.trim(),
      category: rest.category.trim() || CATEGORIES[0],
      imageUrl: rest.imageUrl || null,
    };
    try {
      await api(id ? `/api/news/${id}` : '/api/news', { method: id ? 'PATCH' : 'POST', json });
      setMsg({ tone: 'success', text: json.isPublished ? 'Новость опубликована на сайте.' : 'Новость сохранена как черновик.' });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (n: News) => {
    try {
      await api(`/api/news/${n.id}`, { method: 'PATCH', json: { isPublished: !n.isPublished } });
      setMsg({ tone: 'success', text: n.isPublished ? 'Новость снята с публикации.' : 'Новость опубликована.' });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await api(`/api/news/${confirm.id}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: 'Новость удалена.' });
      setConfirm(null);
      reload();
    } catch (err) {
      setConfirm(null);
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
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
        title="Новости"
        subtitle="Публикации для раздела «Новости Somon» на сайте"
        actions={
          <>
            <ButtonLink href="/news" variant="secondary" external={false}>
              Открыть на сайте
            </ButtonLink>
            <Button
              onClick={() => {
                setFormError('');
                setForm(emptyForm);
              }}
            >
              + Новость
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Заголовок или рубрика" />
        </Field>
        <Field label="Статус">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Все</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
          </Select>
        </Field>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📰" title={data?.length ? 'Ничего не найдено' : 'Новостей пока нет'} description="Расскажите об открытии курса, наборе в группу или событиях центра." />
      ) : (
        <div className="stack" style={{ gap: '0.75rem' }}>
          {rows.map((n) => (
            <article key={n.id} className="card row" style={{ gap: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {n.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(n.imageUrl)} alt="" className="news-thumb" />
              ) : (
                <span className="news-thumb" aria-hidden style={{ display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>
                  📰
                </span>
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                  <strong>{n.title}</strong>
                  <Badge tone={n.isPublished ? 'success' : 'warning'}>{n.isPublished ? 'Опубликована' : 'Черновик'}</Badge>
                  <Badge>{n.category}</Badge>
                </div>
                {n.summary && <p style={{ margin: '0.3rem 0 0', fontSize: '0.9rem' }}>{n.summary}</p>}
                <small className="muted">
                  {n.isPublished && n.publishedAt ? `Опубликована ${formatDate(n.publishedAt)}` : `Создана ${formatDate(n.createdAt)}`}
                  {n.author ? ` · ${fullName(n.author)}` : ''}
                </small>
              </div>
              <div className="table-actions">
                {n.isPublished && (
                  <ButtonLink size="sm" variant="ghost" href={`/news/${n.id}`}>
                    Смотреть
                  </ButtonLink>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFormError('');
                    setForm({
                      id: n.id,
                      title: n.title,
                      summary: n.summary ?? '',
                      body: n.body,
                      category: n.category,
                      imageUrl: n.imageUrl ?? '',
                      isPublished: n.isPublished,
                    });
                  }}
                >
                  Изменить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => togglePublish(n)}>
                  {n.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(n)}>
                  Удалить
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(form)} size="lg" title={form?.id ? 'Редактирование новости' : 'Новая новость'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Заголовок">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </Field>
            <div className="form-grid">
              <Field label="Рубрика">
                <Input list="news-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={80} />
                <datalist id="news-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Обложка" hint="JPG, PNG, GIF, WEBP">
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
            </div>
            <Field label="Краткое описание" hint="Показывается в карточке новости">
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} maxLength={500} />
            </Field>
            <Field label="Текст новости">
              <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </Field>
            <label className="check-line">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Опубликовать на сайте
            </label>
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
        title="Удалить новость?"
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        message={<p style={{ margin: 0 }}>Новость «{confirm?.title}» будет удалена без возможности восстановления.</p>}
      />
    </div>
  );
}
