import { describe, expect, it } from "vitest";
import { mergeRecords } from "../../extension/src/background/storage";
import type { CnkiRecord } from "../../extension/src/shared/types";

const baseRecord: CnkiRecord = {
  id: "P0001",
  title: "测试论文",
  authors: ["张三"],
  source: "测试期刊",
  publishedAt: "2026",
  database: "期刊",
  citations: 1,
  downloads: 2,
  detailUrl: "https://example.com/detail",
  abstract: "",
  keywords: [],
  funding: "",
  album: "",
  topic: "",
  classification: "",
  collectedAt: "2026-05-04T00:00:00.000Z",
  status: "list-only"
};

describe("mergeRecords", () => {
  it("按详情页链接去重，并保留已经补全的详情字段", () => {
    const existing = [{
      ...baseRecord,
      abstract: "已有摘要",
      keywords: ["基层治理"],
      status: "complete" as const
    }];
    const incoming = [{ ...baseRecord, id: "P0002", abstract: "", status: "list-only" as const }];

    const merged = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("P0001");
    expect(merged[0].abstract).toBe("已有摘要");
    expect(merged[0].keywords).toEqual(["基层治理"]);
    expect(merged[0].status).toBe("complete");
  });

  it("为新增论文重新生成连续 ID", () => {
    const incoming = [{
      ...baseRecord,
      id: "临时ID",
      title: "第二篇论文",
      detailUrl: "https://example.com/detail-2"
    }];

    const merged = mergeRecords([baseRecord], incoming);

    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe("P0002");
  });

  it("补全详情页后作者或题名展示变化时仍合并为同一篇论文", () => {
    const incoming = [{
      ...baseRecord,
      id: "P0002",
      title: "测试论文 附视频",
      authors: ["张三", "测试大学"],
      abstract: "补全后的摘要",
      keywords: ["乡村振兴"],
      status: "complete" as const
    }];

    const merged = mergeRecords([baseRecord], incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("P0001");
    expect(merged[0].title).toBe("测试论文");
    expect(merged[0].authors).toEqual(["张三"]);
    expect(merged[0].abstract).toBe("补全后的摘要");
    expect(merged[0].keywords).toEqual(["乡村振兴"]);
    expect(merged[0].status).toBe("complete");
  });

  it("导入全文时合并到已有论文记录", () => {
    const incoming = [{
      ...baseRecord,
      id: "P0002",
      fullText: "这是一段 PDF 全文。",
      fullTextFileName: "测试论文.pdf",
      fullTextImportedAt: "2026-05-04T01:00:00.000Z",
      fullTextMatchScore: 0.96,
      fullTextStatus: "matched" as const
    }];

    const merged = mergeRecords([baseRecord], incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("P0001");
    expect(merged[0].fullText).toBe("这是一段 PDF 全文。");
    expect(merged[0].fullTextFileName).toBe("测试论文.pdf");
    expect(merged[0].fullTextMatchScore).toBe(0.96);
    expect(merged[0].fullTextStatus).toBe("matched");
  });
});
