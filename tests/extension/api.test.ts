import { describe, expect, it } from "vitest";
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "../../extension/src/popup/api";

describe("popup API 配置", () => {
  it("默认使用本地后端地址", () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
  });

  it("支持通过环境变量覆盖后端地址并去掉末尾斜杠", () => {
    expect(resolveApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });
});
