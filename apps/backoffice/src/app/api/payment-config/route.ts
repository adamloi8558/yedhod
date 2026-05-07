import { NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { inArray } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";

const KEYS = ["payment_mode", "easyslip_config", "payment_accounts"] as const;

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(systemConfig)
    .where(inArray(systemConfig.key, KEYS as unknown as string[]));

  const out: Record<string, unknown> = {
    payment_mode: { provider: "anypay" },
    easyslip_config: { hasApiKey: false },
    payment_accounts: [],
  };
  for (const r of rows) {
    if (r.key === "easyslip_config") {
      const v = r.value as { apiKey?: string } | null;
      // Never return the actual API key — only whether one is set.
      out.easyslip_config = { hasApiKey: Boolean(v?.apiKey) };
    } else {
      out[r.key] = r.value;
    }
  }
  return NextResponse.json(out);
}
