import JSZip from "jszip";
import { buildExportFiles } from "../export/exporters";
import type { CnkiRecord, ProjectState } from "../shared/types";
import { appendRecords, createEmptyProject, loadProject, saveProject } from "./storage";

type RuntimeMessage =
  | { type: "SAVE_RECORDS"; records: CnkiRecord[] }
  | { type: "GET_PROJECT" }
  | { type: "CLEAR_PROJECT" }
  | { type: "EXPORT_PACKAGE" }
  | { type: "SAVE_QUICK_REVIEW_REPORT"; report: string }
  | { type: "DOWNLOAD_QUICK_REVIEW_REPORT" }
  | { type: "SAVE_DEEP_REVIEW_REPORT"; report: string }
  | { type: "DOWNLOAD_DEEP_REVIEW_REPORT" };

type Dependencies = Partial<{
  appendRecords: typeof appendRecords;
  loadProject: typeof loadProject;
  saveProject: typeof saveProject;
  downloadZip: typeof downloadZip;
  downloadTextFile: typeof downloadTextFile;
  downloadWordFile: typeof downloadWordFile;
}>;

export async function downloadZip(project: ProjectState) {
  const zip = new JSZip();
  for (const file of buildExportFiles(project.records, 100)) {
    const content = file.filename.endsWith(".csv") ? `\uFEFF${file.content}` : file.content;
    zip.file(file.filename, content);
  }

  const base64 = await zip.generateAsync({ type: "base64" });
  await chrome.downloads.download({
    url: `data:application/zip;base64,${base64}`,
    filename: `cnki-ai-export-${Date.now()}.zip`,
    saveAs: true
  });
}

export async function downloadTextFile(filename: string, content: string) {
  await chrome.downloads.download({
    url: `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`,
    filename,
    saveAs: true
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToWordHtml(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const text = line.trim();
      if (!text) return "";
      if (text.startsWith("### ")) return `<h3>${escapeHtml(text.slice(4))}</h3>`;
      if (text.startsWith("## ")) return `<h2>${escapeHtml(text.slice(3))}</h2>`;
      if (text.startsWith("# ")) return `<h1>${escapeHtml(text.slice(2))}</h1>`;
      if (/^[-*]\s+/.test(text)) return `<p>• ${escapeHtml(text.replace(/^[-*]\s+/, ""))}</p>`;
      if (/^\d+\.\s+/.test(text)) return `<p>${escapeHtml(text)}</p>`;
      return `<p>${escapeHtml(text)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export async function downloadWordFile(filename: string, title: string, markdown: string) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Microsoft YaHei", SimSun, Arial, sans-serif; line-height: 1.7; color: #1f2933; }
    h1 { font-size: 22pt; margin: 0 0 18pt; }
    h2 { font-size: 16pt; margin: 18pt 0 8pt; }
    h3 { font-size: 13pt; margin: 14pt 0 6pt; }
    p { font-size: 11pt; margin: 0 0 8pt; }
  </style>
</head>
<body>
${markdownToWordHtml(markdown)}
</body>
</html>`;

  await chrome.downloads.download({
    url: `data:application/msword;charset=utf-8,${encodeURIComponent(html)}`,
    filename,
    saveAs: true
  });
}

export async function handleRuntimeMessage(message: RuntimeMessage, deps: Dependencies = {}) {
  const services = {
    appendRecords,
    loadProject,
    saveProject,
    downloadZip,
    downloadTextFile,
    downloadWordFile,
    ...deps
  };

  if (message.type === "SAVE_RECORDS") {
    const project = await services.appendRecords(message.records);
    return { ok: true, count: project.records.length, project };
  }

  if (message.type === "GET_PROJECT") {
    return { ok: true, project: await services.loadProject() };
  }

  if (message.type === "CLEAR_PROJECT") {
    const project = createEmptyProject();
    await services.saveProject(project);
    return { ok: true, project };
  }

  if (message.type === "EXPORT_PACKAGE") {
    const project = await services.loadProject();
    await services.downloadZip(project);
    return { ok: true, count: project.records.length };
  }

  if (message.type === "SAVE_QUICK_REVIEW_REPORT") {
    const project = await services.loadProject();
    const next = await services.saveProject({
      ...project,
      quickReviewReport: {
        content: message.report,
        generatedAt: new Date().toISOString()
      }
    });
    return { ok: true, project: next };
  }

  if (message.type === "DOWNLOAD_QUICK_REVIEW_REPORT") {
    const project = await services.loadProject();
    if (!project.quickReviewReport?.content) {
      return { ok: false, error: "尚未生成快速综述报告" };
    }

    await services.downloadWordFile(
      `cnki-quick-review-${Date.now()}.doc`,
      "知网快速综述报告",
      project.quickReviewReport.content
    );
    return { ok: true };
  }

  if (message.type === "SAVE_DEEP_REVIEW_REPORT") {
    const project = await services.loadProject();
    const next = await services.saveProject({
      ...project,
      deepReviewReport: {
        content: message.report,
        generatedAt: new Date().toISOString()
      }
    });
    return { ok: true, project: next };
  }

  if (message.type === "DOWNLOAD_DEEP_REVIEW_REPORT") {
    const project = await services.loadProject();
    if (!project.deepReviewReport?.content) {
      return { ok: false, error: "尚未生成深度综述报告" };
    }

    await services.downloadWordFile(
      `cnki-deep-review-${Date.now()}.doc`,
      "知网深度综述报告",
      project.deepReviewReport.content
    );
    return { ok: true };
  }

  return { ok: false, error: "不支持的后台消息" };
}

if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async () => {
    const current = await chrome.storage.local.get("cnkiProject");
    if (!current.cnkiProject) {
      await chrome.storage.local.set({ cnkiProject: createEmptyProject() });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleRuntimeMessage(message).then(sendResponse);
    return true;
  });
}
