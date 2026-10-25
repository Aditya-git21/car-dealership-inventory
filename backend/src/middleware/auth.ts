import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from '../errors';
import { JWT_SECRET } from '../config';

// 401 = "I don't know who you are". Runs before protected routes.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required');
  }

  let payload: jwt.JwtPayload;
  try {
    // verify() checks the signature AND the expiry
    payload = jwt.verify(header.slice(7).trim(), JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  if (typeof payload.id !== 'number' || (payload.role !== 'USER' && payload.role !== 'ADMIN')) {
    throw new HttpError(401, 'Invalid token');
  }

  res.locals.user = { id: payload.id, role: payload.role };
  next();
}

// 403 = "I know who you are, but you're not allowed". Always runs after authenticate.
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.user?.role !== 'ADMIN') {
    throw new HttpError(403, 'Admin access required');
  }
  next();
}
