import { Router } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { lessonCardInclude, publicUserSelect } from '../lib/selects';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { isPresentStatus, PROGRESS_WEIGHTS } from '../lib/progress';
import { assertTeacherOwnsGroup, markOverdueAssignments, studentMaterialWhere } from '../services/access';
import { averageOf, groupProgress, StudentProgress } from '../services/progress';

const router = Router();
router.use(requireAuth);

const EMPTY_PROGRESS: Omit<StudentProgress, 'studentId'> = {
  progressPercent: 0,
  lessonsPercent: 0,
  assignmentsPercent: 0,
  attendancePercent: 0,
  lessonsTotal: 0,
  lessonsCompleted: 0,
  assignmentsTotal: 0,
  assignmentsDone: 0,
  attendanceMarked: 0,
  attendancePresent: 0,
  averageGrade: null,
  averageGradeMax: null,
  overdueAssignments: 0,
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function studentAssignmentWhere(groupIds: string[], now: Date): Prisma.AssignmentWhereInput {
  return {
    groupId: { in: groupIds },
    status: { not: 'DRAFT' },
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

/** Assignment still waiting for the student's action. */
function isPending(sub?: { status: string; submittedAt: Date | null } | null) {
  return !sub || !sub.submittedAt || ['DRAFT', 'OVERDUE', 'RETURNED'].includes(sub.status);
}

router.get(
  '/student',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.studentId!;
    const now = new Date();
    await markOverdueAssignments();

    const links = await prisma.groupStudent.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        group: {
          include: {
            course: { include: { category: true } },
            teacher: { include: { user: { select: publicUserSelect } } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    const groupIds = links.map((l) => l.groupId);

    const courses = [];
    for (const link of links) {
      const p = (await groupProgress(link.groupId, [studentId])).get(studentId) ?? { studentId, ...EMPTY_PROGRESS };
      const next = await prisma.lesson.findFirst({
        where: { groupId: link.groupId, status: 'SCHEDULED', endsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, startsAt: true, endsAt: true, format: true },
      });
      const { group } = link;
      courses.push({
        course: group.course,
        group: {
          id: group.id,
          code: group.code,
          status: group.status,
          format: group.format,
          startDate: group.startDate,
          endDate: group.endDate,
        },
        teacher: group.teacher,
        ...p,
        lessonsRemaining: Math.max(0, p.lessonsTotal - p.lessonsCompleted),
        nextLesson: next,
      });
    }

    const [upcomingLessons, assignments, recentGrades, allGrades, attendance, notifications, unreadNotifications, activities, achievements, announcements, materialsCount] =
      await Promise.all([
        prisma.lesson.findMany({
          where: { groupId: { in: groupIds }, status: 'SCHEDULED', endsAt: { gte: now } },
          include: lessonCardInclude,
          orderBy: { startsAt: 'asc' },
          take: 6,
        }),
        prisma.assignment.findMany({
          where: studentAssignmentWhere(groupIds, now),
          include: {
            course: { select: { id: true, title: true } },
            group: { select: { id: true, code: true } },
            submissions: {
              where: { studentId },
              select: { id: true, status: true, submittedAt: true, attemptCount: true, grade: { select: { score: true, maxScore: true } } },
            },
          },
          orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
        }),
        prisma.grade.findMany({
          where: { studentId },
          include: {
            submission: { select: { assignment: { select: { id: true, title: true, course: { select: { title: true } } } } } },
            lesson: { select: { id: true, title: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        prisma.grade.findMany({ where: { studentId }, select: { score: true, maxScore: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
        prisma.attendance.findMany({
          where: { studentId, lesson: { groupId: { in: groupIds } } },
          select: { status: true },
        }),
        prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
        prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
        prisma.studentActivity.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 8 }),
        prisma.studentAchievement.findMany({
          where: { studentId },
          include: { achievement: true },
          orderBy: { earnedAt: 'desc' },
          take: 6,
        }),
        prisma.announcement.findMany({
          where: { groupId: { in: groupIds } },
          include: { group: { select: { id: true, code: true, course: { select: { title: true } } } }, author: { select: publicUserSelect } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.material.count({ where: await studentMaterialWhere(studentId) }),
      ]);

    const pendingAssignments = assignments
      .filter((a) => isPending(a.submissions[0]))
      .map(({ submissions, ...a }) => ({
        ...a,
        submission: submissions[0] ?? null,
        isOverdue: Boolean(a.deadline && a.deadline < now),
      }));

    const present = attendance.filter((a) => isPresentStatus(a.status)).length;
    const attendancePercent = attendance.length ? round1((present / attendance.length) * 100) : 0;
    const averageGrade = allGrades.length
      ? round1(allGrades.reduce((s, g) => s + (g.score / g.maxScore) * 5, 0) / allGrades.length)
      : null;
    const overallProgress = averageOf(courses.map((c) => c.progressPercent)) ?? 0;
    const breakdown = {
      lessons: averageOf(courses.map((c) => c.lessonsPercent)) ?? 0,
      assignments: averageOf(courses.map((c) => c.assignmentsPercent)) ?? 0,
      attendance: attendancePercent,
    };

    const stats = {
      activeCourses: courses.length,
      coursesTotal: courses.length,
      coursesCompleted: links.filter((l) => l.group.status === 'COMPLETED').length,
      averageGrade,
      attendancePercent,
      progressPercent: overallProgress,
      activeAssignments: pendingAssignments.length,
      overdueAssignments: pendingAssignments.filter((a) => a.isOverdue).length,
      assignmentsDone: courses.reduce((s, c) => s + c.assignmentsDone, 0),
      assignmentsTotal: courses.reduce((s, c) => s + c.assignmentsTotal, 0),
      unreadNotifications,
      lessonsVisited: present,
      lessonsMarked: attendance.length,
      lessonsMissed: attendance.filter((a) => a.status === 'ABSENT').length,
      materials: materialsCount,
    };

    res.json(
      ok({
        greeting: req.user!.firstName,
        stats,
        courses,
        nextLesson: upcomingLessons[0] ?? null,
        upcomingLessons,
        pendingAssignments: pendingAssignments.slice(0, 8),
        recentGrades,
        gradeTrend: allGrades.slice(-20).map((g) => round1((g.score / g.maxScore) * 5)),
        progress: { overall: overallProgress, ...breakdown, weights: PROGRESS_WEIGHTS },
        notifications,
        unreadNotifications,
        activities,
        achievements,
        announcements,
      })
    );
  })
);

/** Per-course progress page for the student ("Мой прогресс" / course page). */
router.get(
  '/student/course/:courseId',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.studentId!;
    const now = new Date();
    const link = await prisma.groupStudent.findFirst({
      where: { studentId, status: 'ACTIVE', group: { courseId: req.params.courseId } },
      include: {
        group: {
          include: {
            course: { include: { category: true } },
            teacher: { include: { user: { select: publicUserSelect } } },
          },
        },
      },
    });
    if (!link) throw new AppError('Курс недоступен', 404, 'NOT_FOUND');
    const group = link.group;

    const [lessons, assignments, materials, attendance, grades, announcements, progressMap] = await Promise.all([
      prisma.lesson.findMany({
        where: { groupId: group.id },
        include: lessonCardInclude,
        orderBy: { startsAt: 'asc' },
      }),
      prisma.assignment.findMany({
        where: studentAssignmentWhere([group.id], now),
        include: {
          lesson: { select: { id: true, title: true } },
          submissions: { where: { studentId }, include: { grade: true } },
        },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.material.findMany({
        where: { AND: [await studentMaterialWhere(studentId), { courseId: group.courseId }] },
        include: {
          author: { select: publicUserSelect },
          lesson: { select: { id: true, title: true } },
          files: { select: { id: true, originalName: true, size: true, mimeType: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      prisma.attendance.findMany({
        where: { studentId, lesson: { groupId: group.id } },
        include: { lesson: { select: { id: true, title: true, startsAt: true } } },
        orderBy: { lesson: { startsAt: 'desc' } },
      }),
      prisma.grade.findMany({
        where: {
          studentId,
          OR: [{ submission: { assignment: { groupId: group.id } } }, { lesson: { groupId: group.id } }],
        },
        include: {
          submission: { select: { assignment: { select: { id: true, title: true } } } },
          lesson: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.announcement.findMany({
        where: { groupId: group.id },
        include: { author: { select: publicUserSelect } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      groupProgress(group.id, [studentId]),
    ]);

    const progress = progressMap.get(studentId) ?? { studentId, ...EMPTY_PROGRESS };
    const present = attendance.filter((a) => isPresentStatus(a.status)).length;

    res.json(
      ok({
        course: group.course,
        group: { id: group.id, code: group.code, status: group.status, format: group.format, startDate: group.startDate, endDate: group.endDate },
        teacher: group.teacher,
        lessons,
        materials,
        assignments: assignments.map(({ submissions, ...a }) => ({ ...a, submission: submissions[0] ?? null })),
        grades,
        attendance,
        attendanceSummary: {
          total: attendance.length,
          present,
          absent: attendance.filter((a) => a.status === 'ABSENT').length,
          late: attendance.filter((a) => a.status === 'LATE').length,
          excused: attendance.filter((a) => a.status === 'EXCUSED').length,
          percent: progress.attendancePercent,
        },
        announcements,
        progress: { ...progress, weights: PROGRESS_WEIGHTS },
        averageGrade: progress.averageGrade,
        nextLesson: lessons.find((l) => l.status === 'SCHEDULED' && l.endsAt >= now) ?? null,
      })
    );
  })
);

router.get(
  '/teacher',
  requireRole(Role.TEACHER),
  asyncHandler(async (req, res) => {
    const teacherId = req.user!.teacherId!;
    const now = new Date();
    const groups = await prisma.group.findMany({
      where: { teacherId, status: { in: ['ACTIVE', 'ENROLLMENT', 'PLANNED'] } },
      include: {
        course: true,
        _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { startDate: 'asc' },
    });
    const groupIds = groups.map((g) => g.id);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const [studentCount, upcomingLessons, todayLessons, toReview, pendingReview, activeAssignments, unreadNotifications] = await Promise.all([
      prisma.groupStudent.count({ where: { groupId: { in: groupIds }, status: 'ACTIVE' } }),
      prisma.lesson.findMany({
        where: { groupId: { in: groupIds }, status: 'SCHEDULED', endsAt: { gte: now } },
        include: lessonCardInclude,
        orderBy: { startsAt: 'asc' },
        take: 6,
      }),
      prisma.lesson.findMany({
        where: { groupId: { in: groupIds }, startsAt: { gte: dayStart, lte: dayEnd }, status: { not: 'CANCELLED' } },
        include: lessonCardInclude,
        orderBy: { startsAt: 'asc' },
      }),
      prisma.submission.findMany({
        where: { status: { in: ['SUBMITTED', 'REVIEWING'] }, assignment: { groupId: { in: groupIds } } },
        include: {
          assignment: { select: { id: true, title: true, deadline: true, maxScore: true, course: { select: { title: true } }, group: { select: { id: true, code: true } } } },
          student: { include: { user: { select: publicUserSelect } } },
        },
        orderBy: { submittedAt: 'asc' },
        take: 8,
      }),
      prisma.submission.count({ where: { status: { in: ['SUBMITTED', 'REVIEWING'] }, assignment: { groupId: { in: groupIds } } } }),
      prisma.assignment.count({
        where: { groupId: { in: groupIds }, status: { notIn: ['DRAFT'] }, OR: [{ deadline: null }, { deadline: { gte: now } }] },
      }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);

    const groupStats = [];
    const lowAttendance: { student: unknown; percent: number; groupCode: string; groupId: string }[] = [];
    const allRows: StudentProgress[] = [];
    for (const g of groups) {
      const map = await groupProgress(g.id);
      const rows = [...map.values()];
      allRows.push(...rows);
      groupStats.push({
        group: g,
        students: g._count.groupStudents,
        progressPercent: averageOf(rows.map((r) => r.progressPercent)) ?? 0,
        attendancePercent: averageOf(rows.filter((r) => r.attendanceMarked).map((r) => r.attendancePercent)) ?? 0,
        averageGrade: averageOf(rows.map((r) => r.averageGrade)),
      });
      const weak = rows.filter((r) => r.attendanceMarked >= 2 && r.attendancePercent < 70);
      if (weak.length) {
        const students = await prisma.student.findMany({
          where: { id: { in: weak.map((w) => w.studentId) } },
          include: { user: { select: publicUserSelect } },
        });
        for (const w of weak) {
          lowAttendance.push({
            student: students.find((s) => s.id === w.studentId),
            percent: Math.round(w.attendancePercent),
            groupCode: g.code,
            groupId: g.id,
          });
        }
      }
    }

    res.json(
      ok({
        activeGroups: groups.length,
        studentCount,
        lessonsToday: todayLessons.length,
        todayLessons,
        upcomingLessons,
        pendingReview,
        toReview,
        activeAssignments,
        unreadNotifications,
        averageAttendance: averageOf(allRows.filter((r) => r.attendanceMarked).map((r) => r.attendancePercent)) ?? 0,
        averageGrade: averageOf(allRows.map((r) => r.averageGrade)),
        averageProgress: averageOf(allRows.map((r) => r.progressPercent)) ?? 0,
        lowAttendance: lowAttendance.sort((a, b) => a.percent - b.percent).slice(0, 10),
        groupStats,
      })
    );
  })
);

router.get(
  '/teacher/group/:groupId',
  requireRole(Role.TEACHER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.TEACHER) {
      await assertTeacherOwnsGroup(req.user!.teacherId, req.params.groupId);
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: {
        course: true,
        teacher: { include: { user: { select: publicUserSelect } } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { student: { include: { user: { select: publicUserSelect } } } },
          orderBy: { student: { user: { lastName: 'asc' } } },
        },
        lessons: { include: { branch: { select: { name: true } }, classroom: { select: { name: true } } }, orderBy: { startsAt: 'asc' } },
        assignments: {
          include: { _count: { select: { submissions: true } } },
          orderBy: { deadline: 'asc' },
        },
      },
    });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    const progress = await groupProgress(group.id);
    const rows = [...progress.values()];

    const grades = await prisma.grade.findMany({
      where: { OR: [{ submission: { assignment: { groupId: group.id } } }, { lesson: { groupId: group.id } }] },
      select: { score: true, maxScore: true },
    });
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const g of grades) {
      const bucket = String(Math.min(5, Math.max(1, Math.round((g.score / g.maxScore) * 5))));
      distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    const materials = await prisma.material.findMany({
      where: { OR: [{ groupId: group.id }, { groupId: null, courseId: group.courseId }] },
      include: { files: { select: { id: true, originalName: true, size: true, mimeType: true } }, author: { select: publicUserSelect } },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    });

    res.json(
      ok({
        group: {
          ...group,
          groupStudents: group.groupStudents.map((gs) => ({ ...gs, progress: progress.get(gs.studentId) ?? null })),
        },
        analytics: {
          averageGrade: averageOf(rows.map((r) => r.averageGrade)),
          attendancePercent: averageOf(rows.filter((r) => r.attendanceMarked).map((r) => r.attendancePercent)) ?? 0,
          progressPercent: averageOf(rows.map((r) => r.progressPercent)) ?? 0,
          gradeDistribution: distribution,
          gradesCount: grades.length,
        },
        materials,
      })
    );
  })
);

router.get(
  '/admin',
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const [
      usersTotal,
      usersActive,
      students,
      teachers,
      coursesActive,
      coursesArchived,
      groupsActive,
      groupsCompleted,
      assignmentsTotal,
      submissionsPending,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
      prisma.course.count({ where: { status: 'ARCHIVED' } }),
      prisma.group.count({ where: { status: { in: ['ACTIVE', 'ENROLLMENT'] } } }),
      prisma.group.count({ where: { status: 'COMPLETED' } }),
      prisma.assignment.count(),
      prisma.submission.count({ where: { status: { in: ['SUBMITTED', 'REVIEWING'] } } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const weekEnd = new Date(startOfDay.getTime() + 7 * 86400000);

    const lessonsToday = await prisma.lesson.count({
      where: { startsAt: { gte: startOfDay, lte: endOfDay }, status: { not: 'CANCELLED' } },
    });
    const lessonsWeek = await prisma.lesson.count({
      where: { startsAt: { gte: startOfDay, lte: weekEnd }, status: { not: 'CANCELLED' } },
    });

    const attendance = await prisma.attendance.findMany({ select: { status: true } });
    const attPct =
      attendance.length > 0
        ? (attendance.filter((a) => isPresentStatus(a.status)).length / attendance.length) * 100
        : 0;

    const grades = await prisma.grade.findMany({ select: { score: true, maxScore: true } });
    const avgGrade = grades.length ? grades.reduce((s, g) => s + (g.score / g.maxScore) * 5, 0) / grades.length : null;

    const teacherLoad = await prisma.teacher.findMany({
      where: { user: { status: 'ACTIVE' } },
      include: {
        user: { select: publicUserSelect },
        groups: { where: { status: { in: ['ACTIVE', 'ENROLLMENT'] } } },
      },
    });

    const [applicationsPending, recentApplications, todayLessons, recentActions, newsPublished] = await Promise.all([
      prisma.courseApplication.count({ where: { status: 'PENDING' } }),
      prisma.courseApplication.findMany({
        where: { status: 'PENDING' },
        include: {
          course: { select: { id: true, title: true } },
          student: { select: { user: { select: publicUserSelect } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.lesson.findMany({
        where: { startsAt: { gte: startOfDay, lte: endOfDay } },
        include: {
          group: {
            select: {
              code: true,
              course: { select: { title: true } },
              teacher: { select: { user: { select: publicUserSelect } } },
            },
          },
          teacher: { select: { user: { select: publicUserSelect } } },
          classroom: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 12,
      }),
      prisma.auditLog.findMany({
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.news.count({ where: { isPublished: true } }),
    ]);

    res.json(
      ok({
        users: { total: usersTotal, active: usersActive },
        students,
        teachers,
        courses: { active: coursesActive, archived: coursesArchived },
        groups: { current: groupsActive, completed: groupsCompleted },
        lessons: { today: lessonsToday, week: lessonsWeek },
        assignments: { total: assignmentsTotal, pendingReview: submissionsPending },
        attendancePercent: round1(attPct),
        averageGrade: avgGrade ? round1(avgGrade) : null,
        teacherLoad: teacherLoad.map((t) => ({
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`,
          photoUrl: t.user.photoUrl,
          groups: t.groups.length,
        })),
        applicationsPending,
        newsPublished,
        recentApplications: recentApplications.map((a) => ({
          id: a.id,
          createdAt: a.createdAt,
          course: a.course,
          student: a.student.user,
        })),
        todayLessons: todayLessons.map((l) => ({
          id: l.id,
          title: l.title,
          startsAt: l.startsAt,
          endsAt: l.endsAt,
          status: l.status,
          format: l.format,
          groupCode: l.group.code,
          courseTitle: l.group.course.title,
          teacher: (l.teacher ?? l.group.teacher)?.user ?? null,
          place: l.format === 'ONLINE' ? 'Онлайн' : [l.branch?.name, l.classroom?.name].filter(Boolean).join(', ') || null,
        })),
        recentActions: recentActions.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          createdAt: a.createdAt,
          user: a.user,
        })),
      })
    );
  })
);

export default router;
