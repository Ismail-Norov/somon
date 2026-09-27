'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, fullName, statusLabel } from '@/lib/format';

type GroupData = {
  group: {
    id: string;
    code: string;
    courseId: string;
    course: { title: string };
    groupStudents: { studentId: string; student: { id: string; user: { firstName: string; lastName: string } } }[];
    lessons: { id: string; title: string; startsAt: string; status: string }[];
    assignments: { id: string; title: string; deadline?: string; status: string }[];
  };
  analytics: {
    averageGrade: number | null;
    attendancePercent: number;
    gradeDistribution: Record<string, number>;
  };
  materials: { id: string; title: string; type: string }[];
};

const tabs = ['Обзор', 'Студенты', 'Посещаемость', 'Оценки', 'Задания', 'Материалы', 'Расписание', 'Аналитика'];

export default function TeacherGroupWorkspace() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<GroupData>(`/api/analytics/teacher/group/${params.id}`);
  const [tab, setTab] = useState('Обзор');
  const [lessonId, setLessonId] = useState('');
  const [attMap, setAttMap] = useState<Record<string, string>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradingAssignmentId, setGradingAssignmentId] = useState('');
  const [materialOpen, setMaterialOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [assignForm, setAssignForm] = useState({
    title: '',
    description: '',
    deadline: '',
    maxScore: 5,
    file: null as File | null,
  });
  const [materialForm, setMaterialForm] = useState({ 
    title: '', 
    description: '', 
    topic: '', 
    type: 'NOTE',
    file: null as File | null,
    videoUrl: ''
  });
  const [submissions, setSubmissions] = useState<
    { id: string; status: string; studentId: string; student: { user: { firstName: string; lastName: string } }; text?: string; grade?: { score: number } }[]
  >([]);

  const completedLessons = useMemo(
    () => data?.group.lessons.filter((l) => l.status === 'COMPLETED' || l.status === 'SCHEDULED') || [],
    [data]
  );

  async function saveAttendance() {
    if (!lessonId) return;
    setMsg('');
    try {
      await api('/api/attendance/bulk', {
        method: 'POST',
        json: {
          lessonId,
          items: Object.entries(attMap).map(([studentId, status]) => ({ studentId, status })),
        },
      });
      setMsg('Посещаемость сохранена');
      reload();
    } catch (e) {
      setMsg(e instanceof ApiRequestError ? e.message : 'Ошибка');
    }
  }

  async function createAssignment(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    try {
      let attachmentUrl = null;
      let fileName = null;

      if (assignForm.file) {
        const formData = new FormData();
        formData.append('file', assignForm.file);
        const uploadResponse = await api<{ fileUrl: string; fileName: string }>('/api/uploads/assignment', {
          method: 'POST',
          body: formData,
        });
        attachmentUrl = uploadResponse.fileUrl;
        fileName = uploadResponse.fileName;
      }

      await api('/api/assignments', {
        method: 'POST',
        json: {
          courseId: data.group.courseId,
          groupId: data.group.id,
          title: assignForm.title,
          description: assignForm.description,
          deadline: assignForm.deadline ? new Date(assignForm.deadline).toISOString() : null,
          maxScore: Number(assignForm.maxScore),
          status: 'PUBLISHED',
          attachmentUrl,
        },
      });
      setAssignOpen(false);
      setAssignForm({ title: '', description: '', deadline: '', maxScore: 5, file: null });
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  async function loadSubmissions(assignmentId: string) {
    const a = await api<{
      submissions: typeof submissions;
    }>(`/api/assignments/${assignmentId}`);
    setSubmissions(a.submissions || []);
  }

  async function createMaterial(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    try {
      let fileUrl = null;
      let fileName = null;

      if (materialForm.file) {
        const formData = new FormData();
        formData.append('file', materialForm.file);
        const uploadResponse = await api<{ fileUrl: string; fileName: string }>('/api/uploads/material', {
          method: 'POST',
          body: formData,
        });
        fileUrl = uploadResponse.fileUrl;
        fileName = uploadResponse.fileName;
      }

      await api('/api/materials', {
        method: 'POST',
        json: {
          courseId: data.group.courseId,
          groupId: data.group.id,
          title: materialForm.title,
          description: materialForm.description,
          topic: materialForm.topic,
          type: materialForm.type,
          fileUrl,
          fileName,
        },
      });
      setMaterialOpen(false);
      setMaterialForm({ title: '', description: '', topic: '', type: 'NOTE', file: null, videoUrl: '' });
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Не найдено'} onRetry={reload} />;

  const g = data.group;

  return (
    <div>
      <h1 className="page-title">{g.code}</h1>
      <p className="page-sub">{g.course.title}</p>
      {msg && <p className="error-text">{msg}</p>}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} type="button" onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Обзор' && (
        <div className="grid grid-3">
          <div className="card">
            <div className="stat-label">Студенты</div>
            <div className="stat-value">{g.groupStudents.length}</div>
          </div>
          <div className="card">
            <div className="stat-label">Средняя оценка</div>
            <div className="stat-value">{data.analytics.averageGrade ?? '—'}</div>
          </div>
          <div className="card">
            <div className="stat-label">Посещаемость</div>
            <div className="stat-value">{data.analytics.attendancePercent}%</div>
          </div>
        </div>
      )}

      {tab === 'Студенты' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Имя</th>
              </tr>
            </thead>
            <tbody>
              {g.groupStudents.map((s) => (
                <tr key={s.studentId}>
                  <td>{fullName(s.student.user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Посещаемость' && (
        <div className="card stack">
          <Field label="Занятие">
            <Select
              value={lessonId}
              onChange={(e) => {
                setLessonId(e.target.value);
                const initial: Record<string, string> = {};
                g.groupStudents.forEach((s) => {
                  initial[s.studentId] = 'PRESENT';
                });
                setAttMap(initial);
              }}
            >
              <option value="">Выберите занятие</option>
              {completedLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} · {formatDateTime(l.startsAt)}
                </option>
              ))}
            </Select>
          </Field>
          {lessonId &&
            g.groupStudents.map((s) => (
              <div className="row space-between" key={s.studentId}>
                <span>{fullName(s.student.user)}</span>
                <Select
                  value={attMap[s.studentId] || 'PRESENT'}
                  onChange={(e) => setAttMap({ ...attMap, [s.studentId]: e.target.value })}
                  style={{ maxWidth: 200 }}
                >
                  <option value="PRESENT">Присутствовал</option>
                  <option value="ABSENT">Отсутствовал</option>
                  <option value="LATE">Опоздал</option>
                  <option value="EXCUSED">Уважительно</option>
                </Select>
              </div>
            ))}
          <Button onClick={saveAttendance} disabled={!lessonId}>
            Сохранить посещаемость
          </Button>
        </div>
      )}

      {tab === 'Оценки' && (
        <div className="card stack">
          <p>Выберите задание, откройте ответы и выставьте оценку.</p>
          {g.assignments.map((a) => (
            <div className="row space-between" key={a.id}>
              <span>
                {a.title} · до {formatDateTime(a.deadline)}
              </span>
              <Button
                variant="secondary"
                onClick={async () => {
                  setGradingAssignmentId(a.id);
                  await loadSubmissions(a.id);
                  setGradeOpen(true);
                }}
              >
                Проверить
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'Задания' && (
        <div className="stack">
          <Button onClick={() => setAssignOpen(true)}>Создать задание</Button>
          {g.assignments.map((a) => (
            <div className="card row space-between" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <p style={{ margin: 0 }}>до {formatDateTime(a.deadline)}</p>
              </div>
              <Badge>{statusLabel[a.status]}</Badge>
            </div>
          ))}
        </div>
      )}

      {tab === 'Материалы' && (
        <div className="stack">
          <Button onClick={() => setMaterialOpen(true)}>Добавить материал</Button>
          {data.materials.map((m) => (
            <div className="card row space-between" key={m.id}>
              <strong>{m.title}</strong>
              <Badge>{m.type}</Badge>
            </div>
          ))}
        </div>
      )}

      {tab === 'Расписание' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тема</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {g.lessons.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.startsAt)}</td>
                  <td>{l.title}</td>
                  <td>
                    <Badge>{statusLabel[l.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Аналитика' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Средняя оценка</h3>
            <div className="stat-value">{data.analytics.averageGrade ?? '—'}</div>
          </div>
          <div className="card">
            <h3>Посещаемость</h3>
            <div className="stat-value">{data.analytics.attendancePercent}%</div>
          </div>
          <div className="card">
            <h3>Распределение оценок</h3>
            <div className="stack">
              {Object.entries(data.analytics.gradeDistribution).map(([k, v]) => (
                <div key={k} className="row space-between">
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={assignOpen} title="Новое задание" onClose={() => setAssignOpen(false)}>
        <form onSubmit={createAssignment}>
          <Field label="Название">
            <Input
              required
              value={assignForm.title}
              onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
            />
          </Field>
          <Field label="Описание">
            <Textarea
              value={assignForm.description}
              onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
            />
          </Field>
          <Field label="Дедлайн">
            <Input
              type="datetime-local"
              value={assignForm.deadline}
              onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
            />
          </Field>
          <Field label="Макс. балл">
            <Input
              type="number"
              min={1}
              value={assignForm.maxScore}
              onChange={(e) => setAssignForm({ ...assignForm, maxScore: Number(e.target.value) })}
            />
          </Field>
          <Field label="Файл задания (опционально)">
            <Input
              type="file"
              onChange={(e) => setAssignForm({ ...assignForm, file: e.target.files?.[0] || null })}
            />
            <div className="hint">PDF, DOC, DOCX, ZIP до 10MB</div>
          </Field>
          <Button type="submit">Опубликовать</Button>
        </form>
      </Modal>

      <Modal open={gradeOpen} title="Проверка ответов" onClose={() => setGradeOpen(false)}>
        <div className="stack">
          {submissions
            .filter((s) => ['SUBMITTED', 'GRADED', 'OVERDUE', 'REVIEWING'].includes(s.status))
            .map((s) => (
              <div className="card" key={s.id}>
                <strong>{fullName(s.student.user)}</strong>
                <p>{s.text || 'Без текста'}</p>
                {s.grade && <Badge tone="success">Уже оценено: {s.grade.score}</Badge>}
                <form
                  className="row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    try {
                      await api('/api/grades', {
                        method: 'POST',
                        json: {
                          submissionId: s.id,
                          studentId: s.studentId,
                          score: Number(fd.get('score')),
                          comment: String(fd.get('comment') || ''),
                        },
                      });
                      await loadSubmissions(gradingAssignmentId);
                      reload();
                    } catch (err) {
                      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка оценки');
                    }
                  }}
                >
                  <Input name="score" type="number" min={0} max={5} defaultValue={s.grade?.score ?? 5} style={{ maxWidth: 90 }} required />
                  <Input name="comment" placeholder="Комментарий" defaultValue="" style={{ flex: 1 }} />
                  <Button type="submit">Оценить</Button>
                </form>
              </div>
            ))}
          {!submissions.filter((s) => ['SUBMITTED', 'GRADED', 'OVERDUE', 'REVIEWING'].includes(s.status)).length && (
            <p>Нет ответов</p>
          )}
        </div>
      </Modal>

      <Modal open={materialOpen} title="Новый материал" onClose={() => setMaterialOpen(false)}>
        <form onSubmit={createMaterial}>
          <Field label="Название">
            <Input
              required
              value={materialForm.title}
              onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
            />
          </Field>
          <Field label="Тема">
            <Input
              value={materialForm.topic}
              onChange={(e) => setMaterialForm({ ...materialForm, topic: e.target.value })}
            />
          </Field>
          <Field label="Описание">
            <Textarea
              value={materialForm.description}
              onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
            />
          </Field>
          <Field label="Тип">
            <Select
              value={materialForm.type}
              onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
            >
              <option value="NOTE">Заметка</option>
              <option value="PDF">PDF файл</option>
              <option value="LINK">Ссылка</option>
              <option value="VIDEO">Видео</option>
            </Select>
          </Field>
          {materialForm.type === 'PDF' && (
            <Field label="Файл материала">
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files?.[0] || null })}
              />
              <div className="hint">PDF до 10MB</div>
            </Field>
          )}
          {materialForm.type === 'VIDEO' && (
            <Field label="Ссылка на видео">
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={materialForm.videoUrl}
                onChange={(e) => setMaterialForm({ ...materialForm, videoUrl: e.target.value })}
              />
              <div className="hint">YouTube, Vimeo или другая ссылка на видео</div>
            </Field>
          )}
          {materialForm.type === 'LINK' && (
            <Field label="Ссылка">
              <Input
                type="url"
                placeholder="https://..."
                value={materialForm.videoUrl}
                onChange={(e) => setMaterialForm({ ...materialForm, videoUrl: e.target.value })}
              />
            </Field>
          )}
          <Button type="submit">Сохранить</Button>
        </form>
      </Modal>
    </div>
  );
}
