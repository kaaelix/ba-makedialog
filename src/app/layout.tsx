import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Blue Archive Scenario Image Generator & API",
  description:
    "API-first Blue Archive visual novel scenario generator, deterministic PixiJS renderer, and markdown chat renderer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 dark:bg-[#0a0a0b] dark:text-[#f4f4f5] transition-colors duration-150">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
