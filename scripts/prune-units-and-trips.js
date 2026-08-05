const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

function readDatabaseUrl() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((value) => value.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing from backend/.env');
  const value = line.slice('DATABASE_URL='.length).trim();
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

function parseDatabaseUrl(connectionString) {
  const parts = connectionString.replace(/^sqlserver:\/\//, '').split(';');
  const [hostPart, ...parameters] = parts;
  const [server, port] = hostPart.split(':');
  const values = Object.fromEntries(
    parameters.filter(Boolean).map((part) => {
      const separator = part.indexOf('=');
      const key = part.slice(0, separator).trim().toLowerCase();
      const rawValue = part.slice(separator + 1).trim();
      const value = rawValue.startsWith('{') && rawValue.endsWith('}')
        ? rawValue.slice(1, -1)
        : rawValue;
      return [key, value];
    }),
  );
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
  const pool = await sql.connect(parseDatabaseUrl(readDatabaseUrl()));
  const trips = (
    await pool.request().query(`
      SELECT t.id, t.calculatedDistance, t.status, t.createdAt,
             v.registrationNumber, d.staffName
      FROM dbo.trips t
      JOIN dbo.vehicles v ON v.id = t.vehicleId
      JOIN dbo.drivers d ON d.id = t.driverId
      ORDER BY t.createdAt ASC
    `)
  ).recordset;
  const units = (
    await pool.request().query(`
      SELECT id, code, name, departmentId
      FROM dbo.units
      ORDER BY name ASC
    `)
  ).recordset;
  const keepCandidates = trips.filter(
    (trip) => Math.round((trip.calculatedDistance ?? 0) * 10) === 55,
  );

  console.log(
    JSON.stringify(
      {
        mode: process.argv.includes('--apply') ? 'apply' : 'preview',
        units,
        trips,
        keepCandidates: keepCandidates.map((trip) => trip.id),
      },
      null,
      2,
    ),
  );

  if (!process.argv.includes('--apply')) {
    await pool.close();
    return;
  }
  if (keepCandidates.length !== 1) {
    throw new Error(
      `Expected exactly one 5.5 km trip, but found ${keepCandidates.length}. No records were changed.`,
    );
  }

  const keepTripId = keepCandidates[0].id;
  const removeTripIds = trips.filter((trip) => trip.id !== keepTripId).map((trip) => trip.id);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let result;
  try {
    const request = new sql.Request(transaction);
    request.input('keepTripId', sql.UniqueIdentifier, keepTripId);
    result = (
      await request.query(`
        UPDATE dbo.users SET unitId = NULL WHERE unitId IS NOT NULL;
        DECLARE @detachedUsers int = @@ROWCOUNT;
        UPDATE dbo.vehicle_requests
          SET unitId = NULL, unit = '', customUnit = NULL
          WHERE unitId IS NOT NULL OR unit <> '' OR customUnit IS NOT NULL;
        DECLARE @detachedRequests int = @@ROWCOUNT;
        DELETE FROM dbo.units;
        DECLARE @deletedUnits int = @@ROWCOUNT;

        UPDATE dbo.fuel_entries SET tripId = NULL
          WHERE tripId IS NOT NULL AND tripId <> @keepTripId;
        DELETE FROM dbo.driver_current_locations
          WHERE tripId IS NOT NULL AND tripId <> @keepTripId;
        DELETE FROM dbo.driver_location_history
          WHERE tripId IS NOT NULL AND tripId <> @keepTripId;
        DELETE FROM dbo.trips WHERE id <> @keepTripId;
        DECLARE @deletedTrips int = @@ROWCOUNT;

        SELECT @detachedUsers AS detachedUsers,
               @detachedRequests AS detachedRequests,
               @deletedUnits AS deletedUnits,
               @deletedTrips AS deletedTrips;
      `)
    ).recordset[0];
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await pool.close();
  }

  console.log(JSON.stringify({ applied: { keepTripId, ...result } }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
