import { apiHostPermission, DEFAULT_API_BASE_URL } from "../extension/src/shared/apiConfig";

export { DEFAULT_API_BASE_URL };

export type ExtensionManifest = {
  host_permissions?: string[];
  [key: string]: unknown;
};

export function withApiHostPermission<T extends ExtensionManifest>(manifest: T, apiBaseUrl: string): T {
  const apiPermission = apiHostPermission(apiBaseUrl);
  const hostPermissions = (manifest.host_permissions ?? [])
    .filter((permission) => permission !== apiHostPermission(DEFAULT_API_BASE_URL));

  return {
    ...manifest,
    host_permissions: Array.from(new Set([...hostPermissions, apiPermission]))
  };
}
