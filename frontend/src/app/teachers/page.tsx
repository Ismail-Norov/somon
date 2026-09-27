'use client';

import { PageHero, PublicShell } from '@/components/public/PublicShell';
import { TeacherCard } from '@/components/public/Cards';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useApiData } from '@/lib/useApiData';
import type { PublicTeacher } from '@/lib/types';

export default function TeachersPage() {
  const { data, loading, error, reload } = useApiData<PublicTeacher[]>('/api/teachers/public');

  return (
    <PublicShell>
      <PageHero
        eyebrow="Команда"
        title="Наши преподаватели"
        description="Практикующие специалисты, которые ведут курсы Somon, проверяют задания и помогают студентам расти."
      />
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          {loading && <LoadingState />}
          {error && <ErrorState onRetry={reload} />}
          {data && data.length === 0 && <EmptyState title="Информация о преподавателях скоро появится" />}
          {data && data.length > 0 && (
            <div className="grid grid-3">
              {data.map((t) => (
                <TeacherCard key={t.id} teacher={t} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
