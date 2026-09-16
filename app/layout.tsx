import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./desktop-top-nav.css";

export const metadata: Metadata = {
  title: "朝日新聞ポッドキャスト案内所「朝リスの田」",
  description:
    "公式番組と朝リスのおすすめがつながる、朝ポキのプレイリスト案内所。",
  other: { "codex-preview": "development" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}
        {/* Cloudflare Web Analytics */}
        <Script
          strategy="afterInteractive"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token":"06c64615da3b42ceba758c2fa9a439c7"}'
        />
      </body>
    </html>
  );
}
