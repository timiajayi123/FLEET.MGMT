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
    SELECT d.id, d.code, d.name, d.status, dr.name AS directorateName,
      (SELECT COUNT(*) FROM dbo.users u WHERE u.departmentId = d.id) AS userCount,
      (SELECT COUNT(*) FROM dbo.vehicle_requests r WHERE r.departmentId = d.id) AS requestCount,
      (SELECT COUNT(*) FROM dbo.fuel_budgets b WHERE b.departmentId = d.id) AS budgetCount,
      (SELECT COUNT(*) FROM dbo.trips t
        JOIN dbo.vehicle_requests r ON r.id = t.requestId
        WHERE r.departmentId = d.id
          AND ROUND(COALESCE(t.calculatedDistance, 0), 1) = 5.5) AS retainedTripCount
    FROM dbo.departments d
    JOIN dbo.directorates dr ON dr.id = d.directorateId
    WHERE (LOWER(d.name) = 't' AND UPPER(d.code) = 'IT')
       OR (LOWER(d.name) = 'siwes' AND UPPER(d.code) = 'SIWES')
    ORDER BY d.name
  `)).recordset;

  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', targets }, null, 2));
  if (!process.argv.includes('--apply')) {
    await pool.close();
    return;
  }
  if (!targets.length) throw new Error('Neither department still exists. No changes made.');

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = (await new sql.Request(transaction).query(`
      DECLARE @targets TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @targets (id)
      SELECT id FROM dbo.departments
      WHERE (LOWER(name) = 't' AND UPPER(code) = 'IT')
         OR (LOWER(name) = 'siwes' AND UPPER(code) = 'SIWES');

      UPDATE dbo.users SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @targets);
      DECLARE @users int = @@ROWCOUNT;

      UPDATE dbo.vehicle_requests
      SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @targets);
      DECLARE @requests int = @@ROWCOUNT;

      UPDATE dbo.fuel_budgets SET departmentId = NULL
      WHERE departmentId IN (SELECT id FROM @targets);
      DECLARE @budgets int = @@ROWCOUNT;

      DELETE FROM dbo.departments WHERE id IN (SELECT id FROM @targets);
      DECLARE @departments int = @@ROWCOUNT;

      SELECT @users AS detachedUsers, @requests AS detachedRequests,
             @budgets AS detachedBudgets, @departments AS deletedDepartments;
    `)).recordset[0];
    await transaction.commit();
    console.log(JSON.stringify({ applied: result }, null, 2));
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
