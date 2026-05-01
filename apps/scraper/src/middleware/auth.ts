import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

export async function verifyToken(token: string): Promise<void> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }

  const secret = new TextEncoder().encode(authSecret);
  await jwtVerify(token, secret);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  if (!process.env.AUTH_SECRET) {
    console.error("[auth] AUTH_SECRET is not set");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  try {
    await verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
