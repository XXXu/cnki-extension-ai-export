import type { CnkiRecord, ProjectState } from "../shared/types";
import { cleanAbstract } from "../shared/abstract";
import { QUICK_REVIEW_MAX_PAPERS } from "../shared/reviewLimits";
import { recordKey } from "../shared/normalize";

export const STORAGE_KEY = "cnkiProject";

export function createEmptyProject(): ProjectState {
  return {
    name: "未命名项目",
    records: [],
    failures: [],
    paused: false,
    updatedAt: new Date().toISOString(),
    quickReviewReport: undefined
  };
}

function keepBestRecord(prior: CnkiRecord, incoming: CnkiRecord): CnkiRecord {
  const priorAbstract = cleanAbstract(prior.abstract);
  const incomingAbstract = cleanAbstract(incoming.abstract);
  return {
    ...prior,
    ...incoming,
    id: prior.id,
    title: prior.title || incoming.title,
    authors: prior.authors.length > 0 ? prior.authors : incoming.authors,
    abstract: priorAbstract || incomingAbstract,
    keywords: prior.keywords.length > 0 ? prior.keywords : incoming.keywords,
    funding: prior.funding || incoming.funding,
    album: prior.album || incoming.album,
    topic: prior.topic || incoming.topic,
    classification: prior.classification || incoming.classification,
    fullText: prior.fullText || incoming.fullText,
    fullTextFileName: prior.fullTextFileName || incoming.fullTextFileName,
    fullTextImportedAt: prior.fullTextImportedAt || incoming.fullTextImportedAt,
    fullTextMatchScore: prior.fullTextMatchScore ?? incoming.fullTextMatchScore,
    fullTextStatus: prior.fullTextStatus || incoming.fullTextStatus,
    status: prior.status === "complete" ? prior.status : incoming.status
  };
}

export function mergeRecords(existing: CnkiRecord[], incoming: CnkiRecord[]) {
  const byKey = new Map<string, CnkiRecord>();

  for (const record of existing) {
    byKey.set(recordKey(record), record);
  }

  for (const record of incoming) {
    const key = recordKey(record);
    const prior = byKey.get(key);
    if (prior) {
      byKey.set(key, keepBestRecord(prior, record));
      continue;
    }

    byKey.set(key, {
      ...record,
      id: `P${String(byKey.size + 1).padStart(4, "0")}`
    });
  }

  return Array.from(byKey.values()).slice(0, QUICK_REVIEW_MAX_PAPERS);
}

export async function loadProject(): Promise<ProjectState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const project = result[STORAGE_KEY] ?? createEmptyProject();
  return {
    ...project,
    records: (project.records ?? []).slice(0, QUICK_REVIEW_MAX_PAPERS)
  };
}

export async function saveProject(project: ProjectState) {
  const next = {
    ...project,
    records: (project.records ?? []).slice(0, QUICK_REVIEW_MAX_PAPERS),
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function appendRecords(records: CnkiRecord[]) {
  const project = await loadProject();
  const next = {
    ...project,
    records: mergeRecords(project.records, records)
  };
  return saveProject(next);
}
