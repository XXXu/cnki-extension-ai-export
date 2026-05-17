export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

export function resolveApiBaseUrl(value?: string) {
  const baseUrl = value?.trim() || DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/+$/g, "");
}

export function apiHostPermission(apiBaseUrl: string) {
  const url = new URL(resolveApiBaseUrl(apiBaseUrl));
  return `${url.origin}/*`;
}
