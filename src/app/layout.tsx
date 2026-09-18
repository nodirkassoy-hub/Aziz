import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UIProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "Mizom — Accounting & Financial Management", template: "%s · Mizom" },
  description: "Hisob-kitob, invoice, bank, soliqlar, hisobotlar va AI CFO — barchasi yagona platformada.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [
  { media: "(prefers-color-scheme: light)", color: "#f3f5f9" },
  { media: "(prefers-color-scheme: dark)", color: "#0b0e17" },
] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('mizom_theme');const d=t?t==='dark':!window.matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
