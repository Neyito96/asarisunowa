import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const reactions = sqliteTable(
  "reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: text("playlist_id").notNull(),
    visitorKey: text("visitor_key").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_reactions_playlist_visitor").on(
      t.playlistId,
      t.visitorKey,
    ),
    index("idx_reactions_playlist").on(t.playlistId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: text("playlist_id").notNull(),
    nickname: text("nickname").notNull(),
    body: text("body").notNull(),
    tag: text("tag").notNull().default(""),
    visitorKey: text("visitor_key").notNull().default(""),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_comments_playlist_status").on(t.playlistId, t.status),
    index("idx_comments_created").on(t.createdAt),
    index("idx_comments_visitor_created").on(t.visitorKey, t.createdAt),
  ],
);

export const visits = sqliteTable(
  "visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorKey: text("visitor_key").notNull(),
    path: text("path").notNull().default("/"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_visits_created").on(t.createdAt)],
);

export const outboundClicks = sqliteTable(
  "outbound_clicks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: text("playlist_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_clicks_playlist").on(t.playlistId)],
);
