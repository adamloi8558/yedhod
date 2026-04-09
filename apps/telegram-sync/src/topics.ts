import { TelegramClient, Api } from "telegram";
import { db, categories, telegramSyncMessages } from "@kodhom/db";
import { eq, and } from "drizzle-orm";
import { nanoid, slugify } from "./utils.js";

// In-memory cache: "groupId:topicId" -> categoryId
const topicCategoryMap = new Map<string, string>();

function cacheKey(groupId: string, topicId: number): string {
  return `${groupId}:${topicId}`;
}

export async function isForumGroup(
  client: TelegramClient,
  group: Api.TypeEntityLike
): Promise<boolean> {
  try {
    const result = await client.invoke(
      new Api.channels.GetForumTopics({
        channel: group,
        limit: 1,
        offsetDate: 0,
        offsetId: 0,
        offsetTopic: 0,
      })
    );
    return result instanceof Api.messages.ForumTopics;
  } catch {
    return false;
  }
}

export async function getGroupTitle(
  client: TelegramClient,
  group: Api.TypeEntityLike
): Promise<string> {
  const entity = await client.getEntity(group);
  if (entity instanceof Api.Channel || entity instanceof Api.Chat) {
    return entity.title ?? "Unknown Group";
  }
  return "Unknown Group";
}

export async function getForumTopics(
  client: TelegramClient,
  group: Api.TypeEntityLike
): Promise<Map<number, string>> {
  const result = await client.invoke(
    new Api.channels.GetForumTopics({
      channel: group,
      limit: 100,
      offsetDate: 0,
      offsetId: 0,
      offsetTopic: 0,
    })
  );

  const topics = new Map<number, string>();

  if (result instanceof Api.messages.ForumTopics) {
    for (const topic of result.topics) {
      if (topic instanceof Api.ForumTopic) {
        topics.set(topic.id, topic.title);
      }
    }
  }

  return topics;
}

export async function getOrCreateCategory(
  topicId: number,
  topicTitle: string,
  groupId: string,
  accessLevel: "member" | "vip" = "vip"
): Promise<string> {
  // Check cache first
  const key = cacheKey(groupId, topicId);
  const cached = topicCategoryMap.get(key);
  if (cached) return cached;

  // Check if we already synced a message for this group+topic — use that categoryId
  const existingSync = await db.query.telegramSyncMessages.findFirst({
    where: and(
      eq(telegramSyncMessages.telegramGroupId, groupId),
      eq(telegramSyncMessages.telegramTopicId, topicId)
    ),
    columns: { categoryId: true },
  });

  if (existingSync?.categoryId) {
    // Verify category still exists
    const cat = await db.query.categories.findFirst({
      where: eq(categories.id, existingSync.categoryId),
    });
    if (cat) {
      topicCategoryMap.set(key, cat.id);
      return cat.id;
    }
  }

  // Fallback: check by slug (for first-time setup)
  const slug = slugify(topicTitle) || `topic-${topicId}`;
  const existingBySlug = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });

  if (existingBySlug) {
    topicCategoryMap.set(key, existingBySlug.id);
    return existingBySlug.id;
  }

  // Create new category
  const id = nanoid();
  await db.insert(categories).values({
    id,
    name: topicTitle,
    slug,
    accessLevel,
    isActive: true,
    sortOrder: 0,
  });

  console.log(`[topics] Created category "${topicTitle}" (${slug}) [${accessLevel}]`);
  topicCategoryMap.set(key, id);
  return id;
}
