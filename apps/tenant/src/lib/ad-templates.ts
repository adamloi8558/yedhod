export function galaksionBanner(zoneId: string): string {
  const safe = zoneId.replace(/[^a-z0-9_-]/gi, "");
  return `<script async data-cfasync="false" src="//gaboawa.com/full/tag.min.js" data-zone="${safe}"></script><div id="galaksion-${safe}"></div>`;
}

export function galaksionPopunder(zoneId: string): string {
  const safe = zoneId.replace(/[^a-z0-9_-]/gi, "");
  return `<script async data-cfasync="false" src="//gaboawa.com/full/tag.min.js" data-zone="${safe}"></script>`;
}

export function aadsBanner(unitId: string, width: number, height: number): string {
  const safe = unitId.replace(/[^a-z0-9_-]/gi, "");
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  return `<iframe data-aa="${safe}" src="//acceptable.a-ads.com/${safe}/?background_color=transparent" style="border:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background-color:transparent"></iframe>`;
}
