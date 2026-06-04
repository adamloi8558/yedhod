"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { formatCurrency } from "@kodhom/ui/lib/utils";
import { Check, Crown, Flame } from "lucide-react";

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
  const pricePerDay =
    Number.isFinite(priceNumber) && plan.durationDays > 0
      ? Math.max(1, Math.round(priceNumber / plan.durationDays))
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

  return (
    <Card
      className={`relative flex flex-col overflow-hidden rounded-2xl border-primary/30 transition-smooth hover:shadow-xl hover:shadow-primary/10 ${
        featured
          ? "ring-2 ring-primary glow-primary lg:scale-[1.04] z-10"
          : "hover:border-primary/50 hover:-translate-y-0.5"
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
      {featured && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full gradient-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-md shadow-primary/40">
          <Flame className="h-3 w-3" fill="currentColor" />
          คนเลือกมากสุด
        </span>
      )}
      {!featured && showSavings && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-vip/20 border border-vip/40 px-2.5 py-1 text-[11px] font-bold text-vip">
          ประหยัด {savingsPct}%
        </span>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {plan.name}
        </CardTitle>
        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          {tag}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-5">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold gradient-text">
              {formatCurrency(plan.priceThb)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatDuration(plan.durationDays)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {pricePerDay !== null && (
              <span className="text-xs text-muted-foreground">
                เฉลี่ย <span className="font-semibold text-foreground">{pricePerDay}</span> บาท/วัน
              </span>
            )}
            {showSavings && wouldCost && (
              <span className="text-xs text-muted-foreground/70 line-through tabular-nums">
                ฿{wouldCost.toLocaleString("th-TH")}
              </span>
            )}
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-foreground/90">
              ดูคลิป VIP ได้<span className="font-semibold">ทั้งหมด</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-foreground/90">
              {plan.maxDevices === 1
                ? "ดูได้ 1 อุปกรณ์"
                : `ดูพร้อมกันได้ ${plan.maxDevices} อุปกรณ์`}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-foreground/90">ไม่จำกัดเวลา ไม่จำกัดจำนวนคลิป</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-foreground/90">เปิดใช้งานอัตโนมัติทันที</span>
          </li>
        </ul>
        <div className="mt-auto pt-2">
          <Button
            className={`w-full rounded-xl text-white border-0 transition-smooth shadow-lg ${
              featured
                ? "gradient-primary shadow-primary/40 hover:shadow-primary/60 h-11 font-semibold"
                : "gradient-primary shadow-primary/20 hover:shadow-primary/40"
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
          <p className="mt-2 text-center text-[10.5px] text-muted-foreground/80">
            จ่ายเป็นครั้งๆ ไม่ตัดเงินอัตโนมัติ
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
