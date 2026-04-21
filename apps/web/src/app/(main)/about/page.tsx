import { Breadcrumb } from "@/components/breadcrumb";
import { BRAND, BRAND_TAGLINE, canonical, pageTitle } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const revalidate = 86400;

export function generateMetadata(): Metadata {
  const title = pageTitle(`เกี่ยวกับ ${BRAND}`);
  const description = `${BRAND} ${BRAND_TAGLINE} แพลตฟอร์มคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง ปลอดภัย สำหรับผู้มีอายุ 18 ปีขึ้นไป`;
  return {
    title,
    description,
    alternates: canonical("/about"),
    openGraph: {
      type: "website",
      url: "/about",
      title,
      description,
    },
  };
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 animate-fade-in">
      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: `เกี่ยวกับ ${BRAND}` },
        ]}
      />

      <article className="prose prose-invert max-w-none">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-6">
          เกี่ยวกับ {BRAND}
        </h1>

        <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
          <strong>{BRAND}</strong> คือแพลตฟอร์มรวมคลิปวิดีโอผู้ใหญ่คุณภาพสูงสัญชาติไทย
          สร้างขึ้นเพื่อผู้ชมที่มองหาประสบการณ์รับชมที่ปลอดภัย เข้าถึงง่าย
          และคัดสรรเนื้อหามาอย่างพิถีพิถัน เว็บไซต์ของเราจำกัดการเข้าชม
          เฉพาะผู้มีอายุ 18 ปีขึ้นไปเท่านั้น
        </p>

        <h2 className="mt-10 text-xl md:text-2xl font-semibold">ทำไมต้อง {BRAND}</h2>
        <ul className="mt-4 space-y-3 text-sm md:text-base text-foreground/85 list-disc pl-6">
          <li>คลิปคุณภาพ HD คัดสรรใหม่ทุกวัน</li>
          <li>หมวดหมู่หลากหลาย รองรับทุกความชอบ</li>
          <li>รองรับทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์</li>
          <li>สมาชิก VIP รับชมคลิปพรีเมียมแบบไม่จำกัด</li>
          <li>ไม่มีโฆษณาป๊อปอัปรบกวน ประสบการณ์สะอาด</li>
          <li>ปลอดภัย เข้ารหัสการเชื่อมต่อ HTTPS ตลอดเวลา</li>
        </ul>

        <h2 className="mt-10 text-xl md:text-2xl font-semibold">แพ็กเกจสมาชิก</h2>
        <p className="mt-3 text-sm md:text-base text-foreground/85 leading-relaxed">
          {BRAND} เปิดให้รับชมคลิปหมวดทั่วไปได้ฟรีหลังสมัครสมาชิก
          สำหรับผู้ที่ต้องการเข้าถึงคลิป VIP สามารถเลือก
          <a href="/pricing" className="text-primary hover:underline mx-1">
            แพ็กเกจสมาชิก
          </a>
          ที่เหมาะกับคุณ รองรับการชำระผ่าน PromptPay ปลอดภัย เปิดใช้งานทันที
        </p>

        <h2 className="mt-10 text-xl md:text-2xl font-semibold">นโยบายเนื้อหาผู้ใหญ่</h2>
        <p className="mt-3 text-sm md:text-base text-foreground/85 leading-relaxed">
          เว็บไซต์ {BRAND} มีการประกาศเป็นเว็บไซต์สำหรับผู้ใหญ่อย่างชัดเจน
          ผ่านมาตรฐาน RTA (Restricted To Adults) เพื่อให้โปรแกรมควบคุมเนื้อหา
          ของผู้ปกครองและเครื่องมือค้นหาสามารถกรองเนื้อหาได้อย่างถูกต้อง
          เราไม่อนุญาตให้ผู้ที่มีอายุต่ำกว่า 18 ปี เข้าใช้งานเว็บไซต์นี้ในทุกกรณี
        </p>

        <h2 className="mt-10 text-xl md:text-2xl font-semibold">คำถามที่พบบ่อย</h2>
        <dl className="mt-4 space-y-4 text-sm md:text-base">
          <div>
            <dt className="font-semibold text-foreground">อายุขั้นต่ำในการใช้งาน?</dt>
            <dd className="mt-1 text-foreground/80">
              ต้องมีอายุ 18 ปีบริบูรณ์ขึ้นไปเท่านั้น
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">สมาชิก VIP ใช้งานได้กี่อุปกรณ์?</dt>
            <dd className="mt-1 text-foreground/80">
              ขึ้นอยู่กับแพ็กเกจที่เลือก ดูรายละเอียดได้ที่หน้า
              <a href="/pricing" className="text-primary hover:underline mx-1">
                แพ็กเกจสมาชิก
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">คลิปอัปเดตบ่อยแค่ไหน?</dt>
            <dd className="mt-1 text-foreground/80">อัปเดตคลิปใหม่ทุกวัน</dd>
          </div>
        </dl>
      </article>
    </div>
  );
}
