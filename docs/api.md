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
| GET | /auth/me | Текущий пользователь (`{ user }`) |

## Публичный сайт (без авторизации)

| Группа | Пути |
|--------|------|
| Public | GET /public/overview, /public/stats, /public/settings, /public/news, /public/news/:id, /public/materials, /public/contacts |
| Courses | GET /courses/public, /courses/public/meta, /courses/public/:id |
| Teachers | GET /teachers/public, /teachers/public/:id |

## Основные ресурсы

| Группа | Пути |
|--------|------|
| Users | GET/POST /users, GET/PATCH/DELETE /users/:id, PATCH /users/:id/archive, POST/DELETE /users/:id/photo (админ) |
| Профиль | GET/PATCH /users/me/profile, PATCH /users/me/password, POST/DELETE /users/me/photo |
| Teachers | GET /teachers, GET /teachers/:id (админ: группы, курсы, ближайшие занятия) |
| Courses | GET /courses/meta/categories, GET/POST /courses, GET/PATCH /courses/:id, PATCH /courses/:id/archive |
| Groups | GET/POST /groups, GET/PATCH /groups/:id, POST /groups/:id/students, DELETE /groups/:id/students/:studentId, GET /groups/:id/students/:studentId, POST /groups/:id/enroll |
| Lessons | GET/POST /lessons, GET/PATCH/DELETE /lessons/:id (проверка конфликтов аудитории/группы/преподавателя) |
| Branches | GET/POST /branches, PATCH/DELETE /branches/:id, POST /branches/:id/classrooms, PATCH/DELETE /branches/classrooms/:classroomId |
| Attendance | GET /attendance, POST /attendance/bulk, PATCH /attendance/:id |
| Grades | GET/POST /grades, PATCH /grades/:id |
| Assignments | GET/POST /assignments, GET/PATCH/DELETE /assignments/:id, POST /assignments/:id/submissions, GET /assignments/submissions/review, GET /assignments/submissions/:id, POST /assignments/submissions/:id/return, GET /assignments/meta/upload-rules |
| Materials | GET/POST /materials, GET/PATCH/DELETE /materials/:id |
| Files (защищённые) | GET /files/material-file/:fileId, /files/material/:materialId, /files/submission/:fileId, /files/submission-legacy/:submissionId, /files/assignment/:assignmentId |
| Uploads | GET /uploads/rules, POST /uploads, /uploads/assignment, /uploads/material, /uploads/public |
| Notifications | GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all |
| Analytics | GET /analytics/student, /analytics/student/course/:id, /analytics/teacher, /analytics/teacher/group/:id, /analytics/admin |
| Student | GET/POST /student/activity, GET /student/achievements, GET /student/library, GET/POST /student/announcements, DELETE /student/announcements/:id |
| Заявки на курсы | POST /student/applications (студент), GET /student/applications?status=, PATCH /student/applications/:id (админ; одобрение требует `groupId`) |
| News | GET/POST /news, PATCH/DELETE /news/:id (админ) |
| Материалы сайта | GET/POST /public-materials, PATCH/DELETE /public-materials/:id (админ; `isPublic` или доступ только студентам курса `courseId`) |
| Settings | GET /settings, PUT /settings (админ) |

Все защищённые маршруты требуют активную сессию. Права дополнительно проверяются по роли и принадлежности к группе.
Максимальный размер файла задаётся `MAX_FILE_SIZE_MB` (по умолчанию 20 МБ).
