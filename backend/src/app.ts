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
import filesRoutes from './routes/files';
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
  // Private files (submissions, assignment instructions, course materials) go through /api/files only.
  app.use(
    '/uploads',
    (req, res, next) => {
      let first = '';
      try {
        first = decodeURIComponent(req.path).replace(/\\/g, '/').split('/').filter(Boolean)[0] ?? '';
      } catch {
        return res.status(400).end();
      }
      // Windows ignores case and trailing dots/spaces in names, so normalise before comparing.
      if (first.toLowerCase().replace(/[.\s]+$/, '') === 'private') {
        return res.status(404).json({ error: { message: 'Файл не найден', code: 'FILE_NOT_FOUND' } });
      }
      next();
    },
    requireAuth,
    express.static(uploadDir, { dotfiles: 'deny', index: false })
  );

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
  app.use('/api/files', filesRoutes);
  app.use('/api/student', studentExtraRoutes);
  app.use('/api/teachers', teachersRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use(errorHandler);
  return app;
}
