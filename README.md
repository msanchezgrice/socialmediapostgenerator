# Social Radar

Standalone social signal scanning and post proposal app.

## Stack
- Next.js App Router
- Clerk auth
- Supabase database
- OpenAI Responses API for web search and proposal generation
- Vercel cron for daily refresh

## Core flow
1. Sign in with Clerk
2. Import Reboot portfolio projects or add domains manually
3. Scan each active domain and search the live web for recent relevant signals
4. Generate three ready-to-post options per company
5. Suggest X handles and optionally verify them against the X API
6. Open native LinkedIn and X composers from the dashboard

## Environment
Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_WEB_SEARCH_MODEL` (optional, defaults to `gpt-4.1-mini`)
- `X_BEARER_TOKEN` (optional, enables live X handle lookup)
- `SOCIAL_RADAR_CRON_SECRET`

## Commands
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## Database
Supabase migrations live under [`supabase/migrations`](/Users/miguel/socialmediapostgenerator/supabase/migrations).
