import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#04070d] px-6">
      <SignUp forceRedirectUrl="/dashboard" />
    </main>
  );
}
