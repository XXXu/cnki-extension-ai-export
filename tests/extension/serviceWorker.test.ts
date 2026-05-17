import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWordFile, handleRuntimeMessage } from "../../extension/src/background/serviceWorker";
import type { ProjectState } from "../../extension/src/shared/types";

const project: ProjectState = {
  name: "测试项目",
  records: [{ id: "P0001", status: "complete" } as ProjectState["records"][number]],
  failures: [],
  paused: false,
  updatedAt: "2026-05-04T00:00:00.000Z"
};

describe("service worker messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("保存解析出的论文记录", async () => {
    const appendRecords = vi.fn().mockResolvedValue(project);
    const response = await handleRuntimeMessage(
      { type: "SAVE_RECORDS", records: project.records },
      { appendRecords } as never
    );

    expect(appendRecords).toHaveBeenCalledWith(project.records);
    expect(response).toEqual({ ok: true, count: 1, project });
  });

  it("导出当前项目文件包", async () => {
    const loadProject = vi.fn().mockResolvedValue(project);
    const downloadZip = vi.fn().mockResolvedValue(undefined);
    const response = await handleRuntimeMessage(
      { type: "EXPORT_PACKAGE" },
      { loadProject, downloadZip } as never
    );

    expect(downloadZip).toHaveBeenCalledWith(project);
    expect(response).toEqual({ ok: true, count: 1 });
  });

  it("保存快速综述报告", async () => {
    const saveProject = vi.fn(async (nextProject: ProjectState) => nextProject);
    const loadProject = vi.fn().mockResolvedValue(project);
    const response = await handleRuntimeMessage(
      { type: "SAVE_QUICK_REVIEW_REPORT", report: "快速综述报告正文" },
      { loadProject, saveProject } as never
    );

    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({
      quickReviewReport: expect.objectContaining({
        content: "快速综述报告正文"
      })
    }));
    expect(response).toMatchObject({ ok: true });
  });

  it("没有快速综述报告时拒绝下载", async () => {
    const loadProject = vi.fn().mockResolvedValue(project);
    const response = await handleRuntimeMessage(
      { type: "DOWNLOAD_QUICK_REVIEW_REPORT" },
      { loadProject } as never
    );

    expect(response).toEqual({ ok: false, error: "尚未生成快速综述报告" });
  });

  it("下载快速综述报告时生成 Word 文档", async () => {
    const loadProject = vi.fn().mockResolvedValue({
      ...project,
      quickReviewReport: {
        content: "# 快速综述\n\n这是一段报告正文。",
        generatedAt: "2026-05-17T00:00:00.000Z"
      }
    });
    const downloadWordFile = vi.fn().mockResolvedValue(undefined);
    const response = await handleRuntimeMessage(
      { type: "DOWNLOAD_QUICK_REVIEW_REPORT" },
      { loadProject, downloadWordFile } as never
    );

    expect(downloadWordFile).toHaveBeenCalledWith(
      expect.stringMatching(/^cnki-quick-review-\d+\.doc$/),
      "知网快速综述报告",
      "# 快速综述\n\n这是一段报告正文。",
      project.records
    );
    expect(response).toEqual({ ok: true });
  });

  it("保存深度综述报告", async () => {
    const saveProject = vi.fn(async (nextProject: ProjectState) => nextProject);
    const loadProject = vi.fn().mockResolvedValue(project);
    const response = await handleRuntimeMessage(
      { type: "SAVE_DEEP_REVIEW_REPORT", report: "深度综述报告正文" },
      { loadProject, saveProject } as never
    );

    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({
      deepReviewReport: expect.objectContaining({
        content: "深度综述报告正文"
      })
    }));
    expect(response).toMatchObject({ ok: true });
  });

  it("没有深度综述报告时拒绝下载", async () => {
    const loadProject = vi.fn().mockResolvedValue(project);
    const response = await handleRuntimeMessage(
      { type: "DOWNLOAD_DEEP_REVIEW_REPORT" },
      { loadProject } as never
    );

    expect(response).toEqual({ ok: false, error: "尚未生成深度综述报告" });
  });

  it("下载深度综述报告时生成 Word 文档", async () => {
    const loadProject = vi.fn().mockResolvedValue({
      ...project,
      deepReviewReport: {
        content: "# 深度综述\n\n这是一段报告正文。",
        generatedAt: "2026-05-17T00:00:00.000Z"
      }
    });
    const downloadWordFile = vi.fn().mockResolvedValue(undefined);
    const response = await handleRuntimeMessage(
      { type: "DOWNLOAD_DEEP_REVIEW_REPORT" },
      { loadProject, downloadWordFile } as never
    );

    expect(downloadWordFile).toHaveBeenCalledWith(
      expect.stringMatching(/^cnki-deep-review-\d+\.doc$/),
      "知网深度综述报告",
      "# 深度综述\n\n这是一段报告正文。",
      project.records
    );
    expect(response).toEqual({ ok: true });
  });

  it("下载 Word 文档时追加采集论文列表", async () => {
    const download = vi.fn().mockResolvedValue(1);
    vi.stubGlobal("chrome", {
      downloads: { download }
    });

    await downloadWordFile("report.doc", "测试报告", "# 报告正文", [{
      id: "P0001",
      title: "党建引领基层治理的实践路径研究",
      authors: ["张三", "李四"],
      source: "测试期刊",
      publishedAt: "2026-05-17",
      database: "期刊",
      citations: null,
      downloads: null,
      detailUrl: "https://example.com",
      abstract: "摘要",
      keywords: ["基层治理", "党建引领"],
      funding: "",
      album: "",
      topic: "",
      classification: "",
      collectedAt: "2026-05-17T00:00:00.000Z",
      status: "complete"
    }]);

    const [{ url, filename }] = download.mock.calls[0];
    const html = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    expect(filename).toBe("report.doc");
    expect(html).toContain("采集论文列表");
    expect(html).toContain("P0001");
    expect(html).toContain("党建引领基层治理的实践路径研究");
  });
});
