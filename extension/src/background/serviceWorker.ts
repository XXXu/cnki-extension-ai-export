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
  | { type: "DOWNLOAD_QUICK_REVIEW_REPORT" };

type Dependencies = Partial<{
  appendRecords: typeof appendRecords;
  loadProject: typeof loadProject;
  saveProject: typeof saveProject;
  downloadZip: typeof downloadZip;
  downloadTextFile: typeof downloadTextFile;
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

export async function handleRuntimeMessage(message: RuntimeMessage, deps: Dependencies = {}) {
  const services = {
    appendRecords,
    loadProject,
    saveProject,
    downloadZip,
    downloadTextFile,
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

    await services.downloadTextFile(
      `cnki-quick-review-${Date.now()}.md`,
      project.quickReviewReport.content
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
