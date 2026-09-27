import { PrismaClient, Role, UserStatus, CourseStatus, CourseLevel, GroupStatus, LearningFormat, LessonStatus, AssignmentStatus, SubmissionStatus, AttendanceStatus, MaterialType, GroupStudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Somon123!';

async function main() {
  console.log('Seeding Somon database...');
  await prisma.studentAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.studentActivity.deleteMany();
  await prisma.courseApplication.deleteMany();
  await prisma.publicMaterial.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.material.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.groupStudent.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.group.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@somon.local',
      passwordHash,
      firstName: 'Алина',
      lastName: 'Админова',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const teacherUsers = await Promise.all(
    [
      { email: 'teacher1@somon.local', firstName: 'Игорь', lastName: 'Петров', specialization: 'Веб-разработка' },
      { email: 'teacher2@somon.local', firstName: 'Мария', lastName: 'Козлова', specialization: 'Дизайн' },
      { email: 'teacher3@somon.local', firstName: 'Дмитрий', lastName: 'Смирнов', specialization: 'Аналитика данных' },
      { email: 'teacher4@somon.local', firstName: 'Елена', lastName: 'Новикова', specialization: 'Маркетинг' },
    ].map((t) =>
      prisma.user.create({
        data: {
          email: t.email,
          passwordHash,
          firstName: t.firstName,
          lastName: t.lastName,
          role: Role.TEACHER,
          teacher: { create: { specialization: t.specialization, bio: `Преподаватель направления «${t.specialization}»` } },
        },
        include: { teacher: true },
      })
    )
  );

  const studentNames = [
    ['Анна', 'Иванова'], ['Борис', 'Сидоров'], ['Виктория', 'Орлова'], ['Глеб', 'Морозов'],
    ['Дарья', 'Волкова'], ['Егор', 'Лебедев'], ['Жанна', 'Соколова'], ['Илья', 'Кузнецов'],
    ['Ксения', 'Попова'], ['Лев', 'Васильев'], ['Марина', 'Зайцева'], ['Никита', 'Павлов'],
    ['Ольга', 'Семёнова'], ['Павел', 'Голубев'], ['Рита', 'Виноградова'], ['Сергей', 'Богданов'],
  ];

  const studentUsers = await Promise.all(
    studentNames.map(([firstName, lastName], i) =>
      prisma.user.create({
        data: {
          email: `student${i + 1}@somon.local`,
          passwordHash,
          firstName,
          lastName,
          role: Role.STUDENT,
          student: {
            create: {
              phone: `+7900${String(1000000 + i).slice(0, 7)}`,
            },
          },
        },
        include: { student: true },
      })
    )
  );

  const categories = await Promise.all(
    ['Программирование', 'Дизайн', 'Аналитика', 'Маркетинг', 'Языки'].map((name) =>
      prisma.category.create({ data: { name } })
    )
  );

  const courseDefs = [
    { title: 'Основы веб-разработки', categoryId: categories[0].id, level: CourseLevel.BEGINNER, lessonsCount: 12, shortDesc: 'HTML, CSS и JavaScript с нуля' },
    { title: 'React для начинающих', categoryId: categories[0].id, level: CourseLevel.INTERMEDIATE, lessonsCount: 16, shortDesc: 'Компоненты, хуки и SPA' },
    { title: 'UI/UX дизайн', categoryId: categories[1].id, level: CourseLevel.BEGINNER, lessonsCount: 10, shortDesc: 'Проектирование интерфейсов' },
    { title: 'Анализ данных на Python', categoryId: categories[2].id, level: CourseLevel.INTERMEDIATE, lessonsCount: 14, shortDesc: 'Pandas, визуализация, отчёты' },
    { title: 'Digital-маркетинг', categoryId: categories[3].id, level: CourseLevel.BEGINNER, lessonsCount: 8, shortDesc: 'Каналы привлечения и метрики' },
    { title: 'Английский для IT', categoryId: categories[4].id, level: CourseLevel.BEGINNER, lessonsCount: 20, shortDesc: 'Технический английский' },
  ];

  const courses = await Promise.all(
    courseDefs.map((c) =>
      prisma.course.create({
        data: {
          ...c,
          description: `${c.shortDesc}. Практический курс образовательного центра Somon.`,
          durationWeeks: Math.ceil((c.lessonsCount || 10) / 2),
          maxStudents: 16,
          status: CourseStatus.PUBLISHED,
          format: LearningFormat.HYBRID,
        },
      })
    )
  );

  // draft + archived for demo variety
  await prisma.course.create({
    data: {
      title: 'Node.js Advanced (черновик)',
      shortDesc: 'В разработке',
      categoryId: categories[0].id,
      status: CourseStatus.DRAFT,
      level: CourseLevel.ADVANCED,
      lessonsCount: 12,
    },
  });
  await prisma.course.create({
    data: {
      title: 'Основы Photoshop (архив)',
      shortDesc: 'Архивный курс',
      categoryId: categories[1].id,
      status: CourseStatus.ARCHIVED,
      level: CourseLevel.BEGINNER,
      lessonsCount: 8,
    },
  });

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000);

  const groupDefs = [
    { code: 'WEB-A1', courseId: courses[0].id, teacherId: teacherUsers[0].teacher!.id, status: GroupStatus.ACTIVE },
    { code: 'REACT-B1', courseId: courses[1].id, teacherId: teacherUsers[0].teacher!.id, status: GroupStatus.ACTIVE },
    { code: 'UX-C1', courseId: courses[2].id, teacherId: teacherUsers[1].teacher!.id, status: GroupStatus.ENROLLMENT },
    { code: 'DATA-D1', courseId: courses[3].id, teacherId: teacherUsers[2].teacher!.id, status: GroupStatus.ACTIVE },
    { code: 'MKT-E1', courseId: courses[4].id, teacherId: teacherUsers[3].teacher!.id, status: GroupStatus.ACTIVE },
    { code: 'ENG-F1', courseId: courses[5].id, teacherId: teacherUsers[1].teacher!.id, status: GroupStatus.PLANNED },
  ];

  const groups = await Promise.all(
    groupDefs.map((g, i) =>
      prisma.group.create({
        data: {
          code: g.code,
          name: `Группа ${g.code}`,
          courseId: g.courseId,
          teacherId: g.teacherId,
          status: g.status,
          capacity: 12,
          format: LearningFormat.HYBRID,
          startDate: days(-30 + i * 3),
          endDate: days(60 + i * 5),
        },
      })
    )
  );

  // Enroll students into groups (linked)
  const enrollments: { groupId: string; studentIds: string[] }[] = [
    { groupId: groups[0].id, studentIds: studentUsers.slice(0, 6).map((s) => s.student!.id) },
    { groupId: groups[1].id, studentIds: studentUsers.slice(4, 10).map((s) => s.student!.id) },
    { groupId: groups[2].id, studentIds: studentUsers.slice(8, 12).map((s) => s.student!.id) },
    { groupId: groups[3].id, studentIds: studentUsers.slice(10, 15).map((s) => s.student!.id) },
    { groupId: groups[4].id, studentIds: studentUsers.slice(0, 5).map((s) => s.student!.id) },
  ];

  for (const e of enrollments) {
    for (const studentId of e.studentIds) {
      const group = groups.find((g) => g.id === e.groupId)!;
      await prisma.groupStudent.create({
        data: { groupId: e.groupId, studentId, status: GroupStudentStatus.ACTIVE },
      });
      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId, courseId: group.courseId } },
        create: { studentId, courseId: group.courseId },
        update: {},
      });
    }
  }

  // Lessons ~30
  const lessons = [];
  for (const group of groups.slice(0, 5)) {
    for (let i = 0; i < 6; i++) {
      const start = days(-20 + i * 7 + groups.indexOf(group));
      start.setHours(10 + (i % 3), 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60000);
      const lesson = await prisma.lesson.create({
        data: {
          groupId: group.id,
          title: `Занятие ${i + 1}: ${group.code}`,
          startsAt: start,
          endsAt: end,
          format: LearningFormat.HYBRID,
          room: `Ауд. ${100 + i}`,
          status: i < 3 ? LessonStatus.COMPLETED : LessonStatus.SCHEDULED,
        },
      });
      lessons.push(lesson);
    }
  }

  // Materials
  for (const course of courses.slice(0, 5)) {
    for (let i = 0; i < 4; i++) {
      await prisma.material.create({
        data: {
          courseId: course.id,
          title: `Материал ${i + 1}: ${course.title}`,
          description: 'Учебный материал Somon',
          topic: `Тема ${i + 1}`,
          type: i % 2 === 0 ? MaterialType.PDF : MaterialType.NOTE,
          fileUrl: i % 2 === 0 ? null : null,
          sortOrder: i,
          authorId: teacherUsers[0].id,
        },
      });
    }
  }

  // Assignments + submissions + grades
  const assignments = [];
  for (const group of groups.slice(0, 5)) {
    for (let i = 0; i < 3; i++) {
      const a = await prisma.assignment.create({
        data: {
          courseId: group.courseId,
          groupId: group.id,
          title: `Задание ${i + 1} (${group.code})`,
          description: 'Выполните практическое задание и загрузите ответ.',
          criteria: 'Корректность, полнота, оформление',
          deadline: days(7 + i * 5),
          maxScore: 5,
          status: AssignmentStatus.PUBLISHED,
        },
      });
      assignments.push(a);
    }
  }

  const groupStudents = await prisma.groupStudent.findMany({ where: { status: GroupStudentStatus.ACTIVE } });
  for (const a of assignments) {
    const members = groupStudents.filter((gs) => gs.groupId === a.groupId);
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (i % 5 === 4) continue; // some not submitted
      const submitted = true;
      const graded = i % 2 === 0;
      const submission = await prisma.submission.create({
        data: {
          assignmentId: a.id,
          studentId: m.studentId,
          text: 'Мой ответ на задание Somon',
          submittedAt: days(-2),
          status: graded ? SubmissionStatus.GRADED : SubmissionStatus.SUBMITTED,
        },
      });
      if (graded) {
        const teacher = teacherUsers.find((t) => t.teacher!.id === groups.find((g) => g.id === a.groupId)?.teacherId);
        await prisma.grade.create({
          data: {
            submissionId: submission.id,
            studentId: m.studentId,
            teacherId: teacher?.teacher?.id,
            assignmentId: a.id,
            score: 3 + (i % 3),
            maxScore: 5,
            comment: 'Хорошая работа, продолжайте в том же духе.',
          },
        });
      }
    }
  }

  // Attendance
  const completedLessons = lessons.filter((l) => l.status === LessonStatus.COMPLETED);
  for (const lesson of completedLessons) {
    const members = groupStudents.filter((gs) => gs.groupId === lesson.groupId);
    for (let i = 0; i < members.length; i++) {
      const status =
        i % 7 === 1 ? AttendanceStatus.ABSENT : i % 5 === 2 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: members[i].studentId,
          status,
          note: status === AttendanceStatus.ABSENT ? 'Неявка' : null,
        },
      });
    }
  }

  // Notifications
  for (const u of [...studentUsers.slice(0, 8), ...teacherUsers, admin]) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: 'SYSTEM',
        title: 'Добро пожаловать в Somon',
        body: 'Ваш учебный кабинет готов к работе.',
      },
    });
  }
  for (const s of studentUsers.slice(0, 6)) {
    await prisma.notification.create({
      data: {
        userId: s.id,
        type: 'ASSIGNMENT',
        title: 'Новое задание',
        body: 'В вашей группе опубликовано новое задание.',
      },
    });
  }

  // Announcements
  await prisma.announcement.create({
    data: {
      groupId: groups[0].id,
      authorId: teacherUsers[0].id,
      title: 'Перенос занятия',
      body: 'Завтра занятие переносится с 15:00 на 17:00. Аудитория без изменений.',
    },
  });
  await prisma.announcement.create({
    data: {
      groupId: groups[1].id,
      authorId: teacherUsers[0].id,
      title: 'Материалы к практике',
      body: 'Загрузил дополнительные примеры по React. Смотрите раздел материалов.',
    },
  });

  // Public library
  const library = [
    { title: 'Основы JavaScript', category: 'Программирование', type: 'NOTE' as const, level: 'BEGINNER' as const },
    { title: 'Основы Python', category: 'Программирование', type: 'PDF' as const, level: 'BEGINNER' as const },
    { title: 'Git для начинающих', category: 'Программирование', type: 'LINK' as const, level: 'BEGINNER' as const },
    { title: 'Основы Figma', category: 'Дизайн', type: 'NOTE' as const, level: 'BEGINNER' as const },
    { title: 'UX/UI для начинающих', category: 'Дизайн', type: 'PDF' as const, level: 'INTERMEDIATE' as const },
    { title: 'Как составить резюме', category: 'Дополнительное развитие', type: 'NOTE' as const, level: 'BEGINNER' as const },
    { title: 'Как пройти собеседование', category: 'Дополнительное развитие', type: 'NOTE' as const, level: 'BEGINNER' as const },
  ];
  for (const item of library) {
    await prisma.publicMaterial.create({
      data: {
        ...item,
        description: `Открытый материал библиотеки Somon: ${item.title}`,
        authorId: admin.id,
        linkUrl: item.type === 'LINK' ? 'https://example.com' : null,
      },
    });
  }

  // Achievements + activity for student1
  const achDefs = [
    { code: 'FIRST_SUBMISSION', title: 'Первое выполненное задание', description: 'Отправили первую работу' },
    { code: 'TEN_LESSONS', title: '10 посещённых занятий', description: 'Регулярно приходите на занятия' },
    { code: 'EXCELLENT', title: 'Отличный результат', description: 'Получили оценку 5' },
    { code: 'PERFECT_MONTH', title: '100% посещаемость', description: 'Не пропустили занятия' },
    { code: 'ALL_ASSIGNMENTS', title: 'Все задания курса выполнены', description: 'Закрыли все задания курса' },
    { code: 'FIRST_COURSE', title: 'Завершён первый курс', description: 'Дошли до конца программы' },
  ];
  for (const d of achDefs) {
    await prisma.achievement.create({ data: d });
  }

  const s1 = studentUsers[0].student!;
  await prisma.studentActivity.createMany({
    data: [
      { studentId: s1.id, type: 'MATERIAL', title: 'Просмотрен материал «Основы HTML»' },
      { studentId: s1.id, type: 'SUBMISSION', title: 'Отправлено задание №1' },
      { studentId: s1.id, type: 'GRADE', title: 'Получена оценка 4' },
      { studentId: s1.id, type: 'LESSON', title: 'Просмотрено занятие по CSS' },
      { studentId: s1.id, type: 'MATERIAL', title: 'Скачана презентация' },
    ],
  });

  console.log('Seed complete.');
  console.log('Demo password for all accounts:', DEMO_PASSWORD);
  console.log('admin@somon.local / teacher1@somon.local / student1@somon.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
