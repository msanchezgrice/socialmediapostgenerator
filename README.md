# Social Radar

Standalone social signal scanning and post proposal app.

## Stack
- Next.js App Router
- Clerk auth
- Supabase database
- OpenAI for proposal upgrades
- Vercel cron for daily refresh

## Core flow
1. Sign in with Clerk
2. Import Reboot portfolio projects or add domains manually
3. Scan each active domain and related news topics
4. Generate three ready-to-post options per company
5. Open native LinkedIn and X composers from the dashboard

## Environment
Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `SOCIAL_RADAR_CRON_SECRET`

## Commands
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## Database
Supabase migrations live under [`supabase/migrations`](/Users/miguel/socialmediapostgenerator/supabase/migrations).
