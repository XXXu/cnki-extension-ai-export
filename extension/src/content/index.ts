import type { DetailFields } from "./detailPage";
import { parseDetailPage } from "./detailPage";
import { hasResultPageRecords, parseResultPage } from "./resultPage";
import type { CnkiRecord } from "../shared/types";

export type PageKind = "result" | "detail" | "unknown";

export type ContentResponse = {
  ok: boolean;
  kind?: PageKind;
  records?: CnkiRecord[];
  detail?: DetailFields;
  diagnostics?: PageDiagnostics;
  error?: string;
};

export type PageDiagnostics = {
  url: string;
  title: string;
  tables: number;
  iframes: number;
  resultTables: number;
  titleLinks: number;
  textSample: string;
};

export function collectDiagnostics(doc: Document): PageDiagnostics {
  return {
    url: window.location.href,
    title: doc.title,
    tables: doc.querySelectorAll("table").length,
    iframes: doc.querySelectorAll("iframe").length,
    resultTables: doc.querySelectorAll("table.result-table-list").length,
    titleLinks: doc.querySelectorAll("a.fz14, td.name a, .name a, a[href*='abstract'], a[href*='detail']").length,
    textSample: (doc.body?.innerText ?? doc.body?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 600)
  };
}

export function detectPageKind(doc: Document): PageKind {
  if (doc.querySelector("table.result-table-list") || hasResultPageRecords(doc)) return "result";

  const text = doc.body?.textContent ?? "";
  const lowerText = text.toLowerCase();
  const hasAbstract = text.includes("摘要") || lowerText.includes("abstract") || Boolean(doc.querySelector(".abstract"));
  const hasKeywords = text.includes("关键词") || text.includes("关键字") || lowerText.includes("keywords") || lowerText.includes("key words") || Boolean(doc.querySelector(".keywords"));
  if (hasAbstract && hasKeywords) return "detail";

  return "unknown";
}

export function handleContentMessage(message: { type?: string }, doc: Document): ContentResponse {
  if (message.type !== "PARSE_CURRENT_PAGE") {
    return { ok: false, error: "不支持的内容脚本消息" };
  }

  const kind = detectPageKind(doc);
  if (kind === "result") {
    return { ok: true, kind, records: parseResultPage(doc) };
  }
  if (kind === "detail") {
    return { ok: true, kind, detail: parseDetailPage(doc) };
  }

  const diagnostics = collectDiagnostics(doc);
  return {
    ok: false,
    kind,
    diagnostics,
    error: `当前页面不是可识别的知网检索结果页。页面诊断：表格 ${diagnostics.tables} 个，结果表格 ${diagnostics.resultTables} 个，题名链接 ${diagnostics.titleLinks} 个，iframe ${diagnostics.iframes} 个。`
  };
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    sendResponse(handleContentMessage(message, document));
  });
}
