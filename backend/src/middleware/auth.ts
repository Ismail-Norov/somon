import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  studentId?: string;
  teacherId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'somon-dev-jwt-secret';

export function signToken(payload: { id: string; role: Role }) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { id: string; role: Role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token || extractBearer(req.headers.authorization);
    if (!token) throw new AppError('Требуется авторизация', 401, 'UNAUTHORIZED');

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { student: true, teacher: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Пользователь недоступен', 401, 'UNAUTHORIZED');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId: user.student?.id,
      teacherId: user.teacher?.id,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Сессия недействительна', 401, 'UNAUTHORIZED'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Требуется авторизация', 401, 'UNAUTHORIZED'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Недостаточно прав', 403, 'FORBIDDEN'));
    }
    next();
  };
}

function extractBearer(header?: string) {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie('token', { path: '/' });
}
