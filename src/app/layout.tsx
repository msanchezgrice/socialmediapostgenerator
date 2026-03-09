import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthChrome } from "@/components/auth-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Radar",
  description: "Daily signal scanning and packaged social posts for portfolio companies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <AuthChrome />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
