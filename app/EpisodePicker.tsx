"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PICKER_MAX, PICKER_MESSAGES, searchEpisodes, toggleSelection } from "../lib/library-picker.mjs";

export type PickedEpisode = { id: string; title: string; show: string; date: string };
type Row = { id: string; show: string; title: string; date: string; cast?: string; keywords?: string };
type Manifest = { version?: string; shows: { name: string; label?: string; search: string[] }[] };

const DATA_ROOT = "./library/data/";
const PAGE = 30;

export default function EpisodePicker({ selected, onChange, disabled }: {
  selected: PickedEpisode[];
  onChange: (next: PickedEpisode[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notice, setNotice] = useState("");
  const cache = useRef(new Map<string, Promise<Row[]>>());
  const run = useRef(0);

  useEffect(() => {
    fetch(DATA_ROOT + "manifest.json", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("manifest"); return r.json(); })
      .then(setManifest)
      .catch(() => setState("error"));
  }, []);

  function shard(path: string, version?: string) {
    const key = path + "?v=" + (version ?? "");
    if (!cache.current.has(key)) {
      cache.current.set(key, fetch(DATA_ROOT + key).then((r) => { if (!r.ok) throw new Error("shard"); return r.json(); }));
    }
    return cache.current.get(key)!;
  }

  async function search() {
    if (!manifest || !query.trim()) { setNotice("探したい言葉を入れてください。"); return; }
    const mine = ++run.current;
    setState("loading"); setNotice("");
    try {
      const paths = manifest.shows.filter((s) => !show || s.name === show).flatMap((s) => s.search);
      const rows: Row[] = [];
      for (let i = 0; i < paths.length; i += 2) {
        const chunks = await Promise.all(paths.slice(i, i + 2).map((p) => shard(p, manifest.version)));
        if (mine !== run.current) return;
        rows.push(...chunks.flat());
      }
      setResults(searchEpisodes(rows, { query, show }));
      setShown(PAGE); setState("done");
    } catch {
      if (mine === run.current) setState("error");
    }
  }

  function toggle(row: Row) {
    const next = toggleSelection(selected, row, PICKER_MAX) as { selected: PickedEpisode[]; error: string };
    setNotice(next.error ? PICKER_MESSAGES[next.error as keyof typeof PICKER_MESSAGES] : "");
    onChange(next.selected);
  }

  const chosen = useMemo(() => new Set(selected.map((e) => e.id)), [selected]);

  return (
    <fieldset className="episodePicker" disabled={disabled}>
      <legend>朝ポキの蔵から回を選ぶ <small>（任意・最大{PICKER_MAX}件）</small></legend>
      <div className="episodePickerSearch">
        <input type="search" value={query} placeholder="探したい言葉（例：ブラジル）" onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
        <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="番組で絞る">
          <option value="">すべての番組</option>
          {manifest?.shows.map((s) => <option key={s.name} value={s.name}>{s.label || s.name}</option>)}
        </select>
        <button type="button" onClick={() => void search()} disabled={!manifest || state === "loading"}>{state === "loading" ? "探しています…" : "探す"}</button>
      </div>
      {notice && <small role="status" className="submitNotice error">{notice}</small>}
      {state === "error" && <small role="alert" className="submitNotice error">蔵を読み込めませんでした。時間をおいてお試しください。</small>}
      {state === "done" && <small role="status">{results.length}件見つかりました</small>}
      <ul className="episodePickerResults">
        {results.slice(0, shown).map((row) => (
          <li key={row.id}>
            <label>
              <input type="checkbox" checked={chosen.has(row.id)} onChange={() => toggle(row)} />
              <span><b>{row.title}</b><small>{row.show}・{row.date.slice(0, 10)}</small></span>
            </label>
          </li>
        ))}
      </ul>
      {results.length > shown && <button type="button" onClick={() => setShown(shown + PAGE)}>もっと見る</button>}
      <div className="episodePickerSelected" aria-live="polite">
        <b>選んだ回：{selected.length}件</b>
        {selected.length > 0 && <button type="button" onClick={() => onChange([])}>すべて外す</button>}
        <ul>
          {selected.map((e) => (
            <li key={e.id}><span>{e.title}<small>（{e.date}）</small></span><button type="button" aria-label={e.title + "を外す"} onClick={() => onChange(selected.filter((x) => x.id !== e.id))}>外す</button></li>
          ))}
        </ul>
        <small>選んだ回は、共同編集の確認後にまとめてプレイリストへ追加されます。管理者が確認できない回や除外された回は追加されません。</small>
      </div>
    </fieldset>
  );
}
