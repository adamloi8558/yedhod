import { AdSlot, type AdSlotName } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_EVERY = 12;
const IN_FEED_ROTATION: AdSlotName[] = ["in_feed_1", "in_feed_2", "in_feed_3"];

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
      <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center text-white/40">
        <p className="text-sm">ยังไม่มีคลิปในหมวดนี้</p>
      </div>
    );
  }

  const groups: FeedClip[][] = [];
  for (let i = 0; i < clips.length; i += IN_FEED_EVERY) {
    groups.push(clips.slice(i, i + IN_FEED_EVERY));
  }

  return (
    <div className="space-y-10">
      {groups.map((group, gi) => (
        <div key={gi}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {group.map((c, i) => (
              <ClipCard
                key={c.id}
                clip={c}
                index={gi * IN_FEED_EVERY + i + 1}
              />
            ))}
          </div>
          {gi < groups.length - 1 && (
            <div className="my-8 flex justify-center">
              <AdSlot slot={IN_FEED_ROTATION[gi % IN_FEED_ROTATION.length]!} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
