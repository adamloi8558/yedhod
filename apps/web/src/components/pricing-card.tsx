"use client";

import { useRouter } from "next/navigation";
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
  };
  categoryId: string;
  featured?: boolean;
}

function formatDuration(days: number): string {
  if (days >= 36500) return "ตลอดชีพ";
  if (days >= 365) return `${Math.floor(days / 365)} ปี`;
  if (days >= 30) return `${Math.floor(days / 30)} เดือน`;
  if (days >= 7) return `${Math.floor(days / 7)} สัปดาห์`;
  return `${days} วัน`;
}

export function PricingCard({ plan, categoryId, featured }: PricingCardProps) {
  const router = useRouter();

  return (
    <Card className={`relative overflow-hidden rounded-2xl transition-smooth hover:scale-[1.02] hover:shadow-xl ${featured ? 'ring-2 ring-primary glow-primary border-primary/30' : 'border-border/50 hover:border-primary/30'}`}>
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold gradient-text">
            {formatCurrency(plan.priceThb)}
          </span>
          <span className="text-sm text-muted-foreground">
            / {formatDuration(plan.durationDays)}
          </span>
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
          className={`w-full rounded-xl transition-smooth ${featured ? 'gradient-primary text-white border-0 shadow-lg shadow-primary/20 hover:shadow-primary/30' : 'hover:bg-primary hover:text-primary-foreground'}`}
          variant={featured ? "default" : "outline"}
          onClick={() =>
            router.push(
              `/payment?planId=${plan.id}&categoryId=${categoryId}`
            )
          }
        >
          สมัครเลย
        </Button>
      </CardContent>
    </Card>
  );
}
