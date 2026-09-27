import { PrismaClient, Role, UserStatus, CourseStatus, CourseLevel, GroupStatus, LearningFormat, LessonStatus, AssignmentStatus, SubmissionStatus, AttendanceStatus, MaterialType, GroupStudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Somon123!';

async function main() {
  console.log('Seeding Somon database...');
  await prisma.submissionFile.deleteMany();
  await prisma.submissionAttempt.deleteMany();
  await prisma.materialFile.deleteMany();
  await prisma.news.deleteMany();
  await prisma.siteSetting.deleteMany();
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
  await prisma.classroom.deleteMany();
  await prisma.branch.deleteMany();
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
      { email: 'teacher1@somon.local', firstName: 'Алишер', lastName: 'Каримов', specialization: 'Веб-разработка', position: 'Senior Frontend-разработчик', bio: '8 лет в коммерческой разработке. Ведёт курсы по HTML, CSS, JavaScript и React, помогает студентам собрать первое портфолио.' },
      { email: 'teacher2@somon.local', firstName: 'Мадина', lastName: 'Рахимова', specialization: 'UI/UX Design', position: 'Product Designer', bio: 'Проектирует интерфейсы для мобильных и веб-продуктов. Учит думать о пользователе и работать в Figma.' },
      { email: 'teacher3@somon.local', firstName: 'Фаррух', lastName: 'Назаров', specialization: 'Python и аналитика данных', position: 'Data Analyst', bio: 'Строит отчёты и дашборды для бизнеса. Объясняет Python, pandas и визуализацию на реальных задачах.' },
      { email: 'teacher4@somon.local', firstName: 'Елена', lastName: 'Новикова', specialization: 'Digital-маркетинг', position: 'Head of Marketing', bio: 'Запускала рекламные кампании для локальных и международных брендов. Учит работать с метриками.' },
    ].map((t, i) =>
      prisma.user.create({
        data: {
          email: t.email,
          passwordHash,
          firstName: t.firstName,
          lastName: t.lastName,
          role: Role.TEACHER,
          teacher: {
            create: {
              specialization: t.specialization,
              position: t.position,
              bio: t.bio,
              phone: `+992 90 000 00 0${i + 1}`,
            },
          },
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
              phone: `+992 93 ${String(100 + i).padStart(3, '0')} 00 ${String(10 + i).slice(-2)}`,
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
    { title: 'Web-разработка', categoryId: categories[0].id, level: CourseLevel.BEGINNER, lessonsCount: 24, durationWeeks: 12, price: 1200, format: LearningFormat.HYBRID, shortDesc: 'HTML, CSS, JavaScript, React, Node.js' },
    { title: 'React и современный frontend', categoryId: categories[0].id, level: CourseLevel.INTERMEDIATE, lessonsCount: 16, durationWeeks: 8, price: 1000, format: LearningFormat.ONLINE, shortDesc: 'Компоненты, хуки, маршрутизация и работа с API' },
    { title: 'UI/UX Design', categoryId: categories[1].id, level: CourseLevel.BEGINNER, lessonsCount: 16, durationWeeks: 8, price: 900, format: LearningFormat.OFFLINE, shortDesc: 'Figma, основы UX/UI, проектирование интерфейсов' },
    { title: 'Data Analytics', categoryId: categories[2].id, level: CourseLevel.INTERMEDIATE, lessonsCount: 20, durationWeeks: 10, price: 1100, format: LearningFormat.HYBRID, shortDesc: 'Работа с данными, таблицами и визуализацией' },
    { title: 'Digital-маркетинг', categoryId: categories[3].id, level: CourseLevel.BEGINNER, lessonsCount: 8, durationWeeks: 4, price: 600, format: LearningFormat.ONLINE, shortDesc: 'Каналы привлечения, реклама и метрики' },
    { title: 'Английский для IT', categoryId: categories[4].id, level: CourseLevel.BEGINNER, lessonsCount: 20, durationWeeks: 10, price: 700, format: LearningFormat.OFFLINE, shortDesc: 'Технический английский для разработчиков и дизайнеров' },
    { title: 'Python', categoryId: categories[0].id, level: CourseLevel.BEGINNER, lessonsCount: 18, durationWeeks: 9, price: 1000, format: LearningFormat.HYBRID, shortDesc: 'Основы Python, алгоритмы и практические проекты' },
    { title: 'Node.js для профессионалов', categoryId: categories[0].id, level: CourseLevel.ADVANCED, lessonsCount: 14, durationWeeks: 7, price: 1400, format: LearningFormat.ONLINE, shortDesc: 'Архитектура backend, REST API, базы данных и деплой' },
  ];

  const courses = await Promise.all(
    courseDefs.map((c) =>
      prisma.course.create({
        data: {
          ...c,
          description: `${c.shortDesc}. Практический курс образовательного центра Somon: живые занятия, домашние задания с проверкой преподавателем и итоговый проект в портфолио.`,
          maxStudents: 16,
          status: CourseStatus.PUBLISHED,
        },
      })
    )
  );

  const branches = [
    await prisma.branch.create({
      data: {
        name: 'Somon Education — филиал №1',
        address: 'г. Душанбе, пр. Рудаки 123',
        phone: '+992 37 123 45 67',
        workHours: 'Пн–Пт 9:00–19:00, Сб 10:00–16:00',
        description: 'Главный кампус: компьютерные классы и зона коворкинга.',
        classrooms: { create: ['101', '102', '203', '304'].map((n) => ({ name: `Аудитория ${n}`, capacity: 16 })) },
      },
      include: { classrooms: true },
    }),
    await prisma.branch.create({
      data: {
        name: 'Somon Education — филиал №2',
        address: 'г. Душанбе, ул. Айни 45',
        phone: '+992 37 765 43 21',
        workHours: 'Пн–Сб 10:00–20:00',
        description: 'Студия дизайна и переговорные для проектной работы.',
        classrooms: { create: ['11', '12'].map((n) => ({ name: `Аудитория ${n}`, capacity: 12 })) },
      },
      include: { classrooms: true },
    }),
  ];

  // draft + archived for demo variety
  await prisma.course.create({
    data: {
      title: 'Мобильная разработка (черновик)',
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
  const lessonTopics = ['Введение', 'Основы', 'Практикум', 'Углубление', 'Проект', 'Итоги'];
  for (const [gi, group] of groups.slice(0, 5).entries()) {
    const branch = branches[gi % 2];
    for (let i = 0; i < 6; i++) {
      const start = days(-20 + i * 7 + gi);
      start.setHours(10 + ((i + gi) % 4) * 2, 0, 0, 0);
      if (gi === 0 && i === 3) {
        // guarantees an upcoming lesson "today" for dashboard / reminder demos
        start.setTime(now.getTime() + 2 * 3600000);
        start.setMinutes(0, 0, 0);
      }
      const end = new Date(start.getTime() + 90 * 60000);
      const online = (i + gi) % 2 === 1;
      const classroom = branch.classrooms[i % branch.classrooms.length];
      const lesson = await prisma.lesson.create({
        data: {
          groupId: group.id,
          teacherId: group.teacherId,
          title: `${lessonTopics[i]} — ${courseDefs[gi].title}`,
          startsAt: start,
          endsAt: end,
          format: online ? LearningFormat.ONLINE : LearningFormat.OFFLINE,
          meetingUrl: online ? 'https://meet.google.com/somon-demo' : null,
          branchId: online ? null : branch.id,
          classroomId: online ? null : classroom.id,
          room: online ? null : classroom.name,
          status: i < 3 ? LessonStatus.COMPLETED : LessonStatus.SCHEDULED,
        },
      });
      lessons.push(lesson);
    }
  }

  // Materials
  for (const [ci, course] of courses.slice(0, 5).entries()) {
    const group = groups[ci];
    const author = teacherUsers.find((t) => t.teacher!.id === group.teacherId) ?? teacherUsers[0];
    for (let i = 0; i < 4; i++) {
      await prisma.material.create({
        data: {
          courseId: course.id,
          groupId: group.id,
          title: `Урок ${i + 1}. ${lessonTopics[i]} — ${course.title}`,
          description: 'Конспект урока, примеры и ссылки для самостоятельной подготовки.',
          topic: lessonTopics[i],
          type: i === 1 ? MaterialType.VIDEO : i === 3 ? MaterialType.LINK : MaterialType.NOTE,
          videoUrl: i === 1 ? 'https://www.youtube.com/watch?v=W6NZfCO5SIk' : null,
          linkUrl: i === 3 ? 'https://developer.mozilla.org/ru/' : null,
          sortOrder: i,
          authorId: author.id,
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
          attemptCount: 1,
          attempts: {
            create: { number: 1, text: 'Мой ответ на задание Somon', submittedAt: days(-2) },
          },
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
        linkUrl: item.type === 'LINK' ? 'https://git-scm.com/book/ru/v2' : null,
      },
    });
  }
  await prisma.publicMaterial.create({
    data: {
      title: 'Видео: JavaScript за час',
      description: 'Вводная видеолекция по JavaScript для самостоятельного изучения.',
      category: 'Программирование',
      type: MaterialType.VIDEO,
      level: CourseLevel.BEGINNER,
      videoUrl: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
      authorId: admin.id,
    },
  });
  await prisma.publicMaterial.create({
    data: {
      title: 'Чек-лист итогового проекта (для студентов Web-разработки)',
      description: 'Требования к итоговому проекту курса. Доступно только студентам курса.',
      category: 'Программирование',
      type: MaterialType.NOTE,
      level: CourseLevel.BEGINNER,
      isPublic: false,
      courseId: courses[0].id,
      authorId: admin.id,
    },
  });

  // Public news
  const newsDefs = [
    { title: 'Открыт набор в группу Web-разработки', category: 'Набор в группы', summary: 'Стартуем новую группу по Web-разработке: HTML, CSS, JavaScript и React.', daysAgo: 2 },
    { title: 'Новый курс Data Analytics', category: 'Новые курсы', summary: 'Запускаем курс по анализу данных: таблицы, SQL-основы и визуализация.', daysAgo: 6 },
    { title: 'День открытых дверей в Somon', category: 'Мероприятия', summary: 'Приглашаем познакомиться с преподавателями, посмотреть аудитории и пройти пробное занятие.', daysAgo: 10 },
    { title: 'Выпускники UI/UX Design защитили проекты', category: 'Достижения студентов', summary: 'Студенты представили прототипы мобильных приложений для реальных заказчиков.', daysAgo: 18 },
  ];
  for (const n of newsDefs) {
    await prisma.news.create({
      data: {
        title: n.title,
        summary: n.summary,
        body: `${n.summary}\n\nПодробности можно узнать у администратора Somon по телефону или в любом из наших филиалов. Следите за новостями центра!`,
        category: n.category,
        isPublished: true,
        publishedAt: days(-n.daysAgo),
        authorId: admin.id,
      },
    });
  }
  await prisma.news.create({
    data: {
      title: 'Черновик: летний интенсив',
      body: 'Новость в работе, не опубликована.',
      category: 'Новости центра',
      isPublished: false,
      authorId: admin.id,
    },
  });

  await prisma.siteSetting.createMany({
    data: [
      { key: 'social.instagram', value: 'https://instagram.com/' },
      { key: 'social.telegram', value: 'https://t.me/' },
    ],
  });

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
