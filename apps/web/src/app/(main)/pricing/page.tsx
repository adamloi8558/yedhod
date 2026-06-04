import { Suspense } from "react";
import { db } from "@kodhom/db";
import { pricingPlans } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { PricingCard } from "@/components/pricing-card";
import { getSession } from "@/lib/auth-server";
import { ProductJsonLd } from "@/components/jsonld/product";
import { BRAND, canonical, pageTitle } from "@/lib/seo/metadata";
import { Check, X } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  const title = pageTitle("แพ็กเกจสมาชิก VIP ดูคลิปไม่จำกัด");
  const description = `สมาชิก VIP ${BRAND} ดูคลิปไม่จำกัด คุณภาพ HD ไม่มีโฆษณา ชำระผ่าน PromptPay ปลอดภัย เปิดใช้งานทันที สำหรับผู้มีอายุ 18 ปีขึ้นไป`;
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

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      <ProductJsonLd plans={allPlans} />

      <div className="mb-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">แพ็กเกจสมาชิก</h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          เลือกแพ็กเกจที่เหมาะกับคุณ ดูคลิปไม่จำกัด คุณภาพ HD ไม่มีโฆษณา
        </p>
      </div>

      {allPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแพ็กเกจ</p>
      ) : (
        <Suspense
          fallback={
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {allPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="h-72 rounded-2xl border border-primary/20 bg-card/40 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {allPlans.map((plan: typeof allPlans[number]) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                featured={plan.isFeatured}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </Suspense>
      )}

      {/* Free vs VIP comparison — concrete, honest benefits only. */}
      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold tracking-tight text-center mb-6">
          ไม่สมัคร vs สมาชิก VIP
        </h2>
        <div className="rounded-2xl border border-border/40 bg-card/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-semibold border-b border-border/40">
            <span className="text-muted-foreground">สิ่งที่ได้</span>
            <span className="text-muted-foreground text-center min-w-[64px]">ไม่สมัคร</span>
            <span className="gradient-text text-center min-w-[64px]">VIP</span>
          </div>
          {[
            { label: "ดูตัวอย่างคลิป (สั้นๆ)", free: true, vip: true },
            { label: "ดูคลิปทั่วไปเต็มเรื่อง", free: false, vip: true, freeNote: "ต้องสมัครสมาชิกฟรี" },
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
                  <X className="h-4 w-4 text-muted-foreground/50" />
                )}
              </span>
              <span className="flex items-center justify-center min-w-[64px]">
                {row.vip ? (
                  <Check className="h-4 w-4 text-vip" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/50" />
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          ชำระผ่าน PromptPay หรือสลิปธนาคาร เปิดใช้งานทันทีหลังชำระสำเร็จ
        </p>
      </section>
    </div>
  );
}
