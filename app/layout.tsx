import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "朝リスの輪｜朝ポキプレイリスト案内所",
  description:
    "公式番組と朝リスのおすすめがつながる、朝ポキのプレイリスト案内所。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
