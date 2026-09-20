# Database Setup Guide — ReachInbox Email Scheduler

This project supports PostgreSQL 14+ through either local Docker or Supabase PostgreSQL.

---

## 1. Local Docker Setup

The easiest way to run PostgreSQL locally is via Docker Compose:

```bash
docker compose up -d postgres
```

This launches a PostgreSQL container on port `5432` with database `reachinbox_scheduler`.

### Execute Schema & Seed via Docker:

```bash
# Apply schema
docker exec -i reachinbox_postgres psql -U postgres -d reachinbox_scheduler < database/schema.sql

# Apply seed data
docker exec -i reachinbox_postgres psql -U postgres -d reachinbox_scheduler < database/seed.sql
```

---

## 2. Supabase Setup Option

If you prefer Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Open `database/schema.sql`, copy its entire content, paste it into the Supabase SQL editor, and click **Run**.
4. (Optional) Repeat the above with `database/seed.sql` to populate sample users and demo emails.
5. In Supabase Dashboard -> **Settings** -> **Database**, copy your **URI connection string** (Transaction pooler or Session mode).
6. Set `DATABASE_URL` in your `.env` file:
   ```env
   DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"
   ```

---

## 3. Prisma Migrations

When using the backend directly:

```bash
cd apps/backend
npx prisma generate
npx prisma db push # or npx prisma migrate dev
```
