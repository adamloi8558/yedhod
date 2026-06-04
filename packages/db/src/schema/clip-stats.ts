import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
  index,
  real,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";
import { users } from "./auth";

// Per-clip aggregate counters. We keep this as a one-row-per-clip table
// (not a row-per-view log) because we never need the audit trail — only
// the running totals and "what's trending right now". Cheap to read, cheap
// to write.
export const clipStats = pgTable(
  "clip_stats",
  {
    clipId: text("clip_id")
      .primaryKey()
      .references(() => clips.id, { onDelete: "cascade" }),
    // Total view count shown publicly. Seeded with a random number based on
    // clip age (older clips look more popular) and bumped by 1-10 per real
    // view to make a small audience feel busier than it is.
    viewCount: integer("view_count").notNull().default(0),
    // Recent activity bucket for "🔥 trending" — number of views in the
    // last 24h. We don't store individual view timestamps; a periodic
    // job (or each bump) can decay this with a half-life.
    recentViews: integer("recent_views").notNull().default(0),
    // When we last decayed `recentViews`. The bump endpoint applies decay
    // lazily on read so we don't need a cron.
    recentDecayedAt: timestamp("recent_decayed_at").notNull().defaultNow(),
    likeCount: integer("like_count").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    recentIdx: index("clip_stats_recent_idx").on(table.recentViews),
    viewIdx: index("clip_stats_view_idx").on(table.viewCount),
  })
);

// Per-user reaction toggle. Composite PK enforces "one heart per user
// per clip" — toggling just upserts/deletes.
export const clipReactions = pgTable(
  "clip_reactions",
  {
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clipId, table.userId] }),
    userIdx: index("clip_reactions_user_idx").on(table.userId),
  })
);

// Continue-watching for logged-in users. Guests get an equivalent stored
// in localStorage on the client; we never write guest progress to the DB.
export const watchProgress = pgTable(
  "watch_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    // Seconds into the clip — `real` so fractional positions survive
    // round-trips from the <video> element.
    positionSec: real("position_sec").notNull().default(0),
    // We store the duration we saw at save time so the UI can compute
    // "75% watched" without re-fetching the clip row.
    durationSec: real("duration_sec"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.clipId] }),
    userRecentIdx: index("watch_progress_user_recent_idx").on(
      table.userId,
      table.updatedAt
    ),
  })
);
