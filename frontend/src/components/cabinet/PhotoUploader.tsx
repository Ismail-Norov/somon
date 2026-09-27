'use client';

import { useRef, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_MB = 5;

export function PhotoUploader() {
  const { user, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const upload = async (file?: File) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setMsg(null);
    if (!ALLOWED.includes(file.type)) {
      setMsg({ tone: 'error', text: 'Выберите изображение JPG, PNG, GIF или WEBP.' });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setMsg({ tone: 'error', text: `Размер фото не должен превышать ${MAX_MB} МБ.` });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      await api('/api/users/me/photo', { method: 'POST', body: form });
      await refresh();
      setMsg({ tone: 'success', text: 'Фото профиля обновлено.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось загрузить фото' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/users/me/photo', { method: 'DELETE' });
      await refresh();
      setConfirmDelete(false);
      setMsg({ tone: 'success', text: 'Фото удалено. Вместо него показывается первая буква имени.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить фото' });
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <div className="profile-head">
        <Avatar user={user} size={104} />
        <div className="stack" style={{ gap: '0.5rem' }}>
          <div className="row" style={{ gap: '0.5rem' }}>
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? 'Подождите...' : user.photoUrl ? 'Изменить фото' : 'Загрузить фото'}
            </Button>
            {user.photoUrl &&
              (confirmDelete ? (
                <>
                  <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                    Да, удалить
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    Отмена
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  Удалить фото
                </Button>
              ))}
          </div>
          <small className="muted">JPG, PNG, GIF или WEBP, до {MAX_MB} МБ. Фото видят преподаватели и администрация.</small>
          <input ref={inputRef} type="file" accept={ALLOWED.join(',')} hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
    </div>
  );
}
