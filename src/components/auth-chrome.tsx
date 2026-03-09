"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const hiddenPrefixes = ["/dashboard", "/sign-in", "/sign-up"];

export function AuthChrome() {
  const pathname = usePathname();

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end px-4 py-4 md:px-8">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/35 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur">
        <Show when="signed-out">
          <SignUpButton>
            <button className="rounded-full bg-[#14b8a6] px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-[#2dd4bf]">
              Sign Up
            </button>
          </SignUpButton>
          <SignInButton>
            <button className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/10">
              Sign In
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" className="rounded-full bg-[#14b8a6] px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-[#2dd4bf]">
            Dashboard
          </Link>
          <div className="rounded-full border border-white/10 bg-white/5 p-1">
            <UserButton />
          </div>
        </Show>
      </div>
    </div>
  );
}
