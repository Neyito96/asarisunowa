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
      className="playlistEntryModeSelector"
      aria-label="二次プレイリストの追加・自動更新メニュー"
      style={{
        display: "grid",
        gap: 10,
        width: "100%",
        minWidth: 0,
        margin: "18px 0 0",
        padding: 0,
        border: 0,
      }}
    >
      <legend
        style={{
          width: "100%",
          margin: "0 0 2px",
          padding: 0,
          fontSize: "0.82rem",
          fontWeight: 800,
          lineHeight: 1.3,
          color: "#6a5d55",
        }}
      >
        何をしたい？
      </legend>
      {options.map((option) => {
        const disabled = disabledModes.includes(option.value);
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            aria-disabled={disabled || undefined}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              width: "100%",
              minWidth: 0,
              padding: "14px 15px",
              border: selected ? "2px solid #cc4b78" : "1px solid #d9d1cb",
              borderRadius: 14,
              boxSizing: "border-box",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.58 : 1,
              background: selected ? "rgba(204, 75, 120, 0.055)" : "#fff",
              boxShadow: selected ? "0 2px 10px rgba(110, 55, 70, 0.08)" : "none",
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
                flex: "0 0 auto",
                width: 19,
                height: 19,
                minWidth: 19,
                padding: 0,
                margin: "2px 0 0",
                border: 0,
                background: "transparent",
                borderRadius: "50%",
                accentColor: "#cc4b78",
              }}
            />
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <b
                style={{
                  display: "block",
                  margin: 0,
                  fontSize: "0.98rem",
                  fontWeight: 800,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                }}
              >
                <span aria-hidden="true">{option.icon}</span> {option.title}{disabled ? "（準備中）" : ""}
              </b>
              <p
                style={{
                  display: "block",
                  width: "100%",
                  minWidth: 0,
                  margin: "5px 0 0",
                  fontSize: "0.86rem",
                  lineHeight: 1.5,
                  color: "#6f625c",
                  overflowWrap: "break-word",
                }}
              >
                {option.description}
              </p>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}