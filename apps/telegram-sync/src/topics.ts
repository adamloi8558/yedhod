import { TelegramClient, Api } from "telegram";
import { db, categories } from "@kodhom/db";
import { eq } from "drizzle-orm";
import { nanoid, slugify } from "./utils.js";

// In-memory cache: topicId -> categoryId
const topicCategoryMap = new Map<number, string>();

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
  topicTitle: string
): Promise<string> {
  // Check cache first
  const cached = topicCategoryMap.get(topicId);
  if (cached) return cached;

  const slug = slugify(topicTitle) || `topic-${topicId}`;

  // Check if category exists by slug
  const existing = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });

  if (existing) {
    topicCategoryMap.set(topicId, existing.id);
    return existing.id;
  }

  // Create new category
  const id = nanoid();
  await db.insert(categories).values({
    id,
    name: topicTitle,
    slug,
    isActive: true,
    sortOrder: 0,
  });

  console.log(`[topics] Created category "${topicTitle}" (${slug})`);
  topicCategoryMap.set(topicId, id);
  return id;
}
