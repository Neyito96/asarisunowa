"use client";

export type PlaylistEntryMode = "register" | "registerAndAuto" | "autoExisting";

type PlaylistEntryModeSelectorProps = {
  value: PlaylistEntryMode;
  onChange: (value: PlaylistEntryMode) => void;
  disabledModes?: PlaylistEntryMode[];
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
  disabledModes = [],
}: PlaylistEntryModeSelectorProps) {
  return (
    <fieldset className="autoUpdateTypes" aria-label="プレイリストの追加・自動更新メニュー">
      <legend>何をしたい？</legend>
      {options.map((option) => {
        const disabled = disabledModes.includes(option.value);
        return (
          <label
            key={option.value}
            aria-disabled={disabled || undefined}
            style={{
              display: "grid",
              gridTemplateColumns: "22px minmax(0, 1fr)",
              alignItems: "start",
              columnGap: 12,
            }}
          >
            <input
              type="radio"
              name="playlistEntryMode"
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              style={{
                WebkitAppearance: "radio",
                appearance: "auto",
                width: 18,
                height: 18,
                minWidth: 18,
                padding: 0,
                margin: "2px 0 0",
                border: 0,
                background: "transparent",
                borderRadius: "50%",
                flex: "0 0 auto",
                accentColor: "#cc4b78",
              }}
            />
            <span style={{ minWidth: 0 }}>
              <b style={{ display: "block" }}>{option.icon} {option.title}{disabled ? "（準備中）" : ""}</b>
              <small style={{ display: "block", marginTop: 4, lineHeight: 1.5 }}>{option.description}</small>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
