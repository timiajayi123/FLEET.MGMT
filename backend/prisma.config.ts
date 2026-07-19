import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'sqlserver://example.invalid:1433;database=fleet_management;user=fleet_user;password=placeholder;encrypt=true;trustServerCertificate=false;schema=dbo',
  },
});
