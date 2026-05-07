/**
 * EasySlip masks account numbers like "xxx-x-x1234-5". To verify the
 * receiver matches our snapshot account, compare digit-only tails in
 * both directions: either string ends with the other.
 *
 * Strict bank-id equality MUST be checked separately by the caller —
 * tail matching alone is not sufficient.
 */
export function tailMatches(slipAcc: string, ourAcc: string): boolean {
  const slipDigits = slipAcc.replace(/[^0-9]/g, "");
  const ourDigits = ourAcc.replace(/[^0-9]/g, "");
  if (slipDigits.length < 4) return false;
  return ourDigits.endsWith(slipDigits) || slipDigits.endsWith(ourDigits);
}
