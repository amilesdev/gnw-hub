import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SUPERADMIN_NAME ?? 'GNW Admin';
  const email = (process.env.SUPERADMIN_EMAIL ?? 'admin@gnw.local').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD ?? 'changeme123';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { isSuperAdmin: true, role: 'leader', status: 'active' },
    create: {
      name,
      email,
      passwordHash,
      role: 'leader',
      section: 'Vocalist',
      part: 'Tenor',
      status: 'active',
      isSuperAdmin: true,
    },
  });

  console.log(`Seeded super-admin: ${admin.email} (leader, super-admin).`);
  console.log('Sign in with the SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD from your env.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
