import Link from "next/link";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "@kodhom/ui/components/button";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">เว็บ Clone (Tenants)</h1>
        <Link href="/dashboard/tenants/new">
          <Button>+ เพิ่มเว็บใหม่</Button>
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">ชื่อ</th>
              <th className="p-3 text-left">โดเมน</th>
              <th className="p-3 text-left">Slug</th>
              <th className="p-3 text-left">สถานะ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">{t.name}</td>
                <td className="p-3">
                  <a
                    className="text-primary underline"
                    href={`https://${t.primaryDomain}`}
                    target="_blank"
                    rel="noopener"
                  >
                    {t.primaryDomain}
                  </a>
                </td>
                <td className="p-3 font-mono text-xs">{t.slug}</td>
                <td className="p-3">
                  {t.isActive ? (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-green-500">active</span>
                  ) : (
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-500">inactive</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Link href={`/dashboard/tenants/${t.id}`}>
                    <Button variant="outline" size="sm">แก้ไข</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  ยังไม่มี tenant
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
