/**
 * refresh-cookies.ts — sniff fresh kbjfree.com cookies straight out of
 * Chrome's local cookie store and write them to .state/cookies.json.
 *
 * Workflow:
 *   1) Make sure you've visited kbjfree.com in Chrome recently and are
 *      logged in. Solving Cloudflare's "Just a moment" once is enough.
 *   2) Quit Chrome (or at least close all kbjfree.com tabs). On Windows
 *      Chrome locks the cookies SQLite file while running.
 *   3) Run:
 *         pnpm exec tsx scripts/refresh-cookies.ts
 *   4) The script reads the three cookies we need (cf_clearance,
 *      kgateway.auth.access, kgateway.auth.refresh), decrypts them with
 *      DPAPI, and overwrites .state/cookies.json.
 *
 * After that, `pnpm exec tsx scripts/resolve.ts` should work again.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — package ships no type defs
import chromeCookies from "chrome-cookies-secure";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", ".state");
const OUT_PATH = resolve(STATE_DIR, "cookies.json");
const PROFILE = process.env.CHROME_PROFILE || "Default";

const REQUIRED = ["cf_clearance", "kgateway.auth.access", "kgateway.auth.refresh"];

interface Cookie {
  name: string;
  value: string;
}

function getCookies(url: string, format: string): Promise<Record<string, string>> {
  return new Promise((res, rej) => {
    chromeCookies.getCookies(url, format, (err: any, jar: any) => {
      if (err) return rej(err);
      res(jar);
    }, PROFILE);
  });
}

async function main() {
  console.log(`[refresh] reading Chrome cookies for kbjfree.com (profile=${PROFILE})…`);
  let jar: Record<string, string>;
  try {
    jar = await getCookies("https://kbjfree.com/videos", "object");
  } catch (e: any) {
    console.error(`[fatal] could not read Chrome cookies: ${e?.message ?? e}`);
    console.error(
      "  → make sure Chrome is fully closed (it locks the cookies DB on Windows)",
    );
    process.exit(1);
  }

  const cookies: Cookie[] = [];
  const missing: string[] = [];
  for (const name of REQUIRED) {
    if (jar[name]) cookies.push({ name, value: jar[name] });
    else missing.push(name);
  }

  if (missing.length) {
    console.error(`[fatal] missing cookies in Chrome: ${missing.join(", ")}`);
    console.error(
      "  → visit https://kbjfree.com/videos in Chrome, solve any CF challenge, log in, then re-run",
    );
    process.exit(1);
  }

  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(cookies, null, 2));

  // Decode JWT expiry for a friendly status line
  const decExp = (jwt: string) => {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      return new Date(payload.exp * 1000).toLocaleString("en-GB", {
        timeZone: "Asia/Bangkok",
      });
    } catch {
      return "?";
    }
  };
  const access = cookies.find((c) => c.name === "kgateway.auth.access")!;
  const refresh = cookies.find((c) => c.name === "kgateway.auth.refresh")!;
  console.log(`[refresh] wrote ${cookies.length} cookies → ${OUT_PATH}`);
  console.log(`           access expires ${decExp(access.value)}`);
  console.log(`           refresh expires ${decExp(refresh.value)}`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
