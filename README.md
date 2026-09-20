# ReachInbox Email Scheduler

A production-style full-stack email scheduling system, built for the Outbox Labs / ReachInbox.ai
Software Development Intern assignment. It accepts scheduling requests via API, persists them in
PostgreSQL, schedules delivery with BullMQ delayed jobs (no cron), sends mail through Ethereal
SMTP, enforces per-sender hourly rate limits with Redis-backed atomic counters, reschedules
(never drops) jobs when a limit is hit, notifies Slack in real time, indexes every email in
Elasticsearch for search, and exposes a Next.js dashboard that mirrors the supplied Figma.

---

## 1. Tech Stack

**Backend:** Node.js, TypeScript, Express.js, BullMQ, Redis, PostgreSQL, Prisma, Nodemailer +
Ethereal, Elasticsearch, Google OAuth, Slack OAuth/API, Bull Board.

**Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS.

**Infra:** Docker Compose (PostgreSQL, Redis, Elasticsearch), all with health checks and
persisted named volumes.

---

## 2. Architecture

```
Frontend (Next.js)
      ↓ REST (Bearer JWT)
Express API  ──────────────────────────────┐
      ↓                                     │
PostgreSQL (Prisma)                         │
      ↓                                     │
BullMQ (delayed jobs, deterministic IDs)    │
      ↓                                     │
Redis (queue state + atomic rate counters)  │
      ↓                                     │
Worker (configurable concurrency)           │
      ↓                                     │
Rate Limiter (Redis Lua, per-sender/hour) ──┴─→ Slack (on limit hit, real API call)
      ↓ (allowed)
Ethereal SMTP (Nodemailer)
      ↓
PostgreSQL (status update) + Elasticsearch (index for search)
```

The API server and the BullMQ worker run in the same Node process (`src/server.ts`), started
together on boot and shut down together on `SIGTERM`/`SIGINT`. This keeps the assignment's local
demo simple while still using a real, persistent Redis-backed queue underneath — the worker could
be split into its own process later without changing any queue/job code, since BullMQ workers are
just consumers of the same Redis-backed queue.

### Folder structure

```
reachinbox-email-scheduler/
├── apps/
│   ├── frontend/         Next.js dashboard (App Router)
│   └── backend/          Express API + BullMQ worker
├── database/
│   ├── schema.sql        Standalone SQL schema (kept in sync with Prisma)
│   ├── seed.sql           Optional demo data
│   └── README.md          Postgres / Supabase setup details
├── docker-compose.yml     Postgres + Redis + Elasticsearch (dev infra)
├── .env.example
└── README.md              (this file)
```

---

## 3. Setup

### Prerequisites
- Node.js 18+
- Docker (recommended for Postgres/Redis/Elasticsearch) — or your own instances of each

### 3.1 Install dependencies

```bash
npm install            # installs workspace deps for apps/frontend and apps/backend
```

### 3.2 Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (`:5432`), Redis (`:6379`, AOF persistence enabled), and Elasticsearch
(`:9200`), each with a health check and a named Docker volume so state survives container
restarts.

### 3.3 Configure environment variables

```bash
cp .env.example .env
```

Fill in the values described in [Section 4](#4-environment-variables). The system will still run
with several integrations unset — see [Section 12 — External Services](#12-external-services).

### 3.4 Database

Two equivalent options — pick one:

**Option A — Prisma (recommended for local dev):**
```bash
cd apps/backend
npx prisma generate
npx prisma migrate dev   # or: npx prisma db push
npx prisma db seed       # optional demo data
```

**Option B — raw SQL (for Supabase or any external Postgres):**
```bash
psql <DATABASE_URL> -f database/schema.sql
psql <DATABASE_URL> -f database/seed.sql   # optional
```

`database/schema.sql` is hand-kept in sync with `apps/backend/prisma/schema.prisma` — same
tables, columns, constraints and indexes, expressed in raw SQL so it can be run against any
Postgres instance (including Supabase) independently of Prisma. See `database/README.md` for the
full Supabase walkthrough.

### 3.5 Run backend (API + worker, one process)

```bash
cd apps/backend
npm run dev          # tsx watch, http://localhost:5000
```

On boot you'll see log lines for: DB connectivity, Redis connectivity, Ethereal transporter init
(auto-creates a throwaway test account if `ETHEREAL_USER`/`ETHEREAL_PASSWORD` are blank),
Elasticsearch index verification/creation, and the worker starting with its configured
concurrency.

### 3.6 Run frontend

```bash
cd apps/frontend
npm run dev           # http://localhost:3000
```

### 3.7 Access Bull Board (queue dashboard)

```
http://localhost:5000/admin/queues
```

Protected with HTTP Basic Auth — browser will prompt for the `ADMIN_USERNAME` / `ADMIN_PASSWORD`
you set in `.env` (defaults to `admin` / `changeme` locally; change this before deploying
anywhere beyond localhost). Shows waiting, delayed, active, completed, and failed jobs live.

---

## 4. Environment Variables

All configuration is environment-driven — nothing is hardcoded. See `.env.example` for the full,
annotated list. Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local Docker or Supabase) |
| `REDIS_URL` | Redis connection string, used by BullMQ and the rate limiter |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint |
| `JWT_SECRET`, `SESSION_SECRET` | Session/token signing secrets |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | Google OAuth app credentials |
| `SLACK_CLIENT_ID/SECRET/REDIRECT_URI` | Slack OAuth app credentials |
| `ETHEREAL_HOST/PORT/USER/PASSWORD` | Ethereal SMTP; leave user/password blank to auto-create a test account on boot |
| `MAX_EMAILS_PER_HOUR` | Optional global hourly cap (see §8 trade-offs — currently unused; per-sender limiting is the enforced strategy) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Enforced per-sender hourly cap |
| `EMAIL_MIN_DELAY_SECONDS` | Minimum delay between sends per sender |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | HTTP Basic Auth credentials for the Bull Board dashboard |
| `FRONTEND_URL` / `BACKEND_URL` | Used for CORS and OAuth redirects |

---

## 5. Scheduling Architecture

1. `POST /api/campaigns` validates the request, creates a `Campaign` row, then for each valid
   recipient creates an `Email` row (status `SCHEDULED`) and enqueues a **BullMQ delayed job**
   with a **deterministic job ID** (`email_<emailId>`).
2. Each recipient's send time is offset from the campaign start time by
   `index * delaySeconds`, so `EmailA@10:00:00`, `EmailB@10:00:02`, `EmailC@10:00:04` for a
   2-second delay — matching the assignment's example exactly.
3. Redis persists all queue state (`appendonly yes`). No cron, no polling loop, no
   `node-cron`/`agenda` anywhere in the codebase — the worker only reacts to BullMQ's own
   delayed-job scheduler.
4. When a job's delay elapses, the worker (`src/workers/email.worker.ts`) picks it up, checks
   idempotency, checks the rate limiter, applies the inter-email delay, sends via Ethereal,
   updates Postgres, and indexes into Elasticsearch.

## 6. Restart Persistence

- BullMQ jobs live in Redis, not in application memory — restarting the Node process does **not**
  recreate or lose jobs; the `Queue`/`Worker` objects simply reconnect to the same Redis-backed
  queue on boot and resume consuming from where they left off.
- The server never re-derives the job list from the database on startup — jobs are only ever
  created once, at scheduling time.
- Already-`SENT` emails are protected from re-sending by the idempotency check in the worker
  (see §7), so even in a pathological case (e.g. a job somehow re-delivered), nothing is
  double-sent.

**Manual test:** schedule several emails a few minutes out, `Ctrl+C` the backend, restart it, and
watch Bull Board / the Scheduled Emails view — the same jobs are still there and fire at their
original times.

## 7. Idempotency

- Every `Email` row has a unique `idempotencyKey` (`campaign_<campaignId>_recipient_<recipient>`)
  and a unique `bullmqJobId` — both DB-level `UNIQUE` constraints.
- BullMQ job IDs are deterministic (`email_<emailId>`), so re-enqueuing the same email is a no-op
  at the queue level.
- Before sending, the worker re-reads the email's current status from Postgres. If it's already
  `SENT`, the job returns immediately without calling the SMTP transport again.
- Status transitions are `SCHEDULED → PROCESSING → SENT` (or `FAILED`, or
  `RATE_LIMITED_RESCHEDULED` when deferred — see §9), each written with its own `prisma.update`
  call, so a crash mid-job leaves a recoverable, inspectable state rather than a silent duplicate
  send.

## 8. Worker Concurrency

- Configured via `WORKER_CONCURRENCY` (default `5`), passed straight into BullMQ's
  `Worker(..., { concurrency })` — never hardcoded.
- Concurrency only controls how many jobs the worker pulls off the queue in parallel; correctness
  under concurrency comes from the rate limiter (§9) and idempotency (§7), not from the
  concurrency setting itself. Because the hourly counter increment is a single atomic Redis Lua
  script, N workers incrementing the same key at once still can't exceed the configured limit —
  there's no read-then-write race window.

## 9. Rate Limiting & Rescheduling

- **Delay between sends** (`EMAIL_MIN_DELAY_SECONDS` / per-sender `delaySeconds`): applied
  worker-side as a bounded `setTimeout` inside the job handler, after the rate-limit check and
  before the SMTP call, per sender. This is the simplest correct implementation for a
  single-in-process worker and is fully configurable per campaign/sender.
- **Hourly limit** (`MAX_EMAILS_PER_HOUR_PER_SENDER`): enforced with a Redis key
  `email-rate:{senderId}:{hour-window}`, incremented via a single atomic Lua script
  (`INCR` + conditional `EXPIRE`) — safe across multiple concurrent jobs, multiple workers, or
  multiple backend instances, since the whole check-and-increment is one atomic Redis operation,
  not a separate read then write.
- **On limit exceeded:** the job is **not** failed or dropped. The worker calls
  `job.moveToDelayed()` to push it into the next hourly window, updates the `Email` row to
  `RATE_LIMITED_RESCHEDULED` with the new `scheduledAt`, and fires a real Slack notification
  (see §10). Ordering is preserved as well as BullMQ's delayed-job ordering allows — jobs are
  rescheduled to the same target window and process in roughly the order they were rescheduled.
- **Global limit trade-off:** `MAX_EMAILS_PER_HOUR` is read into config but not currently wired
  into an enforcement path. The assignment allows *either* a global cap *or* a per-sender cap
  ("Either global ... or per-sender/per-tenant ... you will have to support multiple senders");
  this implementation intentionally chose per-sender enforcement since the system is explicitly
  multi-sender. The env var is left in place as a documented, easy extension point rather than
  removed, but treat it as inert today.

## 10. Slack Notifications

- Real OAuth flow: **Connect Slack** in the sidebar → `GET /api/slack/connect` builds a
  `slack.com/oauth/v2/authorize` URL → user authorizes → Slack redirects to
  `GET /api/slack/callback` → backend exchanges the code via `oauth.v2.access` and stores the
  resulting token/webhook per user in the `slack_connections` table.
- On a rate-limit hit, `slackService.sendRateLimitAlert()` makes a **live API call** — via the
  incoming webhook if one was granted, otherwise `chat.postMessage` with the stored bot token —
  not a log line.
- If Slack isn't connected, the alert function returns `false` and logs an info line; it never
  throws, so a missing Slack connection can never fail or block an email job.
- Disconnect (`POST /api/slack/disconnect`) deletes the stored connection; reconnecting
  immediately re-enables notifications with no redeploy, since the worker looks up the connection
  fresh on every rate-limit event rather than caching it.

## 11. Elasticsearch

- Index `emails` is created on boot (if missing) with explicit mappings: `recipient`/`subject`
  as analyzed text (with a `.keyword` sub-field on `recipient`), `body` as analyzed text, `status`
  as a keyword, and date fields for `scheduledAt`/`sentAt`/`createdAt`.
- Every email is indexed at creation time (`status: SCHEDULED`) and re-indexed on send
  (`status: SENT`), so both scheduled and sent emails are searchable throughout their lifecycle.
- `GET /api/emails/search?q=...` runs a `multi_match` fuzzy query across
  `recipient^3, subject^2, body`, scoped to the authenticated user. The frontend search bar in the
  dashboard header calls this endpoint directly — there is no frontend-only/fake search.
- If Elasticsearch is unreachable, indexing calls are swallowed with a warning log (never crash
  the request path), and search returns an empty result set with `isElasticsearch: false` rather
  than throwing.

## 12. External Services

The app runs without any of the below configured — Google/Slack routes respond with clear "not
configured" errors instead of crashing, and Ethereal auto-generates a throwaway test account if
no credentials are given. To use the real integrations:

1. **Google OAuth** — create an OAuth 2.0 Client ID in Google Cloud Console, add
   `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI, set
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. **Ethereal Email** — no signup needed; leave `ETHEREAL_USER`/`ETHEREAL_PASSWORD` blank and a
   fresh test inbox is created automatically each boot (credentials and the preview URL for every
   send are logged to the console).
3. **Slack OAuth app** — create a Slack app at api.slack.com/apps with the `chat:write`,
   `incoming-webhook`, and `channels:read` scopes, set the redirect URL to
   `http://localhost:5000/api/slack/callback`, set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
4. **PostgreSQL** — local via Docker Compose, or a Supabase project (see `database/README.md`).
5. **Elasticsearch** — local via Docker Compose, or any hosted cluster reachable at
   `ELASTICSEARCH_URL`.

---

## 13. API Reference

All routes below (except the two OAuth redirect/callback pairs) require
`Authorization: Bearer <JWT>`.

**Auth**
- `GET /api/auth/google` — start Google OAuth
- `GET /api/auth/google/callback` — Google OAuth callback → redirects to frontend with a JWT
- `GET /api/auth/me` — current user
- `POST /api/auth/logout`
- `POST /api/auth/demo` — local convenience login (seeds/returns the demo user); does not replace
  the real Google OAuth flow above

**Campaigns**
- `POST /api/campaigns` — create + schedule a campaign (validates recipients, creates Email rows
  + BullMQ jobs)
- `GET /api/campaigns`
- `GET /api/campaigns/:id`

**Emails**
- `GET /api/emails/scheduled`
- `GET /api/emails/sent`
- `GET /api/emails/search?q=...`
- `GET /api/emails/counts`
- `GET /api/emails/:id`

**Senders**
- `GET /api/senders`
- `POST /api/senders` — create an additional sender (name, email, hourlyLimit, delaySeconds)

**Slack**
- `GET /api/slack/connect`
- `GET /api/slack/callback`
- `POST /api/slack/disconnect`
- `GET /api/slack/status`

**Health**
- `GET /api/health` — DB / Redis / Elasticsearch connectivity summary

---

## 14. Load Behavior

For 1000+ emails scheduled around the same time: each recipient becomes its own BullMQ delayed
job, so BullMQ/Redis (not application memory) holds the backlog. The worker only ever pulls up to
`WORKER_CONCURRENCY` jobs at once, the per-sender Redis counter caps actual sends per hour
regardless of how many jobs are "due," and anything over the cap is rescheduled into the next
window rather than dropped — so the system degrades to "slower" under load, never to "lossy."

---

## 15. Manual Test Plan

Since this is a time-boxed assignment, testing is documented here as a manual checklist rather
than an automated suite:

1. Schedule one email a minute out → confirm it appears in Scheduled, then moves to Sent.
2. Schedule multiple emails with a delay → confirm send timestamps are staggered correctly.
3. Upload a CSV/TXT with mixed valid/invalid addresses → confirm only the valid count is shown
   and only valid addresses are scheduled (also confirm the backend rejects invalid addresses
   even if the frontend check were bypassed, per `extractValidEmails` in `campaign.service.ts`).
4. Set an artificially low hourly limit (e.g. 2) on a sender and schedule 5 emails → confirm the
   3rd–5th are rescheduled (`RATE_LIMITED_RESCHEDULED`) into the next hour, not failed.
5. With Slack connected, repeat step 4 → confirm a real message lands in the Slack channel.
6. Disconnect Slack, repeat step 4 → confirm scheduling/sending still succeeds with no crash and
   no notification.
7. Stop the backend mid-way through a batch, restart it → confirm remaining future jobs still
   fire, already-sent emails are not resent.
8. Search for a recipient/subject substring in the dashboard → confirm results come from the
   Elasticsearch-backed `/api/emails/search` endpoint (check network tab).
9. Log in with Google → confirm the header shows real name/email/avatar and logout works.
10. Visit `/admin/queues` without credentials → confirm a 401 prompt; with correct
    `ADMIN_USERNAME`/`ADMIN_PASSWORD` → confirm the live queue view loads.

---

## 16. Assumptions & Trade-offs

- PostgreSQL chosen over MySQL; Prisma as the primary ORM, with a hand-synced `schema.sql` for
  environments that want raw SQL (e.g. pasting into Supabase's SQL editor).
- API server and BullMQ worker run in one Node process for simplicity in local/demo use; they are
  already decoupled through Redis, so splitting them into separate processes later requires no
  changes to queue or job code.
- Per-sender hourly rate limiting was chosen over a global cap (both are permitted by the
  assignment); `MAX_EMAILS_PER_HOUR` remains as an unused, documented env var rather than being
  removed.
- Inter-email delay is implemented as a worker-side `setTimeout` rather than a BullMQ rate
  limiter option, to keep the per-sender delay value fully dynamic (read from the sender/campaign
  record at job time) instead of fixed at queue-creation time.
- Bull Board is protected with HTTP Basic Auth (env-configured) rather than reusing the app's JWT
  scheme, since it's a server-rendered admin page navigated to directly in the browser.
- Ethereal is used instead of a production SMTP provider, per the assignment; the preview URL for
  every send is logged server-side for demo purposes.
- A default sender is auto-created for a new user on first login so the compose screen is usable
  immediately; additional senders can be added from Compose → "Add sender".

---

## 17. Feature Checklist

**Backend**
- [x] Email scheduler (BullMQ delayed jobs, no cron)
- [x] PostgreSQL persistence (Prisma + synced `schema.sql`)
- [x] BullMQ + Redis
- [x] Multiple senders (`Sender` model, `POST /api/senders`, per-sender limiter)
- [x] Configurable worker concurrency
- [x] Configurable inter-email delay
- [x] Hourly rate limiting, Redis/DB backed, atomic (Lua script)
- [x] Rescheduling (not failing) on rate-limit hit
- [x] Slack OAuth, real notification, disconnect/reconnect
- [x] Elasticsearch indexing + search
- [x] Bull Board dashboard, protected with Basic Auth
- [x] Ethereal SMTP
- [x] Idempotency (unique keys + deterministic job IDs + status checks)
- [x] Restart persistence

**Frontend**
- [x] Google OAuth (real)
- [x] User profile, logout
- [x] Dashboard (sidebar, header, search)
- [x] Scheduled Emails / Sent Emails views (loading, empty, error states)
- [x] Compose Email (subject, body, recipients, chips)
- [x] CSV/TXT upload with "X email addresses detected"
- [x] Start time / Send Later UI with presets
- [x] Delay + hourly limit inputs
- [x] Multi-sender selection + "Add sender" UI
- [x] Elasticsearch-backed search bar
- [x] Email detail view
- [x] Reusable components (Button, Modal, Toast, Badge, EmailRow, Sidebar, Header)
- [x] TypeScript throughout

---

## 18. Demo Instructions

1. `docker compose up -d`, then start backend (`npm run dev` in `apps/backend`) and frontend
   (`npm run dev` in `apps/frontend`).
2. Log in with Google (or the demo login) → dashboard loads.
3. Compose a new email, upload a small CSV of leads, confirm the detected count, set a delay and
   hourly limit, schedule it.
4. Show the Scheduled Emails tab, then Bull Board (`/admin/queues`, login with your admin
   credentials) showing the delayed/waiting jobs.
5. Wait for the worker to process — show the Sent Emails tab and open one email's detail view
   (includes the Ethereal preview link in the backend logs).
6. Search for the recipient/subject in the header search bar.
7. Stop the backend, restart it, show the same scheduled jobs are still present and still fire.
8. (Bonus) Lower a sender's hourly limit, schedule enough emails to exceed it, and show the
   rescheduled status plus the Slack message landing in a connected channel.
