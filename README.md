# Somon

Веб-приложение для управления образовательным центром **Somon**.

Студенты работают с курсами, расписанием, материалами, заданиями, оценками и прогрессом.  
Преподаватели ведут группы, посещаемость, задания и аналитику.  
Администраторы управляют пользователями, курсами, группами и расписанием.

## Стек

- **Frontend:** Next.js 15 (App Router), TypeScript, CSS
- **Backend:** Node.js, Express, Prisma
- **БД:** SQLite (по умолчанию, без Docker) · опционально PostgreSQL через Docker Compose
- **Auth:** JWT в httpOnly cookie

## Требования

- Node.js 20+
- npm 10+
- (опционально) Docker для PostgreSQL

## Быстрый старт

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: http://localhost:4000  
Health: http://localhost:4000/api/health

### 2. Frontend

```bash
cd frontend
# .env.local уже содержит NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

Приложение: http://localhost:3000

## Демо-аккаунты

Пароль для всех: `Somon123!`

| Роль | Email |
|------|-------|
| Администратор | `admin@somon.local` |
| Преподаватель | `teacher1@somon.local` |
| Студент | `student1@somon.local` |

Также: `teacher2@…`–`teacher4@…`, `student2@…`–`student16@…`.

## Сценарий демонстрации (защита)

1. Войти как `admin@somon.local` — Dashboard и статистика.
2. Открыть **Курсы** и **Группы**, показать преподавателя и студентов.
3. Открыть **Расписание**.
4. Войти как `teacher1@somon.local` — открыть группу, отметить посещаемость.
5. Создать задание и материал во вкладках группы.
6. Войти как `student1@somon.local` — увидеть задание, расписание, материал, прогресс.
7. Отправить ответ на задание.
8. Вернуться к преподавателю — проверить ответ и выставить оценку.
9. Вернуться к студенту — оценка, уведомление, обновлённый прогресс.

## Переменные окружения (backend)

См. `backend/.env.example`.

Для PostgreSQL:

1. `docker compose up -d`
2. В `backend/.env`: `DATABASE_URL="postgresql://somon:somon@localhost:5432/somon?schema=public"`
3. В `prisma/schema.prisma` сменить `provider` на `postgresql`
4. `npx prisma db push && npm run db:seed`

## Структура

```
somon/
  backend/     Express API + Prisma + seed
  frontend/    Next.js UI
  docs/        ER, API, права, диаграммы
  docker-compose.yml
  README.md
```

## Формула прогресса

`0.4 × %завершённых занятий + 0.4 × %выполненных заданий + 0.2 × %посещаемости`

Опоздание и уважительная причина считаются присутствием.

## Документация

- [Архитектура и ER](docs/architecture.md)
- [API](docs/api.md)
- [Роли и права](docs/access.md)
- [Сценарии тестирования](docs/test-scenarios.md)

## Команды

```bash
# backend
npm run dev
npm run db:seed
npx prisma studio

# frontend
npm run dev
npm run build
```
