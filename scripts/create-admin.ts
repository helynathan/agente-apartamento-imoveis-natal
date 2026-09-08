import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const email = parseArg('email');
  const password = parseArg('password');
  const name = parseArg('name');

  if (!email || !password || !name) {
    console.error('Uso: npm run create-admin -- --email=... --password=... --name="..."');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, name, role: 'ADMIN' },
    create: { email, passwordHash, name, role: 'ADMIN' },
  });

  console.log(`Admin criado/atualizado: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
