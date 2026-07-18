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
- Localized in Spanish (default) and English, with a language toggle on every page

## Stack

- **Frontend / backend:** Next.js 16 with React 19
- **Database:** SQLite via `better-sqlite3`
- **Hosting target:** Azure App Service on Linux

## Cheapest Azure SKU recommendation

For the lowest-cost first deployment, use **Azure App Service Free (F1)** on a **single instance**. The Bicep template in [`infra/main.bicep`](infra/main.bicep) provisions this by default.

Important caveats:

- F1 has a ~60 CPU-minute/day quota; once exceeded, the app stops responding until the quota resets. It also has no Always On, no custom domain SSL, and a shared 1 GB storage cap for the whole app (code + SQLite DB + photos).
- If the community relies on this being reliably up, move to **Basic B1** (~$13/month) by passing `skuName=B1` to the Bicep deployment — no code changes needed.
- **Critical:** the SQLite file must live outside the app's deployment folder (`/home/site/wwwroot`), because every redeploy replaces that folder's contents. The template sets `DATABASE_PATH=/home/data/sau-incidence-reporting.db`, which is under Azure's persistent `/home` share and survives redeploys and restarts.
- This app stores SQLite data in a local file, so it must stay on a single instance (no scale-out) unless storage is moved to a managed service (e.g. Azure Files mount, Azure SQL, or Blob Storage for photos).

## Deploying to Azure

Prerequisites: `az` and `gh` CLIs installed (`brew install azure-cli gh`), logged in with `az login` and `gh auth login`, and a GitHub remote for this repo.

1. Create a resource group and deploy the infrastructure:

   ```bash
   az group create --name sau-incidence-rg --location eastus

   az deployment group create \
     --resource-group sau-incidence-rg \
     --template-file infra/main.bicep \
     --parameters appName=sau-incidence-<your-unique-suffix> \
                  adminPassword='<choose-a-strong-password>' \
                  adminSessionSecret="$(openssl rand -hex 32)" \
                  emailEncryptionSecret="$(openssl rand -hex 32)"
   ```

   App names are globally unique across Azure, so pick a suffix (e.g. your community name + a few digits).

2. Get the publish profile and wire up GitHub Actions:

   ```bash
   az webapp deploy-list-publish-profiles --name <appName> --resource-group sau-incidence-rg --xml \
     | gh secret set AZURE_WEBAPP_PUBLISH_PROFILE

   gh variable set AZURE_WEBAPP_NAME --body "<appName>"
   ```

3. Push to `main` (or run the workflow manually from the Actions tab). The [`azure-deploy.yml`](.github/workflows/azure-deploy.yml) workflow builds the app on GitHub's Linux runners (matching Azure's Linux runtime, so the native `better-sqlite3` binary is compiled for the right platform) and deploys it.

4. Visit `https://<appName>.azurewebsites.net`.

To change the admin password or secrets later: `az webapp config appsettings set --name <appName> --resource-group sau-incidence-rg --settings ADMIN_PASSWORD='<new-value>'`.

## Local setup

1. Copy the environment example and set secure secrets:

   ```bash
   cp .env.example .env.local
   ```

2. Set these values:

   - `ADMIN_PASSWORD`: required to access `/admin`
   - `ADMIN_SESSION_SECRET`: used to sign the admin session cookie, required in production
   - `EMAIL_ENCRYPTION_SECRET`: used to encrypt optional email values, required in production
   - `DATABASE_PATH`: optional absolute path for the SQLite database file

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

4. Open:
   - Public form: `http://localhost:3000/`
   - Admin dashboard: `http://localhost:3000/admin`

## Localization

The app defaults to Spanish for every visitor, regardless of browser language — this does **not** auto-detect the browser's `Accept-Language` header, since the community is Spanish-speaking by default. English is available via the "EN" toggle at `/en` (e.g. `/en/admin`), which switches by adding a URL prefix, not a cookie-only preference.

- UI strings live in [`messages/es.json`](messages/es.json) and [`messages/en.json`](messages/en.json). Add a key to both files when adding new UI text.
- Admin-controlled content (incidence type names, e.g. "Tubería rota") is free-text data stored in the database, not a translated UI string — it displays the same regardless of the selected language. Rename or duplicate types per language from the admin page if bilingual type names are needed.
- Status labels (New, Fixed, etc.) are translated; the underlying stored values (`new`, `fixed`, ...) are not.

## Notes

- The database is created automatically on first run.
- Default incidence types are seeded automatically and can be managed from the admin page.
- Uploaded photos are stored inside the SQLite database.
- The built-in workflow statuses include `reported_to_naret` and `reported_to_zen` because the original requirements explicitly asked for those named escalation targets.
