import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { UserRole } from "./types";

export type SessionPayload = {
  username: string;
  role: UserRole;
  personName?: string;
};

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifySession(token: string, secret: string): SessionPayload {
  return jwt.verify(token, secret) as SessionPayload;
}

declare global {
  // eslint-disable-next-line no-var
  var __session: SessionPayload | undefined;
}

export type AuthedRequest = Request & { session?: SessionPayload };

export function authMiddleware(secret: string) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token = req.cookies?.session;
    if (!token) return next();
    try {
      req.session = verifySession(token, secret);
    } catch {
      // ignore invalid token
    }
    next();
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.session) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }
  next();
}

