/** Compare visible digits at their original positions; never concatenate masks. */
export function tailMatches(slipAcc: string, ourAcc: string): boolean {
  const pattern = slipAcc.replace(/[\s-]/g, "");
  const account = ourAcc.replace(/[\s-]/g, "");
  if (!/^[0-9xX*•●]+$/.test(pattern) || !/^\d+$/.test(account)) return false;
  if (pattern.length !== account.length) return false;
  if ((pattern.match(/\d/g) ?? []).length < 4) return false;
  return [...pattern].every((char, i) => !/\d/.test(char) || char === account[i]);
}
