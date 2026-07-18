# Santa Ana Urbano incidence reporting

A small full-stack Next.js application for collecting and managing public incidence reports for the Santa Ana Urbano gated community.

## Features

- Public reporting form with:
  - date picker
  - admin-managed incidence type dropdown
  - house number reporter field
  - free-text description
  - up to 3 photos per report
  - optional email validation
- Admin dashboard with:
  - password-gated access
  - filters by type, date, reporter, and status
  - status updates for each report
  - type management for the public dropdown
- Lightweight SQLite storage
- Optional email values encrypted at rest and never displayed in the admin UI

## Stack

- **Frontend / backend:** Next.js 16 with React 19
- **Database:** SQLite via `better-sqlite3`
- **Hosting target:** Azure App Service on Linux

## Cheapest Azure SKU recommendation

For the lowest-cost first deployment, start with **Azure App Service Free (F1)** and keep the app on a **single instance** with the default local SQLite database path.

Important caveats:

- F1 is the cheapest entry point, but it has limited CPU, memory, and uptime behavior.
- If you need stronger reliability, custom domains with fewer limitations, or better performance for photo uploads, the next practical step is **Basic B1**.
- This app stores SQLite data in a local file, so it should stay on a single instance unless storage is moved to a managed service.

## Local setup

1. Copy the environment example and set secure secrets:

   ```bash
   cp .env.example .env.local
   ```

2. Set these values:

   - `ADMIN_PASSWORD`: required to access `/admin`
   - `ADMIN_SESSION_SECRET`: used to sign the admin session cookie
   - `EMAIL_ENCRYPTION_SECRET`: used to encrypt optional email values
   - `DATABASE_PATH`: optional absolute path for the SQLite database file

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

4. Open:
   - Public form: `http://localhost:3000/`
   - Admin dashboard: `http://localhost:3000/admin`

## Notes

- The database is created automatically on first run.
- Default incidence types are seeded automatically and can be managed from the admin page.
- Uploaded photos are stored inside the SQLite database.
