import { describe, expect, it } from "vitest";
import { cleanFullText, splitFullText } from "../../extension/src/fulltext/fullText";

describe("fullText helpers", () => {
  it("清洗 PDF 全文中的多余空白", () => {
    expect(cleanFullText("第一段\n\n   第二段")).toBe("第一段 第二段");
  });

  it("按长度切分全文并保留重叠内容", () => {
    const chunks = splitFullText("12345678901234567890", { chunkSize: 10, overlapSize: 2 });

    expect(chunks).toEqual(["1234567890", "9012345678", "7890"]);
  });
});
