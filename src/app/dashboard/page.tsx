import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getAuthUserSeed } from "@/lib/auth";
import { ensureProfile, getRadarSummary } from "@/lib/radar-store";
import { SocialRadarDashboard } from "@/components/social-radar-dashboard";

export default async function DashboardPage() {
  const seed = await getAuthUserSeed();
  if (!seed) {
    redirect("/sign-in");
  }

  const profile = await ensureProfile(seed);
  const summary = await getRadarSummary(profile.id);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_24%),radial-gradient(circle_at_90%_10%,_rgba(245,158,11,0.12),_transparent_20%),linear-gradient(180deg,_#07111b_0%,_#03060b_100%)] px-4 py-4 text-white md:px-6 md:py-5">
      <div className="mx-auto max-w-[1560px]">
        <header className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-black/25 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-[#5eead4]">Social Radar</div>
            <h1 className="mt-2 font-[Georgia] text-3xl tracking-tight text-white md:text-[2.5rem]">Daily signal scans for your portfolio companies</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              Manage company domains, emails, and handles in an isolated app. Every active project gets fresh signals and
              three ready-to-post options.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 md:block">
              {seed.name}
            </div>
            <UserButton />
          </div>
        </header>

        <div className="mt-6">
          <SocialRadarDashboard initialSummary={summary} />
        </div>
      </div>
    </main>
  );
}
