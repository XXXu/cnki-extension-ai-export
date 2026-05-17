export type CollectionStatus = "list-only" | "partial" | "complete" | "failed";
export type FullTextStatus = "none" | "matched" | "unmatched" | "failed";

export type CnkiRecord = {
  id: string;
  title: string;
  authors: string[];
  source: string;
  publishedAt: string;
  database: string;
  citations: number | null;
  downloads: number | null;
  detailUrl: string;
  abstract: string;
  keywords: string[];
  funding: string;
  album: string;
  topic: string;
  classification: string;
  collectedAt: string;
  status: CollectionStatus;
  error?: string;
  fullText?: string;
  fullTextFileName?: string;
  fullTextImportedAt?: string;
  fullTextMatchScore?: number;
  fullTextStatus?: FullTextStatus;
};

export type ProjectState = {
  name: string;
  records: CnkiRecord[];
  failures: Array<{ url: string; reason: string }>;
  paused: boolean;
  updatedAt: string;
  quickReviewReport?: {
    content: string;
    generatedAt: string;
  };
};
