import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./desktop-top-nav.css";

export const metadata: Metadata = {
  title: "朝リスの田（番組とプレイリスト）｜朝リスの輪 — 朝日新聞ポッドキャストの非公式リスナーサイト",
  description:
    "公式番組と朝リスのおすすめがつながる、朝日新聞ポッドキャストのプレイリスト案内所。",
  authors: [{ name: "ネジート (NEYITO)", url: "https://neyito96.github.io/asarisunowa/humans.txt" }],
  creator: "ネジート (NEYITO)",
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
        {/* 作者の署名（画面には出ない。開発者ツールのコンソールにだけ出る） */}
        <Script id="neyito-signature" strategy="afterInteractive">{`console.log("%cこの宇宙はネジート（NEYITO）がAIを使って2026.9.6から描きはじめました", "color:#c9a96e;font-size:12px")`}</Script>
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
