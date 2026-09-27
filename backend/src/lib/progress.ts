/** Progress formula (fixed for Somon v1):
 * 0.4 * completed_lessons% + 0.4 * completed_assignments% + 0.2 * attendance%
 */
export const PROGRESS_WEIGHTS = {
  lessons: 0.4,
  assignments: 0.4,
  attendance: 0.2,
} as const;

export function computeProgress(input: {
  lessonsTotal: number;
  lessonsCompleted: number;
  assignmentsTotal: number;
  assignmentsDone: number;
  attendancePercent: number;
}) {
  const lessonsPct =
    input.lessonsTotal > 0 ? (input.lessonsCompleted / input.lessonsTotal) * 100 : 0;
  const assignmentsPct =
    input.assignmentsTotal > 0 ? (input.assignmentsDone / input.assignmentsTotal) * 100 : 0;
  const attendancePct = Math.max(0, Math.min(100, input.attendancePercent));

  const progress =
    PROGRESS_WEIGHTS.lessons * lessonsPct +
    PROGRESS_WEIGHTS.assignments * assignmentsPct +
    PROGRESS_WEIGHTS.attendance * attendancePct;

  return {
    progressPercent: Math.round(progress * 10) / 10,
    lessonsPercent: Math.round(lessonsPct * 10) / 10,
    assignmentsPercent: Math.round(assignmentsPct * 10) / 10,
    attendancePercent: Math.round(attendancePct * 10) / 10,
  };
}

/** Late counts as present for attendance % (configurable rule). */
export function isPresentStatus(status: string) {
  return status === 'PRESENT' || status === 'LATE' || status === 'EXCUSED';
}
