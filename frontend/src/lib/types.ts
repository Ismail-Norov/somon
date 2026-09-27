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

/* ---------- Cabinet (LMS) ---------- */

export type TeacherRef = { id: string; position?: string | null; specialization?: string | null; user: PersonRef };

export type LessonCard = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  format: 'ONLINE' | 'OFFLINE' | 'HYBRID' | string;
  status: string;
  room?: string | null;
  meetingUrl?: string | null;
  comment?: string | null;
  group: { id: string; code: string; format?: string; course: { id: string; title: string }; teacher?: TeacherRef | null };
  teacher?: TeacherRef | null;
  branch?: { id: string; name: string; address: string } | null;
  classroom?: { id: string; name: string } | null;
};

export type StoredFileInfo = { id: string; originalName: string; size: number; mimeType: string; createdAt?: string };

export type GradeInfo = {
  id: string;
  score: number;
  maxScore: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  teacher?: TeacherRef | null;
};

export type SubmissionAttempt = {
  id: string;
  number: number;
  text?: string | null;
  submittedAt: string;
  files: StoredFileInfo[];
};

export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  text?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  submittedAt?: string | null;
  status: string;
  attemptCount: number;
  feedback?: string | null;
  returnedAt?: string | null;
  grade?: GradeInfo | null;
  attempts?: SubmissionAttempt[];
  student?: { id: string; user: PersonRef };
};

export type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  criteria?: string | null;
  deadline?: string | null;
  publishAt?: string | null;
  maxScore: number;
  status: string;
  allowResubmit: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  courseId: string;
  groupId?: string | null;
  lessonId?: string | null;
  createdAt: string;
  course?: { id: string; title: string };
  group?: { id: string; code: string; teacher?: TeacherRef | null } | null;
  lesson?: { id: string; title: string; startsAt: string; endsAt?: string } | null;
  submissions?: Submission[];
  submission?: Submission | null;
  pendingReview?: number;
  _count?: { submissions: number };
};

export type Material = {
  id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  type: string;
  fileUrl?: string | null;
  fileName?: string | null;
  linkUrl?: string | null;
  videoUrl?: string | null;
  publishedAt: string;
  courseId?: string | null;
  groupId?: string | null;
  lessonId?: string | null;
  authorId?: string | null;
  course?: { id: string; title: string } | null;
  group?: { id: string; code: string } | null;
  lesson?: { id: string; title: string; startsAt?: string } | null;
  author?: PersonRef | null;
  files: StoredFileInfo[];
};

export type ProgressInfo = {
  progressPercent: number;
  lessonsPercent: number;
  assignmentsPercent: number;
  attendancePercent: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  assignmentsTotal: number;
  assignmentsDone: number;
  attendanceMarked: number;
  attendancePresent: number;
  averageGrade: number | null;
  overdueAssignments: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type ActivityItem = { id: string; type: string; title: string; meta?: string | null; createdAt: string };

export type UploadRules = { extensions: string[]; accept: string; maxFileMb: number; maxFiles?: number };

export type PublicStat = { key: string; label: string; value: string };
