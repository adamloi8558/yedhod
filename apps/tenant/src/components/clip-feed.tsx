import { AdSlot, type AdSlotName } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_EVERY = 8;
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {group.map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
          {idx < groups.length - 1 && (
            <AdSlot slot={IN_FEED_ROTATION[idx % IN_FEED_ROTATION.length]!} />
          )}
        </div>
      ))}
    </div>
  );
}
