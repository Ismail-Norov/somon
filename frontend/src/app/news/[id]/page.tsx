'use client';

import { useParams } from 'next/navigation';
import { PublicShell } from '@/components/public/PublicShell';
import { BackLink } from '@/components/ui/BackLink';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fileUrl } from '@/lib/api';
import { formatDateLong } from '@/lib/format';
import { useApiData } from '@/lib/useApiData';
import type { NewsItem } from '@/lib/types';

export default function NewsDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<NewsItem>(`/api/public/news/${params.id}`);

  return (
    <PublicShell>
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container article">
          <BackLink href="/news" label="Назад к новостям" />
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {data && (
            <article>
              <div className="news-meta" style={{ justifyContent: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span className="chip">{data.category}</span>
                <time>{formatDateLong(data.publishedAt)}</time>
              </div>
              <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', marginBottom: '1rem' }}>
                {data.title}
              </h1>
              {data.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(data.imageUrl)}
                  alt=""
                  style={{ borderRadius: 'var(--radius)', marginBottom: '1.5rem', width: '100%' }}
                />
              )}
              {data.summary && <p style={{ fontSize: '1.15rem', color: 'var(--ink)' }}>{data.summary}</p>}
              <div className="article-body">{data.body}</div>
            </article>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
