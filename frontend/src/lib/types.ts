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
  position?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  createdAt?: string;
}

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export type PersonRef = {
  id?: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  email?: string;
};

export type PublicTeacherRef = {
  id: string;
  specialization?: string | null;
  position?: string | null;
  user: PersonRef;
};

export type PublicCourse = {
  id: string;
  title: string;
  shortDesc?: string | null;
  description?: string | null;
  level: string;
  format: string;
  durationWeeks?: number | null;
  lessonsCount?: number | null;
  price?: number | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
  teachers: PublicTeacherRef[];
  groups: {
    id: string;
    code: string;
    name?: string | null;
    status: string;
    capacity: number;
    format: string;
    startDate?: string | null;
    endDate?: string | null;
    seatsLeft: number;
    teacher?: PublicTeacherRef | null;
    _count: { groupStudents: number };
  }[];
};

export type PublicTeacher = {
  id: string;
  specialization?: string | null;
  position?: string | null;
  bio?: string | null;
  user: PersonRef;
  courses: { id: string; title: string }[];
};

export type NewsItem = {
  id: string;
  title: string;
  summary?: string | null;
  body?: string;
  category: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  isPublished?: boolean;
};

export type PublicMaterial = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  type: string;
  level: string;
  fileUrl?: string | null;
  fileName?: string | null;
  linkUrl?: string | null;
  videoUrl?: string | null;
  isPublic: boolean;
  publishedAt: string;
  author?: { firstName: string; lastName: string } | null;
};

export type Branch = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  description?: string | null;
  workHours?: string | null;
  _count?: { classrooms: number };
};

export type SiteSettings = Record<string, string>;

export type PublicStat = { key: string; label: string; value: string };
