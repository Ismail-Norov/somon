# API Somon

Базовый URL: `http://localhost:4000/api`  
Auth: cookie `token` (httpOnly) или `Authorization: Bearer <token>`  
Ответ успеха: `{ "data": ... }`  
Ошибка: `{ "error": { "code": "...", "message": "..." } }`

## Auth

| Method | Path | Описание |
|--------|------|----------|
| POST | /auth/login | Вход |
| POST | /auth/register | Регистрация студента |
| POST | /auth/logout | Выход |
| GET | /auth/me | Текущий пользователь |

## Основные ресурсы

| Группа | Пути |
|--------|------|
| Users | GET/POST /users, PATCH /users/:id, PATCH /users/:id/archive, PATCH /users/me/profile |
| Courses | GET /courses/public, GET/POST /courses, PATCH /courses/:id, PATCH /courses/:id/archive |
| Groups | GET/POST /groups, PATCH /groups/:id, POST /groups/:id/students, POST /groups/:id/enroll |
| Lessons | GET/POST /lessons, PATCH /lessons/:id |
| Attendance | GET /attendance, POST /attendance/bulk, PATCH /attendance/:id |
| Grades | GET/POST /grades, PATCH /grades/:id |
| Assignments | GET/POST /assignments, PATCH /assignments/:id, POST /assignments/:id/submissions |
| Materials | GET/POST /materials, PATCH/DELETE /materials/:id |
| Notifications | GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all |
| Analytics | GET /analytics/student, /analytics/student/course/:id, /analytics/teacher, /analytics/teacher/group/:id, /analytics/admin |
| Uploads | POST /uploads |

Все защищённые маршруты требуют активную сессию. Права дополнительно проверяются по роли и принадлежности к группе.
