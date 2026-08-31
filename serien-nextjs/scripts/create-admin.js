/**
 * Create or update an admin user from explicit environment variables.
 *
 * Required: ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional: ADMIN_NAME
 */

const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set explicitly');
  }
  if (password.length < 16) {
    throw new Error('ADMIN_PASSWORD must contain at least 16 characters');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await prisma.users.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: 'admin',
    },
    create: {
      id: randomUUID(),
      email,
      name,
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log(`Admin user is ready: ${admin.email} (${admin.id})`);
}

createAdminUser()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
