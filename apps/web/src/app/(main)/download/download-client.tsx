"use client";

import { useEffect, useState } from "react";
import {
  Smartphone,
  Apple,
  Monitor,
  Download,
  Zap,
  ShieldCheck,
  Wifi,
  Home,
  Share,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
} from "lucide-react";

type OS = "ios" | "android" | "mac" | "windows";

function detectOS(): OS {
  if (typeof window === "undefined") return "android";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua)) return "mac";
  return "windows";
}

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function DownloadClient() {
  const [os, setOs] = useState<OS>("android");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setOs(detectOS());
    // Already installed?
    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setInstalled(true);
    }
    function onPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function triggerInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  }

  const tabs: { id: OS; label: string; icon: typeof Apple }[] = [
    { id: "ios", label: "iPhone / iPad", icon: Apple },
    { id: "android", label: "Android", icon: Smartphone },
    { id: "mac", label: "Mac", icon: Monitor },
    { id: "windows", label: "Windows", icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/[0.08] via-background to-background p-6 md:p-9 text-center shadow-xl shadow-primary/10 mb-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-white shadow-lg shadow-primary/30">
          <Download className="h-7 w-7" />
        </div>
        <h1 className="relative text-2xl md:text-3xl font-bold tracking-tight">
          ติดตั้งแอป <span className="gradient-text">เย็ดโหด</span>
        </h1>
        <p className="relative mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
          เปิดเร็วกว่า เหมือนแอปจริง — ไม่ต้องโหลดผ่าน App Store หรือ Play Store
          <br className="hidden md:inline" />
          <span className="text-primary font-semibold">ฟรี! เลือกระบบของคุณด้านล่างเพื่อดูวิธีติดตั้ง</span>
        </p>

        {installed && (
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            ติดตั้งเรียบร้อยแล้ว
          </div>
        )}

        {!installed && installEvent && (
          <button
            type="button"
            onClick={triggerInstall}
            className="relative mt-5 inline-flex items-center justify-center gap-2 rounded-xl gradient-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-smooth hover:shadow-primary/50"
          >
            <Download className="h-4 w-4" />
            ติดตั้งทันที (กดเพียงปุ่มเดียว)
          </button>
        )}
      </section>

      {/* Benefits */}
      <section className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Zap, title: "เปิดเร็ว", sub: "เปิดทันที ไม่ต้องผ่าน Browser" },
          { icon: Wifi, title: "กินเน็ตน้อย", sub: "โหลดน้อยกว่าเว็บปกติ" },
          { icon: ShieldCheck, title: "ปลอดภัย", sub: "ไม่ต้องดาวน์โหลดไฟล์ใดๆ" },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.title}
              className="rounded-2xl border border-primary/15 bg-card/30 p-3 md:p-4 text-center"
            >
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs md:text-sm font-semibold">{b.title}</p>
              <p className="mt-0.5 text-[10px] md:text-xs text-muted-foreground leading-snug">
                {b.sub}
              </p>
            </div>
          );
        })}
      </section>

      {/* OS tabs */}
      <section className="mb-8">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight mb-1">
          เลือกระบบของคุณ
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          เราเลือกคู่มือให้แล้ว — กดเปลี่ยนได้ตามต้องการ
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = os === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOs(t.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth ${
                  active
                    ? "gradient-primary text-white shadow-md shadow-primary/30"
                    : "border border-border/40 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {os === "ios" && <IOSGuide />}
        {os === "android" && <AndroidGuide />}
        {os === "mac" && <MacGuide />}
        {os === "windows" && <WindowsGuide />}
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg md:text-xl font-semibold tracking-tight mb-3">
          คำถามที่พบบ่อย
        </h2>
        <div className="space-y-2">
          {[
            {
              q: "ติดตั้งแล้วเสียพื้นที่เครื่องเยอะไหม?",
              a: "ไม่เลย — แอปนี้ใช้พื้นที่น้อยกว่า 1 MB เพราะเป็น web app ที่ทำงานผ่าน browser engine ของระบบ",
            },
            {
              q: "ติดตั้งไม่ได้?",
              a: "บน iPhone ต้องเปิดด้วย Safari เท่านั้น (ไม่ใช่ Chrome) — บน Android ใช้ Chrome หรือ Edge — บน PC ใช้ Chrome/Edge",
            },
            {
              q: "ลบแอปออกยังไง?",
              a: "เหมือนแอปทั่วไป — กดค้างที่ไอคอน แล้วเลือก 'ลบ' หรือ 'Uninstall'",
            },
            {
              q: "ปลอดภัยไหม?",
              a: "ปลอดภัย — ไม่มีการดาวน์โหลดไฟล์ APK/IPA ใดๆ ทุกอย่างทำงานผ่าน browser ที่คุณใช้อยู่",
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border/40 bg-card/30 overflow-hidden transition-smooth hover:border-primary/40 open:border-primary/50"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 font-medium text-sm list-none">
                <span>{f.q}</span>
                <span
                  aria-hidden
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-smooth group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white shadow-md shadow-primary/30">
        {n}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm md:text-base font-semibold leading-snug">{title}</p>
        {children && (
          <div className="mt-1 text-xs md:text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function GuideCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-card/30 p-5 md:p-6">
      <h3 className="text-base md:text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function IOSGuide() {
  return (
    <GuideCard
      title="iPhone และ iPad"
      sub="ใช้เวลาประมาณ 30 วินาที — ต้องใช้ Safari เท่านั้น"
    >
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90">
        ⚠️ ระวัง: บน iPhone/iPad ต้องเปิดด้วย <strong>Safari</strong> (เบราว์เซอร์รูปเข็มทิศสีฟ้า)
        เท่านั้น ถ้ากำลังเปิดด้วย Chrome ให้คัดลอก URL ไปวางใน Safari ก่อน
      </div>
      <Step n={1} title="กดปุ่ม Share (สี่เหลี่ยมมีลูกศรขึ้น) ที่แถบเครื่องมือ">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <Share className="h-4 w-4 text-primary" />
          <span>ปกติอยู่ด้านล่างของหน้าจอบน iPhone หรือมุมขวาบนบน iPad</span>
        </span>
      </Step>
      <Step n={2} title="เลื่อนลงแล้วเลือก ‘เพิ่มไปยังหน้าจอโฮม’">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <PlusSquare className="h-4 w-4 text-primary" />
          <span>ภาษาอังกฤษ: Add to Home Screen</span>
        </span>
      </Step>
      <Step n={3} title="กด ‘เพิ่ม’ ที่มุมขวาบน">
        ไอคอน เย็ดโหด จะถูกเพิ่มที่หน้าจอโฮม
      </Step>
      <Step n={4} title="กดไอคอนจากหน้าจอโฮมเพื่อเปิด">
        แอปจะเปิดแบบเต็มจอ ไม่มีแถบ browser
      </Step>
    </GuideCard>
  );
}

function AndroidGuide() {
  return (
    <GuideCard title="Android" sub="ใช้เวลาประมาณ 15 วินาที — แนะนำ Chrome หรือ Edge">
      <Step n={1} title="เปิดด้วย Chrome หรือ Edge">
        ถ้ากำลังใช้ browser อื่น ให้เปิด duketoon URL ใน Chrome/Edge ก่อน
      </Step>
      <Step n={2} title="กดเมนู 3 จุด (⋮) มุมขวาบน">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <MoreVertical className="h-4 w-4 text-primary" />
          <span>ในแถบ URL ด้านบน</span>
        </span>
      </Step>
      <Step n={3} title="เลือก ‘ติดตั้งแอป’ หรือ ‘เพิ่มไปยังหน้าจอโฮม’">
        บางเครื่องอาจแสดง popup ขึ้นมาให้กดติดตั้งโดยอัตโนมัติ
      </Step>
      <Step n={4} title="ยืนยันการติดตั้ง">
        ไอคอน เย็ดโหด จะถูกเพิ่มที่หน้าจอ พร้อมเปิดใช้งานได้เลย
      </Step>
    </GuideCard>
  );
}

function MacGuide() {
  return (
    <GuideCard title="macOS" sub="ใช้ Safari หรือ Chrome">
      <Step n={1} title="Safari: เปิดเมนู File → ‘เพิ่มในแท่นวาง’ (Add to Dock)">
        หรือกดไอคอน Share ในแถบเครื่องมือ แล้วเลือก Add to Dock
      </Step>
      <Step n={2} title="Chrome / Edge: กดไอคอน ‘ติดตั้ง’ ที่ขวาของแถบ URL">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <Download className="h-4 w-4 text-primary" />
          <span>หรือเมนู ⋮ → ‘ติดตั้ง เย็ดโหด’</span>
        </span>
      </Step>
      <Step n={3} title="เปิดจาก Launchpad หรือ Dock">
        แอปจะรันในหน้าต่างของตัวเอง ไม่ต้องเปิด browser
      </Step>
    </GuideCard>
  );
}

function WindowsGuide() {
  return (
    <GuideCard title="Windows" sub="ใช้ Chrome หรือ Edge">
      <Step n={1} title="กดไอคอน ‘ติดตั้ง’ ที่ขวาของแถบ URL">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <Download className="h-4 w-4 text-primary" />
          <span>หรือเมนู ⋮ → ‘ติดตั้ง เย็ดโหด’</span>
        </span>
      </Step>
      <Step n={2} title="ยืนยันการติดตั้ง">
        แอปจะถูกเพิ่มลง Start menu และ Desktop
      </Step>
      <Step n={3} title="เปิดจาก Start menu หรือ taskbar">
        <span className="inline-flex items-center gap-1.5 mt-1">
          <Home className="h-4 w-4 text-primary" />
          <span>แอปจะรันแยกจาก browser ปกติ</span>
        </span>
      </Step>
    </GuideCard>
  );
}
