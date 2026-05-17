import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_API_BASE_URL, generateDeepReview, generateQuickReview, resolveApiBaseUrl } from "../../extension/src/popup/api";

describe("popup API 配置", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("默认使用本地后端地址", () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
  });

  it("支持通过环境变量覆盖后端地址并去掉末尾斜杠", () => {
    expect(resolveApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("显示快速综述篇数上限错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "QUICK_REVIEW_PAPER_LIMIT_EXCEEDED"
    }), { status: 400, headers: { "content-type": "application/json" } })));

    await expect(generateQuickReview("token", [])).rejects.toThrow("快速综述最多支持 200 篇");
  });

  it("显示深度综述篇数上限错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "DEEP_REVIEW_PAPER_LIMIT_EXCEEDED"
    }), { status: 400, headers: { "content-type": "application/json" } })));

    await expect(generateDeepReview("token", [])).rejects.toThrow("深度综述最多支持 50 篇 PDF");
  });
});
