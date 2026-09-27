import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { fileUrl } from '@/lib/api';
import {
  formatDateLong,
  formatPrice,
  fullName,
  lessonsLabel,
  materialTypeIcon,
  materialTypeLabel,
  statusLabel,
  weeksLabel,
} from '@/lib/format';
import type { NewsItem, PublicCourse, PublicMaterial, PublicTeacher } from '@/lib/types';

const COURSE_ACCENTS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#0891b2', '#db2777'];

function accentFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COURSE_ACCENTS[hash % COURSE_ACCENTS.length];
}

export function CourseCard({
  course,
  href = `/courses/${course.id}`,
  footer,
}: {
  course: PublicCourse;
  href?: string;
  footer?: React.ReactNode;
}) {
  const teacher = course.teachers[0];
  const price = formatPrice(course.price);
  return (
    <article className="course-card" style={{ '--accent': accentFor(course.id) } as React.CSSProperties}>
      <div className="course-card-top">
        <span className="course-card-category">{course.category?.name || 'Курс'}</span>
        <span className="course-card-format">{statusLabel[course.format] || course.format}</span>
      </div>
      <h3>
        <Link href={href}>{course.title}</Link>
      </h3>
      <p className="course-desc">{course.shortDesc}</p>
      <ul className="course-facts">
        {weeksLabel(course.durationWeeks) && <li>⏱ {weeksLabel(course.durationWeeks)}</li>}
        {lessonsLabel(course.lessonsCount) && <li>📚 {lessonsLabel(course.lessonsCount)}</li>}
        <li>📈 {statusLabel[course.level] || course.level}</li>
      </ul>
      {teacher && (
        <div className="course-teacher">
          <Avatar user={teacher.user} size={28} />
          <span>{fullName(teacher.user)}</span>
          {course.teachers.length > 1 && <span className="muted">+{course.teachers.length - 1}</span>}
        </div>
      )}
      <div className="course-card-footer">
        {price ? <strong className="course-price">{price}</strong> : <span />}
        {footer ?? (
          <ButtonLink href={href} variant="secondary" size="sm">
            Подробнее
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function TeacherCard({ teacher }: { teacher: PublicTeacher }) {
  return (
    <article className="teacher-card">
      <Avatar user={teacher.user} size={96} className="teacher-photo" />
      <h3>{fullName(teacher.user)}</h3>
      {teacher.position && <p className="teacher-position">{teacher.position}</p>}
      <p className="teacher-role">{teacher.specialization || 'Преподаватель'}</p>
      {teacher.bio && <p className="teacher-bio">{teacher.bio}</p>}
      {teacher.courses.length > 0 && (
        <div className="teacher-courses">
          {teacher.courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="chip">
              {c.title}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="news-card">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="news-cover" src={fileUrl(item.imageUrl)} alt="" />
      ) : (
        <div className="news-cover news-cover-placeholder" aria-hidden>
          📰
        </div>
      )}
      <div className="news-body">
        <div className="news-meta">
          <span className="chip">{item.category}</span>
          <time>{formatDateLong(item.publishedAt)}</time>
        </div>
        <h3>
          <Link href={`/news/${item.id}`}>{item.title}</Link>
        </h3>
        {item.summary && <p>{item.summary}</p>}
        <Link href={`/news/${item.id}`} className="text-link">
          Читать →
        </Link>
      </div>
    </article>
  );
}

export function PublicMaterialCard({ material }: { material: PublicMaterial }) {
  return (
    <article className="material-card">
      <div className="material-type">
        <span aria-hidden>{materialTypeIcon[material.type] || '📘'}</span>
        {materialTypeLabel[material.type] || material.type}
        {!material.isPublic && <span className="chip chip-warning">Для студентов курса</span>}
      </div>
      <h3>{material.title}</h3>
      {material.description && <p>{material.description}</p>}
      <div className="material-meta">
        <span className="chip">{material.category}</span>
        <span>{formatDateLong(material.publishedAt)}</span>
      </div>
      <div className="row">
        {material.fileUrl && (
          <ButtonLink href={fileUrl(material.fileUrl)} variant="secondary" size="sm" external>
            Открыть файл
          </ButtonLink>
        )}
        {material.videoUrl && (
          <ButtonLink href={material.videoUrl} variant="secondary" size="sm" external>
            🎥 Смотреть видео
          </ButtonLink>
        )}
        {material.linkUrl && (
          <ButtonLink href={material.linkUrl} variant="secondary" size="sm" external>
            🔗 Перейти по ссылке
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
