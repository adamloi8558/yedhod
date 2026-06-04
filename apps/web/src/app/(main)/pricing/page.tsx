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
  Crown,
  Sparkles,
  PlayCircle,
  RefreshCw,
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

  const trustSignals: { icon: typeof Clock; text: string }[] = [
    { icon: Clock, text: "ซื้อได้ 24 ชั่วโมง เปิดใช้อัตโนมัติ" },
    { icon: Zap, text: "เข้าดูภายใน 30 วินาทีหลังจ่าย" },
    { icon: ShieldCheck, text: "ไม่ตัดเงินอัตโนมัติ จ่ายเป็นครั้งๆ" },
    { icon: Smartphone, text: "ดูได้ทุกอุปกรณ์" },
  ];

  const whyVip: { icon: typeof Crown; title: string; desc: string }[] = [
    {
      icon: Crown,
      title: "ปลดล็อกคลิป VIP ทั้งหมด",
      desc: "เข้าถึงทุกหมวด VIP เต็มเรื่อง ไม่มีตัดต่อ ไม่ใส่ลายน้ำ",
    },
    {
      icon: Sparkles,
      title: "อัปเดตคลิปใหม่ต่อเนื่อง",
      desc: "เพิ่มคลิปใหม่ทุกวัน เห็นก่อนใครก่อนเปิดให้ดูฟรี",
    },
    {
      icon: PlayCircle,
      title: "ดูได้ไม่จำกัด",
      desc: "ดูกี่คลิป กี่ครั้ง กี่ชั่วโมงก็ได้ ตลอดอายุแพ็กเกจ",
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

      {/* Hero */}
      <section className="relative overflow-hidden mb-10 rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-accent/40 to-background p-6 md:p-10 lg:p-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-vip/10 blur-3xl"
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          ระบบอัตโนมัติ 24 ชั่วโมง
        </span>
        <h1 className="relative mt-4 text-3xl md:text-5xl font-bold gradient-text tracking-tight">
          เลือกแพ็กเกจที่ใช่
        </h1>
        <p className="relative mt-3 md:mt-4 text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto">
          จ่ายครั้งเดียว ดูคลิป VIP เต็มเรื่อง ไม่จำกัดเวลา ไม่จำกัดจำนวน — เปิดใช้งานอัตโนมัติทันทีหลังจ่ายเงิน
        </p>

        {/* Trust row */}
        <div className="relative mt-7 flex flex-wrap justify-center gap-2 md:gap-2.5">
          {trustSignals.map((t) => {
            const Icon = t.icon;
            return (
              <span
                key={t.text}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-[11px] md:text-xs font-medium text-foreground/85 backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {t.text}
              </span>
            );
          })}
        </div>
      </section>

      {/* Plan grid */}
      {allPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแพ็กเกจ</p>
      ) : (
        <Suspense
          fallback={
            <div className={`grid gap-5 ${gridCols}`}>
              {allPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="h-96 rounded-2xl border border-primary/20 bg-card/40 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <div className={`grid gap-5 ${gridCols}`}>
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

      <p className="mt-5 text-center text-xs text-muted-foreground">
        ราคารวม VAT แล้ว ไม่มีค่าใช้จ่ายซ่อน
      </p>

      {/* Why VIP — 3 columns of concrete benefits */}
      <section className="mt-16">
        <h2 className="text-center text-xl md:text-2xl font-bold tracking-tight mb-2">
          ทำไมต้องเป็น <span className="gradient-text">VIP</span>?
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-8">
          สมัครครั้งเดียว ได้ทุกอย่างที่ต้องการ
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {whyVip.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-border/40 bg-card/40 p-5 md:p-6 transition-smooth hover:bg-card hover:border-primary/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary mb-4 transition-smooth group-hover:bg-primary/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

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

      {/* Comparison — keep it but tightened */}
      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-center text-xl md:text-2xl font-bold tracking-tight mb-6">
          ไม่สมัคร <span className="text-muted-foreground/70 text-base font-normal">vs</span>{" "}
          <span className="gradient-text">สมาชิก VIP</span>
        </h2>
        <div className="rounded-2xl border border-border/40 bg-card/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-semibold border-b border-border/40 bg-card/40">
            <span className="text-muted-foreground">สิ่งที่ได้</span>
            <span className="text-muted-foreground text-center min-w-[64px]">ไม่สมัคร</span>
            <span className="gradient-text text-center min-w-[64px]">VIP</span>
          </div>
          {[
            { label: "ดูตัวอย่างคลิป (สั้นๆ)", free: true, vip: true },
            { label: "ดูคลิปทั่วไปเต็มเรื่อง", free: false, vip: true },
            { label: "ดูคลิป VIP เต็มเรื่อง", free: false, vip: true },
            { label: "ไม่จำกัดเวลา/จำนวนคลิป", free: false, vip: true },
            { label: "ดูพร้อมกันหลายอุปกรณ์", free: false, vip: true },
            { label: "อัปเดตคลิปใหม่ต่อเนื่อง", free: true, vip: true },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 md:px-6 py-3 text-sm border-b border-border/30 last:border-0"
            >
              <span className="text-foreground/90">{row.label}</span>
              <span className="flex items-center justify-center min-w-[64px]">
                {row.free ? (
                  <Check className="h-4 w-4 text-primary/70" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/40" />
                )}
              </span>
              <span className="flex items-center justify-center min-w-[64px]">
                {row.vip ? (
                  <Check className="h-4 w-4 text-vip" strokeWidth={3} />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/40" />
                )}
              </span>
            </div>
          ))}
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
