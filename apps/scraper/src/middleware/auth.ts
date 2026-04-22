import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET;

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  if (!AUTH_SECRET) {
    console.error("[auth] AUTH_SECRET is not set");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  try {
    const secret = new TextEncoder().encode(AUTH_SECRET);
    await jwtVerify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
