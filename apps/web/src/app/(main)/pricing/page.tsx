import { Suspense } from "react";
import { db } from "@kodhom/db";
import { pricingPlans } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { PricingCard } from "@/components/pricing-card";
import { getSession } from "@/lib/auth-server";
import { ProductJsonLd } from "@/components/jsonld/product";
import { BRAND, canonical, pageTitle } from "@/lib/seo/metadata";
import {
  Check,
  X,
  Clock,
  Zap,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Crown,
  Film,
  PlayCircle,
  ShieldAlert,
  Infinity as InfinityIcon,
  MonitorSmartphone,
  RotateCw,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  const title = pageTitle("แพ็กเกจสมาชิก VIP ดูคลิปไม่จำกัด");
  const description = `สมาชิก VIP ${BRAND} ดูคลิปไม่จำกัด คุณภาพ HD ไม่มีโฆษณา ชำระผ่าน PromptPay ระบบเปิดใช้งานอัตโนมัติ 24 ชั่วโมง สำหรับผู้มีอายุ 18 ปีขึ้นไป`;
  return {
    title,
    description,
    alternates: canonical("/pricing"),
    openGraph: {
      type: "website",
      url: "/pricing",
      title,
      description,
    },
  };
}

export default async function PricingPage() {
  const [allPlans, session] = await Promise.all([
    db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(asc(pricingPlans.sortOrder)),
    getSession(),
  ]);
  const isLoggedIn = !!session?.user;

  // Highest per-day price across plans = the "no-discount" baseline used
  // to compute honest savings strikethroughs on longer plans.
  const baselinePricePerDay = allPlans.reduce<number>((max, p) => {
    const price = Number.parseFloat(p.priceThb);
    if (!Number.isFinite(price) || p.durationDays <= 0) return max;
    return Math.max(max, price / p.durationDays);
  }, 0);

  // Decide grid columns from plan count so 4 plans get a single row at lg.
  const gridCols =
    allPlans.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : allPlans.length === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : allPlans.length === 2
          ? "sm:grid-cols-2"
          : "";

  const trustSignals: {
    icon: typeof Clock;
    title: string;
    sub: string;
  }[] = [
    {
      icon: Clock,
      title: "สมัครได้ตลอด 24 ชั่วโมง",
      sub: "สมัครเมื่อไรก็ได้",
    },
    {
      icon: Zap,
      title: "เปิดใช้งานทันทีภายในไม่กี่วินาที",
      sub: "หลังยืนยันการชำระเงิน",
    },
    {
      icon: ShieldCheck,
      title: "ชำระครั้งเดียว ไม่มีต่ออายุอัตโนมัติ",
      sub: "หมดอายุเมื่อครบระยะเวลา",
    },
    {
      icon: Smartphone,
      title: "รองรับทุกอุปกรณ์",
      sub: "มือถือ แท็บเล็ต และคอมพิวเตอร์",
    },
  ];

  const faqs: { q: string; a: string }[] = [
    {
      q: "จ่ายแล้วเข้าใช้ได้ทันทีไหม?",
      a: "ใช้ได้ทันที ระบบยืนยันการชำระเงินอัตโนมัติ 24 ชั่วโมง โดยทั่วไปเปิดใช้งานภายใน 30 วินาที",
    },
    {
      q: "มีตัดเงินอัตโนมัติทุกเดือนไหม?",
      a: "ไม่มี — เป็นการจ่ายเป็นครั้งๆ ไม่ผูกบัตร เมื่อครบกำหนดถ้าอยากต่อค่อยจ่ายใหม่",
    },
    {
      q: "ใช้บนหลายเครื่องพร้อมกันได้กี่เครื่อง?",
      a: "ขึ้นกับแพ็กเกจ — 15 วัน/30 วัน ใช้ได้ 2 อุปกรณ์, 3 เดือนใช้ได้ 3 อุปกรณ์, 1 ปีใช้ได้ 5 อุปกรณ์",
    },
    {
      q: "ชำระเงินได้ทางไหนบ้าง?",
      a: "PromptPay (สแกน QR) หรือโอนแล้วแนบสลิป รองรับธนาคารทุกแห่งในไทย",
    },
    {
      q: "ข้อมูลปลอดภัยไหม?",
      a: "ปลอดภัย — เว็บไม่เก็บข้อมูลบัตรเครดิต ทุกการชำระผ่าน PromptPay เท่านั้น และข้อมูลส่วนตัวไม่ถูกเปิดเผย",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <ProductJsonLd plans={allPlans} />

      {/* Hero — balanced premium card */}
      <section className="relative overflow-hidden mb-10 rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/[0.08] via-background to-background p-6 md:p-9 text-center shadow-xl shadow-primary/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-vip/12 blur-3xl"
        />
        {/* Pill */}
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/70 px-3.5 py-1.5 text-xs md:text-sm font-medium text-foreground/90 backdrop-blur">
          <span className="flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-white">
            <Zap className="h-3 w-3" fill="currentColor" strokeWidth={0} />
          </span>
          ระบบเปิดใช้งานอัตโนมัติ 24 ชั่วโมง
        </span>

        {/* Headline */}
        <h1 className="relative mt-4 text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
          <span className="text-foreground">เลือกแพ็กเกจสมาชิก </span>
          <span className="bg-gradient-to-br from-vip via-vip to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_oklch(0.78_0.14_75/0.4)]">
            VIP
          </span>
        </h1>

        <p className="relative mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          เข้าถึงทุกอรรถรสแบบเต็มรูปแบบ ดูได้ไม่จำกัด ทุกที่ ทุกเวลา
          <br className="hidden md:inline" />
          <span className="text-primary font-semibold">พร้อมเปิดใช้งานอัตโนมัติหลังการชำระเงิน</span>
        </p>

        {/* Trust row — 4 columns */}
        <div className="relative mt-7">
          <div className="rounded-2xl border border-primary/20 bg-card/30 px-3 py-4 md:px-5 md:py-5 backdrop-blur">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 md:gap-y-0 md:divide-x divide-primary/15">
              {trustSignals.map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.title}
                    className="flex items-center gap-3 px-2 md:px-4 md:justify-center"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-primary/40 bg-gradient-to-b from-primary/20 to-primary/5">
                      <Icon className="h-5 w-5 text-primary" strokeWidth={2.2} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs md:text-sm font-semibold text-foreground leading-tight">
                        {t.title}
                      </p>
                      <p className="mt-0.5 text-[11px] md:text-xs text-muted-foreground leading-snug">
                        {t.sub}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section heading — extra space so the featured card's notched
          ribbon never collides with the subheading. */}
      <div className="text-center mb-10 md:mb-14">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          เลือกแพ็กเกจที่<span className="gradient-text">ใช่</span>สำหรับคุณ
        </h2>
        <p className="mt-1.5 text-xs md:text-sm text-muted-foreground">
          ราคาเดียวจบ ไม่มีค่าใช้จ่ายซ่อน
        </p>
      </div>

      {/* Plan grid */}
      {allPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแพ็กเกจ</p>
      ) : (
        <Suspense
          fallback={
            <div className={`grid gap-6 ${gridCols}`}>
              {allPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="h-[28rem] rounded-2xl border border-primary/20 bg-card/40 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <div className={`grid gap-6 md:gap-7 ${gridCols} items-stretch`}>
            {allPlans.map((plan: typeof allPlans[number]) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                featured={plan.isFeatured}
                isLoggedIn={isLoggedIn}
                baselinePricePerDay={baselinePricePerDay || null}
              />
            ))}
          </div>
        </Suspense>
      )}

      {/* How it works — 3 steps */}
      <section className="mt-16">
        <h2 className="text-center text-xl md:text-2xl font-bold tracking-tight mb-8">
          เริ่มต้นง่ายๆ ใน 3 ขั้น
        </h2>
        <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
          {[
            { n: "1", title: "เลือกแพ็กเกจ", desc: "เลือกระยะเวลาที่เหมาะกับการใช้งาน" },
            { n: "2", title: "ชำระเงิน", desc: "สแกน QR PromptPay หรือแนบสลิปโอน" },
            { n: "3", title: "เริ่มดูทันที", desc: "ระบบเปิดใช้งานอัตโนมัติภายใน 30 วินาที" },
          ].map((step) => (
            <div
              key={step.n}
              className="relative rounded-2xl border border-border/40 bg-card/30 p-5 text-center"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-base font-bold text-white shadow-lg shadow-primary/30">
                {step.n}
              </div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison — premium access table */}
      <section className="mt-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            เปรียบเทียบ
            <span className="bg-gradient-to-br from-vip via-vip to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_14px_oklch(0.78_0.14_75/0.35)]">
              สิทธิ์การเข้าถึง
            </span>
          </h2>
          <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-primary/60">
            <span aria-hidden className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40" />
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary/60" />
            <p className="px-2 text-xs md:text-sm text-muted-foreground">
              อิสระในการรับชมที่เหนือกว่า เพื่อประสบการณ์ระดับพรีเมียม
            </p>
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary/60" />
            <span aria-hidden className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40" />
          </div>
        </div>

        <div className="relative rounded-2xl border border-primary/20 bg-card/30 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_120px_140px] md:grid-cols-[1fr_160px_180px] items-center px-3 md:px-5 py-4 border-b border-primary/15 bg-card/40">
            <div className="flex items-center justify-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm md:text-base font-semibold text-foreground">
                สิทธิประโยชน์
              </span>
            </div>
            <div className="text-center text-xs md:text-sm font-medium text-muted-foreground">
              สมาชิกทั่วไป
            </div>
            <div className="text-center text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 text-vip">
              <Crown className="h-4 w-4" fill="currentColor" />
              สมาชิก VIP
            </div>
          </div>

          {/* VIP column gold tint background */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-[140px] md:w-[180px] bg-gradient-to-b from-vip/[0.08] via-vip/[0.04] to-transparent ring-1 ring-inset ring-vip/30 rounded-r-2xl"
          />

          {[
            {
              icon: Film,
              title: "รับชมตัวอย่างคอนเทนต์",
              sub: "ตัวอย่างคอนเทนต์คุณภาพระดับพรีเมียม",
              free: true,
              vip: true,
            },
            {
              icon: PlayCircle,
              title: "เข้าถึงคอนเทนต์มาตรฐานแบบเต็มรูปแบบ",
              sub: "รับชมคอนเทนต์ทั่วไปแบบเต็มเรื่อง",
              free: false,
              vip: true,
            },
            {
              icon: ShieldAlert,
              title: "เข้าถึงคอนเทนต์ VIP แบบเต็มรูปแบบ",
              sub: "คอนเทนต์พิเศษสำหรับสมาชิก VIP เท่านั้น",
              free: false,
              vip: true,
            },
            {
              icon: InfinityIcon,
              title: "รับชมได้ไม่จำกัดตลอดระยะเวลาสมาชิก",
              sub: "ไม่จำกัดเวลาและจำนวนคอนเทนต์",
              free: false,
              vip: true,
            },
            {
              icon: MonitorSmartphone,
              title: "รองรับการใช้งานหลายอุปกรณ์",
              sub: "รับชมได้พร้อมกันบนหลายอุปกรณ์",
              free: false,
              vip: true,
            },
            {
              icon: RotateCw,
              title: "อัปเดตคอนเทนต์ใหม่อย่างต่อเนื่อง",
              sub: "เข้าถึงคอนเทนต์ใหม่ก่อนใคร ไม่พลาดทุกความบันเทิง",
              free: true,
              vip: true,
            },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.title}
                className="relative grid grid-cols-[1fr_120px_140px] md:grid-cols-[1fr_160px_180px] items-center px-3 md:px-5 py-4 md:py-5 border-b border-primary/10 last:border-0"
              >
                <div className="flex items-start gap-3 min-w-0 pr-3">
                  <span className="flex h-9 w-9 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30 text-primary">
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm md:text-base font-semibold text-foreground leading-tight">
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-[11px] md:text-xs text-muted-foreground leading-snug">
                      {row.sub}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  {row.free ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/60 ring-1 ring-muted-foreground/20">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="relative z-[1] flex items-center justify-center">
                  {row.vip ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full gradient-vip text-vip-foreground shadow-md shadow-vip/40">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/60 ring-1 ring-muted-foreground/20">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-center text-xl md:text-2xl font-bold tracking-tight mb-2">
          คำถามที่พบบ่อย
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-8">
          ยังลังเล? อ่านตรงนี้ก่อน
        </p>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border/40 bg-card/30 overflow-hidden transition-smooth hover:border-primary/40 open:border-primary/50"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 md:px-5 py-4 font-medium text-sm md:text-base list-none">
                <span>{f.q}</span>
                <span
                  aria-hidden
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-smooth group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-4 md:px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA — reassurance band */}
      <section className="mt-16 mb-4 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/40 to-vip/5 p-6 md:p-10 text-center">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          พร้อมเริ่มดูแบบ <span className="gradient-text">VIP</span> หรือยัง?
        </h2>
        <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
          เลื่อนขึ้นไปเลือกแพ็กเกจที่เหมาะกับคุณ — ระบบเปิดใช้ทันทีหลังจ่ายเงิน
        </p>
        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            ไม่ผูกบัตร
          </span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            ปลอดภัย ไม่เก็บข้อมูลบัตร
          </span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ระบบทำงาน 24 ชม.
          </span>
        </div>
      </section>
    </div>
  );
}
