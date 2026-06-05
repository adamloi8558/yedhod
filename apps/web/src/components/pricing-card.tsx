"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { formatCurrency } from "@kodhom/ui/lib/utils";
import { Check, Crown, Star, Rocket, Sparkles, Gem, Lock } from "lucide-react";

interface PricingCardProps {
  plan: {
    id: string;
    name: string;
    durationDays: number;
    priceThb: string;
    maxDevices: number;
    isFeatured?: boolean;
  };
  featured?: boolean;
  isLoggedIn: boolean;
  // Highest price-per-day across all visible plans — used to compute
  // honest savings for each card ("ประหยัด N% เทียบกับแพ็ก 15 วัน").
  baselinePricePerDay?: number | null;
}

function formatDuration(days: number): string {
  if (days >= 36500) return "ตลอดชีพ";
  if (days >= 365) return `${Math.floor(days / 365)} ปี`;
  if (days >= 30) return `${Math.floor(days / 30)} เดือน`;
  if (days >= 7) return `${Math.floor(days / 7)} สัปดาห์`;
  return `${days} วัน`;
}

function valueTag(days: number): string {
  if (days >= 365) return "ประหยัดสุด";
  if (days >= 90) return "คุ้มกว่า";
  if (days >= 30) return "ยอดนิยม";
  return "ลองใช้งาน";
}

function isValidRedirect(value: string | null): value is string {
  if (!value) return false;
  return value.startsWith("/") && !value.startsWith("//");
}

export function PricingCard({
  plan,
  featured,
  isLoggedIn,
  baselinePricePerDay,
}: PricingCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirect = isValidRedirect(redirectParam) ? redirectParam : null;

  const priceNumber = Number.parseFloat(plan.priceThb);
  // Honest per-day price: don't round — show the actual ratio to 2dp so
  // the math always checks out (e.g. 139 / 15 = 9.27, not 9 even).
  const pricePerDay =
    Number.isFinite(priceNumber) && plan.durationDays > 0
      ? priceNumber / plan.durationDays
      : null;
  const tag = valueTag(plan.durationDays);

  // Strikethrough = what this many days would cost at the shortest plan's
  // day rate. Only show when the savings are real (≥ 5%) — otherwise it
  // looks like marketing fluff.
  const baseline =
    baselinePricePerDay && Number.isFinite(baselinePricePerDay)
      ? baselinePricePerDay
      : null;
  const wouldCost =
    baseline && plan.durationDays > 0 ? baseline * plan.durationDays : null;
  const savingsPct =
    wouldCost && Number.isFinite(priceNumber) && wouldCost > priceNumber
      ? Math.round(((wouldCost - priceNumber) / wouldCost) * 100)
      : 0;
  const showSavings = savingsPct >= 5;

  function handleClick() {
    if (!isLoggedIn) {
      const dest = redirect
        ? `/pricing?redirect=${encodeURIComponent(redirect)}`
        : "/pricing";
      router.push(`/login?redirect=${encodeURIComponent(dest)}`);
      return;
    }
    const params = new URLSearchParams({ planId: plan.id });
    if (redirect) params.set("redirect", redirect);
    router.push(`/payment?${params.toString()}`);
  }

  // Pick a "personality" icon per plan tier so each card has a small,
  // distinctive visual marker at the top — matches the mockup hierarchy
  // (trial → popular → recommended → best value).
  const TierIcon = featured
    ? Sparkles
    : plan.durationDays >= 365
      ? Gem
      : plan.durationDays >= 30
        ? Star
        : Rocket;

  return (
    <Card
      className={`relative flex flex-col items-center overflow-hidden rounded-2xl bg-card/50 text-center transition-smooth ${
        featured
          ? "ring-2 ring-vip glow-vip lg:scale-[1.05] z-10 bg-gradient-to-b from-vip/[0.08] via-card/60 to-card/40 shadow-xl shadow-vip/25"
          : "border border-primary/20 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15"
      }`}
    >
      {/* Featured: notched gold ribbon */}
      {featured && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-b-2xl gradient-vip px-6 py-1.5 text-[12px] font-bold text-vip-foreground shadow-md shadow-vip/40">
            แนะนำ
          </span>
        </div>
      )}

      <CardHeader className={`flex flex-col items-center gap-2.5 pb-2 ${featured ? "pt-10" : "pt-7"}`}>
        {/* Tier icon medallion */}
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ${
            featured
              ? "bg-gradient-to-b from-vip/25 to-vip/5 ring-vip/50 text-vip shadow-md shadow-vip/25"
              : "bg-gradient-to-b from-primary/15 to-primary/5 ring-primary/35 text-primary"
          }`}
        >
          <TierIcon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <CardTitle
          className={`text-xs font-medium uppercase tracking-[0.2em] ${
            featured ? "text-vip/90" : "text-muted-foreground"
          }`}
        >
          {tag}
        </CardTitle>
        <div className="text-base font-semibold text-foreground">
          {plan.name}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center gap-5 px-5 pb-5">
        {/* Price */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span
              className={`font-bold tabular-nums tracking-tight ${
                featured
                  ? "text-4xl md:text-[2.5rem] leading-none text-vip drop-shadow-[0_0_18px_oklch(0.78_0.14_75/0.4)]"
                  : "text-3xl md:text-4xl leading-none gradient-text"
              }`}
            >
              {formatCurrency(plan.priceThb)}
            </span>
          </div>
          <span className="mt-1 text-xs text-muted-foreground">
            / {formatDuration(plan.durationDays)}
          </span>
          {pricePerDay !== null && (
            <span
              className={`mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${
                featured
                  ? "border-vip/40 bg-vip/10 text-vip"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              เฉลี่ย <span className="font-bold tabular-nums">{pricePerDay.toFixed(2)}</span> บาท/วัน
            </span>
          )}
          {showSavings && wouldCost && !featured && (
            <span className="mt-1 text-[11px] text-muted-foreground/70 line-through tabular-nums">
              ฿{wouldCost.toLocaleString("th-TH")}
            </span>
          )}
        </div>

        {/* Benefits */}
        <ul className="w-full space-y-2.5 text-sm text-left">
          {[
            <>ดูคลิป VIP ได้<span className="font-semibold">ทั้งหมด</span></>,
            plan.maxDevices === 1
              ? "ดูได้ 1 อุปกรณ์"
              : `ดูพร้อมกันได้ ${plan.maxDevices} อุปกรณ์`,
            "ไม่จำกัดเวลา ไม่จำกัดจำนวนคลิป",
            "เปิดใช้งานอัตโนมัติทันที",
          ].map((label, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                  featured ? "bg-vip/20 text-vip" : "bg-primary/15 text-primary"
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-foreground/90">{label}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-auto w-full pt-2">
          <Button
            className={`w-full rounded-xl border-0 font-semibold transition-smooth shadow-lg ${
              featured
                ? "gradient-vip text-vip-foreground shadow-vip/40 hover:shadow-vip/60 h-12 text-base"
                : "gradient-primary text-white shadow-primary/20 hover:shadow-primary/40 h-11"
            }`}
            onClick={handleClick}
          >
            {isLoggedIn ? (
              featured ? (
                <span className="inline-flex items-center gap-1.5">
                  <Crown className="h-4 w-4" />
                  สมัครเลย — เปิดใช้ทันที
                </span>
              ) : (
                "สมัครเลย"
              )
            ) : (
              "เข้าสู่ระบบเพื่อสมัคร"
            )}
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-muted-foreground/80">
            <Lock className="h-2.5 w-2.5" />
            จ่ายครั้งเดียว ไม่มีการต่ออายุอัตโนมัติ
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
