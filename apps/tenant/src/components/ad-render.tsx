import {
  galaksionBanner,
  galaksionPopunder,
  aadsBanner,
} from "@/lib/ad-templates";

type AdInput = {
  id: string;
  slot: string;
  type: string;
  embedCode: string | null;
  imageR2Key: string | null;
  linkUrl: string | null;
  altText: string | null;
  networkZoneId: string | null;
  networkWidth: number | null;
  networkHeight: number | null;
};

export function AdRender({ ad }: { ad: AdInput }) {
  if (ad.type === "embed" && ad.embedCode) {
    return <div dangerouslySetInnerHTML={{ __html: ad.embedCode }} />;
  }
  if (ad.type === "banner" && ad.imageR2Key) {
    // Ad image goes through /api/ads/[id]/image so <img src> stays on the
    // tenant domain. The route enforces tenant scope, so cross-tenant
    // hotlinking is blocked.
    const src = `/api/ads/${ad.id}/image`;
    const img = (
      <img
        src={src}
        alt={ad.altText ?? ""}
        style={{ maxWidth: "100%", height: "auto" }}
      />
    );
    return ad.linkUrl ? (
      <a href={ad.linkUrl} target="_blank" rel="nofollow noopener">
        {img}
      </a>
    ) : (
      img
    );
  }
  if (ad.type === "galaksion" && ad.networkZoneId) {
    const html =
      ad.slot === "popunder"
        ? galaksionPopunder(ad.networkZoneId)
        : galaksionBanner(ad.networkZoneId);
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (ad.type === "aads" && ad.networkZoneId) {
    const html = aadsBanner(
      ad.networkZoneId,
      ad.networkWidth ?? 468,
      ad.networkHeight ?? 60
    );
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return null;
}
