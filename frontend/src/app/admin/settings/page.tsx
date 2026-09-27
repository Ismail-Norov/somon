'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { SiteSettings, UploadRules } from '@/lib/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type FieldDef = { key: string; label: string; hint?: string; multiline?: boolean; placeholder?: string; type?: string };
type Section = { title: string; description?: string; fields: FieldDef[] };

const SECTIONS: Section[] = [
  {
    title: 'Сайт',
    description: 'Название и тексты главной страницы',
    fields: [
      { key: 'site.name', label: 'Короткое название (логотип)' },
      { key: 'site.fullName', label: 'Полное название' },
      { key: 'site.tagline', label: 'Слоган в hero-блоке' },
      { key: 'site.description', label: 'Описание центра', multiline: true },
      { key: 'about.text', label: 'Текст блока «О Somon»', multiline: true },
    ],
  },
  {
    title: 'Контакты',
    description: 'Показываются в подвале сайта и на странице «Контакты». Филиалы настраиваются в разделе «Филиалы и аудитории»',
    fields: [
      { key: 'contact.phone', label: 'Телефон', type: 'tel' },
      { key: 'contact.email', label: 'Email', type: 'email' },
      { key: 'contact.address', label: 'Адрес' },
      { key: 'contact.workHours', label: 'Время работы' },
    ],
  },
  {
    title: 'Социальные сети',
    description: 'Пустое поле — иконка не показывается',
    fields: [
      { key: 'social.instagram', label: 'Instagram', placeholder: 'https://instagram.com/...', type: 'url' },
      { key: 'social.telegram', label: 'Telegram', placeholder: 'https://t.me/...', type: 'url' },
      { key: 'social.facebook', label: 'Facebook', placeholder: 'https://facebook.com/...', type: 'url' },
      { key: 'social.youtube', label: 'YouTube', placeholder: 'https://youtube.com/...', type: 'url' },
    ],
  },
  {
    title: 'Статистика на главной',
    description: 'Оставьте поле пустым, чтобы показывать реальное число из базы данных. Можно указать, например, «500+»',
    fields: [
      { key: 'stats.students', label: 'Студентов' },
      { key: 'stats.courses', label: 'Курсов' },
      { key: 'stats.teachers', label: 'Преподавателей' },
      { key: 'stats.directions', label: 'Направлений' },
    ],
  },
];

export default function AdminSettingsPage() {
  const { data, loading, error, reload } = useApiData<SiteSettings>('/api/settings');
  const { data: rules } = useApiData<{ submission: UploadRules }>('/api/uploads/rules');
  const [form, setForm] = useState<SiteSettings>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const dirty = data ? Object.keys(form).some((k) => form[k] !== data[k]) : false;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== data?.[k]).map(([k, v]) => [k, v.trim()]));
      const saved = await api<SiteSettings>('/api/settings', { method: 'PUT', json: changed });
      setForm(saved);
      await reload();
      setMsg({ tone: 'success', text: 'Настройки сохранены и уже отображаются на сайте.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <form className="stack" style={{ gap: '1rem' }} onSubmit={save}>
      <PageHeader
        title="Настройки сайта"
        subtitle="Контакты, тексты и показатели публичного сайта Somon"
        actions={
          <>
            <ButtonLink href="/" variant="secondary">
              Открыть сайт
            </ButtonLink>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {SECTIONS.map((section) => (
        <section key={section.title} className="card settings-section">
          <h2 className="card-title">{section.title}</h2>
          {section.description && (
            <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.88rem' }}>
              {section.description}
            </p>
          )}
          <div className="form-grid">
            {section.fields.map((f) => (
              <div key={f.key} className={f.multiline ? 'span-all' : undefined}>
                <Field label={f.label} hint={f.hint}>
                  {f.multiline ? (
                    <Textarea rows={4} maxLength={2000} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <Input
                      type={f.type ?? 'text'}
                      maxLength={2000}
                      placeholder={f.placeholder}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card settings-section">
        <h2 className="card-title">Учебные правила</h2>
        <dl className="kv">
          <dt>Формула прогресса</dt>
          <dd>0.4 × занятия + 0.4 × задания + 0.2 × посещаемость</dd>
          <dt>Опоздание</dt>
          <dd>Считается присутствием</dd>
          <dt>Файлы заданий и материалов</dt>
          <dd>До {rules?.submission.maxFileMb ?? 20} МБ, проверка расширения и содержимого файла</dd>
          <dt>Напоминания о занятиях</dt>
          <dd>Автоматически за несколько часов до начала (LESSON_REMINDER_HOURS)</dd>
        </dl>
      </section>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? 'Сохраняем...' : 'Сохранить изменения'}
        </Button>
      </div>
    </form>
  );
}
