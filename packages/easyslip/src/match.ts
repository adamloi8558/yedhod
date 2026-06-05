/**
 * EasySlip masks account numbers like "xxx-x-x1234-5" — the visible
 * digits aren't necessarily the tail. Some patterns:
 *   - "xxx-x-x3395-0" → visible "33950" (last digit shown)
 *   - "xxx-x-x3395-x" → visible "3395" (last digit masked too)
 *   - "664-5-xxx950" → visible "6645950" (head + tail)
 * For an account like "6645533950" any of these visible groups should
 * match because they are subsequences of contiguous digits in the
 * underlying account number.
 *
 * Strategy: take whatever digits are visible from the slip, and check
 * whether that exact substring appears in our (full) account number.
 * We require the visible substring to be at least 4 digits long, to
 * keep false positives low — different bank account numbers do
 * occasionally share short numeric prefixes/suffixes.
 *
 * Strict bank-id equality MUST be checked separately by the caller —
 * tail matching alone is not sufficient.
 */
export function tailMatches(slipAcc: string, ourAcc: string): boolean {
  const slipDigits = slipAcc.replace(/[^0-9]/g, "");
  const ourDigits = ourAcc.replace(/[^0-9]/g, "");
  if (slipDigits.length < 4) return false;
  // Old behavior — full-tail equality in either direction
  if (ourDigits.endsWith(slipDigits) || slipDigits.endsWith(ourDigits)) {
    return true;
  }
  // EasySlip-masked patterns: digits visible in the slip are some
  // contiguous fragment of our real account number. Accept if so.
  if (ourDigits.includes(slipDigits)) return true;
  return false;
}
