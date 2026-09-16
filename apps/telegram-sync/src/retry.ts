export function retryDelayMs(error: unknown, failures: number): number {
  const e = error as { seconds?: unknown; errorMessage?: string; message?: string } | null;
  const seconds = Number(e?.seconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000) + 5000;
  const match = `${e?.errorMessage ?? ""} ${e?.message ?? ""}`.match(/FLOOD(?:_WAIT)?[_ ](\d+)/i);
  if (match) return Number(match[1]) * 1000 + 5000;
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(Math.max(failures - 1, 0), 5));
}
