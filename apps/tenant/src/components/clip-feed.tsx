import { AdSlot, type AdSlotName } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_EVERY = 12;
const IN_FEED_ROTATION: AdSlotName[] = ["in_feed_1", "in_feed_2", "in_feed_3"];

type FeedClip = {
  id: string;
  title: string;
  thumbnailR2Key: string | null;
  duration: number | null;
};

export function ClipFeed({ clips }: { clips: FeedClip[] }) {
  const groups: FeedClip[][] = [];
  for (let i = 0; i < clips.length; i += IN_FEED_EVERY) {
    groups.push(clips.slice(i, i + IN_FEED_EVERY));
  }
  return (
    <div className="space-y-8">
      {groups.map((group, idx) => (
        <div key={idx}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {group.map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
          {idx < groups.length - 1 && (
            <div className="my-6">
              <AdSlot slot={IN_FEED_ROTATION[idx % IN_FEED_ROTATION.length]!} />
            </div>
          )}
        </div>
      ))}
      {clips.length === 0 && (
        <div className="rounded-lg border border-white/10 p-12 text-center text-white/40">
          <p className="text-sm">ยังไม่มีคลิปในหมวดนี้</p>
        </div>
      )}
    </div>
  );
}
