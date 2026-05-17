import { describe, expect, it } from "vitest";
import {
  buildAiMarkdown,
  buildAnalysisPrompt,
  buildCsv,
  buildExportFiles,
  buildFullTextEnhancedBatches,
  buildFullTextMergePrompt,
  buildReadme
} from "../../extension/src/export/exporters";
import type { CnkiRecord } from "../../extension/src/shared/types";

const record: CnkiRecord = {
  id: "P0001",
  title: "关系产权视域下党建引领村集体经济组织治理研究",
  authors: ["许中缘", "潘笛"],
  source: "中南大学学报(社会科学版)",
  publishedAt: "2026-04-23",
  database: "期刊",
  citations: 112,
  downloads: 18,
  detailUrl: "https://example.com/detail",
  abstract: "构建具有中国特色的村集体经济组织治理体系。",
  keywords: ["集体经济组织", "党建引领"],
  funding: "湖南省普通本科高校教学改革研究一般项目",
  album: "社会科学Ⅰ辑",
  topic: "中国共产党; 农业经济",
  classification: "F321.32;D267.2",
  collectedAt: "2026-05-04T00:00:00.000Z",
  status: "complete"
};

describe("AI export builders", () => {
  it("生成带论文 ID 的 AI 阅读版 Markdown", () => {
    const markdown = buildAiMarkdown([record]);

    expect(markdown).toContain("[论文ID] P0001");
    expect(markdown).toContain("题名：关系产权视域下党建引领村集体经济组织治理研究");
    expect(markdown).toContain("关键词：集体经济组织；党建引领");
  });

  it("生成 CSV 和中文说明", () => {
    expect(buildCsv([record])).toContain("ID,题名,作者");
    expect(buildReadme()).toContain("快速综述材料");
  });

  it("快速综述提示词限定为摘要级分析", () => {
    const prompt = buildAnalysisPrompt();

    expect(prompt).toContain("论文题录、摘要和关键词");
    expect(prompt).toContain("不要推断论文的研究方法、论证过程、数据来源或材料细节");
    expect(prompt).not.toContain("可用全文");
    expect(prompt).not.toContain("有全文的论文优先依据全文判断");
  });

  it("生成完整导出文件清单", () => {
    const files = buildExportFiles([record], 1);

    expect(files.map((file) => file.filename)).toEqual([
      "快速综述材料/第001批.txt",
      "知网文献列表.csv",
      "使用说明.txt"
    ]);
  });

  it("有 PDF 全文时生成全文增强批次", () => {
    const recordWithFullText = {
      ...record,
      fullText: "引言部分。".repeat(200),
      fullTextFileName: "关系产权视域下党建引领村集体经济组织治理研究.pdf",
      fullTextMatchScore: 0.95,
      fullTextStatus: "matched" as const
    };

    const batches = buildFullTextEnhancedBatches([recordWithFullText], 1000);
    const files = buildExportFiles([recordWithFullText], 1);

    expect(batches[0].filename).toBe("02_全文增强分析包/enhance_batch_001.md");
    expect(batches[0].content).toContain("摘要：构建具有中国特色的村集体经济组织治理体系。");
    expect(batches[0].content).toContain("关键词：集体经济组织；党建引领");
    expect(batches[0].content).toContain("全文切片");
    expect(files.map((file) => file.filename)).not.toContain("02_全文增强分析包/enhance_batch_001.md");
  });

  it("全文增强批次中没有全文的论文标明未导入", () => {
    const batches = buildFullTextEnhancedBatches([record], 1000);

    expect(batches[0].content).toContain("全文：未导入");
  });

  it("全文增强分析提示词包含深度综述分析要求", () => {
    const prompt = buildFullTextMergePrompt();

    expect(prompt).toContain("阅读规则");
    expect(prompt).toContain("证据等级");
    expect(prompt).toContain("代表性论文");
    expect(prompt).toContain("重复性研究");
    expect(prompt).toContain("研究空白");
    expect(prompt).toContain("可写入文献综述");
    expect(prompt).toContain("英文论文");
    expect(prompt).toContain("用中文归纳");
  });
});
