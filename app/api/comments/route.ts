import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { comments } from "../../../db/schema";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("playlistId") || "";
  const rows = await getDb()
    .select({
      id: comments.id,
      nickname: comments.nickname,
      body: comments.body,
      tag: comments.tag,
    })
    .from(comments)
    .where(and(eq(comments.playlistId, id), eq(comments.status, "approved")))
    .orderBy(desc(comments.id))
    .limit(30);
  return Response.json({ comments: rows });
}
export async function POST(req: Request) {
  const x = (await req.json()) as Record<string, string>;
  const nickname = x.nickname?.trim(),
    body = x.body?.trim(),
    tag = x.tag?.trim(),
    visitorKey = x.visitorKey?.trim();
  const allowedTags = new Set([
    "初めての人に",
    "学びが深い",
    "笑った",
    "何度も聴きたい",
    "今こそ聴きたい",
  ]);
  if (
    !x.playlistId ||
    !nickname ||
    nickname.length > 30 ||
    !body ||
    body.length > 120 ||
    !tag ||
    !allowedTags.has(tag) ||
    !visitorKey ||
    visitorKey.length > 80 ||
    x.website
  )
    return Response.json({ error: "invalid" }, { status: 400 });

  if (
    /(https?:\/\/|www\.|discord\.gg|open\.spotify\.com|[a-z0-9-]+\.(com|jp|net|org|io)\b)/i.test(
      `${nickname} ${body}`,
    )
  ) {
    return Response.json({ error: "link" }, { status: 400 });
  }

  const db = getDb();
  const recent = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.visitorKey, visitorKey),
        sql`${comments.createdAt} >= datetime('now', '-60 seconds')`,
      ),
    )
    .limit(1);
  if (recent.length)
    return Response.json({ error: "cooldown" }, { status: 429 });

  const duplicate = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.playlistId, x.playlistId),
        eq(comments.visitorKey, visitorKey),
        eq(comments.body, body),
      ),
    )
    .limit(1);
  if (duplicate.length)
    return Response.json({ error: "duplicate" }, { status: 409 });

  await db.insert(comments).values({
    playlistId: x.playlistId,
    nickname,
    body,
    tag,
    visitorKey,
    status: "approved",
  });
  return Response.json({ ok: true }, { status: 201 });
}
