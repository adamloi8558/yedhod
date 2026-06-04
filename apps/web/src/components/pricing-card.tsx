"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { formatCurrency } from "@kodhom/ui/lib/utils";

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
}

function formatDuration(days: number): string {
  if (days >= 36500) return "ตลอดชีพ";
  if (days >= 365) return `${Math.floor(days / 365)} ปี`;
  if (days >= 30) return `${Math.floor(days / 30)} เดือน`;
  if (days >= 7) return `${Math.floor(days / 7)} สัปดาห์`;
  return `${days} วัน`;
}

// Short value tag derived from duration. Helps users compare plans at a
// glance without us inventing fake "popularity" data.
function valueTag(days: number): string {
  if (days >= 365) return "ประหยัดสุด";
  if (days >= 90) return "คุ้มกว่า";
  if (days >= 30) return "ยอดนิยม";
  return "ลองใช้งาน";
}

function isValidRedirect(value: string | null): value is string {
  if (!value) return false;
  // Allow only same-origin relative paths.
  return value.startsWith("/") && !value.startsWith("//");
}

export function PricingCard({ plan, featured, isLoggedIn }: PricingCardProps) {
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
    <Card className={`relative overflow-hidden rounded-2xl border-primary/30 transition-smooth hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 ${featured ? 'ring-2 ring-primary glow-primary' : 'hover:border-primary/50'}`}>
      {/* Top gradient bar on every card; featured stands out via ring + glow + badge */}
      <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
      {featured && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full gradient-primary px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md shadow-primary/30">
          ⭐ แนะนำ
        </span>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          {tag}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold gradient-text">
              {formatCurrency(plan.priceThb)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatDuration(plan.durationDays)}
            </span>
          </div>
          {pricePerDay !== null && (
            <div className="mt-1 text-xs text-muted-foreground">
              เฉลี่ย {pricePerDay} บาท/วัน
            </div>
          )}
        </div>
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">✓</span>
            อุปกรณ์สูงสุด {plan.maxDevices} เครื่อง
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">✓</span>
            ระยะเวลา {formatDuration(plan.durationDays)}
          </li>
        </ul>
        <Button
          className="w-full rounded-xl gradient-primary text-white border-0 shadow-lg shadow-primary/20 transition-smooth hover:shadow-primary/30"
          onClick={handleClick}
        >
          {isLoggedIn ? "สมัครเลย" : "เข้าสู่ระบบเพื่อสมัคร"}
        </Button>
      </CardContent>
    </Card>
  );
}
