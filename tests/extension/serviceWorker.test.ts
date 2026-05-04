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
});
