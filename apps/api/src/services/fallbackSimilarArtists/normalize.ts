export function normalizeArtistName(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, '')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
