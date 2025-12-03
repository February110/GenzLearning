// app/layout.tsx
import "./globals.css";
import Script from "next/script";
import NextTopLoader from "nextjs-toploader";
import { Inter } from "next/font/google";
import ClientWrapper from "@/components/ClientWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "GenZ Learning",
  description: "Hệ thống học trực tuyến và quản lý lớp học",
  icons: {
    icon: '/images/logo/logo-light-admin.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Ensure theme class is applied ASAP to avoid mismatches across routes */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
          try {
            const t = localStorage.getItem('theme');
            const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const dark = t === 'dark' || (!t || t === 'system') && systemDark;
            document.documentElement.classList[dark ? 'add' : 'remove']('dark');
          } catch {}
          `}
        </Script>
        <NextTopLoader 
          color="#7C3AED"
          initialPosition={0.2}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />
        {/* Toàn bộ logic client (providers + navbar/guard) được bọc trong ClientWrapper */}
        <ClientWrapper>{children}</ClientWrapper>
      </body>
    </html>
  );
}
