# Sahaj Space Studio

A responsive interior design studio website with a public portfolio and enquiry experience, a separate admin dashboard, and a Node.js API backed by PostgreSQL.

## Features

### Public website

- Responsive studio landing page with portfolio, team, process, and contact sections.
- Scroll based hero and gallery presentation, including a 3D gallery experience.
- Configurable home types, design packages, plans, and pricing.
- FAQ, team profiles, and contact information loaded from the API.
- Enquiry form with email notifications when SMTP is configured.
- WhatsApp and Instagram links managed through admin settings.

### Admin dashboard

Open `/admin.html` and sign in with the credentials configured in the backend environment. The dashboard supports:

- Overview statistics for unique visitors, page views, enquiries, gallery items, and team members.
- Enquiry review, status updates, and email replies.
- Gallery uploads and management, including images, videos, display placement, and cover selection.
- Team profile and FAQ management.
- Package types, plans, pricing, and planner footnote management.
- Public contact and studio snapshot settings.

## Technology

- Frontend: HTML, CSS, and browser JavaScript.
- Backend: Node.js, Express, and PostgreSQL (`pg`).
- Admin API protection: JWT bearer tokens.
- Uploads: files are stored under `backend/uploads/`.
- Email: Nodemailer with an SMTP server.

## Project layout

```text
.
├── backend/
│   ├── config/             Passport configuration
│   ├── db/                 PostgreSQL schema and initialization
│   ├── middleware/         Admin auth, uploads, and visitor tracking
│   ├── routes/             API route handlers
│   ├── uploads/            Uploaded media
│   ├── utils/              Email helpers
│   ├── .env.example        Environment variable template
│   ├── package.json
│   └── server.js           Express application entry point
└── frontend/
    ├── assets/             Public images and media
    ├── css/                Public and admin stylesheets
    ├── js/                 Public and admin browser code
    ├── index.html          Public website
    └── admin.html          Admin dashboard
```

## Requirements

- Node.js 18 or newer.
- PostgreSQL 13 or newer, available locally or through a hosted provider.
- SMTP credentials if admin email replies or enquiry notifications should be sent.

## Local setup

1. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create a local environment file by copying the example:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env` instead.

3. Edit `backend/.env`. Set a PostgreSQL connection string and unique secrets and admin credentials. At minimum, configure:

   ```dotenv
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sahaj_space
   JWT_SECRET=replace_with_a_long_random_secret
   SESSION_SECRET=replace_with_a_different_long_random_secret
   ADMIN_USERNAME=choose_a_username
   ADMIN_PASSWORD=choose_a_strong_password
   ```

   Create the PostgreSQL database named in `DATABASE_URL` before starting the server. The app creates and updates its tables during startup. You can instead configure PostgreSQL using `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.

4. Start the server from the `backend` directory:

   ```bash
   npm start
   ```

   For development with automatic restarts:

   ```bash
   npm run dev
   ```

5. Open:

   - Public site: <http://localhost:5000/>
   - Admin dashboard: <http://localhost:5000/admin.html>

The Express server serves both frontend pages and the API from the same origin. `PORT` can be changed if port 5000 is already in use.

## Environment variables

See [`backend/.env.example`](backend/.env.example) for the full template.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; defaults to `5000`. |
| `NODE_ENV` | Runtime mode; controls secure session cookie behavior. |
| `DATABASE_URL` | PostgreSQL connection URL. |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Alternative PostgreSQL connection settings when `DATABASE_URL` is not set. |
| `PG_SSL` | Set to `true` to enable PostgreSQL SSL. |
| `JWT_SECRET` | Signs admin API access tokens. |
| `SESSION_SECRET` | Signs Express session cookies. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin dashboard login credentials. |
| `CORS_ORIGIN` | Optional comma-separated list of allowed API origins. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | SMTP connection for notifications and replies. |
| `NOTIFY_EMAIL` | Destination for new enquiry notifications. |
| `BUSINESS_WHATSAPP`, `BUSINESS_INSTAGRAM` | Optional business contact defaults. Admin settings can also manage public contact information. |

Keep real credentials in `backend/.env` or in the deployment provider's secret manager. Do not commit `.env` or production secrets.

## API overview

The server mounts these route groups under `/api`:

| Route | Purpose |
| --- | --- |
| `/api/contact` | Public enquiry submission. |
| `/api/faq` | Public FAQ retrieval and admin FAQ management. |
| `/api/gallery` | Public gallery retrieval and admin media management. |
| `/api/team` | Public team retrieval and admin team management. |
| `/api/packages` | Public package data and admin package management. |
| `/api/settings` | Public studio settings and admin settings updates. |
| `/api/admin` | Admin login, overview statistics, enquiry inbox, and replies. |
| `/api/auth` | Backend session and Passport routes retained by the server. |

Admin-only endpoints require the bearer token returned by the admin login endpoint. Do not expose that token or the admin credentials publicly.

## Database and uploaded files

The PostgreSQL schema is in [`backend/db/schema.sql`](backend/db/schema.sql). Database initialization runs when the server starts and applies compatibility updates for existing installations. The schema contains studio content, enquiries, settings, plans, and visit statistics.

Gallery and team uploads are written to `backend/uploads/`. Back up the PostgreSQL database and uploaded files together. On hosting platforms with ephemeral disks, use persistent storage for uploads or move media to an object storage service.

## Deployment notes

- Run the backend on a Node.js host and provide the required environment variables through its secret configuration.
- Use a managed PostgreSQL database or a persistent PostgreSQL server. Enable `PG_SSL=true` when required by the provider.
- Set `NODE_ENV=production`, use strong unique JWT/session secrets, and set `CORS_ORIGIN` to the deployed site origin(s) when cross-origin access is needed.
- Ensure `backend/uploads/` is persistent or configure external media storage before deploying where local files are temporary.
- Configure SMTP if the site should send enquiry notifications and admin replies.

## Useful files

- Public content and page structure: `frontend/index.html`
- Public interactions and API loading: `frontend/js/main.js`
- Public design: `frontend/css/style.css`
- Admin layout: `frontend/admin.html`
- Admin interactions: `frontend/js/admin.js`
- Admin design: `frontend/css/admin.css`
- Express setup and static hosting: `backend/server.js`
- Database connection and startup initialization: `backend/db/db.js`
- Database schema: `backend/db/schema.sql`
