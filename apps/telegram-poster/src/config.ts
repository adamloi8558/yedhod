import { db, systemConfig } from "@kodhom/db";
import { eq } from "drizzle-orm";

export async function getBotToken(): Promise<string> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_bot_token"),
  });

  if (!config?.value) {
    throw new Error(
      "Missing system config: telegram_poster_bot_token. Add it in the backoffice config page."
    );
  }

  return String(config.value);
}

export async function getTargetGroup(): Promise<string> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_target_group"),
  });

  if (!config?.value) {
    throw new Error(
      "Missing system config: telegram_poster_target_group. Add it in the backoffice config page."
    );
  }

  return String(config.value);
}

/**
 * Return every chat the poster should mirror to. Supports either:
 *   - a JSON array stored at `telegram_poster_target_groups` (plural), or
 *   - the legacy single-value at `telegram_poster_target_group`.
 * Always returns at least one chat (raises if neither is set).
 */
export async function getTargetGroups(): Promise<string[]> {
  const list = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_target_groups"),
  });
  if (list?.value) {
    if (Array.isArray(list.value)) {
      return list.value.map((v) => String(v)).filter(Boolean);
    }
    // Be forgiving: if someone wrote a comma-separated string, accept it.
    return String(list.value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Fallback to the legacy single-group key so existing setups keep working.
  return [await getTargetGroup()];
}
