'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function ConfirmModal({
  open,
  title = 'Подтвердите действие',
  message,
  confirmLabel = 'Удалить',
  tone = 'danger',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={() => !busy && onClose()}>
      <div className="stack">
        <div>{message}</div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? 'Подождите...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
