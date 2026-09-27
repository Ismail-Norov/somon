'use client';

import Link from 'next/link';
import { api, API_URL } from '@/lib/api';
import type { Material } from '@/lib/types';
import { formatDate, fullName, materialTypeIcon, materialTypeLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { FileList } from '@/components/cabinet/Files';

/** Records video/link opens in the student's activity log (the backend can't see external clicks). */
export function trackMaterialOpen(materialId: string, type: 'VIDEO_OPEN' | 'LINK_OPEN') {
  api('/api/student/activity', { method: 'POST', json: { type, materialId } }).catch(() => undefined);
}

export function MaterialLinks({ material, track }: { material: Material; track?: boolean }) {
  if (!material.videoUrl && !material.linkUrl) return null;
  return (
    <div className="row" style={{ gap: '0.5rem' }}>
      {material.videoUrl && (
        <a
          className="btn btn-primary btn-sm"
          href={material.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track && trackMaterialOpen(material.id, 'VIDEO_OPEN')}
        >
          ▶ Смотреть видео
        </a>
      )}
      {material.linkUrl && (
        <a
          className="btn btn-secondary btn-sm"
          href={material.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track && trackMaterialOpen(material.id, 'LINK_OPEN')}
        >
          🔗 Открыть ссылку
        </a>
      )}
    </div>
  );
}

export function MaterialCard({ material, href, track, actions }: { material: Material; href?: string; track?: boolean; actions?: React.ReactNode }) {
  return (
    <article className="card stack" style={{ gap: '0.6rem' }}>
      <div className="row space-between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: '0.6rem', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.6rem' }} aria-hidden>
            {materialTypeIcon[material.type] ?? '📘'}
          </span>
          <div style={{ minWidth: 0 }}>
            {href ? (
              <Link href={href} className="text-link" style={{ fontSize: '1rem' }}>
                {material.title}
              </Link>
            ) : (
              <strong>{material.title}</strong>
            )}
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {[material.course?.title, material.group?.code, material.topic].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        <Badge tone="brand">{materialTypeLabel[material.type] ?? material.type}</Badge>
      </div>
      {material.description && <p style={{ margin: 0, fontSize: '0.92rem' }}>{material.description}</p>}
      {material.lesson && (
        <small className="muted">
          Занятие: {material.lesson.title}
          {material.lesson.startsAt ? ` (${formatDate(material.lesson.startsAt)})` : ''}
        </small>
      )}
      <FileList files={material.files ?? []} basePath="/api/files/material-file" />
      {!material.files?.length && material.fileUrl && (
        <a className="text-link" href={`${API_URL}/api/files/material/${material.id}`} target="_blank" rel="noopener noreferrer">
          📎 {material.fileName || 'Файл'}
        </a>
      )}
      <MaterialLinks material={material} track={track} />
      <div className="row space-between" style={{ fontSize: '0.8rem' }}>
        <span className="muted">
          {material.author ? `Автор: ${fullName(material.author)} · ` : ''}
          {formatDate(material.publishedAt)}
        </span>
        {actions}
      </div>
    </article>
  );
}
