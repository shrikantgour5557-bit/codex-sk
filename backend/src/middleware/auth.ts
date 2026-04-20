import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface AuthPayload {
  sub: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Missing access token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'change-me') as AuthPayload;
    (req as Request & { user?: AuthPayload }).user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return res.status(403).json({ message: 'Admin role required' });
  }
  return next();
}
