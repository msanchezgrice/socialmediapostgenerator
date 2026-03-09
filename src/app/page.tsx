import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";

const features = [
  "Import the Reboot portfolio or add domains manually",
  "Scan each domain daily and infer the most relevant topics",
  "Package three ready-to-post options for LinkedIn, X, and cross-post use",
  "Toggle projects on or off and store company emails and handles separately",
];

export default async function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(245,158,11,0.12),_transparent_24%),linear-gradient(180deg,_#08111b_0%,_#04070d_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.24em] text-[#5eead4] uppercase">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#14b8a6]/40 bg-[#0a1721] text-lg">⌁</span>
            Social Radar
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr,0.95fr]">
          <div>
            <div className="inline-flex rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#5eead4]">
              Isolated app. Isolated data.
            </div>
            <h1 className="mt-6 max-w-3xl font-[Georgia] text-5xl leading-[1.02] tracking-tight text-white md:text-7xl">
              Turn daily market signals into posts your companies can actually ship.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Social Radar watches your domains, tracks relevant news, and writes daily packaged post options for each active
              company. Your company list, contact emails, handles, signals, and proposals live in a dedicated database instead
              of leaking into your StartupMachine data.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Show when="signed-out">
                <SignUpButton>
                  <button className="rounded-full bg-[#14b8a6] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#2dd4bf]">
                    Create First User
                  </button>
                </SignUpButton>
                <SignInButton>
                  <button className="rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:bg-white/10">
                    Sign In
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="rounded-full bg-[#14b8a6] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#2dd4bf]">
                  Go to Dashboard
                </Link>
              </Show>
              <a
                href="https://github.com/msanchezgrice/socialmediapostgenerator"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:bg-white/10"
              >
                View Repo
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <section className="rounded-[32px] border border-white/10 bg-black/30 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Daily loop</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Signal to post in one dashboard</h2>
                </div>
                <div className="rounded-full border border-[#14b8a6]/25 bg-[#14b8a6]/10 px-3 py-1 text-xs text-[#5eead4]">3 proposals / company</div>
              </div>
              <div className="mt-6 space-y-3">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                    <span className="mt-0.5 text-[#5eead4]">●</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#f59e0b]/15 bg-[#120d05]/90 p-6">
              <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Why separate</div>
              <p className="mt-3 text-sm leading-7 text-amber-50/85">
                This app is designed to keep your company list, contact emails, platform handles, and post history outside the
                StartupMachine control plane. New Supabase project. New Vercel project. Optional separate Clerk app.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
