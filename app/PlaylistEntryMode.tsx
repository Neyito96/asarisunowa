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
    icon: "＋",
    title: "二次プレイリストを登録",
    description: "Spotify / YouTube Music のプレイリストを朝リストに追加",
  },
  {
    value: "registerAndAuto",
    icon: "＋🔄",
    title: "登録 ＋ 自動更新",
    description: "新しいSpotifyプレイリストを登録し、そのまま自動更新も申し込む",
  },
  {
    value: "autoExisting",
    icon: "🔄",
    title: "登録済みを自動更新",
    description: "朝リストにあるSpotifyプレイリストを、自動で育てる",
  },
];

export default function PlaylistEntryModeSelector({
  value,
  onChange,
  disabledModes = [],
}: PlaylistEntryModeSelectorProps) {
  return (
    <fieldset
      className="autoUpdateTypes playlistEntryModeSelector"
      aria-label="二次プレイリストの追加・自動更新メニュー"
      style={{ display: "grid", gap: 12 }}
    >
      <legend style={{ marginBottom: 8 }}>何をしたい？</legend>
      {options.map((option) => {
        const disabled = disabledModes.includes(option.value);
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            aria-disabled={disabled || undefined}
            style={{
              display: "grid",
              gridTemplateColumns: "24px minmax(0, 1fr)",
              alignItems: "start",
              columnGap: 12,
              width: "100%",
              padding: "16px 18px",
              borderRadius: 16,
              boxSizing: "border-box",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              background: selected ? "rgba(204, 75, 120, 0.06)" : "#fff",
            }}
          >
            <input
              type="radio"
              name="playlistEntryMode"
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              style={{
                WebkitAppearance: "radio",
                appearance: "auto",
                width: 18,
                height: 18,
                minWidth: 18,
                padding: 0,
                margin: "3px 0 0",
                border: 0,
                background: "transparent",
                borderRadius: "50%",
                accentColor: "#cc4b78",
              }}
            />
            <span style={{ display: "block", minWidth: 0 }}>
              <b
                style={{
                  display: "block",
                  fontSize: "1.02rem",
                  lineHeight: 1.35,
                  margin: 0,
                }}
              >
                <span aria-hidden="true">{option.icon}</span> {option.title}{disabled ? "（準備中）" : ""}
              </b>
              <small
                style={{
                  display: "block",
                  marginTop: 6,
                  lineHeight: 1.55,
                  fontSize: "0.9rem",
                }}
              >
                {option.description}
              </small>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
