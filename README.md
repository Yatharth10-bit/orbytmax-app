# OrbytMax

OrbytMax is a Next.js 16 satellite tracker and education app. It includes a live satellite map, city-based visible pass lookup, satellite and mission detail pages, ISRO/global mission libraries, a satellite parts guide, and an interactive orbit basics quiz.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set a hosted PostgreSQL connection string:

```bash
cp .env.example .env
```

3. Prepare the database:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Open `http://127.0.0.1:3000` or the local URL printed by Next.js.

## Hosted Database Setup

Use a hosted PostgreSQL database for local development, previews, and production. Good options include Vercel Postgres/Neon, Supabase Postgres, Railway Postgres, or another managed PostgreSQL provider.

The app no longer uses local SQLite. `DATABASE_URL` must be a PostgreSQL URL:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

For a new hosted database, run:

```bash
npm run db:push
npm run db:seed
```

For migration-based production deploys, create migrations locally with:

```bash
npm run db:migrate:dev
```

Then apply committed migrations in hosted environments with:

```bash
npm run db:migrate
```

## Environment Variables

Required:

- `DATABASE_URL`: Hosted PostgreSQL connection string.
- `AUTH_SECRET`: Long random secret for Auth.js/NextAuth.

Optional:

- `NEXTAUTH_URL`: Canonical app URL for production or a fixed preview URL.

Never commit `.env`, `.env.local`, database URLs, auth secrets, Vercel tokens, or provider credentials.

## Prisma Commands

```bash
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to a development/preview database
npm run db:migrate:dev   # Create a local migration
npm run db:migrate       # Apply migrations in deployment
npm run db:seed          # Seed/update satellites, mission, quiz, and education content
```

The seed script is idempotent for catalog content and does not wipe users, favorites, follows, or alerts.

## Development Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
```

## Build Commands

```bash
npm run build
npm run start
```

`npm run build` runs `prisma generate` before `next build`.

## Deployment Steps

Preferred platform: Vercel.

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. Import the project in Vercel.
3. Add environment variables in Vercel Project Settings:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` if needed
4. Ensure the hosted PostgreSQL database has the schema:
   - Preview/development: `npm run db:push`
   - Migration workflow: `npm run db:migrate`
5. Seed catalog data once per database:
   - `npm run db:seed`
6. Deploy.

## Vercel Preview Link Workflow

With Vercel Git integration, every pull request or non-production branch push gets a preview deployment URL automatically. Share that URL for review instead of sending a zip.

Manual preview deploy:

```bash
npm install -g vercel
vercel
```

Production deploy:

```bash
vercel --prod
```

## Deployment Checklist

- [ ] `DATABASE_URL` points to hosted PostgreSQL, not SQLite.
- [ ] `AUTH_SECRET` is set and not committed.
- [ ] `.env` and local database files are ignored.
- [ ] `npm run db:generate` passes.
- [ ] Hosted database schema is pushed or migrated.
- [ ] `npm run db:seed` has populated satellite, mission, quiz, and education content.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] Vercel preview link opens the app.
- [ ] Live map, Sky Tonight, satellite detail, Education Hub, and quiz flows are checked on desktop and mobile.

## Known Limitations

- Satellite pass predictions depend on available TLE data and are approximate.
- The city lookup has a local fallback list and uses Open-Meteo geocoding when a city is not in the fallback list.
- Some spacecraft visuals are procedural fallback models when no production model asset URL is available.
- Authenticated favorites, follows, alerts, and dashboard features require a working hosted database and auth secret.
