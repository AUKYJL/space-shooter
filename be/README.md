# Space Shooter Backend (NestJS)

Backend lives in `be/` and serves as the source of truth for:
- user profile / currencies / progression
- stations (AFK production)
- runs snapshots + reward granting

## Requirements

- Node.js + npm
- Postgres

## Environment variables

- `DATABASE_URL` (required): Postgres connection string
- `JWT_SECRET` (required): JWT signing secret
- `BE_PORT` (optional, default `4000`): HTTP port

## Local run

```bash
cd be
npm install

# prepare database
npx prisma migrate dev
npx prisma db seed

# run
npm run start:dev
```

## Frontend dev flow

- Start backend (`npm run start:dev`) on `BE_PORT` (default `4000`).
- In `fe/.env.local`, set `VITE_API_BASE_URL=http://localhost:4000`.
- Start frontend (`cd fe && npm run dev`) and open `/login` to register via `POST /auth/register` or sign in via `POST /auth/login`.

## Swagger (dev)

When `NODE_ENV` is not `production`, Swagger UI is available at:
- `GET /docs`

## Tests

```bash
cd be
npm test
```
