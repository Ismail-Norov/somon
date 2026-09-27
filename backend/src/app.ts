import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import coursesRoutes from './routes/courses';
import groupsRoutes from './routes/groups';
import lessonsRoutes from './routes/lessons';
import attendanceRoutes from './routes/attendance';
import gradesRoutes from './routes/grades';
import assignmentsRoutes from './routes/assignments';
import materialsRoutes from './routes/materials';
import notificationsRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';
import uploadsRoutes from './routes/uploads';
import studentExtraRoutes from './routes/student-extra';
import teachersRoutes from './routes/teachers';
import publicRoutes from './routes/public';
import newsRoutes from './routes/news';
import settingsRoutes from './routes/settings';
import { errorHandler } from './middleware/error';
import { requireAuth } from './middleware/auth';
import { ok } from './lib/errors';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  // Photos and public-site files are intentionally world-readable; everything else needs a session.
  app.use('/uploads/photos', express.static(path.join(uploadDir, 'photos')));
  app.use('/uploads/public', express.static(path.join(uploadDir, 'public')));
  app.use('/uploads', requireAuth, express.static(uploadDir));

  app.get('/api/health', (_req, res) => res.json(ok({ status: 'ok', name: 'Somon API' })));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/lessons', lessonsRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/grades', gradesRoutes);
  app.use('/api/assignments', assignmentsRoutes);
  app.use('/api/materials', materialsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/student', studentExtraRoutes);
  app.use('/api/teachers', teachersRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use(errorHandler);
  return app;
}
