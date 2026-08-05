const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

function databaseConfig() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((row) => row.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing from backend/.env');
  const connectionString = line.slice('DATABASE_URL='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  const parts = connectionString.replace(/^sqlserver:\/\//, '').split(';');
  const [hostPart, ...parameters] = parts;
  const [server, port] = hostPart.split(':');
  const values = Object.fromEntries(parameters.filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    const key = part.slice(0, separator).trim().toLowerCase();
    const raw = part.slice(separator + 1).trim();
    return [key, raw.startsWith('{') && raw.endsWith('}') ? raw.slice(1, -1) : raw];
  }));
  return {
    server,
    ...(port ? { port: Number(port) } : {}),
    database: values.database,
    user: values.user ?? values.username,
    password: values.password,
    options: {
      encrypt: values.encrypt?.toLowerCase() === 'true',
      trustServerCertificate: values.trustservercertificate?.toLowerCase() === 'true',
    },
  };
}

async function main() {
  const pool = await sql.connect(databaseConfig());
  const targets = (await pool.request().query(`
    SELECT d.id, d.code, d.name, d.status,
      (SELECT COUNT(*) FROM dbo.departments p WHERE p.directorateId = d.id) AS departmentCount,
      (SELECT COUNT(*) FROM dbo.users u WHERE u.directorateId = d.id) AS userCount,
      (SELECT COUNT(*) FROM dbo.vehicle_requests r WHERE r.directorateId = d.id) AS requestCount,
      (SELECT COUNT(*) FROM dbo.fuel_budgets b WHERE b.directorateId = d.id) AS budgetCount,
      (SELECT COUNT(*) FROM dbo.trips t
        JOIN dbo.vehicle_requests r ON r.id = t.requestId
        WHERE r.directorateId = d.id
          AND ROUND(COALESCE(t.calculatedDistance, 0), 1) = 5.5) AS retainedTripCount
    FROM dbo.directorates d
    WHERE UPPER(d.name) IN ('HUMAN RESOURCES', 'INFORMATION AND COMMUNICATION TECH')
    ORDER BY d.name
  `)).recordset;
  const fallbacks = (await pool.request().query(`
    SELECT id, code, name
    FROM dbo.directorates
    WHERE UPPER(name) NOT IN ('HUMAN RESOURCES', 'INFORMATION AND COMMUNICATION TECH')
      AND status = 'ACTIVE'
    ORDER BY sortOrder, name
  `)).recordset;

  console.log(JSON.stringify({
    mode: process.argv.includes('--apply') ? 'apply' : 'preview',
    targets,
    fallback: fallbacks[0] ?? null,
  }, null, 2));
  if (!process.argv.includes('--apply')) {
    await pool.close();
    return;
  }
  if (targets.length !== 2) throw new Error(`Expected 2 target directorates, found ${targets.length}. No changes made.`);
  if (!fallbacks.length) throw new Error('No active fallback directorate exists for preserving linked requests.');

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = new sql.Request(transaction);
    request.input('fallbackId', sql.UniqueIdentifier, fallbacks[0].id);
    const result = (await request.query(`
      DECLARE @targets TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @targets (id)
      SELECT id FROM dbo.directorates
      WHERE UPPER(name) IN ('HUMAN RESOURCES', 'INFORMATION AND COMMUNICATION TECH');

      DECLARE @departments TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @departments (id)
      SELECT id FROM dbo.departments WHERE directorateId IN (SELECT id FROM @targets);

      UPDATE dbo.users SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @departments);
      UPDATE dbo.users SET directorateId = NULL
      WHERE directorateId IN (SELECT id FROM @targets);
      DECLARE @detachedUsers int = @@ROWCOUNT;

      UPDATE dbo.vehicle_requests SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @departments);
      UPDATE dbo.vehicle_requests SET directorateId = @fallbackId
      WHERE directorateId IN (SELECT id FROM @targets);
      DECLARE @movedRequests int = @@ROWCOUNT;

      UPDATE dbo.fuel_budgets SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @departments);
      UPDATE dbo.fuel_budgets SET directorateId = NULL
      WHERE directorateId IN (SELECT id FROM @targets);
      DECLARE @detachedBudgets int = @@ROWCOUNT;

      DELETE FROM dbo.departments WHERE id IN (SELECT id FROM @departments);
      DECLARE @deletedDepartments int = @@ROWCOUNT;
      DELETE FROM dbo.directorates WHERE id IN (SELECT id FROM @targets);
      DECLARE @deletedDirectorates int = @@ROWCOUNT;

      SELECT @detachedUsers AS detachedUsers, @movedRequests AS movedRequests,
             @detachedBudgets AS detachedBudgets, @deletedDepartments AS deletedDepartments,
             @deletedDirectorates AS deletedDirectorates;
    `)).recordset[0];
    await transaction.commit();
    console.log(JSON.stringify({ applied: { fallback: fallbacks[0], ...result } }, null, 2));
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
