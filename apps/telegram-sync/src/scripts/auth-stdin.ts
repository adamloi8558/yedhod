/**
 * Non-interactive auth wrapper. Reads phone, OTP, 2FA password line-by-line
 * from a file (one new line per prompt), so a remote agent can drive the
 * flow without tty access.
 *
 * Run:
 *   pnpm --filter @kodhom/telegram-sync exec tsx src/scripts/auth-stdin.ts
 *
 * Input file: /tmp/tg-input.txt (UNIX) or %TEMP%/tg-input.txt (Windows)
 *   line 1: phone (+xxxxx)
 *   line 2: OTP code (added later)
 *   line 3: 2FA password (added later, can be empty)
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
if (!apiId || !apiHash) {
  console.error("Missing TELEGRAM_API_ID/TELEGRAM_API_HASH in .env");
  process.exit(1);
}

import os from "os";
const INPUT = path.join(os.tmpdir(), "tg-input.txt");
const CONSUMED = path.join(os.tmpdir(), "tg-consumed.txt");
console.log(`[wrapper] input file: ${INPUT}`);

if (!fs.existsSync(CONSUMED)) fs.writeFileSync(CONSUMED, "");
if (!fs.existsSync(INPUT)) fs.writeFileSync(INPUT, "");

function consumedCount(): number {
  return fs
    .readFileSync(CONSUMED, "utf8")
    .split("\n")
    .filter(Boolean).length;
}

async function nextLine(label: string): Promise<string> {
  console.log(`[wrapper] need ${label}`);
  while (true) {
    const lines = fs
      .readFileSync(INPUT, "utf8")
      .split("\n")
      .map((l) => l.trim());
    const idx = consumedCount();
    if (lines[idx] !== undefined && lines[idx] !== "") {
      const value = lines[idx];
      fs.appendFileSync(CONSUMED, value + "\n");
      return value;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: () => nextLine("phone"),
  phoneCode: () => nextLine("OTP code"),
  password: () => nextLine("2FA password (empty if none)"),
  onError: (err) => {
    console.error("[wrapper] err:", err);
  },
});

console.log("===SESSION_BEGIN===");
console.log(client.session.save());
console.log("===SESSION_END===");
await client.disconnect();
process.exit(0);
