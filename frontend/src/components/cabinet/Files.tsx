'use client';

import { useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { StoredFileInfo } from '@/lib/types';

const EXT_ICON: Record<string, string> = {
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  xls: '📗',
  xlsx: '📗',
  ppt: '📙',
  pptx: '📙',
  zip: '🗜️',
  rar: '🗜️',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  txt: '📄',
};

export function extOf(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileIcon(name: string) {
  return EXT_ICON[extOf(name)] ?? '📎';
}

/** URL of an access-checked file download route, e.g. /api/files/submission/:id. */
export function protectedFileUrl(path: string, download = false) {
  return `${API_URL}${path}${download ? (path.includes('?') ? '&' : '?') + 'download=1' : ''}`;
}

type FileListProps = {
  files: StoredFileInfo[];
  /** Route prefix, e.g. "/api/files/submission" — the file id is appended. */
  basePath: string;
  onDownload?: (file: StoredFileInfo) => void;
};

export function FileList({ files, basePath, onDownload }: FileListProps) {
  if (!files.length) return null;
  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.id} className="file-item">
          <span className="file-icon" aria-hidden>
            {fileIcon(f.originalName)}
          </span>
          <span className="file-meta">
            <strong title={f.originalName}>{f.originalName}</strong>
            <small>
              {extOf(f.originalName).toUpperCase() || 'Файл'} · {formatBytes(f.size)}
            </small>
          </span>
          <span className="file-actions">
            <a className="btn btn-secondary btn-sm" href={protectedFileUrl(`${basePath}/${f.id}`)} target="_blank" rel="noopener noreferrer">
              Открыть
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href={protectedFileUrl(`${basePath}/${f.id}`, true)}
              onClick={() => onDownload?.(f)}
            >
              Скачать
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Single legacy file (e.g. assignment instruction) served via an access-checked route. */
export function SingleFile({ name, path }: { name: string; path: string }) {
  return (
    <ul className="file-list">
      <li className="file-item">
        <span className="file-icon" aria-hidden>
          {fileIcon(name)}
        </span>
        <span className="file-meta">
          <strong title={name}>{name}</strong>
          <small>{extOf(name).toUpperCase() || 'Файл'}</small>
        </span>
        <span className="file-actions">
          <a className="btn btn-secondary btn-sm" href={protectedFileUrl(path)} target="_blank" rel="noopener noreferrer">
            Открыть
          </a>
          <a className="btn btn-ghost btn-sm" href={protectedFileUrl(path, true)}>
            Скачать
          </a>
        </span>
      </li>
    </ul>
  );
}

type PickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  /** Allowed extensions without dot, upper or lower case. */
  extensions: string[];
  maxFileMb: number;
  maxFiles?: number;
  disabled?: boolean;
};

export function FilePicker({ files, onChange, extensions, maxFileMb, maxFiles = 5, disabled }: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const allowed = extensions.map((e) => e.toLowerCase());

  const add = (list: FileList | null) => {
    if (!list) return;
    setError('');
    const next = [...files];
    for (const file of Array.from(list)) {
      const ext = extOf(file.name);
      if (!allowed.includes(ext)) {
        setError(`Файл «${file.name}» не подходит. Разрешены: ${extensions.join(', ').toUpperCase()}`);
        continue;
      }
      if (file.size > maxFileMb * 1024 * 1024) {
        setError(`Файл «${file.name}» больше ${maxFileMb} МБ`);
        continue;
      }
      if (file.size === 0) {
        setError(`Файл «${file.name}» пустой`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.length >= maxFiles) {
        setError(`Можно прикрепить не больше ${maxFiles} файлов`);
        break;
      }
      next.push(file);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="stack" style={{ gap: '0.5rem' }}>
      <div
        className={`dropzone ${drag ? 'dropzone-active' : ''} ${disabled ? 'dropzone-disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
      >
        <span aria-hidden style={{ fontSize: '1.6rem' }}>
          📎
        </span>
        <div>
          <strong>Перетащите файлы сюда</strong> или{' '}
          <button type="button" className="text-link as-link" onClick={() => inputRef.current?.click()} disabled={disabled}>
            выберите на компьютере
          </button>
        </div>
        <small className="muted">
          {extensions.join(', ').toUpperCase()} · до {maxFileMb} МБ каждый · не больше {maxFiles} файлов
        </small>
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={allowed.map((e) => `.${e}`).join(',')}
          hidden
          onChange={(e) => add(e.target.files)}
        />
      </div>
      {error && <span className="error-text">{error}</span>}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="file-item">
              <span className="file-icon" aria-hidden>
                {fileIcon(f.name)}
              </span>
              <span className="file-meta">
                <strong title={f.name}>{f.name}</strong>
                <small>
                  {extOf(f.name).toUpperCase()} · {formatBytes(f.size)}
                </small>
              </span>
              <span className="file-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  disabled={disabled}
                >
                  Удалить
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
