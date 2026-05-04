import { describe, expect, it } from "vitest";
import manifest from "../../extension/manifest.json";

describe("插件脚手架", () => {
  it("使用 Manifest V3 并配置弹窗入口", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.action.default_popup).toBe("extension/src/popup/popup.html");
  });
});
