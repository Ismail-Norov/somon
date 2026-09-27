'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** "← Назад" link. With `href` it always goes to the parent section; without it, to the previous page. */
export function BackLink({ href, label = 'Назад' }: { href?: string; label?: string }) {
  const router = useRouter();
  if (href) {
    return (
      <Link href={href} className="back-link">
        ← {label}
      </Link>
    );
  }
  return (
    <button type="button" className="back-link" onClick={() => router.back()}>
      ← {label}
    </button>
  );
}
