'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { BranchWithRooms } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type BranchForm = { id?: string; name: string; address: string; phone: string; workHours: string; description: string; isActive: boolean };
type RoomForm = { branchId: string; id?: string; name: string; capacity: string };

const emptyBranch: BranchForm = { name: '', address: '', phone: '', workHours: '', description: '', isActive: true };

export default function AdminBranchesPage() {
  const { data, loading, error, reload } = useApiData<BranchWithRooms[]>('/api/branches?all=1');
  const [branchForm, setBranchForm] = useState<BranchForm | null>(null);
  const [roomForm, setRoomForm] = useState<RoomForm | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'branch' | 'room'; id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const call = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setSaving(true);
    setFormError('');
    try {
      await fn();
      setMsg({ tone: 'success', text: success });
      after?.();
      reload();
    } catch (err) {
      const text = err instanceof ApiRequestError ? err.message : 'Не удалось выполнить действие';
      if (branchForm || roomForm) setFormError(text);
      else setMsg({ tone: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm) return;
    const { id, ...rest } = branchForm;
    const json = {
      ...rest,
      name: rest.name.trim(),
      address: rest.address.trim(),
      phone: rest.phone.trim() || null,
      workHours: rest.workHours.trim() || null,
      description: rest.description.trim() || null,
    };
    call(
      () => api(id ? `/api/branches/${id}` : '/api/branches', { method: id ? 'PATCH' : 'POST', json }),
      id ? 'Филиал сохранён' : 'Филиал добавлен',
      () => setBranchForm(null)
    );
  };

  const saveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm) return;
    const capacity = roomForm.capacity ? Number(roomForm.capacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) return setFormError('Вместимость — целое положительное число');
    const json = { name: roomForm.name.trim(), capacity };
    call(
      () =>
        api(roomForm.id ? `/api/branches/classrooms/${roomForm.id}` : `/api/branches/${roomForm.branchId}/classrooms`, {
          method: roomForm.id ? 'PATCH' : 'POST',
          json,
        }),
      roomForm.id ? 'Аудитория сохранена' : 'Аудитория добавлена',
      () => setRoomForm(null)
    );
  };

  const remove = () => {
    if (!confirm) return;
    const url = confirm.kind === 'branch' ? `/api/branches/${confirm.id}` : `/api/branches/classrooms/${confirm.id}`;
    const target = confirm;
    setConfirm(null);
    call(() => api(url, { method: 'DELETE' }), target.kind === 'branch' ? 'Филиал удалён' : 'Аудитория удалена');
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Филиалы и аудитории"
        subtitle="Места проведения офлайн-занятий. Активные филиалы видны на сайте и в расписании"
        back={{ href: '/admin/schedule', label: 'Назад к расписанию' }}
        actions={
          <Button
            onClick={() => {
              setFormError('');
              setBranchForm(emptyBranch);
            }}
          >
            + Филиал
          </Button>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState icon="🏫" title="Филиалов пока нет" description="Добавьте первый филиал, чтобы назначать офлайн-занятия." />
      ) : (
        <div className="grid grid-2">
          {data.map((b) => (
            <article key={b.id} className="card stack" style={{ gap: '0.75rem', opacity: b.isActive ? 1 : 0.7 }}>
              <div className="row space-between" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{b.name}</h3>
                  <div className="muted" style={{ fontSize: '0.88rem' }}>
                    📍 {b.address}
                  </div>
                  {b.phone && <div className="muted" style={{ fontSize: '0.88rem' }}>☎ {b.phone}</div>}
                  {b.workHours && <div className="muted" style={{ fontSize: '0.88rem' }}>🕒 {b.workHours}</div>}
                </div>
                <Badge tone={b.isActive ? 'success' : 'default'}>{b.isActive ? 'Активен' : 'Неактивен'}</Badge>
              </div>
              {b.description && <p style={{ margin: 0, fontSize: '0.9rem' }}>{b.description}</p>}

              <div>
                <div className="row space-between" style={{ marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>Аудитории ({b.classrooms.length})</strong>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFormError('');
                      setRoomForm({ branchId: b.id, name: '', capacity: '' });
                    }}
                  >
                    + Аудитория
                  </Button>
                </div>
                {b.classrooms.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                    Аудиторий пока нет
                  </p>
                ) : (
                  b.classrooms.map((c) => (
                    <div key={c.id} className="list-row">
                      <span style={{ flex: 1 }}>
                        {c.name}
                        {c.capacity ? <span className="muted"> · до {c.capacity} чел.</span> : null}
                      </span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        занятий: {c._count?.lessons ?? 0}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFormError('');
                          setRoomForm({ branchId: b.id, id: c.id, name: c.name, capacity: c.capacity ? String(c.capacity) : '' });
                        }}
                      >
                        Изменить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'room', id: c.id, name: c.name })}>
                        ✕
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFormError('');
                    setBranchForm({
                      id: b.id,
                      name: b.name,
                      address: b.address,
                      phone: b.phone ?? '',
                      workHours: b.workHours ?? '',
                      description: b.description ?? '',
                      isActive: b.isActive,
                    });
                  }}
                >
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => call(() => api(`/api/branches/${b.id}`, { method: 'PATCH', json: { isActive: !b.isActive } }), b.isActive ? 'Филиал скрыт' : 'Филиал активирован')}
                >
                  {b.isActive ? 'Сделать неактивным' : 'Активировать'}
                </Button>
                <ButtonLink size="sm" variant="ghost" href={`/admin/schedule?view=week`}>
                  Расписание
                </ButtonLink>
                {(b._count?.lessons ?? 0) === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'branch', id: b.id, name: b.name })}>
                    Удалить
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(branchForm)} title={branchForm?.id ? 'Редактирование филиала' : 'Новый филиал'} onClose={() => !saving && setBranchForm(null)}>
        {branchForm && (
          <form className="stack" onSubmit={saveBranch}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Название">
              <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required maxLength={120} placeholder="Somon Education — филиал №1" />
            </Field>
            <Field label="Адрес">
              <Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} required maxLength={300} />
            </Field>
            <div className="form-grid">
              <Field label="Телефон">
                <Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} maxLength={40} />
              </Field>
              <Field label="Часы работы">
                <Input value={branchForm.workHours} onChange={(e) => setBranchForm({ ...branchForm, workHours: e.target.value })} maxLength={200} placeholder="Пн–Сб 9:00–20:00" />
              </Field>
            </div>
            <Field label="Описание">
              <Textarea rows={3} value={branchForm.description} onChange={(e) => setBranchForm({ ...branchForm, description: e.target.value })} maxLength={2000} />
            </Field>
            <label className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={branchForm.isActive} onChange={(e) => setBranchForm({ ...branchForm, isActive: e.target.checked })} />
              Активен (виден на сайте и доступен в расписании)
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setBranchForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(roomForm)} title={roomForm?.id ? 'Редактирование аудитории' : 'Новая аудитория'} onClose={() => !saving && setRoomForm(null)}>
        {roomForm && (
          <form className="stack" onSubmit={saveRoom}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="form-grid">
              <Field label="Название">
                <Input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} required maxLength={60} placeholder="Аудитория 304" />
              </Field>
              <Field label="Вместимость">
                <Input type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
              </Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setRoomForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(confirm)} title="Подтвердите удаление" onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="stack">
            <p>
              Удалить {confirm.kind === 'branch' ? 'филиал' : 'аудиторию'} «{confirm.name}»?
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Отмена
              </Button>
              <Button variant="danger" onClick={remove}>
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
