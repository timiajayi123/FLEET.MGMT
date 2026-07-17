const { randomBytes, randomUUID, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const { Client } = require('pg');

const scrypt = promisify(scryptCallback);
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://fleet:timileyin12@localhost:5432/fleet_management?schema=public';
const TEMP_PASSWORD = 'Nmdpra@2026';

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

async function one(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] || null;
}

async function upsertUser(client, input) {
  const passwordHash = await hashPassword(TEMP_PASSWORD);
  const existing = await one(client, 'select id from users where email=$1 or "employeeId"=$2 limit 1', [
    input.email,
    input.employeeId,
  ]);
  if (existing) {
    return one(
      client,
      `update users set
        email=$1,
        "passwordHash"=$2,
        "staffName"=$3,
        "employeeId"=$4,
        phone=$5,
        status='ACTIVE',
        "roleId"=$6,
        "locationId"=$7,
        "directorateId"=$8,
        "departmentId"=$9,
        "unitId"=$10,
        "updatedAt"=now()
      where id=$11
      returning id,email,"staffName","employeeId"`,
      [
        input.email,
        passwordHash,
        input.staffName,
        input.employeeId,
        input.phone,
        input.roleId,
        input.locationId,
        input.directorateId,
        input.departmentId,
        input.unitId,
        existing.id,
      ],
    );
  }
  return one(
    client,
    `insert into users (
      id,email,"passwordHash","staffName","employeeId",phone,status,"roleId",
      "locationId","directorateId","departmentId","unitId","createdAt","updatedAt"
    ) values ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$10,$11,now(),now())
    returning id,email,"staffName","employeeId"`,
    [
      randomUUID(),
      input.email,
      passwordHash,
      input.staffName,
      input.employeeId,
      input.phone,
      input.roleId,
      input.locationId,
      input.directorateId,
      input.departmentId,
      input.unitId,
    ],
  );
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    const roles = Object.fromEntries(
      (
        await client.query(
          `select id,code from roles where code in ('S_ADMIN','DRIVER','ST') and status='ACTIVE'`,
        )
      ).rows.map((role) => [role.code, role.id]),
    );
    for (const code of ['S_ADMIN', 'DRIVER', 'ST']) {
      if (!roles[code]) throw new Error(`Missing active role: ${code}`);
    }

    const location = await one(
      client,
      `select id from locations where status='ACTIVE' order by "sortOrder", name limit 1`,
    );
    const directorate = await one(
      client,
      `select id from directorates where status='ACTIVE' order by "sortOrder", name limit 1`,
    );
    const department = directorate
      ? await one(
          client,
          `select id from departments where status='ACTIVE' and "directorateId"=$1 order by "sortOrder", name limit 1`,
          [directorate.id],
        )
      : null;
    const unit = department
      ? await one(
          client,
          `select id from units where status='ACTIVE' and "departmentId"=$1 order by "sortOrder", name limit 1`,
          [department.id],
        )
      : null;

    const commonOrg = {
      locationId: location?.id || null,
      directorateId: directorate?.id || null,
      departmentId: department?.id || null,
      unitId: unit?.id || null,
    };

    const users = [];
    users.push(
      await upsertUser(client, {
        email: 'admin@nmdpra.gov.ng',
        staffName: 'Test Super Admin',
        employeeId: 'NMDPRA-ADMIN-001',
        phone: '08000000001',
        roleId: roles.S_ADMIN,
        ...commonOrg,
      }),
    );
    users.push(
      await upsertUser(client, {
        email: 'driver@nmdpra.gov.ng',
        staffName: 'Test Driver',
        employeeId: 'NMDPRA-DRV-001',
        phone: '08000000002',
        roleId: roles.DRIVER,
        ...commonOrg,
      }),
    );
    users.push(
      await upsertUser(client, {
        email: 'staff@nmdpra.gov.ng',
        staffName: 'Test Staff User',
        employeeId: 'NMDPRA-STF-001',
        phone: '08000000003',
        roleId: roles.ST,
        ...commonOrg,
      }),
    );

    let driver = await one(client, 'select id from drivers where "employeeId"=$1', [
      'NMDPRA-DRV-001',
    ]);
    if (!driver) {
      driver = await one(
        client,
        `insert into drivers (
          id,"staffName","employeeId",phone,email,"licenceNumber","licenceClass",status,"locationId","createdAt","updatedAt"
        ) values ($1,'Test Driver','NMDPRA-DRV-001','08000000002','driver@nmdpra.gov.ng','TEST-DRV-001','D','AVAILABLE',$2,now(),now())
        returning id`,
        [randomUUID(), location?.id || null],
      );
    }

    const allocation = await one(
      client,
      `select id from vehicle_allocations where "driverId"=$1 and status='ACTIVE' limit 1`,
      [driver.id],
    );
    if (!allocation) {
      const vehicle = await one(
        client,
        `select id from vehicles where status='AVAILABLE' order by "registrationNumber" limit 1`,
      );
      if (vehicle) {
        await one(
          client,
          `insert into vehicle_allocations (
            id,"vehicleId","driverId",purpose,destination,"startAt","expectedEndAt",status,notes,"createdAt","updatedAt"
          ) values ($1,$2,$3,'Driver test allocation',$4,now(),now()+interval '1 day','ACTIVE','Created for role permission testing.',now(),now())
          returning id`,
          [randomUUID(), vehicle.id, driver.id, location ? 'Test route' : 'Field route'],
        );
        await client.query(`update vehicles set status='IN_USE',"updatedAt"=now() where id=$1`, [
          vehicle.id,
        ]);
        await client.query(`update drivers set status='ASSIGNED',"updatedAt"=now() where id=$1`, [
          driver.id,
        ]);
      }
    }

    await client.query('commit');
    console.table(users);
    console.log(`Temporary password for all three users: ${TEMP_PASSWORD}`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
