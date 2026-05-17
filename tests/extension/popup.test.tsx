import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../extension/src/fulltext/pdfText", () => ({
  extractPdfText: vi.fn(async () => "党建引领基层治理的实践路径研究 张三 这是一段 PDF 全文。")
}));

import { App } from "../../extension/src/popup/App";

const listOnlyRecord = {
  id: "P0001",
  title: "党建引领基层治理的实践路径研究",
  authors: ["张三"],
  source: "测试期刊",
  publishedAt: "2026-04-30",
  database: "期刊",
  citations: null,
  downloads: null,
  detailUrl: "https://kns.cnki.net/kcms2/article/abstract?v=test",
  abstract: "",
  keywords: [],
  funding: "",
  album: "",
  topic: "",
  classification: "",
  collectedAt: "2026-05-04T00:00:00.000Z",
  status: "list-only"
};

describe("popup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("显示采集数量并触发下载采集结果动作", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [{ id: "P0001", status: "complete" }],
            failures: []
          }
        });
      }
      if (message.type === "EXPORT_PACKAGE") {
        callback({ ok: true, count: 1 });
      }
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1 篇")).toHaveLength(2);
    });
    fireEvent.click(screen.getByText("下载结果"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "EXPORT_PACKAGE" }, expect.any(Function));
    });
    expect(await screen.findByText("已导出 1 篇")).toBeTruthy();
  });

  it("登录后生成快速综述并启用报告下载", async () => {
    const sendMessage = vi.fn((message: { type: string; report?: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [{
              ...listOnlyRecord,
              abstract: "这是一段摘要。",
              keywords: ["基层治理"]
            }],
            failures: []
          }
        });
      }
      if (message.type === "SAVE_QUICK_REVIEW_REPORT") {
        callback({
          ok: true,
          project: {
            records: [listOnlyRecord],
            failures: [],
            quickReviewReport: {
              content: message.report,
              generatedAt: "2026-05-17T00:00:00.000Z"
            }
          }
        });
      }
      if (message.type === "DOWNLOAD_QUICK_REVIEW_REPORT") {
        callback({ ok: true });
      }
    });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: "test-token",
        user: {
          id: "u1",
          email: "student@example.com",
          quickReviewQuota: 3,
          deepReviewQuota: 0
        }
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        report: "快速综述报告正文",
        quota: { quickReviewQuota: 2, deepReviewQuota: 0 }
      }), { status: 200, headers: { "content-type": "application/json" } }));

    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("登录"));

    expect(await screen.findByText("student@example.com")).toBeTruthy();
    fireEvent.click(screen.getByText("生成快速综述"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        { type: "SAVE_QUICK_REVIEW_REPORT", report: "快速综述报告正文" },
        expect.any(Function)
      );
    });
    expect(await screen.findByText("快速综述已生成")).toBeTruthy();

    fireEvent.click(screen.getAllByText("下载报告")[0]);
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "DOWNLOAD_QUICK_REVIEW_REPORT" }, expect.any(Function));
    });
  });

  it("导入全文后生成深度综述并启用报告下载", async () => {
    const matchedRecord = {
      ...listOnlyRecord,
      abstract: "这是一段摘要。",
      keywords: ["基层治理"],
      fullText: "这是一段 PDF 全文。",
      fullTextStatus: "matched"
    };
    localStorage.setItem("cnkiReviewAuth", JSON.stringify({
      token: "test-token",
      user: {
        id: "u1",
        email: "student@example.com",
        quickReviewQuota: 2,
        deepReviewQuota: 1
      }
    }));
    const sendMessage = vi.fn((message: { type: string; report?: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [matchedRecord],
            failures: []
          }
        });
      }
      if (message.type === "SAVE_DEEP_REVIEW_REPORT") {
        callback({
          ok: true,
          project: {
            records: [matchedRecord],
            failures: [],
            deepReviewReport: {
              content: message.report,
              generatedAt: "2026-05-17T00:00:00.000Z"
            }
          }
        });
      }
      if (message.type === "DOWNLOAD_DEEP_REVIEW_REPORT") {
        callback({ ok: true });
      }
    });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      report: "深度综述报告正文",
      quota: { quickReviewQuota: 2, deepReviewQuota: 0 }
    }), { status: 200, headers: { "content-type": "application/json" } }));

    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    expect(await screen.findByText("student@example.com")).toBeTruthy();
    fireEvent.click(screen.getByText("生成深度综述"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        { type: "SAVE_DEEP_REVIEW_REPORT", report: "深度综述报告正文" },
        expect.any(Function)
      );
    });
    expect(await screen.findByText("深度综述已生成")).toBeTruthy();

    fireEvent.click(screen.getAllByText("下载报告")[1]);
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "DOWNLOAD_DEEP_REVIEW_REPORT" }, expect.any(Function));
    });
  });

  it("点击采集并补全后保存完整记录", async () => {
    const sendMessage = vi.fn((message: { type: string; records?: unknown[] }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [],
            failures: []
          }
        });
      }
      if (message.type === "SAVE_RECORDS") {
        callback({
          ok: true,
          count: 1,
          project: {
            records: message.records,
            failures: []
          }
        });
      }
    });
    const query = vi.fn((_options, callback) => callback([{ id: 7 }]));
    const create = vi.fn((_options, callback) => callback({ id: 88 }));
    const remove = vi.fn((_tabId, callback) => callback?.());
    const addListener = vi.fn((listener) => listener(88, { status: "complete" }, { id: 88 }));
    const removeListener = vi.fn();
    const executeScript = vi.fn()
      .mockResolvedValueOnce([
        {
          result: {
            records: [listOnlyRecord],
            diagnostics: {
              url: "https://kns.cnki.net/",
              title: "知网检索页",
              tables: 1,
              resultTables: 1,
              titleLinks: 1,
              textSample: "论文列表"
            }
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          result: {
            detail: {
              title: "党建引领基层治理的实践路径研究",
              authors: ["张三"],
              abstract: "这是一段详情页摘要。",
              keywords: ["基层治理", "党建引领"],
              funding: "测试基金",
              album: "社会科学Ⅰ辑",
              topic: "中国共产党",
              classification: "D267"
            },
            diagnostics: { title: "详情页", abstractLength: 10, keywordCount: 2 }
          }
        }
      ]);

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query,
        sendMessage: vi.fn(),
        create,
        remove,
        onUpdated: { addListener, removeListener }
      },
      scripting: { executeScript }
    });

    render(<App />);

    await screen.findByText("采集当前页");
    fireEvent.click(screen.getByText("采集当前页"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        {
          type: "SAVE_RECORDS",
          records: [expect.objectContaining({
            id: "P0001",
            abstract: "这是一段详情页摘要。",
            keywords: ["基层治理", "党建引领"],
            status: "complete"
          })]
        },
        expect.any(Function)
      );
    });
    expect(await screen.findByText("已采集 1 篇，已补全 1 篇，失败 0 篇")).toBeTruthy();
  });

  it("导入 PDF 全文后保存匹配记录", async () => {
    localStorage.setItem("cnkiReviewAuth", JSON.stringify({
      token: "test-token",
      user: {
        id: "u1",
        email: "student@example.com",
        quickReviewQuota: 2,
        deepReviewQuota: 1
      }
    }));
    const sendMessage = vi.fn((message: { type: string; records?: unknown[] }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [listOnlyRecord],
            failures: []
          }
        });
      }
      if (message.type === "SAVE_RECORDS") {
        callback({
          ok: true,
          count: 1,
          project: {
            records: message.records,
            failures: []
          }
        });
      }
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    fireEvent.click(screen.getByText("导入PDF"));
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["fake"], "党建引领基层治理的实践路径研究.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        {
          type: "SAVE_RECORDS",
          records: [expect.objectContaining({
            id: "P0001",
            fullText: "党建引领基层治理的实践路径研究 张三 这是一段 PDF 全文。",
            fullTextFileName: "党建引领基层治理的实践路径研究.pdf",
            fullTextStatus: "matched"
          })]
        },
        expect.any(Function)
      );
    });
    expect(await screen.findByText("已读取 1 个 PDF，匹配 1 篇，未匹配 0 个，失败 0 个")).toBeTruthy();
  });

  it("未登录时禁止导入 PDF", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [listOnlyRecord],
            failures: []
          }
        });
      }
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    expect((await screen.findByText("导入PDF") as HTMLButtonElement).disabled).toBe(true);
  });
});
