import { getCurrentTenant } from "@/lib/tenant";
import { getTenantAds } from "@/lib/tenant-queries";
import { AdRender } from "./ad-render";

const VALID_SLOTS = [
  "header_top",
  "header_bottom",
  "sidebar_top",
  "sidebar_mid",
  "sidebar_bot",
  "in_feed_1",
  "in_feed_2",
  "in_feed_3",
  "before_video",
  "after_video",
  "under_title",
  "popunder",
  "footer_top",
  "footer_bottom",
  "sticky_bottom",
] as const;

export type AdSlotName = (typeof VALID_SLOTS)[number];

export async function AdSlot({ slot }: { slot: AdSlotName }) {
  const tenant = await getCurrentTenant();
  const ads = await getTenantAds(tenant.id, slot);
  if (ads.length === 0) return null;
  return (
    <div
      data-ad-slot={slot}
      className="ad-slot my-3 flex flex-col items-center gap-3"
    >
      {ads.map((a) => (
        <AdRender key={a.id} ad={a} />
      ))}
    </div>
  );
}
