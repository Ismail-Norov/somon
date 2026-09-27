import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ok } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeProgress, isPresentStatus } from '../lib/progress';
import { assertTeacherOwnsGroup } from '../services/access';

const router = Router();
router.use(requireAuth);

router.get(
  '/student',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.studentId!;
    const links = await prisma.groupStudent.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        group: {
          include: {
            course: true,
            teacher: { include: { user: true } },
            lessons: true,
            assignments: { where: { status: { not: 'DRAFT' } } },
          },
        },
      },
    });

    const grades = await prisma.grade.findMany({ where: { studentId } });
    const avgScore =
      grades.length > 0 ? grades.reduce((s, g) => s + (g.score / g.maxScore) * 5, 0) / grades.length : null;

    const courses = [];
    for (const link of links) {
      const group = link.group;
      const lessonsTotal = group.lessons.filter((l) => l.status !== 'CANCELLED').length;
      const lessonsCompleted = group.lessons.filter((l) => l.status === 'COMPLETED').length;
      const assignmentIds = group.assignments.map((a) => a.id);
      const submissions = await prisma.submission.findMany({
        where: {
          studentId,
          assignmentId: { in: assignmentIds },
          status: { in: ['SUBMITTED', 'REVIEWING', 'GRADED'] },
        },
      });
      const attendance = await prisma.attendance.findMany({
        where: {
          studentId,
          lesson: { groupId: group.id, status: { not: 'CANCELLED' } },
        },
      });
      const present = attendance.filter((a) => isPresentStatus(a.status)).length;
      const attendancePercent = attendance.length ? (present / attendance.length) * 100 : 0;
      const overdue = group.assignments.filter(
        (a) => a.deadline && a.deadline < new Date() && !submissions.some((s) => s.assignmentId === a.id)
      ).length;

      const progress = computeProgress({
        lessonsTotal,
        lessonsCompleted,
        assignmentsTotal: group.assignments.length,
        assignmentsDone: submissions.length,
        attendancePercent,
      });

      courses.push({
        course: group.course,
        group: { id: group.id, code: group.code, status: group.status },
        teacher: group.teacher,
        ...progress,
        lessonsTotal,
        lessonsCompleted,
        lessonsRemaining: Math.max(0, lessonsTotal - lessonsCompleted),
        assignmentsDone: submissions.length,
        assignmentsTotal: group.assignments.length,
        overdueAssignments: overdue,
        averageGrade: null as number | null,
      });
    }

    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { gte: new Date() },
        group: { groupStudents: { some: { studentId, status: 'ACTIVE' } } },
      },
      include: { 
        group: { 
          include: { 
            course: true,
            teacher: { include: { user: true } }
          } 
        } 
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });

    const deadlines = await prisma.assignment.findMany({
      where: {
        status: { not: 'DRAFT' },
        deadline: { gte: new Date() },
        group: { groupStudents: { some: { studentId, status: 'ACTIVE' } } },
      },
      include: { group: true, course: true },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const unreadNotifications = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });

    const allAttendance = await prisma.attendance.findMany({ where: { studentId } });
    const presentCount = allAttendance.filter((a) => isPresentStatus(a.status)).length;
    const absentCount = allAttendance.filter((a) => a.status === 'ABSENT').length;
    const overallAttendance =
      allAttendance.length > 0 ? (presentCount / allAttendance.length) * 100 : 0;

    const recentGrades = await prisma.grade.findMany({
      where: { studentId },
      include: {
        submission: { include: { assignment: { include: { course: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const gradeTrend = recentGrades.map((g) => Math.round((g.score / g.maxScore) * 50) / 10);

    const activeAssignments = await prisma.assignment.findMany({
      where: {
        status: { not: 'DRAFT' },
        group: { groupStudents: { some: { studentId, status: 'ACTIVE' } } },
      },
      include: {
        course: true,
        group: true,
        submissions: { where: { studentId } },
      },
      orderBy: { deadline: 'asc' },
      take: 8,
    });

    const pendingAssignments = activeAssignments.filter((a) => {
      const sub = a.submissions[0];
      return !sub || ['DRAFT', 'OVERDUE'].includes(sub.status);
    });

    const nextLesson = upcomingLessons[0]
      ? await prisma.lesson.findUnique({
          where: { id: upcomingLessons[0].id },
          include: {
            group: {
              include: {
                course: true,
                teacher: { include: { user: true } },
              },
            },
          },
        })
      : null;

    const primary = courses[0] || null;

    const stats = {
      coursesTotal: courses.length,
      coursesCompleted: links.filter((l) => l.group.status === 'COMPLETED').length,
      activeAssignments: pendingAssignments.length,
      assignmentsDone: courses.reduce((s, c) => s + c.assignmentsDone, 0),
      averageGrade: avgScore ? Math.round(avgScore * 10) / 10 : null,
      attendancePercent: Math.round(overallAttendance * 10) / 10,
      lessonsVisited: presentCount,
      lessonsTotal: allAttendance.length,
      lessonsMissed: absentCount,
    };

    const overallProgress =
      courses.length > 0
        ? Math.round(
            (courses.reduce((s, c) => s + c.progressPercent, 0) / courses.length) * 10
          ) / 10
        : 0;

    const assignmentsPct =
      stats.assignmentsDone + pendingAssignments.length > 0
        ? Math.round(
            (stats.assignmentsDone / Math.max(1, stats.assignmentsDone + pendingAssignments.length)) *
              1000
          ) / 10
        : 0;

    const activities = [];
    const achievements = [];
    
    try {
      if (prisma.studentActivity) {
        activities.push(...(await prisma.studentActivity.findMany({
          where: { studentId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        })));
      }
    } catch (e) {
      // Model might not be available
    }
    
    try {
      if (prisma.studentAchievement) {
        achievements.push(...(await prisma.studentAchievement.findMany({
          where: { studentId },
          include: { achievement: true },
          orderBy: { earnedAt: 'desc' },
          take: 6,
        })));
      }
    } catch (e) {
      // Model might not be available
    }

    let announcements = [];
    try {
      if (prisma.announcement) {
        announcements = await prisma.announcement.findMany({
          where: {
            groupId: { in: links.map((l) => l.group.id) },
          },
          include: { group: { include: { course: true } }, author: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
      }
    } catch (e) {
      // Model might not be available
    }

    res.json(
      ok({
        greeting: `${req.user!.firstName}`,
        courses: courses.map((c, idx) => {
          const group = links[idx].group;
          const lessonsTotal = group.lessons.filter((l) => l.status !== 'CANCELLED').length;
          const lessonsCompleted = group.lessons.filter((l) => l.status === 'COMPLETED').length;
          const lessonsPercent = lessonsTotal ? (lessonsCompleted / lessonsTotal) * 100 : 0;
          return {
            ...c,
            lessonsTotal,
            lessonsCompleted,
            lessonsPercent: Math.round(lessonsPercent * 10) / 10,
            shortDesc: group.course.shortDesc,
            description: group.course.description,
          };
        }),
        primaryCourse: primary
          ? {
              ...primary,
              lessonsTotal: links[0].group.lessons.filter((l) => l.status !== 'CANCELLED').length,
              lessonsCompleted: links[0].group.lessons.filter((l) => l.status === 'COMPLETED').length,
            }
          : null,
        upcomingLessons,
        nextLesson,
        deadlines,
        pendingAssignments,
        recentGrades: [...recentGrades].reverse().slice(0, 5),
        gradeTrend,
        averageGrade: avgScore ? Math.round(avgScore * 10) / 10 : null,
        attendancePercent: Math.round(overallAttendance * 10) / 10,
        attendanceSummary: {
          total: allAttendance.length,
          present: presentCount,
          absent: absentCount,
          percent: Math.round(overallAttendance * 10) / 10,
        },
        progress: {
          overall: overallProgress,
          assignments: assignmentsPct,
          attendance: Math.round(overallAttendance * 10) / 10,
          averageGrade: avgScore ? Math.round(avgScore * 10) / 10 : null,
        },
        stats,
        notifications,
        overallProgress,
        activeAssignments: pendingAssignments.length,
        unreadNotifications,
        activities,
        achievements,
        announcements,
      })
    );
  })
);

router.get(
  '/student/course/:courseId',
  requireRole(Role.STUDENT),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.studentId!;
    const link = await prisma.groupStudent.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
        group: { courseId: req.params.courseId },
      },
      include: {
        group: {
          include: {
            course: true,
            teacher: { include: { user: true } },
            lessons: { orderBy: { startsAt: 'asc' } },
            assignments: { where: { status: { not: 'DRAFT' } }, orderBy: { deadline: 'asc' } },
          },
        },
      },
    });
    if (!link) throw new AppError('Курс недоступен', 404, 'NOT_FOUND');

    const materials = await prisma.material.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { sortOrder: 'asc' },
    });
    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        assignmentId: { in: link.group.assignments.map((a) => a.id) },
      },
      include: { grade: true },
    });
    const grades = await prisma.grade.findMany({
      where: { studentId, assignmentId: { in: link.group.assignments.map((a) => a.id) } },
    });
    const attendance = await prisma.attendance.findMany({
      where: { studentId, lesson: { groupId: link.group.id } },
    });

    const lessonsTotal = link.group.lessons.filter((l) => l.status !== 'CANCELLED').length;
    const lessonsCompleted = link.group.lessons.filter((l) => l.status === 'COMPLETED').length;
    const present = attendance.filter((a) => isPresentStatus(a.status)).length;
    const attendancePercent = attendance.length ? (present / attendance.length) * 100 : 0;
    const progress = computeProgress({
      lessonsTotal,
      lessonsCompleted,
      assignmentsTotal: link.group.assignments.length,
      assignmentsDone: submissions.filter((s) =>
        ['SUBMITTED', 'REVIEWING', 'GRADED'].includes(s.status)
      ).length,
      attendancePercent,
    });

    let announcements = [];
    try {
      if (prisma.announcement) {
        announcements = await prisma.announcement.findMany({
          where: { groupId: link.group.id },
          include: { author: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      }
    } catch (e) {
      // Model might not be available
    }

    const avg =
      grades.length > 0 ? grades.reduce((s, g) => s + g.score, 0) / grades.length : null;

    res.json(
      ok({
        course: link.group.course,
        group: link.group,
        teacher: link.group.teacher,
        materials,
        assignments: link.group.assignments.map((a) => ({
          ...a,
          submission: submissions.find((s) => s.assignmentId === a.id) || null,
        })),
        grades,
        attendance,
        attendanceSummary: {
          total: attendance.length,
          present,
          absent: attendance.filter((a) => a.status === 'ABSENT').length,
          percent: Math.round(attendancePercent * 10) / 10,
        },
        announcements,
        progress,
        averageGrade: avg ? Math.round(avg * 10) / 10 : null,
        nextLesson: link.group.lessons.find((l) => l.status === 'SCHEDULED' && l.startsAt >= new Date()) || null,
      })
    );
  })
);

router.get(
  '/teacher',
  requireRole(Role.TEACHER),
  asyncHandler(async (req, res) => {
    const teacherId = req.user!.teacherId!;
    const groups = await prisma.group.findMany({
      where: { teacherId, status: { in: ['ACTIVE', 'ENROLLMENT'] } },
      include: {
        course: true,
        _count: { select: { groupStudents: true } },
      },
    });

    const groupIds = groups.map((g) => g.id);
    const studentCount = await prisma.groupStudent.count({
      where: { groupId: { in: groupIds }, status: 'ACTIVE' },
    });

    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        groupId: { in: groupIds },
        status: 'SCHEDULED',
        startsAt: { gte: new Date() },
      },
      include: { 
        group: { 
          include: { 
            course: true,
            teacher: { include: { user: true } }
          } 
        } 
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });

    const toReview = await prisma.submission.findMany({
      where: {
        status: 'SUBMITTED',
        assignment: { groupId: { in: groupIds } },
      },
      include: {
        assignment: { include: { course: true, group: true } },
        student: { include: { user: true } },
      },
      take: 10,
    });

    const lowAttendance: { student: unknown; percent: number; groupCode: string }[] = [];
    for (const g of groups) {
      const members = await prisma.groupStudent.findMany({
        where: { groupId: g.id, status: 'ACTIVE' },
        include: { student: { include: { user: true } } },
      });
      for (const m of members) {
        const att = await prisma.attendance.findMany({
          where: { studentId: m.studentId, lesson: { groupId: g.id } },
        });
        if (!att.length) continue;
        const pct = (att.filter((a) => isPresentStatus(a.status)).length / att.length) * 100;
        if (pct < 70) {
          lowAttendance.push({ student: m.student, percent: Math.round(pct), groupCode: g.code });
        }
      }
    }

    const groupStats = [];
    for (const g of groups) {
      const grades = await prisma.grade.findMany({
        where: { submission: { assignment: { groupId: g.id } } },
      });
      const avg = grades.length ? grades.reduce((s, x) => s + x.score, 0) / grades.length : null;
      groupStats.push({
        group: g,
        averageGrade: avg ? Math.round(avg * 10) / 10 : null,
        students: g._count.groupStudents,
      });
    }

    const activeAssignments = await prisma.assignment.count({
      where: {
        groupId: { in: groupIds },
        status: { not: 'DRAFT' },
      },
    });

    const allAttendance = await prisma.attendance.findMany({
      where: { lesson: { groupId: { in: groupIds } } },
    });

    const teacherAttendance = allAttendance.length > 0
      ? (allAttendance.filter((a) => isPresentStatus(a.status)).length / allAttendance.length) * 100
      : 0;

    const teacherGrades = await prisma.grade.findMany({
      where: { submission: { assignment: { groupId: { in: groupIds } } } },
    });

    const teacherAvgGrade = teacherGrades.length 
      ? teacherGrades.reduce((s, g) => s + g.score, 0) / teacherGrades.length 
      : null;

    res.json(
      ok({
        activeGroups: groups.length,
        studentCount,
        upcomingLessons,
        toReview,
        lowAttendance: lowAttendance.slice(0, 10),
        groupStats: groupStats.map((gs) => ({
          ...gs,
          attendancePercent: gs.attendancePercent || 0,
        })),
        lessonsToday,
        activeAssignments,
        averageAttendance: Math.round(teacherAttendance * 10) / 10,
        averageGrade: teacherAvgGrade ? Math.round(teacherAvgGrade * 10) / 10 : 0,
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
        teacher: { include: { user: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { student: { include: { user: true } } },
        },
        lessons: { orderBy: { startsAt: 'asc' } },
        assignments: { orderBy: { deadline: 'asc' } },
      },
    });
    if (!group) throw new AppError('Группа не найдена', 404, 'NOT_FOUND');

    const grades = await prisma.grade.findMany({
      where: { submission: { assignment: { groupId: group.id } } },
    });
    const avg = grades.length ? grades.reduce((s, g) => s + g.score, 0) / grades.length : null;

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const g of grades) {
      const bucket = String(Math.min(5, Math.max(1, Math.round(g.score))));
      distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    const attendanceRows = await prisma.attendance.findMany({
      where: { lesson: { groupId: group.id } },
    });
    const attPct =
      attendanceRows.length > 0
        ? (attendanceRows.filter((a) => isPresentStatus(a.status)).length / attendanceRows.length) * 100
        : 0;

    const materials = await prisma.material.findMany({
      where: { courseId: group.courseId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(
      ok({
        group,
        analytics: {
          averageGrade: avg ? Math.round(avg * 10) / 10 : null,
          attendancePercent: Math.round(attPct * 10) / 10,
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
      prisma.submission.count({ where: { status: 'SUBMITTED' } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const weekEnd = new Date(startOfDay.getTime() + 7 * 86400000);

    const lessonsToday = await prisma.lesson.count({
      where: { 
        groupId: { in: groupIds },
        startsAt: { gte: startOfDay, lte: endOfDay }, 
        status: { not: 'CANCELLED' } 
      },
    });
    const lessonsWeek = await prisma.lesson.count({
      where: { 
        groupId: { in: groupIds },
        startsAt: { gte: startOfDay, lte: weekEnd }, 
        status: { not: 'CANCELLED' } 
      },
    });

    const attendance = await prisma.attendance.findMany();
    const attPct =
      attendance.length > 0
        ? (attendance.filter((a) => isPresentStatus(a.status)).length / attendance.length) * 100
        : 0;

    const grades = await prisma.grade.findMany();
    const avgGrade = grades.length ? grades.reduce((s, g) => s + g.score, 0) / grades.length : null;

    const teacherLoad = await prisma.teacher.findMany({
      include: {
        user: true,
        groups: { where: { status: { in: ['ACTIVE', 'ENROLLMENT'] } } },
      },
    });

    res.json(
      ok({
        users: { total: usersTotal, active: usersActive },
        students,
        teachers,
        courses: { active: coursesActive, archived: coursesArchived },
        groups: { current: groupsActive, completed: groupsCompleted },
        lessons: { today: lessonsToday, week: lessonsWeek },
        assignments: { total: assignmentsTotal, pendingReview: submissionsPending },
        attendancePercent: Math.round(attPct * 10) / 10,
        averageGrade: avgGrade ? Math.round(avgGrade * 10) / 10 : null,
        teacherLoad: teacherLoad.map((t) => ({
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`,
          groups: t.groups.length,
        })),
      })
    );
  })
);

export default router;
