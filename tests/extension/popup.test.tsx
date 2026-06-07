import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../extension/src/fulltext/pdfText", () => ({
  extractPdfText: vi.fn(async () => "党建引领基层治理的实践路径研究 张三 这是一段 PDF 全文。")
}));

import { App, extractCnkiDetailFromFrame } from "../../extension/src/popup/App";

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

function makeRecords(count: number, withFullText = false) {
  return Array.from({ length: count }, (_, index) => ({
    ...listOnlyRecord,
    id: `P${String(index + 1).padStart(4, "0")}`,
    title: `测试论文 ${index + 1}`,
    abstract: "这是一段摘要。",
    keywords: ["文献综述"],
    status: "complete",
    ...(withFullText ? {
      fullText: "这是一段 PDF 全文。",
      fullTextStatus: "matched"
    } : {})
  }));
}

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
    fireEvent.click(screen.getAllByText("下载报告")[0]);

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

    fireEvent.click(screen.getAllByText("下载报告")[1]);
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "DOWNLOAD_QUICK_REVIEW_REPORT" }, expect.any(Function));
    });
  });

  it("登录后可以退出账号且不清空当前信息", async () => {
    localStorage.setItem("cnkiReviewAuth", JSON.stringify({
      token: "test-token",
      user: {
        id: "u1",
        email: "student@example.com",
        quickReviewQuota: 3,
        deepReviewQuota: 1
      }
    }));
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [{
              ...listOnlyRecord,
              abstract: "这是一段摘要。",
              status: "complete"
            }],
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

    expect(await screen.findByText("student@example.com")).toBeTruthy();
    expect(screen.getAllByText("1 篇")).toHaveLength(2);

    fireEvent.click(screen.getByText("退出"));

    expect(localStorage.getItem("cnkiReviewAuth")).toBeNull();
    expect(await screen.findByText("已退出登录")).toBeTruthy();
    expect(screen.getByLabelText("邮箱")).toBeTruthy();
    expect(screen.getByLabelText("密码")).toBeTruthy();
    expect(screen.getAllByText("1 篇")).toHaveLength(2);
    expect(sendMessage).not.toHaveBeenCalledWith({ type: "CLEAR_PROJECT" }, expect.any(Function));
  });

  it("快速综述超过 200 篇时不发起请求", async () => {
    localStorage.setItem("cnkiReviewAuth", JSON.stringify({
      token: "test-token",
      user: {
        id: "u1",
        email: "student@example.com",
        quickReviewQuota: 3,
        deepReviewQuota: 1
      }
    }));
    const fetch = vi.fn();
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: makeRecords(201),
            failures: []
          }
        });
      }
    });

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
    fireEvent.click(screen.getByText("生成快速综述"));

    expect(await screen.findByText("快速综述最多支持 200 篇，请减少后再生成")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("注册前校验邮箱格式", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [],
            failures: []
          }
        });
      }
    });
    const fetch = vi.fn();

    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    expect(screen.queryByLabelText("验证码")).toBeNull();
    expect(screen.queryByText("获取验证码")).toBeNull();
    fireEvent.click(screen.getByText("去注册"));

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "xiao930822@163" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("注册"));

    expect(await screen.findByText("邮箱格式不正确，请填写完整邮箱")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("注册前校验密码长度", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [],
            failures: []
          }
        });
      }
    });
    const fetch = vi.fn();

    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    fireEvent.click(screen.getByText("去注册"));
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("注册"));

    expect(await screen.findByText("密码至少需要 8 位")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("注册时先发送验证码并带验证码提交", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [],
            failures: []
          }
        });
      }
    });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: "test-token",
        user: {
          id: "u1",
          email: "student@example.com",
          quickReviewQuota: 3,
          deepReviewQuota: 1
        }
      }), { status: 201, headers: { "content-type": "application/json" } }));

    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    fireEvent.click(screen.getByText("去注册"));
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("获取验证码"));
    expect(await screen.findByText("验证码已发送，请查看邮箱")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("注册"));

    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/auth/verification-code"),
        expect.objectContaining({
          body: JSON.stringify({ email: "student@example.com" })
        })
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/auth/register"),
        expect.objectContaining({
          body: JSON.stringify({
            email: "student@example.com",
            password: "password123",
            verificationCode: "123456"
          })
        })
      );
    });
    expect(await screen.findByText("student@example.com")).toBeTruthy();
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

    fireEvent.click(screen.getAllByText("下载报告")[2]);
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "DOWNLOAD_DEEP_REVIEW_REPORT" }, expect.any(Function));
    });
  });

  it("深度综述超过 50 篇 PDF 时不发起请求", async () => {
    localStorage.setItem("cnkiReviewAuth", JSON.stringify({
      token: "test-token",
      user: {
        id: "u1",
        email: "student@example.com",
        quickReviewQuota: 2,
        deepReviewQuota: 1
      }
    }));
    const fetch = vi.fn();
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: makeRecords(51, true),
            failures: []
          }
        });
      }
    });

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

    expect(await screen.findByText("深度综述最多支持 50 篇 PDF，请减少后再生成")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
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
    const create = vi.fn((_options, callback) => callback({ id: 88, status: "complete" }));
    const remove = vi.fn((_tabId, callback) => callback?.());
    const addListener = vi.fn();
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
    expect(await screen.findByText("已采集 1 篇，已补摘要 1 篇，未补摘要 0 篇")).toBeTruthy();
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith(88, expect.any(Function));
    });
  });

  it("采集过程中禁用采集按钮，避免重复触发", async () => {
    let resolveQuery: ((tabs: Array<{ id: number }>) => void) | undefined;
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
    });
    const query = vi.fn((_options, callback) => {
      resolveQuery = callback;
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query,
        sendMessage: vi.fn()
      },
      scripting: { executeScript: vi.fn() }
    });

    render(<App />);

    const button = await screen.findByText("采集当前页") as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button.disabled).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);

    resolveQuery?.([]);
    expect(await screen.findByText("未找到当前标签页")).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it("当前信息已满 200 篇时不再采集当前页", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: makeRecords(200),
            failures: []
          }
        });
      }
    });
    const query = vi.fn();

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query,
        sendMessage: vi.fn()
      }
    });

    render(<App />);

    await screen.findAllByText("200 篇");
    fireEvent.click(screen.getByText("采集当前页"));

    expect(await screen.findByText("当前信息已达 200 篇上限，请先清空当前信息后再采集")).toBeTruthy();
    expect(query).not.toHaveBeenCalled();
  });

  it("详情页未识别到摘要时保存失败状态并显示未补摘要统计", async () => {
    let projectRecords: unknown[] = [];
    const sendMessage = vi.fn((message: { type: string; records?: unknown[] }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: projectRecords,
            failures: []
          }
        });
      }
      if (message.type === "SAVE_RECORDS") {
        projectRecords = message.records ?? [];
        callback({
          ok: true,
          count: projectRecords.length,
          project: {
            records: projectRecords,
            failures: []
          }
        });
      }
    });
    const query = vi.fn((_options, callback) => callback([{ id: 7 }]));
    const create = vi.fn((_options, callback) => callback({ id: 88, status: "complete" }));
    const remove = vi.fn((_tabId, callback) => callback?.());
    const addListener = vi.fn();
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
              authors: [],
              abstract: "",
              keywords: []
            },
            diagnostics: { title: "详情页", abstractLength: 0, keywordCount: 0 }
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
      expect(projectRecords).toEqual([
        expect.objectContaining({
          id: "P0001",
          status: "failed",
          error: "详情页未识别到摘要或关键词"
        })
      ]);
    });
    expect(await screen.findByText("已采集 1 篇，已补摘要 0 篇，未补摘要 1 篇")).toBeTruthy();
    expect(screen.getAllByText("1 篇")).toHaveLength(2);
  });

  it("详情页只有关键词没有摘要时不计入已补摘要", async () => {
    let projectRecords: unknown[] = [];
    const sendMessage = vi.fn((message: { type: string; records?: unknown[] }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: projectRecords,
            failures: []
          }
        });
      }
      if (message.type === "SAVE_RECORDS") {
        projectRecords = message.records ?? [];
        callback({
          ok: true,
          count: projectRecords.length,
          project: {
            records: projectRecords,
            failures: []
          }
        });
      }
    });
    const query = vi.fn((_options, callback) => callback([{ id: 7 }]));
    const create = vi.fn((_options, callback) => callback({ id: 88, status: "complete" }));
    const remove = vi.fn((_tabId, callback) => callback?.());
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
              authors: [],
              abstract: "",
              keywords: ["基层治理", "党建引领"]
            },
            diagnostics: { title: "详情页", abstractLength: 0, keywordCount: 2 }
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
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      scripting: { executeScript }
    });

    render(<App />);

    await screen.findByText("采集当前页");
    fireEvent.click(screen.getByText("采集当前页"));

    await waitFor(() => {
      expect(projectRecords).toEqual([
        expect.objectContaining({
          id: "P0001",
          abstract: "",
          keywords: ["基层治理", "党建引领"],
          status: "partial"
        })
      ]);
    });
    expect(await screen.findByText("已采集 1 篇，已补摘要 0 篇，未补摘要 1 篇")).toBeTruthy();
  });

  it("采集超过 200 篇时只保存前 200 篇", async () => {
    const savedBatches: unknown[][] = [];
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
        savedBatches.push(message.records ?? []);
        callback({
          ok: true,
          count: message.records?.length ?? 0,
          project: {
            records: message.records,
            failures: []
          }
        });
      }
    });
    const query = vi.fn((_options, callback) => callback([{ id: 7 }]));
    const executeScript = vi.fn().mockResolvedValueOnce([
      {
        result: {
          records: makeRecords(201),
          diagnostics: {
            url: "https://kns.cnki.net/",
            title: "知网检索页",
            tables: 1,
            resultTables: 1,
            titleLinks: 201,
            textSample: "论文列表"
          }
        }
      }
    ]);

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query,
        sendMessage: vi.fn()
      },
      scripting: { executeScript }
    });

    render(<App />);

    await screen.findByText("采集当前页");
    fireEvent.click(screen.getByText("采集当前页"));

    await waitFor(() => {
      expect(savedBatches[0]).toHaveLength(200);
    });
    expect(savedBatches[0][0]).toEqual(expect.objectContaining({ id: "P0001" }));
    expect(savedBatches[0][199]).toEqual(expect.objectContaining({ id: "P0200" }));
    expect(await screen.findByText("本页超过 200 篇，已自动停止采集，只保留前 200 篇")).toBeTruthy();
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

  it("清空按钮使用当前信息文案", async () => {
    const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
      if (message.type === "GET_PROJECT") {
        callback({
          ok: true,
          project: {
            records: [],
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

    expect(await screen.findByText("清空当前信息")).toBeTruthy();
    expect(screen.queryByText("清空当前项目")).toBeNull();
  });

  it("详情页正文快照不作为摘要", () => {
    document.body.innerHTML = `
      <h1 class="title">“党建+网格+大数据”为啥管用好用</h1>
      <div class="authors"><a>王大庆</a><a>冯芸</a></div>
      <div id="ChDivSummary">
        <strong>正文快照：</strong>
        全省4.6万个村党组织成为促振兴、保平安的桥头堡。
      </div>
      <p><strong>报纸日期：</strong>2026-05-16</p>
      <p><strong>专辑：</strong>社会科学Ⅰ辑</p>
      <p><strong>专题：</strong>中国共产党</p>`;

    const result = extractCnkiDetailFromFrame();

    expect(result.detail.abstract).toBe("");
    expect(result.diagnostics.abstractLength).toBe(0);
  });
});
