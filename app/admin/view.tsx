"use client";
import { useEffect, useState } from "react";
type M = {
  all: number;
  today: number;
  weekUsers: number;
  clicks: number;
  likes: number;
};
export default function Admin() {
  const [m, setM] = useState<M | null>(null);
  async function load() {
    const d = await fetch("/api/admin").then((r) => r.json());
    setM(d.metrics);
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <main className="wrap admin">
      <a href="/">← サイトへ戻る</a>
      <h1>管理ダッシュボード</h1>
      <div className="metrics">
        <div className="metric">
          累計ページ表示<strong>{m?.all ?? "—"}</strong>
        </div>
        <div className="metric">
          今日の表示<strong>{m?.today ?? "—"}</strong>
        </div>
        <div className="metric">
          7日間の来訪者<strong>{m?.weekUsers ?? "—"}</strong>
        </div>
        <div className="metric">
          Spotifyへ移動<strong>{m?.clicks ?? "—"}</strong>
        </div>
        <div className="metric">
          ♡合計<strong>{m?.likes ?? "—"}</strong>
        </div>
      </div>
      <p>アクセス数はサイト上には表示せず、この管理画面だけで確認できます。</p>
    </main>
  );
}
