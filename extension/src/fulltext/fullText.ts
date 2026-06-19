import { cleanText } from "../shared/normalize";

export function cleanFullText(value: string) {
  return cleanText(value)
    .replace(/\s*第\s*\d+\s*页\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitFullText(
  text: string,
  options: { chunkSize?: number; overlapSize?: number } = {}
) {
  const cleaned = cleanFullText(text);
  const chunkSize = options.chunkSize ?? 7000;
  const overlapSize = options.overlapSize ?? 500;
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = Math.max(end - overlapSize, start + 1);
  }
  return chunks;
}
