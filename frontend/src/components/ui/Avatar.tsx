import { fileUrl } from '@/lib/api';
import { initials } from '@/lib/format';

type Props = {
  user?: { firstName?: string; lastName?: string; photoUrl?: string | null } | null;
  size?: number;
  className?: string;
};

export function Avatar({ user, size = 40, className = '' }: Props) {
  const src = fileUrl(user?.photoUrl);
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.38)) }}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} />
      ) : (
        initials(user)
      )}
    </span>
  );
}
