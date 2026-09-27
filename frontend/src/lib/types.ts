export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  studentId?: string | null;
  teacherId?: string | null;
  phone?: string | null;
  specialization?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
}

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};
