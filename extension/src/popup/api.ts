import { resolveApiBaseUrl } from "../shared/apiConfig";
import { DEEP_REVIEW_MAX_PAPERS, QUICK_REVIEW_MAX_PAPERS } from "../shared/reviewLimits";
import type { CnkiRecord } from "../shared/types";

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "../shared/apiConfig";

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
    const error = body.error ?? body.message ?? `HTTP_${response.status}`;
    if (error === "INVALID_REQUEST") return "邮箱格式不正确、密码少于 8 位，或验证码格式不正确";
    if (error === "EMAIL_ALREADY_REGISTERED") return "该邮箱已注册，请直接登录";
    if (error === "INVALID_VERIFICATION_CODE") return "验证码不正确或已过期，请重新获取";
    if (error === "EMAIL_SENDER_NOT_CONFIGURED") return "服务器还没有配置邮件发送服务";
    if (error === "INVALID_CREDENTIALS") return "邮箱或密码不正确";
    if (error === "UNAUTHORIZED") return "登录已失效，请重新登录";
    if (error === "QUICK_REVIEW_QUOTA_EXHAUSTED") return "快速综述次数已用完";
    if (error === "DEEP_REVIEW_QUOTA_EXHAUSTED") return "深度综述次数已用完";
    if (error === "QUICK_REVIEW_PAPER_LIMIT_EXCEEDED") return `快速综述最多支持 ${QUICK_REVIEW_MAX_PAPERS} 篇`;
    if (error === "DEEP_REVIEW_PAPER_LIMIT_EXCEEDED") return `深度综述最多支持 ${DEEP_REVIEW_MAX_PAPERS} 篇 PDF`;
    return error;
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

export function sendVerificationCode(email: string) {
  return requestJson<{ ok: true }>("/auth/verification-code", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function register(email: string, password: string, verificationCode: string) {
  return requestJson<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, verificationCode })
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
