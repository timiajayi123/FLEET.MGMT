# Fleet allocation and GPS tracking — local testing

## Local services

- SQL Server 2022 Express: `localhost:1434`, database `fleet_management`, schema `dbo`
- Backend: `http://localhost:3002`
- Frontend: `http://localhost:3000`

The local database URL belongs in `backend/.env`. Never commit its password.

## Environment variables

Backend (`backend/.env`):

```env
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:3000
DATABASE_URL="sqlserver://localhost:1434;database=fleet_management;user=fleet_user;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true;schema=dbo"
ENABLE_GPS_SIMULATOR=true
```

Frontend (`frontend/.env.local`):

```env
BACKEND_URL=http://localhost:3002
NEXT_PUBLIC_BACKEND_SOCKET_URL=http://localhost:3002
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_KEY
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
NEXT_PUBLIC_ENABLE_GPS_SIMULATOR=true
```

Restrict the Google Maps browser key to the Maps JavaScript API, Places API, and local/production HTTP referrers. If the key is absent, the fleet list and simulator still work and the page shows setup guidance.

## Database and seed

Prisma CLI's native TLS engine fails against local SQL Server on this Windows installation. Schema upgrades are generated with `prisma migrate diff`, reviewed, and applied through the encrypted `mssql` driver; do not run `migrate reset`.

The development seed is hard-blocked unless the URL targets `localhost:1434/fleet_management` and `NODE_ENV` is not production:

```powershell
cd backend
npm run seed:dev
```

It preserves existing users and creates clearly named `DEV-*` master data, two drivers, three vehicles, an approved request, an accepted allocation ready to start, an upcoming allocation, and a completed sample route.

## Start commands

In separate terminals:

```powershell
npm run start:dev -w backend
npm run dev -w frontend
```

## Test accounts

- Administrator: `admin@nmdpra.gov.ng`
- Driver: `driver@nmdpra.gov.ng`

Use the temporary passwords issued locally. The seed never replaces an existing password. Set `DEV_ADMIN_PASSWORD` and `DEV_DRIVER_PASSWORD` only when seeding a fresh database and deterministic local credentials are required.

## Complete workflow

1. Sign in as the administrator and open Vehicle Allocation.
2. Select an approved request, available vehicle, active driver, and schedule; create the assignment.
3. Sign out and sign in as the driver.
4. Open GPS Tracking. Accept the assignment if it is still `ASSIGNED`.
5. Select Start Trip and allow precise location access. The trip, allocation, vehicle, and driver statuses update transactionally.
6. Keep the page open. GPS points are sent every 10 seconds or after meaningful movement. Offline points queue in IndexedDB and upload after reconnection.
7. In another browser/session, sign in as admin and open Live Fleet Map. Socket updates move the marker; 10-second polling is the fallback.
8. For a desk test, enable both simulator variables, select an in-progress allocation, and start the development simulator. Simulated points are labelled.
9. End the trip from the driver dashboard. The final point is attempted, queued points flush, statistics are calculated, and the vehicle/driver return to `AVAILABLE`.
10. Confirm the completed trip and route remain in recent history.

## Troubleshooting

- Browser location requires `https://` except for trusted `localhost` development origins.
- On Android/iPhone, enable Location for the browser and this site; denied permission never starts tracking.
- If the map is blank, check the key, billing/demo status, referrer restrictions, Maps JavaScript API, and the browser console.
- If WebSockets fail, ensure port 3002 is reachable. Polling continues every 10 seconds.
- A grey marker is stale/offline; the UI never labels a coordinate older than 60 seconds as live.
- GPS updates are accepted only for an authenticated driver's own in-progress trip. The simulator additionally requires the development flags and an admin/fleet-manager session.
