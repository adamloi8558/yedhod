import { AdSlot, type AdSlotName } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_ROTATION: AdSlotName[] = ["in_feed_1", "in_feed_2", "in_feed_3"];
// 60 is the LCM of the responsive column counts we use (2/3/4/5) so any ad
// break lands on a fully-formed row. Keeps the grid tidy at every width.
const AD_EVERY = 60;
// Insert a native ad card inside the grid every N clips. 20 is another
// grid-friendly multiple (2/4/5 all divide it) so the native card lands
// as the row's first cell on all breakpoints.
const NATIVE_EVERY = 20;

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
            {seg.map((c, i) => {
              const globalIdx = si * AD_EVERY + i;
              const card = (
                <ClipCard key={c.id} clip={c} index={globalIdx + 1} />
              );
              // Insert one native ad card after every NATIVE_EVERY clips
              // (but not at the very end of a segment — the between-
              // segment break already carries an ad).
              const showNative =
                (globalIdx + 1) % NATIVE_EVERY === 0 && i !== seg.length - 1;
              if (!showNative) return card;
              return (
                <>
                  {card}
                  <div
                    key={`native-${globalIdx}`}
                    className="ad-slot--native aspect-video flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <AdSlot slot="native_row" />
                  </div>
                </>
              );
            })}
          </div>
          {si < segments.length - 1 && (
            <div className="my-10 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <AdSlot slot={IN_FEED_ROTATION[si % IN_FEED_ROTATION.length]!} />
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
