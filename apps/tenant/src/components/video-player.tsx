// The stream endpoint proxies the R2 object through the tenant's own
// domain, so we can use it directly as the video src — no more client-
// side fetch → JSON URL → mount video. Tenant scope + auth still happen
// inside the route handler.
export default function VideoPlayer({ clipId }: { clipId: string }) {
  return (
    <video
      src={`/api/clips/${clipId}/stream`}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded bg-black"
    />
  );
}
