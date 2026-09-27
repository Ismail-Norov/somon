'use client';

import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { formatDate, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StudentGroupReport, type StudentGroupCard } from '@/components/cabinet/StudentGroupReport';

export default function TeacherStudentCardPage() {
  const { id, studentId } = useParams<{ id: string; studentId: string }>();
  const { data, loading, error, reload } = useApiData<StudentGroupCard>(`/api/groups/${id}/students/${studentId}`);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Студент не найден'} onRetry={reload} />;

  const { student, group } = data;
  const user = student.user;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader back={{ href: `/teacher/groups/${group.id}`, label: `Назад к группе ${group.code}` }} title="Карточка студента" />

      <div className="card row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <Avatar user={user} size={72} />
        <div className="stack" style={{ gap: '0.25rem', flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0 }}>{fullName(user)}</h2>
          <span className="muted">{user.email}</span>
          {student.phone && <span className="muted">{student.phone}</span>}
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            В группе {group.code} с {formatDate(student.joinedAt)}
          </span>
        </div>
        <Badge tone={student.status === 'ACTIVE' ? 'success' : 'default'}>{statusLabel[student.status] ?? student.status}</Badge>
      </div>

      <StudentGroupReport data={data} submissionHref={(sid) => `/teacher/review/${sid}`} />
    </div>
  );
}
