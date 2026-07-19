import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaMssql } from '@prisma/adapter-mssql';
// Prisma 7 generates TypeScript that imports .js specifiers. The development seed
// intentionally uses the same compiled artifacts as the running Nest application.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../dist/generated/prisma/client.js') as typeof import('../generated/prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashPassword } = require('../dist/src/auth/password.js') as typeof import('../src/auth/password');

const url = process.env.DATABASE_URL ?? '';
if (!url.startsWith('sqlserver://localhost:1434') || !url.includes('database=fleet_management') || /postgresql:\/\/|neon/i.test(url)) {
  throw new Error('Development seed is restricted to localhost:1434/fleet_management.');
}
if (process.env.NODE_ENV === 'production') throw new Error('Development seed cannot run in production.');

const prisma = new PrismaClient({ adapter: new PrismaMssql(url, { schema: 'dbo' }) });
const generated = () => `Nm${randomBytes(12).toString('base64url')}!7`;

async function ensureUser(email: string, employeeId: string, staffName: string, roleId: string, supplied?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, password: null };
  const password = supplied || generated();
  const user = await prisma.user.create({ data: { email, employeeId, staffName, roleId, status: 'ACTIVE', passwordHash: await hashPassword(password) } });
  return { user, password };
}

async function main() {
  const adminRole = await prisma.role.upsert({ where: { code: 'S_ADMIN' }, update: { status: 'ACTIVE' }, create: { code: 'S_ADMIN', name: 'System Administrator', isSystemRole: true, status: 'ACTIVE', sortOrder: 1 } });
  const driverRole = await prisma.role.upsert({ where: { code: 'DRIVER' }, update: { status: 'ACTIVE' }, create: { code: 'DRIVER', name: 'Driver', isSystemRole: true, status: 'ACTIVE', sortOrder: 4 } });
  const admin = await ensureUser('admin@nmdpra.gov.ng', 'NMDPRA-ADMIN-001', 'SYSTEM ADMINISTRATOR', adminRole.id, process.env.DEV_ADMIN_PASSWORD);
  const driverUser = await ensureUser('driver@nmdpra.gov.ng', 'NMDPRA-DRIVER-001', 'TEST DRIVER', driverRole.id, process.env.DEV_DRIVER_PASSWORD);
  const directorate = await prisma.directorate.upsert({ where: { code: 'DEV-OPS' }, update: {}, create: { code: 'DEV-OPS', name: 'Development Operations', description: 'Local test data', status: 'ACTIVE' } });
  const department = await prisma.department.upsert({ where: { code: 'DEV-TRANSPORT' }, update: {}, create: { code: 'DEV-TRANSPORT', name: 'Development Transport', directorateId: directorate.id, status: 'ACTIVE' } });
  const unit = await prisma.unit.upsert({ where: { code: 'DEV-FLEET' }, update: {}, create: { code: 'DEV-FLEET', name: 'Development Fleet Unit', departmentId: department.id, status: 'ACTIVE' } });
  const location = await prisma.location.upsert({ where: { code: 'DEV-ABUJA' }, update: { latitude: 9.0765, longitude: 7.3986 }, create: { code: 'DEV-ABUJA', name: 'Development Abuja Office', address: 'Central Area, Abuja', state: 'FCT', latitude: 9.0765, longitude: 7.3986, status: 'ACTIVE' } });
  const vehicleType = await prisma.vehicleType.upsert({ where: { code: 'DEV-SUV' }, update: {}, create: { code: 'DEV-SUV', name: 'Development SUV', passengerCapacity: 5, status: 'ACTIVE' } });
  const driverOne = await prisma.driver.upsert({ where: { employeeId: 'NMDPRA-DRIVER-001' }, update: { status: 'ASSIGNED', locationId: location.id }, create: { staffName: 'TEST DRIVER', employeeId: 'NMDPRA-DRIVER-001', phone: '08000000001', email: 'driver@nmdpra.gov.ng', category: 'PERMANENT STAFF', zone: 'NORTH CENTRAL', locationId: location.id, status: 'ASSIGNED' } });
  const driverTwo = await prisma.driver.upsert({ where: { employeeId: 'NMDPRA-DRIVER-002' }, update: { status: 'ASSIGNED' }, create: { staffName: 'DEMO RELIEF DRIVER', employeeId: 'NMDPRA-DRIVER-002', phone: '08000000002', email: 'driver2@nmdpra.gov.ng', category: 'OUTSOURCED', zone: 'NORTH CENTRAL', locationId: location.id, status: 'ASSIGNED' } });
  const vehicleOne = await prisma.vehicle.upsert({ where: { registrationNumber: 'DEV-FLEET-001' }, update: { status: 'ALLOCATED' }, create: { registrationNumber: 'DEV-FLEET-001', officialRegistrationNumber: 'DEV-FLEET-001', manufacturer: 'Toyota', model: 'Hilux', year: 2023, color: 'White', locationId: location.id, vehicleTypeId: vehicleType.id, status: 'ALLOCATED' } });
  const vehicleTwo = await prisma.vehicle.upsert({ where: { registrationNumber: 'DEV-FLEET-002' }, update: { status: 'ALLOCATED' }, create: { registrationNumber: 'DEV-FLEET-002', officialRegistrationNumber: 'DEV-FLEET-002', manufacturer: 'Ford', model: 'Ranger', year: 2022, color: 'Silver', locationId: location.id, vehicleTypeId: vehicleType.id, status: 'ALLOCATED' } });
  const vehicleThree = await prisma.vehicle.upsert({ where: { registrationNumber: 'DEV-FLEET-003' }, update: {}, create: { registrationNumber: 'DEV-FLEET-003', officialRegistrationNumber: 'DEV-FLEET-003', manufacturer: 'Mitsubishi', model: 'Pajero', year: 2021, color: 'Black', locationId: location.id, vehicleTypeId: vehicleType.id, status: 'AVAILABLE' } });
  const requestData = { staffName: admin.user.staffName, employeeId: admin.user.employeeId, locationId: location.id, directorateId: directorate.id, departmentId: department.id, unitId: unit.id, vehicleTypeId: vehicleType.id, requesterId: admin.user.id, location: location.name, directorate: directorate.name, department: department.name, unit: unit.name, purposeOfTrip: 'Development GPS workflow test', vehicleTypeName: vehicleType.name, destination: 'NMDPRA Abuja Field Office', departureDate: new Date(Date.now() + 30 * 60_000), expectedReturnDate: new Date(Date.now() + 4 * 60 * 60_000), numberOfPassengers: 2, priority: 'NORMAL' };
  const approvedRequest = await prisma.vehicleRequest.upsert({ where: { requestNumber: 'DEV-REQ-APPROVED' }, update: { status: 'APPROVED' }, create: { ...requestData, requestNumber: 'DEV-REQ-APPROVED', status: 'APPROVED' } });
  const activeRequest = await prisma.vehicleRequest.upsert({ where: { requestNumber: 'DEV-REQ-ACTIVE' }, update: { status: 'ALLOCATED' }, create: { ...requestData, requestNumber: 'DEV-REQ-ACTIVE', status: 'ALLOCATED' } });
  const active = await prisma.vehicleAllocation.upsert({ where: { id: '10000000-0000-4000-8000-000000000001' }, update: { status: 'ACCEPTED', vehicleId: vehicleOne.id, driverId: driverOne.id }, create: { id: '10000000-0000-4000-8000-000000000001', requestId: activeRequest.id, assignedById: admin.user.id, vehicleId: vehicleOne.id, driverId: driverOne.id, purpose: activeRequest.purposeOfTrip, destination: activeRequest.destination, startAt: activeRequest.departureDate, expectedEndAt: activeRequest.expectedReturnDate, status: 'ACCEPTED', notes: 'Development assignment ready for driver start.' } });
  const upcomingRequest = await prisma.vehicleRequest.upsert({ where: { requestNumber: 'DEV-REQ-UPCOMING' }, update: { status: 'ALLOCATED' }, create: { ...requestData, requestNumber: 'DEV-REQ-UPCOMING', departureDate: new Date(Date.now() + 26 * 60 * 60_000), expectedReturnDate: new Date(Date.now() + 30 * 60 * 60_000), status: 'ALLOCATED' } });
  await prisma.vehicleAllocation.upsert({ where: { id: '10000000-0000-4000-8000-000000000003' }, update: { status: 'ASSIGNED' }, create: { id: '10000000-0000-4000-8000-000000000003', requestId: upcomingRequest.id, assignedById: admin.user.id, vehicleId: vehicleTwo.id, driverId: driverTwo.id, purpose: upcomingRequest.purposeOfTrip, destination: upcomingRequest.destination, startAt: upcomingRequest.departureDate, expectedEndAt: upcomingRequest.expectedReturnDate, status: 'ASSIGNED', notes: 'Upcoming development assignment.' } });
  const completedRequest = await prisma.vehicleRequest.upsert({ where: { requestNumber: 'DEV-REQ-COMPLETED' }, update: { status: 'COMPLETED' }, create: { ...requestData, requestNumber: 'DEV-REQ-COMPLETED', departureDate: new Date(Date.now() - 26 * 60 * 60_000), expectedReturnDate: new Date(Date.now() - 23 * 60 * 60_000), status: 'COMPLETED' } });
  const completedAllocation = await prisma.vehicleAllocation.upsert({ where: { id: '10000000-0000-4000-8000-000000000002' }, update: {}, create: { id: '10000000-0000-4000-8000-000000000002', requestId: completedRequest.id, assignedById: admin.user.id, vehicleId: vehicleThree.id, driverId: driverTwo.id, purpose: completedRequest.purposeOfTrip, destination: completedRequest.destination, startAt: completedRequest.departureDate, expectedEndAt: completedRequest.expectedReturnDate, actualStartAt: completedRequest.departureDate, actualEndAt: completedRequest.expectedReturnDate, status: 'COMPLETED' } });
  const completedTrip = await prisma.trip.upsert({ where: { allocationId: completedAllocation.id }, update: {}, create: { allocationId: completedAllocation.id, requestId: completedRequest.id, vehicleId: vehicleThree.id, driverId: driverTwo.id, startLatitude: 9.0765, startLongitude: 7.3986, endLatitude: 9.0865, endLongitude: 7.4106, startedAt: completedRequest.departureDate, endedAt: completedRequest.expectedReturnDate, calculatedDistance: 2.1, maximumSpeed: 16, averageSpeed: 9, status: 'COMPLETED' } });
  for (let index = 0; index < 6; index++) await prisma.driverLocationHistory.upsert({ where: { clientEventId: `DEV-HISTORY-${index}` }, update: {}, create: { clientEventId: `DEV-HISTORY-${index}`, allocationId: completedAllocation.id, tripId: completedTrip.id, vehicleId: vehicleThree.id, driverId: driverTwo.id, latitude: 9.0765 + index * .002, longitude: 7.3986 + index * .0024, speed: 7 + index, heading: 45, accuracy: 8, recordedAt: new Date(completedRequest.departureDate.getTime() + index * 20 * 60_000), receivedAt: new Date(), isSimulated: true } });
  console.log(JSON.stringify({ created: { approvedRequest: approvedRequest.requestNumber, activeAllocation: active.id, upcomingAllocation: '10000000-0000-4000-8000-000000000003', completedTrip: completedTrip.id, vehicles: 3, drivers: 2 }, credentials: { admin: admin.password ? { email: admin.user.email, password: admin.password } : 'existing account retained', driver: driverUser.password ? { email: driverUser.user.email, password: driverUser.password } : 'existing account retained' } }, null, 2));
}

main().finally(() => prisma.$disconnect());
