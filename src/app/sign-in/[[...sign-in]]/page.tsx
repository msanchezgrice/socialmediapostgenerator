import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#04070d] px-6">
      <SignIn forceRedirectUrl="/dashboard" />
    </main>
  );
}
