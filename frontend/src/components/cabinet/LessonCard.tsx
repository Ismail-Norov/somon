import type { LessonCard as Lesson } from '@/lib/types';
import { formatDateLong, formatTimeRange, fullName, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';

function timing(lesson: Lesson) {
  const now = Date.now();
  const start = new Date(lesson.startsAt).getTime();
  const end = new Date(lesson.endsAt).getTime();
  if (now >= start && now <= end) return { label: 'Идёт сейчас', tone: 'success' as const };
  if (start - now <= 30 * 60 * 1000 && start > now) return { label: 'Скоро начнётся', tone: 'warning' as const };
  return null;
}

/** Shows where the lesson happens: meeting link for online, branch/classroom for offline. */
export function LessonPlace({ lesson }: { lesson: Lesson }) {
  const online = lesson.format === 'ONLINE' || lesson.format === 'HYBRID';
  const offline = lesson.format === 'OFFLINE' || lesson.format === 'HYBRID';
  return (
    <div className="stack" style={{ gap: '0.35rem' }}>
      {offline && (
        <div className="lesson-place">
          <span aria-hidden>📍</span>
          <span>
            {lesson.branch ? (
              <>
                <strong>{lesson.branch.name}</strong>
                {lesson.branch.address && <span className="muted"> · {lesson.branch.address}</span>}
              </>
            ) : (
              <strong>Учебный центр Somon</strong>
            )}
            {(lesson.classroom || lesson.room) && (
              <span className="muted"> · {lesson.classroom?.name ?? lesson.room}</span>
            )}
          </span>
        </div>
      )}
      {online && (
        <div className="lesson-place">
          <span aria-hidden>💻</span>
          <span>{lesson.meetingUrl ? 'Онлайн-занятие по ссылке' : 'Онлайн — ссылка появится перед занятием'}</span>
        </div>
      )}
    </div>
  );
}

export function LessonCardView({ lesson, compact = false }: { lesson: Lesson; compact?: boolean }) {
  const teacher = lesson.teacher ?? lesson.group.teacher;
  const badge = timing(lesson);
  const canJoin = (lesson.format === 'ONLINE' || lesson.format === 'HYBRID') && lesson.meetingUrl;
  return (
    <div className={`lesson-card ${compact ? 'lesson-card-compact' : ''}`}>
      <div className="lesson-date">
        <strong>{new Date(lesson.startsAt).getDate()}</strong>
        <span>{new Date(lesson.startsAt).toLocaleDateString('ru-RU', { month: 'short' })}</span>
      </div>
      <div className="stack" style={{ gap: '0.4rem', minWidth: 0, flex: 1 }}>
        <div className="row" style={{ gap: '0.4rem' }}>
          <Badge tone={lesson.format === 'ONLINE' ? 'info' : lesson.format === 'OFFLINE' ? 'brand' : 'default'}>
            {statusLabel[lesson.format] ?? lesson.format}
          </Badge>
          {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
          {lesson.status === 'CANCELLED' && <Badge tone="danger">Отменено</Badge>}
        </div>
        <strong className="lesson-title">{lesson.title}</strong>
        <span className="muted" style={{ fontSize: '0.9rem' }}>
          {lesson.group.course.title} · {lesson.group.code}
        </span>
        <span style={{ fontSize: '0.9rem' }}>
          🕒 {formatDateLong(lesson.startsAt)}, {formatTimeRange(lesson.startsAt, lesson.endsAt)}
        </span>
        {!compact && teacher && <span style={{ fontSize: '0.9rem' }}>👩‍🏫 {fullName(teacher.user)}</span>}
        {!compact && <LessonPlace lesson={lesson} />}
      </div>
      {canJoin && lesson.status !== 'CANCELLED' && (
        <div className="lesson-action">
          <ButtonLink href={lesson.meetingUrl!} external size="sm">
            Перейти к занятию
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
