'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';

export default function TeacherProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', specialization: '', bio: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        specialization: user.specialization || '',
        bio: user.bio || '',
      });
      setPhotoPreview(user.photoUrl || null);
    }
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api('/api/users/me/profile', { method: 'PATCH', json: form });
      await refresh();
      setMsg('Сохранено');
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setMsg('Разрешены только изображения (JPG, PNG, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMsg('Размер файла не должен превышать 5MB');
      return;
    }

    setUploading(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await api<{ photoUrl: string }>('/api/users/me/photo', {
        method: 'POST',
        body: formData,
      });

      setPhotoPreview(response.photoUrl);
      await refresh();
      setMsg('Фото успешно загружено');
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  }

  async function handlePhotoDelete() {
    if (!confirm('Удалить фото профиля?')) return;

    try {
      await api('/api/users/me/photo', { method: 'DELETE' });
      setPhotoPreview(null);
      await refresh();
      setMsg('Фото удалено');
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка удаления фото');
    }
  }

  return (
    <div>
      <h1 className="page-title">Профиль преподавателя</h1>
      <p className="page-sub">{user?.email}</p>
      
      <div className="card" style={{ maxWidth: 480, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: photoPreview 
                ? `url(${photoPreview}) center/cover` 
                : 'linear-gradient(145deg, var(--brand), var(--brand-dark))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 700,
            }}
          >
            {!photoPreview && (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
          </div>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="file"
                id="photo-upload"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handlePhotoUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="photo-upload">
                <Button as="span" disabled={uploading} size="sm">
                  {uploading ? 'Загрузка...' : 'Загрузить фото'}
                </Button>
              </label>
              {photoPreview && (
                <Button variant="secondary" onClick={handlePhotoDelete} size="sm">
                  Удалить
                </Button>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              JPG, PNG, GIF до 5MB
            </p>
          </div>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 480 }} onSubmit={onSubmit}>
        <Field label="Имя">
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </Field>
        <Field label="Фамилия">
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </Field>
        <Field label="Специализация">
          <Input
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          />
        </Field>
        <Field label="О себе">
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value }) } />
        </Field>
        {msg && <p>{msg}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </form>
    </div>
  );
}