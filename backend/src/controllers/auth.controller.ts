import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function register(req: Request, res: Response) {
  const payload = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(payload.password, 10);

  return res.status(201).json({
    message: 'User registered. Persist to DB in user repository layer.',
    user: { fullName: payload.fullName, email: payload.email, passwordHash }
  });
}

export async function login(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);

  const token = jwt.sign(
    { sub: 'demo-user-id', role: 'USER' },
    process.env.JWT_SECRET ?? 'change-me',
    { expiresIn: '1d' }
  );

  return res.json({ message: `Logged in as ${email}`, token });
}
