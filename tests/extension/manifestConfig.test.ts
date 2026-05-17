import { describe, expect, it } from "vitest";
import manifest from "../../extension/manifest.json";
import { withApiHostPermission } from "../../build/manifestConfig";

describe("扩展 Manifest 构建配置", () => {
  it("根据 API 地址生成后端访问权限", () => {
    const nextManifest = withApiHostPermission(manifest, "https://api.example.com/");

    expect(nextManifest.host_permissions).toContain("https://api.example.com/*");
    expect(nextManifest.host_permissions).toContain("https://*.cnki.net/*");
    expect(nextManifest.host_permissions).toContain("https://*.cnki.com.cn/*");
    expect(nextManifest.host_permissions).not.toContain("http://127.0.0.1:3000/*");
  });
});
