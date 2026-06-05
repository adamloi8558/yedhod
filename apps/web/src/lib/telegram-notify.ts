import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";

// Tiny Telegram Bot API wrapper for sending admin notifications. We
// don't run a bot polling loop — only send messages.
//
// Config keys (system_config table):
//   telegram_support: { botToken: string, chatId: string }
// botToken is the bot token from @BotFather; chatId is where admin
// notifications go (a private chat, a group, or a channel — to use a
// channel, add the bot as admin and chatId is "@channelname" or the
// numeric id).

const SUPPORT_CONFIG_KEY = "telegram_support";

interface TelegramSupportConfig {
  botToken?: string;
  chatId?: string;
}

let cached: { value: TelegramSupportConfig | null; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadConfig(): Promise<TelegramSupportConfig | null> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;
  const [row] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, SUPPORT_CONFIG_KEY))
    .limit(1);
  const value = (row?.value as TelegramSupportConfig | null) ?? null;
  cached = { value, ts: Date.now() };
  return value;
}

export async function sendSupportNotification(text: string): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg?.botToken || !cfg?.chatId) {
    console.warn("[telegram-notify] no config — skipping");
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram-notify] send failed", res.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[telegram-notify] error", (e as Error).message);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
