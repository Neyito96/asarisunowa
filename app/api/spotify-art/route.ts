import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url");
  if (!value)
    return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const supplied = new URL(value);
    if (supplied.protocol !== "https:") throw new Error("invalid url");
    const resolved =
      supplied.hostname === "open.spotify.com"
        ? supplied
        : new URL((await fetch(supplied, { redirect: "follow" })).url);
    const spotifyType = resolved.pathname.split("/")[1];
    if (
      resolved.hostname !== "open.spotify.com" ||
      !["show", "playlist"].includes(spotifyType)
    ) {
      throw new Error("not a supported Spotify page");
    }
    const oembed = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(resolved.toString())}`,
    );
    if (!oembed.ok) throw new Error("oEmbed unavailable");
    const data = (await oembed.json()) as {
      thumbnail_url?: string;
      title?: string;
    };
    return NextResponse.json(
      {
        thumbnailUrl: data.thumbnail_url,
        title: data.title,
        spotifyUrl: resolved.toString(),
      },
      { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "artwork unavailable" }, { status: 404 });
  }
}
