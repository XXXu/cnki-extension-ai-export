import type { CnkiRecord } from "../shared/types";
import { cleanText } from "../shared/normalize";

const MATCH_THRESHOLD = 0.72;

export function normalizeForMatch(value: string) {
  return cleanText(value)
    .replace(/\s*附视频\s*$/g, "")
    .replace(/[《》“”"'‘’：:，,。；;、\s\-—_（）()【】[\]]/g, "")
    .toLowerCase();
}

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

function includesNormalized(haystack: string, needle: string) {
  return Boolean(needle) && haystack.includes(needle);
}

function commonPrefixRatio(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 0;
  let same = 0;
  const minLength = Math.min(a.length, b.length);
  for (let index = 0; index < minLength; index += 1) {
    if (a[index] !== b[index]) break;
    same += 1;
  }
  return same / maxLength;
}

function scoreRecord(record: CnkiRecord, fileName: string, text: string) {
  const normalizedText = normalizeForMatch(text.slice(0, 5000));
  const normalizedTitle = normalizeForMatch(record.title);
  const normalizedFileName = normalizeForMatch(fileName);
  let score = 0;

  if (includesNormalized(normalizedText, normalizedTitle)) {
    score += 0.82;
  } else if (includesNormalized(normalizedFileName, normalizedTitle)) {
    score += 0.78;
  } else {
    score += commonPrefixRatio(normalizedTitle, normalizedText.slice(0, normalizedTitle.length));
  }

  const authorHits = record.authors.filter((author) =>
    includesNormalized(normalizedText, normalizeForMatch(author))
  ).length;
  if (record.authors.length > 0) {
    score += Math.min(authorHits / record.authors.length, 1) * 0.12;
  }

  if (includesNormalized(normalizedText, normalizeForMatch(record.source))) {
    score += 0.06;
  }

  return Math.min(score, 1);
}

export function matchFullTextToRecord(records: CnkiRecord[], fileName: string, text: string) {
  let best: { record: CnkiRecord | null; score: number } = { record: null, score: 0 };

  for (const record of records) {
    const score = scoreRecord(record, fileName, text);
    if (score > best.score) {
      best = { record, score };
    }
  }

  return best.score >= MATCH_THRESHOLD ? best : { record: null, score: best.score };
}

