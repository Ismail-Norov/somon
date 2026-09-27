import { ProgressBar } from '@/components/ui/ProgressBar';

type Props = {
  overall: number;
  lessons: number;
  assignments: number;
  attendance: number;
  details?: { lessons?: string; assignments?: string; attendance?: string };
};

/** Progress = 40% lessons + 40% assignments + 20% attendance, shown with its components. */
export function ProgressBreakdown({ overall, lessons, assignments, attendance, details }: Props) {
  const rows = [
    { label: 'Пройденные занятия', weight: 40, value: lessons, detail: details?.lessons },
    { label: 'Выполненные задания', weight: 40, value: assignments, detail: details?.assignments },
    { label: 'Посещаемость', weight: 20, value: attendance, detail: details?.attendance },
  ];
  return (
    <div className="stack" style={{ gap: '0.9rem' }}>
      <div className="progress-overall">
        <div className="progress-ring" style={{ ['--p' as string]: `${Math.min(100, overall)}` }}>
          <span>{Math.round(overall)}%</span>
        </div>
        <div>
          <strong>Общий прогресс</strong>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Считается автоматически: 40% занятия + 40% задания + 20% посещаемость
          </p>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="stack" style={{ gap: '0.3rem' }}>
          <div className="row space-between" style={{ fontSize: '0.9rem' }}>
            <span>
              {r.label} <span className="muted">· вес {r.weight}%</span>
            </span>
            <strong>{Math.round(r.value)}%</strong>
          </div>
          <ProgressBar value={r.value} />
          {r.detail && <small className="muted">{r.detail}</small>}
        </div>
      ))}
    </div>
  );
}
