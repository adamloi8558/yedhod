import { AdSlot, type AdSlotName } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_ROTATION: AdSlotName[] = ["in_feed_1", "in_feed_2", "in_feed_3"];
// 60 is the LCM of the responsive column counts we use (2/3/4/5) so any ad
// break lands on a fully-formed row. Keeps the grid tidy at every width.
const AD_EVERY = 60;

type FeedClip = {
  id: string;
  title: string;
  thumbnailR2Key: string | null;
  duration: number | null;
  categoryName?: string | null;
  createdAt?: Date | string | null;
};

export function ClipFeed({ clips }: { clips: FeedClip[] }) {
  if (clips.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-16 text-center text-white/40">
        <p className="text-sm">ยังไม่มีคลิปในหมวดนี้</p>
      </div>
    );
  }

  const segments: FeedClip[][] = [];
  for (let i = 0; i < clips.length; i += AD_EVERY) {
    segments.push(clips.slice(i, i + AD_EVERY));
  }

  return (
    <div>
      {segments.map((seg, si) => (
        <div key={si} className={si > 0 ? "mt-8" : ""}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {seg.map((c, i) => (
              <ClipCard
                key={c.id}
                clip={c}
                index={si * AD_EVERY + i + 1}
              />
            ))}
          </div>
          {si < segments.length - 1 && (
            <div className="my-8 flex justify-center">
              <AdSlot slot={IN_FEED_ROTATION[si % IN_FEED_ROTATION.length]!} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
