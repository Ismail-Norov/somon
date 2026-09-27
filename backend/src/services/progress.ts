import { prisma } from '../lib/prisma';
import { computeProgress, isPresentStatus } from '../lib/progress';

const DONE_STATUSES = ['SUBMITTED', 'REVIEWING', 'GRADED'];

export type StudentProgress = {
  studentId: string;
  progressPercent: number;
  lessonsPercent: number;
  assignmentsPercent: number;
  attendancePercent: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  assignmentsTotal: number;
  assignmentsDone: number;
  attendanceMarked: number;
  attendancePresent: number;
  averageGrade: number | null;
  averageGradeMax: number | null;
  overdueAssignments: number;
};

/**
 * Progress of every active (or given) student in a group, always derived from source data:
 * 0.4 × completed lessons% + 0.4 × done assignments% + 0.2 × attendance%.
 */
export async function groupProgress(groupId: string, studentIds?: string[]): Promise<Map<string, StudentProgress>> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      lessons: { where: { status: { not: 'CANCELLED' } }, select: { id: true, status: true } },
      assignments: { where: { status: { not: 'DRAFT' } }, select: { id: true, deadline: true } },
      groupStudents: studentIds ? undefined : { where: { status: 'ACTIVE' }, select: { studentId: true } },
    },
  });
  const result = new Map<string, StudentProgress>();
  if (!group) return result;

  const ids = studentIds ?? group.groupStudents.map((g) => g.studentId);
  if (!ids.length) return result;

  const lessonIds = group.lessons.map((l) => l.id);
  const assignmentIds = group.assignments.map((a) => a.id);
  const lessonsTotal = group.lessons.length;
  const lessonsCompleted = group.lessons.filter((l) => l.status === 'COMPLETED').length;

  const [submissions, attendance, grades] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: { in: ids }, assignmentId: { in: assignmentIds } },
      select: { studentId: true, assignmentId: true, status: true },
    }),
    prisma.attendance.findMany({
      where: { studentId: { in: ids }, lessonId: { in: lessonIds } },
      select: { studentId: true, status: true },
    }),
    prisma.grade.findMany({
      where: {
        studentId: { in: ids },
        OR: [{ assignmentId: { in: assignmentIds } }, { lessonId: { in: lessonIds } }],
      },
      select: { studentId: true, score: true, maxScore: true },
    }),
  ]);

  const now = new Date();
  for (const studentId of ids) {
    const subs = submissions.filter((s) => s.studentId === studentId);
    const done = new Set(subs.filter((s) => DONE_STATUSES.includes(s.status)).map((s) => s.assignmentId));
    const att = attendance.filter((a) => a.studentId === studentId);
    const present = att.filter((a) => isPresentStatus(a.status)).length;
    const attendancePercent = att.length ? (present / att.length) * 100 : 0;
    const g = grades.filter((x) => x.studentId === studentId);
    const avgNormalized = g.length ? g.reduce((s, x) => s + (x.score / x.maxScore) * 5, 0) / g.length : null;

    const p = computeProgress({
      lessonsTotal,
      lessonsCompleted,
      assignmentsTotal: assignmentIds.length,
      assignmentsDone: done.size,
      attendancePercent,
    });
    result.set(studentId, {
      studentId,
      ...p,
      lessonsTotal,
      lessonsCompleted,
      assignmentsTotal: assignmentIds.length,
      assignmentsDone: done.size,
      attendanceMarked: att.length,
      attendancePresent: present,
      averageGrade: avgNormalized === null ? null : Math.round(avgNormalized * 10) / 10,
      averageGradeMax: avgNormalized === null ? null : 5,
      overdueAssignments: group.assignments.filter((a) => a.deadline && a.deadline < now && !done.has(a.id)).length,
    });
  }
  return result;
}

export function averageOf(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}

/** Aggregated progress for a whole group (used by teacher / admin views). */
export async function groupSummary(groupId: string) {
  const map = await groupProgress(groupId);
  const rows = [...map.values()];
  return {
    students: rows.length,
    progressPercent: averageOf(rows.map((r) => r.progressPercent)) ?? 0,
    attendancePercent: averageOf(rows.filter((r) => r.attendanceMarked > 0).map((r) => r.attendancePercent)) ?? 0,
    averageGrade: averageOf(rows.map((r) => r.averageGrade)),
    assignmentsDone: rows.reduce((s, r) => s + r.assignmentsDone, 0),
    assignmentsMissing: rows.reduce((s, r) => s + (r.assignmentsTotal - r.assignmentsDone), 0),
  };
}
