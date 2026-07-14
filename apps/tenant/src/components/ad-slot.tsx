import { getCurrentTenant } from "@/lib/tenant";
import { getTenantAds } from "@/lib/tenant-queries";
import { AdRender } from "./ad-render";

const VALID_SLOTS = [
  "header_top",
  "header_bottom",
  "catbar_below",
  "hero_below",
  "sidebar_top",
  "sidebar_mid",
  "sidebar_bot",
  "in_feed_1",
  "in_feed_2",
  "in_feed_3",
  "native_row",
  "between_sections",
  "before_video",
  "after_video",
  "under_title",
  "related_below",
  "popunder",
  "footer_top",
  "above_footer",
  "footer_bottom",
  "sticky_bottom",
] as const;

export type AdSlotName = (typeof VALID_SLOTS)[number];

// Slots whose only purpose is to inject a script (popunder). No frame,
// no "โฆษณา" label — they render nothing visible on purpose.
const INVISIBLE_SLOTS = new Set<AdSlotName>(["popunder"]);

// Slots that live inside a tight strip (mobile sticky bar) where any
// wrapper/label would eat the height. Keep them plain.
const CHROMELESS_SLOTS = new Set<AdSlotName>(["sticky_bottom"]);

export async function AdSlot({ slot }: { slot: AdSlotName }) {
  const tenant = await getCurrentTenant();
  const ads = await getTenantAds(tenant.id, slot);
  if (ads.length === 0) return null;

  if (INVISIBLE_SLOTS.has(slot)) {
    return (
      <div data-ad-slot={slot} className="ad-slot ad-slot--invisible">
        {ads.map((a) => (
          <AdRender key={a.id} ad={a} />
        ))}
      </div>
    );
  }

  if (CHROMELESS_SLOTS.has(slot)) {
    return (
      <div
        data-ad-slot={slot}
        className="ad-slot ad-slot--chromeless flex items-center justify-center py-1"
      >
        {ads.map((a) => (
          <AdRender key={a.id} ad={a} />
        ))}
      </div>
    );
  }

  return (
    <div data-ad-slot={slot} className="ad-slot">
      <div className="ad-slot__inner">
        <span className="ad-slot__label">โฆษณา</span>
        <div className="ad-slot__body">
          {ads.map((a) => (
            <AdRender key={a.id} ad={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
