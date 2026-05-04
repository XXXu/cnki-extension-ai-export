import type { CnkiRecord } from "./types";

export function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function splitAuthors(value: string) {
  return cleanText(value)
    .split(/\s+\band\b\s+|[;；,，、]/i)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

export function parseCount(value: string) {
  const text = cleanText(value);
  if (!text || text === "-") return null;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function makeRecordId(index: number) {
  return `P${String(index + 1).padStart(4, "0")}`;
}

function titleKey(title: string) {
  return cleanText(title).replace(/\s*附视频\s*$/, "").replace(/\s+/g, "");
}

function urlKey(url: string) {
  const text = cleanText(url);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return text;
  }
}

export function recordKey(record: Pick<CnkiRecord, "title" | "source" | "publishedAt" | "detailUrl">) {
  return [
    urlKey(record.detailUrl) || titleKey(record.title),
    cleanText(record.source),
    cleanText(record.publishedAt)
  ].join("|");
}
