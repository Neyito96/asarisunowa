import Community from "./community";
import PlaylistEntryModeBridge from "./PlaylistEntryModeBridge";
import { playlists } from "./data";

export const dynamic = "force-static";

export default function Home() {
  return (
    <>
      <Community playlists={playlists} />
      <PlaylistEntryModeBridge />
    </>
  );
}
