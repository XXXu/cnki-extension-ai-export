import { describe, expect, it, vi } from "vitest";
import { handleRuntimeMessage } from "../../extension/src/background/serviceWorker";
import type { ProjectState } from "../../extension/src/shared/types";

const project: ProjectState = {
  name: "测试项目",
  records: [{ id: "P0001", status: "complete" } as ProjectState["records"][number]],
  failures: [],
  paused: false,
  updatedAt: "2026-05-04T00:00:00.000Z"
};

describe("service worker messages", () => {
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
});
