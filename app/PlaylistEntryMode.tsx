"use client";

export type PlaylistEntryMode = "register" | "registerAndAuto" | "autoExisting";

type PlaylistEntryModeSelectorProps = {
  value: PlaylistEntryMode;
  onChange: (value: PlaylistEntryMode) => void;
};

const options: Array<{
  value: PlaylistEntryMode;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "register",
    icon: "➕",
    title: "朝リストに登録する",
    description: "Spotify / YouTube Music のプレイリストを追加",
  },
  {
    value: "registerAndAuto",
    icon: "➕🔄",
    title: "登録して、自動更新も申し込む",
    description: "新しいSpotifyプレイリストを追加し、自動更新も申請",
  },
  {
    value: "autoExisting",
    icon: "🔄",
    title: "登録済みを自動更新にする",
    description: "すでに朝リストにあるSpotifyプレイリストを育てる",
  },
];

export default function PlaylistEntryModeSelector({
  value,
  onChange,
}: PlaylistEntryModeSelectorProps) {
  return (
    <fieldset className="autoUpdateTypes" aria-label="プレイリストの追加・自動更新メニュー">
      <legend>何をしたい？</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name="playlistEntryMode"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <b>{option.icon} {option.title}</b>
            <small>{option.description}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
