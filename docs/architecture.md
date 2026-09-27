# Архитектура Somon

```
Browser → Next.js (frontend) → Express API (backend) → SQLite/PostgreSQL
                              ↘ локальный uploads/
```

## Компоненты

- **frontend** — UI по ролям, клиентский auth-guard, формы на реальном API
- **backend** — REST API, JWT, проверка прав на сервере, бизнес-правила
- **database** — Prisma schema + seed
- **notifications** — записи в таблице `notifications`

## ER (логические сущности)

```
User 1—1 Student
User 1—1 Teacher
Course 1—N Group
Teacher 1—N Group
Group N—M Student (GroupStudent)
Group 1—N Lesson
Course 1—N Assignment / Material
Assignment 1—N Submission
Submission 1—0..1 Grade
Lesson 1—N Attendance
User 1—N Notification / AuditLog
```

## Диаграмма вариантов использования (кратко)

- Студент: вход, запись на курс, просмотр расписания/материалов, сдача заданий, просмотр оценок и прогресса
- Преподаватель: управление группой, посещаемость, задания, оценка работ, аналитика
- Администратор: CRUD пользователей/курсов/групп/расписания, статистика центра
