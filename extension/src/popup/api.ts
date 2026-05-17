import type { CnkiRecord } from "../shared/types";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

export type BackendUser = {
  id: string;
  email: string;
  quickReviewQuota: number;
  deepReviewQuota: number;
};

export type AuthSession = {
  token: string;
  user: BackendUser;
};

export type QuickReviewResponse = {
  report: string;
  quota: Pick<BackendUser, "quickReviewQuota" | "deepReviewQuota">;
};

export type DeepReviewResponse = QuickReviewResponse;

type ApiErrorBody = {
  error?: string;
  message?: string;
};

async function readError(response: Response) {
  try {
    const body = await response.json() as ApiErrorBody;
    return body.error ?? body.message ?? `HTTP_${response.status}`;
  } catch {
    return `HTTP_${response.status}`;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);

  const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

export function register(email: string, password: string) {
  return requestJson<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function login(email: string, password: string) {
  return requestJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function getMe(token: string) {
  return requestJson<{ user: BackendUser }>("/me", { method: "GET", token });
}

export function generateQuickReview(token: string, records: CnkiRecord[]) {
  return requestJson<QuickReviewResponse>("/review/quick", {
    method: "POST",
    token,
    body: JSON.stringify({
      papers: records.map((record) => ({
        id: record.id,
        title: record.title,
        abstract: record.abstract,
        keywords: record.keywords
      }))
    })
  });
}

export function generateDeepReview(token: string, records: CnkiRecord[]) {
  return requestJson<DeepReviewResponse>("/review/deep", {
    method: "POST",
    token,
    body: JSON.stringify({
      papers: records
        .filter((record) => record.fullText)
        .map((record) => ({
          id: record.id,
          title: record.title,
          abstract: record.abstract,
          keywords: record.keywords,
          fullText: record.fullText
        }))
    })
  });
}
