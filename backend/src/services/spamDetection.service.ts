const blockedTerms = ['crypto guaranteed', 'double your money', 'instant loan no checks'];

export function detectSpam(input: string): { isSpam: boolean; reason?: string } {
  const normalized = input.toLowerCase();
  const found = blockedTerms.find((term) => normalized.includes(term));
  if (found) {
    return { isSpam: true, reason: `Detected blocked phrase: ${found}` };
  }

  const excessiveLinks = (normalized.match(/https?:\/\//g) ?? []).length > 3;
  if (excessiveLinks) {
    return { isSpam: true, reason: 'Too many links in ad body' };
  }

  return { isSpam: false };
}
