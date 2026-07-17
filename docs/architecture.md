# Architecture

This repository begins with three independently owned boundaries:

- **Frontend:** Next.js App Router application responsible for the web experience.
- **Backend:** NestJS application responsible for future API and domain capabilities.
- **Persistence:** PostgreSQL accessed by the backend through Prisma ORM.

No domain modules, data models, API contracts, authentication, or other business logic are included in this scaffold. Those decisions should be recorded as architecture decision records in this directory as the system evolves.
