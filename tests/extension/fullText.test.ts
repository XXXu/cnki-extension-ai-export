import { describe, expect, it } from "vitest";
import { cleanFullText, matchFullTextToRecord, normalizeForMatch, splitFullText } from "../../extension/src/fulltext/fullText";
import type { CnkiRecord } from "../../extension/src/shared/types";

const record: CnkiRecord = {
  id: "P0001",
  title: "乡村振兴视角下基层治理路径研究",
  authors: ["张三", "李四"],
  source: "测试期刊",
  publishedAt: "2026",
  database: "期刊",
  citations: null,
  downloads: null,
  detailUrl: "https://example.com/detail",
  abstract: "摘要",
  keywords: ["乡村振兴"],
  funding: "",
  album: "",
  topic: "",
  classification: "",
  collectedAt: "2026-05-04T00:00:00.000Z",
  status: "complete"
};

const englishRecord: CnkiRecord = {
  ...record,
  id: "P0002",
  title: "Rural Governance and Collective Economy in China",
  authors: ["John Smith", "Mary Lee"],
  source: "Journal of Rural Studies",
  keywords: ["rural governance"],
  abstract: "English abstract"
};

describe("fullText helpers", () => {
  it("清洗匹配文本时去除空白和标点", () => {
    expect(normalizeForMatch("《乡村振兴：基层治理》")).toBe("乡村振兴基层治理");
  });

  it("清洗 PDF 全文中的多余空白", () => {
    expect(cleanFullText("第一段\n\n   第二段")).toBe("第一段 第二段");
  });

  it("按长度切分全文并保留重叠内容", () => {
    const chunks = splitFullText("12345678901234567890", { chunkSize: 10, overlapSize: 2 });

    expect(chunks).toEqual(["1234567890", "9012345678", "7890"]);
  });

  it("题名出现在 PDF 首页文本时匹配到论文", () => {
    const result = matchFullTextToRecord(
      [record],
      "下载文件.pdf",
      "乡村振兴视角下基层治理路径研究 张三 李四 测试期刊 正文内容"
    );

    expect(result.record?.id).toBe("P0001");
    expect(result.score).toBeGreaterThanOrEqual(0.72);
  });

  it("低分匹配不自动绑定论文", () => {
    const result = matchFullTextToRecord([record], "无关文件.pdf", "这是一篇完全无关的 PDF");

    expect(result.record).toBeNull();
    expect(result.score).toBeLessThan(0.72);
  });

  it("英文 PDF 题名和作者出现在首页时匹配到英文论文", () => {
    const result = matchFullTextToRecord(
      [record, englishRecord],
      "Rural Governance and Collective Economy in China.pdf",
      "Rural Governance and Collective Economy in China John Smith Mary Lee Journal of Rural Studies"
    );

    expect(result.record?.id).toBe("P0002");
    expect(result.score).toBeGreaterThanOrEqual(0.72);
  });
});
