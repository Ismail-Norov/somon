'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatDate, fullName, statusLabel } from '@/lib/format';

type Group = {
  id: string;
  code: string;
  status: string;
  capacity: number;
  startDate?: string;
  endDate?: string;
  course: { title: string };
  teacher?: { user: { firstName: string; lastName: string } };
  _count: { groupStudents: number };
};

type Course = { id: string; title: string };
type TeacherUser = { id: string; teacherId?: string; firstName: string; lastName: string; role: string };
type StudentUser = { id: string; studentId?: string; firstName: string; lastName: string; role: string };

export default function AdminGroupsPage() {
  const { data, loading, error, reload } = useApiData<Group[]>('/api/groups');
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [studentId, setStudentId] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    courseId: '',
    teacherId: '',
    capacity: 12,
    status: 'ENROLLMENT',
    startDate: '',
    endDate: '',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api<Course[]>('/api/courses'),
      api<TeacherUser[]>('/api/users?role=TEACHER'),
      api<StudentUser[]>('/api/users?role=STUDENT'),
    ]).then(([c, t, s]) => {
      setCourses(c);
      setTeachers(t);
      setStudents(s);
    });
  }, []);

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const teacher = teachers.find((t) => t.id === form.teacherId);
      await api('/api/groups', {
        method: 'POST',
        json: {
          code: form.code,
          name: form.name || form.code,
          courseId: form.courseId,
          teacherId: teacher?.teacherId || null,
          capacity: Number(form.capacity),
          status: form.status,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        },
      });
      setOpen(false);
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  async function addStudent(e: FormEvent) {
    e.preventDefault();
    if (!addOpen) return;
    const student = students.find((s) => s.id === studentId);
    if (!student?.studentId) {
      setMsg('Выберите студента');
      return;
    }
    try {
      await api(`/api/groups/${addOpen}/students`, {
        method: 'POST',
        json: { studentId: student.studentId },
      });
      setAddOpen(null);
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Группы</h1>
          <p className="page-sub">Формирование учебных групп</p>
        </div>
        <Button onClick={() => setOpen(true)}>Создать группу</Button>
      </div>
      {msg && <p className="error-text">{msg}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Код</th>
              <th>Курс</th>
              <th>Преподаватель</th>
              <th>Студенты</th>
              <th>Период</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((g) => (
              <tr key={g.id}>
                <td>{g.code}</td>
                <td>{g.course.title}</td>
                <td>{fullName(g.teacher?.user)}</td>
                <td>
                  {g._count.groupStudents}/{g.capacity}
                </td>
                <td>
                  {formatDate(g.startDate)} — {formatDate(g.endDate)}
                </td>
                <td>
                  <Badge>{statusLabel[g.status]}</Badge>
                </td>
                <td>
                  <Button variant="secondary" onClick={() => setAddOpen(g.id)}>
                    + студент
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Новая группа" onClose={() => setOpen(false)}>
        <form onSubmit={createGroup}>
          <Field label="Код">
            <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Курс">
            <Select required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Выберите</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Преподаватель">
            <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">Не назначен</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Вместимость">
            <Input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Статус">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="PLANNED">Планирование</option>
              <option value="ENROLLMENT">Набор</option>
              <option value="ACTIVE">Обучение</option>
            </Select>
          </Field>
          <Field label="Начало">
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Окончание">
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
          <Button type="submit">Создать</Button>
        </form>
      </Modal>

      <Modal open={!!addOpen} title="Добавить студента" onClose={() => setAddOpen(null)}>
        <form onSubmit={addStudent}>
          <Field label="Студент">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              <option value="">Выберите</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Добавить</Button>
        </form>
      </Modal>
    </div>
  );
}
