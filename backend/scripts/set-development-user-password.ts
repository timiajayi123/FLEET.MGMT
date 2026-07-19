import 'dotenv/config';
import { PrismaMssql } from '@prisma/adapter-mssql';

// Prisma 7's generated client and the password helper are loaded from the
// compiled backend, matching the development seed workflow.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../dist/generated/prisma/client.js') as typeof import('../generated/prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashPassword, verifyPassword } = require('../dist/src/auth/password.js') as typeof import('../src/auth/password');

const url = process.env.DATABASE_URL ?? '';
const email = process.env.DEV_TARGET_EMAIL?.trim().toLowerCase();
const password = process.env.DEV_NEW_PASSWORD;

if (!url.startsWith('sqlserver://localhost:1434') || !url.includes('database=fleet_management') || /postgresql:\/\/|neon/i.test(url)) {
  throw new Error('Password updates are restricted to localhost:1434/fleet_management.');
}
if (process.env.NODE_ENV === 'production') throw new Error('This utility cannot run in production.');
if (!email) throw new Error('DEV_TARGET_EMAIL is required.');
if (!password || password.length < 8) throw new Error('DEV_NEW_PASSWORD must contain at least 8 characters.');

const prisma = new PrismaClient({ adapter: new PrismaMssql(url, { schema: 'dbo' }) });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email }, select: { email: true } });
  if (!existing) throw new Error(`User ${email} was not found.`);

  const passwordHash = await hashPassword(password!);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  const verified = await verifyPassword(password!, passwordHash);
  console.log(JSON.stringify({ email, updated: true, verified }));
}

main().finally(() => prisma.$disconnect());
