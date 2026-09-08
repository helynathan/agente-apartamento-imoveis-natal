import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';

export async function authorizeCredentials(
  email: string | undefined,
  password: string | undefined
): Promise<{ id: string; email: string; name: string; role: string } | null> {
  if (!email || !password) return null;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
