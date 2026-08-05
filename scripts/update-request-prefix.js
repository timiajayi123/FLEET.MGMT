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
  const before = (await pool.request().query(`
    SELECT requestNumber
    FROM dbo.vehicle_requests
    WHERE requestNumber LIKE 'FMR-%'
    ORDER BY createdAt
  `)).recordset;
  console.log(JSON.stringify({ matchingRequests: before.length, before }, null, 2));

  if (process.argv.includes('--apply') && before.length) {
    const result = await pool.request().query(`
      UPDATE dbo.vehicle_requests
      SET requestNumber = 'VR-' + SUBSTRING(requestNumber, 5, LEN(requestNumber))
      WHERE requestNumber LIKE 'FMR-%';
      SELECT @@ROWCOUNT AS updated;
    `);
    console.log(JSON.stringify({ applied: result.recordset[0] }, null, 2));
  }

  const remaining = (await pool.request().query(`
    SELECT COUNT(*) AS count
    FROM dbo.vehicle_requests
    WHERE requestNumber LIKE 'FMR-%'
  `)).recordset[0].count;
  const current = (await pool.request().query(`
    SELECT requestNumber
    FROM dbo.vehicle_requests
    ORDER BY createdAt
  `)).recordset;
  console.log(JSON.stringify({ remainingFmrRequests: remaining, current }, null, 2));
  await pool.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
