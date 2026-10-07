# Job Application Tracker

A Chrome extension + Node.js/Express API for tracking job applications.
Open a job posting on LinkedIn, Indeed, Wellfound, Internshala or Naukri, click the extension, and the job's title, company and location are filled in for you. Save it, then track it through **Saved → Applied → Assessment → Interview → Offer / Rejected** with notes, salary, dates and more. Everything is stored per user in PostgreSQL.

---

## Features

- **One-click job capture**: detects the website, extracts title / company / location / work mode, and lets you correct the values before saving.
- **Website adapters** for LinkedIn, Indeed, Wellfound, Internshala and Naukri, each with fallback selectors and a JSON-LD (`schema.org/JobPosting`) fallback. Other career sites that publish JSON-LD (Greenhouse, Lever, Workday …) work through a generic adapter.
- **Saved jobs**: search, filter by status (with counts), change status from a dropdown, edit all tracker fields inline, two-step delete.
- **Export to Excel**: one click downloads all your saved jobs as `Job_Applications_YYYY-MM-DD.xlsx` (bold frozen header, filters, clickable job links, real date cells), built from the database by the backend.
- **Tracker fields**: status, salary, work mode, date applied, interview date, resume used, referral, notes. A Settings tab chooses which of them appear on the job cards.
- **Duplicate protection**: the same job can't be saved twice, even when opened from links with different tracking parameters (`409 Conflict` → "This job is already saved.").
- **Accounts**: register / log in with email + password (bcrypt + JWT). Every job belongs to one user, and users can never see each other's jobs.
- **Clear error states**: unsupported website, no job found on page, backend offline, session expired, invalid data, duplicates.

## Architecture

```
┌────────────────────────── Chrome extension (Manifest V3) ──────────────────────────┐
│ popup.html / popup.js        ui/*View.js          lib/api.js ───────── HTTP + JWT ─┼──┐
│        │                                         lib/storage.js (chrome.storage)    │  │
│        └─ lib/extractor.js ── chrome.scripting.executeScript (activeTab) ──┐        │  │
│                                                                            ▼        │  │
│   In the job page:  utils/websiteDetector.js → adapters/<site>Adapter.js → content.js│  │
└─────────────────────────────────────────────────────────────────────────────────────┘  │
                                                                                         ▼
┌──────────────────────────── backend (Node.js + Express 5) ──────────────────────────────┐
│ app.js: helmet → cors → express.json → routes → notFound → errorHandler                 │
│ routes/      → middleware (requireAuth, validate[zod]) → controllers/ → services/       │
│ services/jobService.js, authService.js ── Prisma Client (+ @prisma/adapter-pg) ──┐      │
└──────────────────────────────────────────────────────────────────────────────────┼──────┘
                                                                                   ▼
                                                                    PostgreSQL (Supabase)
```

**Extraction flow:** opening the popup injects the detector, helpers, all adapters and `content.js` into the active tab (only then, thanks to the `activeTab` permission). `content.js` picks the adapter for the site, runs it safely, and returns a plain `{ ok, source, job }` object to the popup.

**Adapter strategy (per site):** stable hooks first (`data-testid`, ids, link `href` patterns, readable class names), older/alternative selectors next, and finally the page's JSON-LD `JobPosting` data, which fills only the fields still missing. Each adapter also builds a **canonical job URL** (e.g. `linkedin.com/jobs/view/<id>/`, `indeed.com/viewjob?jk=<key>`) so duplicate detection works across search pages and direct links.

## Tech stack

| Part      | Technology |
|-----------|------------|
| Extension | Chrome Manifest V3, vanilla JavaScript (ES modules in the popup), no build step |
| Backend   | Node.js 20.19+ (tested on 22), Express 5, zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, exceljs (Excel export) |
| Database  | PostgreSQL (Supabase) via Prisma ORM 7 + `@prisma/adapter-pg` |
| Tests     | `node:test`, supertest (API), jsdom (adapters), puppeteer-core (browser end-to-end) |

## Folder structure

```
.
├── extension/                  ← load this folder in Chrome
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.js   popup entry point + shared state
│   ├── ui/                     authView, currentJobView, savedJobsView, settingsView, dom helpers
│   ├── lib/                    api.js (all HTTP), storage.js, extractor.js, config.js
│   ├── utils/                  websiteDetector.js, extractionHelpers.js (run in the page)
│   ├── adapters/               linkedin, indeed, wellfound, internshala, naukri, generic
│   └── content.js              runs the right adapter inside the page
├── backend/
│   ├── prisma/                 schema.prisma + migrations/
│   ├── prisma.config.ts        Prisma CLI config (reads DATABASE_URL)
│   ├── src/
│   │   ├── server.js           connects to the DB, starts listening
│   │   ├── app.js              Express app and middleware order
│   │   ├── config/env.js       reads and validates environment variables
│   │   ├── db/prisma.js        single Prisma client
│   │   ├── routes/             health, auth, jobs
│   │   ├── controllers/        HTTP in/out only
│   │   ├── services/           database logic (jobService, authService) + exportService (Excel)
│   │   ├── middleware/         requireAuth, validate, errorHandler
│   │   ├── validation/         zod schemas (job + auth)
│   │   └── utils/              HttpError, normalizeJobUrl
│   └── tests/                  unit + API integration tests
└── tests/
    ├── extension/              adapter + API-client tests (jsdom)
    ├── e2e/popup.e2e.js        real Chrome + extension + backend
    └── test-job.html           manual test page (generic JSON-LD adapter)
```

## Setup

### 1. Prerequisites

- Node.js **20.19 or newer** (`node -v`)
- A PostgreSQL database. The project uses a free [Supabase](https://supabase.com) project; any PostgreSQL 13+ works.
- Google Chrome (or another Chromium browser)

### 2. Backend

```bash
cd backend
npm install                # also runs `prisma generate`
cp .env.example .env       # then fill in the values (see below)
npm run db:migrate         # creates the User and Job tables
npm start                  # or: npm run dev (restarts on file changes)
```

Check it: <http://localhost:5000/api/health> should return `{"success":true,…,"database":"connected"}`.

### 3. Environment variables (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string. Supabase: *Project Settings → Database → Connection string*. The direct connection (`db.<ref>.supabase.co:5432`) is IPv6-only; if your network has no IPv6, use the **Session pooler** string instead. |
| `JWT_SECRET` | yes | At least 32 random characters. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | no | Defaults to `5000`. The extension expects `http://localhost:5000`. |
| `JWT_EXPIRES_IN` | no | Login lifetime, default `7d`. |
| `CORS_ORIGINS` | no | Comma-separated extension origins (e.g. `chrome-extension://<your-extension-id>`). Empty = any `chrome-extension://` origin. |

`.env` is git-ignored; never commit real values.

### 4. Load the extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the **`extension/`** folder (not the repo root)
4. Pin "Job Application Tracker" to the toolbar
5. Click the icon → **Create account** → you're in

After changing extension code, click the reload icon on the extension card.

> Using a different backend URL? Change `API_BASE_URL` in `extension/lib/config.js`, `host_permissions` and the `connect-src` part of `content_security_policy` in `extension/manifest.json`.

## API

All responses are JSON: `{ "success": true, … }` or `{ "success": false, "message": "…", "errors"?: [...] }`.
Job routes need `Authorization: Bearer <token>` (from register/login).

| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| GET | `/api/health` | API + database status | 200 | 503 DB unreachable |
| POST | `/api/auth/register` | `{ email, password }` (8–72 chars) → `{ token, user }` | 201 | 400, 409 email taken, 429 |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` | 200 | 400, 401, 429 |
| GET | `/api/auth/me` | Current user | 200 | 401 |
| DELETE | `/api/auth/me` | Delete account and all its jobs | 200 | 401 |
| GET | `/api/jobs?status=Applied` | The user's jobs, newest first (status filter optional) | 200 | 400, 401 |
| GET | `/api/jobs/export` | All of the user's jobs as an `.xlsx` file (header-only file if there are none) | 200 | 401 |
| GET | `/api/jobs/:id` | One job | 200 | 400, 401, 404 |
| POST | `/api/jobs` | Create a job | 201 | 400, 401, **409 duplicate** (`existingJobId` included) |
| PATCH | `/api/jobs/:id` | Update any editable field(s) | 200 | 400, 401, 404 |
| DELETE | `/api/jobs/:id` | Delete a job | 200 | 400, 401, 404 |

**Job fields**

| Field | Type | Notes |
|-------|------|-------|
| `title` | string (required) | max 300 |
| `jobUrl` | http(s) URL (required on create) | normalised: tracking params (`utm_*`, `trk`, `refId` …), `#hash` and trailing `/` removed. Not editable. |
| `source` | `linkedin` \| `indeed` \| `wellfound` \| `internshala` \| `naukri` \| `other` (required on create) | Not editable |
| `status` | `Saved` \| `Applied` \| `Assessment` \| `Interview` \| `Rejected` \| `Offer` | default `Saved`. Setting `Applied` with no `dateApplied` fills in today. |
| `company`, `location`, `salary`, `resumeUsed`, `referral` | string or null | `""` clears the value |
| `workMode` | `Remote` \| `Hybrid` \| `On-site` \| null | |
| `notes` | string or null | max 5000 |
| `dateApplied`, `interviewDate` | date string (`2026-10-05`) or null | |
| `id`, `savedAt`, `createdAt`, `updatedAt` | set by the server | |

Duplicates are decided by the database constraint `UNIQUE(userId, source, jobUrl)`, so two users can save the same job, but one user can't save it twice (even with two simultaneous requests).

Example:

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"my-password"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -X POST localhost:5000/api/jobs -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Backend Developer","company":"Acme","jobUrl":"https://www.linkedin.com/jobs/view/123/","source":"linkedin"}'
```

## Supported websites

| Website | Pages | Live check (5 Oct 2026, automated Chrome) |
|---------|-------|-------------------------------------------|
| LinkedIn | `/jobs/view/…` (logged out & in), search/collections pages with `currentJobId` | ✅ public job page extracted correctly |
| Internshala | `/job/detail/…`, `/internship/detail/…` | ✅ job and internship pages extracted correctly |
| Wellfound | `/jobs/<id>-…` | ✅ title + company from the heading, location from JSON-LD |
| Indeed (all regional domains) | `/viewjob?jk=…`, `/jobs?…&vjk=…` | ⚠️ not verified live: Indeed returns **403 "Blocked"** to automated browsers. Covered by fixture tests. |
| Naukri | `/job-listings-…` | ⚠️ not verified live: Naukri returns **403 "Access Denied"** to automated browsers. Covered by fixture tests. |
| Any site with JSON-LD `JobPosting` | e.g. Greenhouse, Lever | ✅ generic adapter (source "Other") |

Logged-in LinkedIn layouts couldn't be checked live (that needs a real account). The adapter includes the current "unified top card" selectors plus a layout-independent fallback that finds the job by its id in links.

Job sites change their HTML often. If a site stops working, update only that site's file in `extension/adapters/` and add a fixture test in `tests/extension/adapters.test.js`.

## Testing

```bash
# Backend: unit tests + API integration tests (needs DATABASE_URL; creates and deletes throwaway users)
cd backend && npm test

# Extension: website detection, every adapter, fallbacks, API client (no browser or backend needed)
npm install && npm test

# End-to-end: real Chrome + the extension + the running backend
cd backend && npm start          # in one terminal
npm run test:e2e                 # in another (set CHROME_PATH if Chrome isn't found)
```

| Suite | Count | Covers |
|-------|-------|--------|
| `backend/tests` | 27 | health, register/login/me/delete, 401s, CRUD, validation errors, malformed JSON, unknown ids, duplicate 409 (incl. different tracking URL), status filter, auto `dateApplied`, DB persistence, **cross-user isolation**, Excel export (contents, only own jobs, empty, 401) |
| `tests/extension` | 29 | detector (incl. look-alike domains), each adapter on its page layouts, JSON-LD fallback for every site, broken JSON-LD, missing elements, unknown sites, double injection, API client errors (offline, 400, 401, 409, 500, non-JSON), Excel download request |
| `tests/e2e` | 18 checks | the whole popup flow in Chrome, including XSS-safe rendering and the offline state |

### Manual testing checklist

Some things only a person in a real browser can check:

1. Load the extension, create an account.
2. Open a job on each site (LinkedIn logged in **and** logged out, Indeed, Naukri, Wellfound, Internshala). Click the icon and confirm the fields, then **Save job**.
3. Click the icon again on the same job → button shows **Already saved**, and **View saved job** jumps to it.
4. Open the same job from a search page (LinkedIn `currentJobId`, Indeed `vjk`) → still **Already saved**.
5. Saved jobs: change status, edit fields, use search and the status filter, delete.
6. Settings (⚙): toggle fields and check the cards change.
7. Saved jobs → **Export to Excel**: a `Job_Applications_<today>.xlsx` file downloads and opens in Excel / Google Sheets with one row per saved job.
8. Stop the backend → the popup shows "Cannot connect to server. Is the backend running?"
9. Open a non-job site (e.g. a news page) → "This website is not currently supported."
10. For the generic adapter: `npx http-server tests -p 8080`, open <http://localhost:8080/test-job.html>.

## Security

- Passwords hashed with bcrypt; JWT signed with HS256 (algorithm pinned on verify); the secret comes from the environment and must be at least 32 characters.
- Every job query is scoped by `userId`. Another user's job id behaves exactly like a missing job (404).
- Tokens of deleted accounts are rejected.
- zod validation on every body/query; ids validated; JSON body limited to 100 kB.
- Prisma parameterised queries only (no raw SQL with user input).
- helmet security headers; CORS only for `chrome-extension://` origins (or the configured list); login/register rate-limited (20 / 15 min / IP).
- The error handler never sends stack traces; unexpected errors become a generic 500.
- Extension: job data from websites is rendered with `textContent` only (never `innerHTML`), links must be `http(s)`, values used in selectors are validated, strict extension CSP, and no `<all_urls>` content script (scripts run only on the tab where you click the icon).

## Known limitations

- **Indeed and Naukri** block automated browsers, so their adapters are verified with fixture HTML only (see table above).
- The login token is kept in `chrome.storage.local`, and there is no refresh token. When it expires (7 days by default) you log in again.
- `npm audit` reports high-severity advisories in `mysql2` / `deepmerge-ts`. They come from the **Prisma CLI's** own dependencies (`prisma@7.10.0`, which `@prisma/client` declares as a peer). This app uses PostgreSQL through `pg` and never loads `mysql2`, and neither is reachable through the API. The only fix is Prisma 8, still a release candidate. Upgrade when it is stable.
- `exceljs@4.4.0` depends on `uuid@8`, which `npm audit` flags (moderate). The advisory only affects uuid's v3/v5/v6 functions when a buffer is passed in; exceljs only calls `v4()`.
- Registering with an email that already exists returns "already exists". That's convenient, but it reveals whether an email has an account.
- The backend URL is fixed at build time (`lib/config.js` + manifest). There is no in-extension setting for it.
- Rate limiting is in memory (per server process).

## Future improvements

- Options page to configure the backend URL (with optional host permissions)
- Export to CSV / Google Sheets
- Reminders for interview dates (`chrome.alarms` + notifications)
- Dashboard web page with charts per status / source
- Refresh tokens or httpOnly-cookie sessions for a hosted deployment
- Deploy the API (Render/Fly.io) and publish to the Chrome Web Store
