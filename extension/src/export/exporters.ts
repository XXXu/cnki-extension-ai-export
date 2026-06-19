import Papa from "papaparse";
import { splitFullText } from "../fulltext/fullText";
import type { CnkiRecord } from "../shared/types";

export type ExportFile = {
  filename: string;
  content: string;
  mimeType: string;
};

export function buildCsv(records: CnkiRecord[]) {
  return Papa.unparse(
    records.map((record) => ({
      ID: record.id,
      题名: record.title,
      作者: record.authors.join(";"),
      来源: record.source,
      发表时间: record.publishedAt,
      数据库: record.database,
      被引: record.citations ?? "",
      下载: record.downloads ?? "",
      关键词: record.keywords.join(";"),
      摘要: record.abstract,
      基金资助: record.funding,
      专辑: record.album,
      专题: record.topic,
      分类号: record.classification,
      全文文件: record.fullTextFileName ?? "",
      全文状态: record.fullTextStatus ?? "none",
      详情页链接: record.detailUrl,
      采集状态: record.status
    })),
    {
      columns: [
        "ID",
        "题名",
        "作者",
        "来源",
        "发表时间",
        "数据库",
        "被引",
        "下载",
        "关键词",
        "摘要",
        "基金资助",
        "专辑",
        "专题",
        "分类号",
        "全文文件",
        "全文状态",
        "详情页链接",
        "采集状态"
      ],
      escapeFormulae: true
    }
  );
}

export function buildJsonl(records: CnkiRecord[]) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

export function buildAiMarkdown(records: CnkiRecord[]) {
  return records
    .map((record) => [
      `[论文ID] ${record.id}`,
      `题名：${record.title}`,
      `作者：${record.authors.join("；")}`,
      `来源：${record.source}`,
      `发表时间：${record.publishedAt}`,
      `数据库：${record.database}`,
      `被引：${record.citations ?? ""}`,
      `下载：${record.downloads ?? ""}`,
      `关键词：${record.keywords.join("；")}`,
      `摘要：${record.abstract}`,
      `基金资助：${record.funding}`,
      `专辑：${record.album}`,
      `专题：${record.topic}`,
      `分类号：${record.classification}`,
      `详情页链接：${record.detailUrl}`,
      `采集状态：${record.status}`
    ].join("\n"))
    .join("\n\n---\n\n");
}

export function buildBatches(records: CnkiRecord[], batchSize = 100) {
  const batches: Array<{ filename: string; content: string }> = [];
  for (let index = 0; index < records.length; index += batchSize) {
    const batchNumber = String(batches.length + 1).padStart(3, "0");
    const batchRecords = records.slice(index, index + batchSize);
    batches.push({
      filename: `快速综述材料/第${batchNumber}批.txt`,
      content: [
        buildAnalysisPrompt(),
        "",
        "---",
        "",
        buildAiMarkdown(batchRecords)
      ].join("\n")
    });
  }
  return batches;
}

export function buildQuickSummaryMarkdown(records: CnkiRecord[]) {
  return [
    buildAnalysisPrompt(),
    "",
    "---",
    "",
    buildAiMarkdown(records)
  ].join("\n");
}

export function buildFullTextIndex(records: CnkiRecord[]) {
  const fullTextRecords = records.filter((record) => record.fullText);
  if (fullTextRecords.length === 0) return "当前分析包尚未导入 PDF 全文。";

  return [
    "# 全文论文索引",
    "",
    ...fullTextRecords.map((record) => [
      `- ${record.id}｜${record.title}`,
      `  - 作者：${record.authors.join("；")}`,
      `  - 来源：${record.source}`,
      `  - PDF：${record.fullTextFileName ?? ""}`
    ].join("\n"))
  ].join("\n");
}

function buildEnhancedRecordBlock(record: CnkiRecord, chunk: string | null, chunkIndex: number, chunkCount: number) {
  const lines = [
    `[论文ID] ${record.id}`,
    `题名：${record.title}`,
    `作者：${record.authors.join("；")}`,
    `来源：${record.source}`,
    `发表时间：${record.publishedAt}`,
    `关键词：${record.keywords.join("；")}`,
    `摘要：${record.abstract}`,
    `PDF文件：${record.fullTextFileName ?? ""}`,
    `全文状态：${record.fullTextStatus ?? "none"}`
  ];

  if (!chunk) {
    return [...lines, "全文：未导入"].join("\n");
  }

  return [
    ...lines,
    `全文切片：${chunkIndex + 1}/${chunkCount}`,
    "",
    chunk
  ].join("\n");
}

export function buildFullTextEnhancedBatches(records: CnkiRecord[], maxBatchChars = 60000) {
  const blocks = records
    .flatMap((record) => {
      if (!record.fullText) return [buildEnhancedRecordBlock(record, null, 0, 0)];
      const chunks = splitFullText(record.fullText ?? "");
      return chunks.map((chunk, index) => buildEnhancedRecordBlock(record, chunk, index, chunks.length));
    });

  const batches: Array<{ filename: string; content: string }> = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const block of blocks) {
    if (current.length > 0 && currentLength + block.length > maxBatchChars) {
      const batchNumber = String(batches.length + 1).padStart(3, "0");
      batches.push({
        filename: `02_全文增强分析包/enhance_batch_${batchNumber}.md`,
        content: current.join("\n\n---\n\n")
      });
      current = [];
      currentLength = 0;
    }
    current.push(block);
    currentLength += block.length;
  }

  if (current.length > 0) {
    const batchNumber = String(batches.length + 1).padStart(3, "0");
    batches.push({
      filename: `02_全文增强分析包/enhance_batch_${batchNumber}.md`,
      content: current.join("\n\n---\n\n")
    });
  }

  return batches;
}

export function buildAnalysisPrompt() {
  return [
    "请根据我提供的论文题录、摘要和关键词，完成文献综述前期的摘要级分析。",
    "材料不包含论文全文。请只依据题名、作者、来源、发表时间、关键词和摘要进行判断；不要推断论文的研究方法、论证过程、数据来源或材料细节。",
    "所有判断尽量引用论文ID；区分高频观点、重复性表达和建议优先核对/精读的代表论文；不要编造材料中没有的信息。",
    "如果材料中包含英文论文，请纳入同一套分类和归纳，并用中文总结其可从题录、摘要和关键词中看出的观点、可能贡献和不足。",
    "",
    "请回答：",
    "1. 这些论文大概分成哪几类？",
    "2. 每一类主要在讨论什么？",
    "3. 哪些观点反复出现？",
    "4. 哪些论文只是重复已有说法？",
    "5. 哪些论文看起来有代表性，建议优先核对或精读？",
    "6. 已有研究的贡献是什么？",
    "7. 共同不足是什么？",
    "8. 研究空白可能在哪里？",
    "9. 哪些内容可以进入我的文献综述？",
    "",
    "输出格式建议：主题分类表、反复观点表、建议优先核对论文清单、已有贡献、共同不足、研究空白、可写入文献综述的素材段落。"
  ].join("\n");
}

export function buildMergePrompt() {
  return [
    "请合并多个批次的文献分析结果，生成总报告。",
    "要求：去除重复主题，保留能够回溯到论文ID的判断；如果不同批次结论冲突，请指出冲突并说明可能原因。",
    "输出结构：主题分类、反复观点、代表论文、已有贡献、共同不足、研究空白、可写入文献综述的段落草稿。"
  ].join("\n");
}

export function buildFullTextMergePrompt() {
  return [
    "# 全文增强分析提示词",
    "",
    "请分析我上传的 `02_全文增强分析包/enhance_batch_xxx.md`。这些材料来自知网论文，部分论文包含 PDF 全文切片，部分论文只有题录、摘要和关键词。请把目标放在博士论文文献综述的前期归纳上，而不是简单摘要每篇论文。",
    "",
    "## 阅读规则",
    "",
    "1. 每条材料都有 `[论文ID]`。所有重要判断都要尽量标注论文ID，方便我回到原文核对。",
    "2. 有 `全文切片` 的论文，优先依据全文判断；摘要只能作为辅助。",
    "3. 标明 `全文：未导入` 的论文，只能做摘要级判断，不能推断其研究方法、论证过程或材料细节。",
    "4. 如果同一论文被拆成多个全文切片，请把这些切片合并理解为同一篇论文，不要当成多篇论文。",
    "5. 英文论文也必须纳入分析，请用中文归纳英文论文的观点、方法、贡献和不足；不要因为题名或全文是英文就漏掉。",
    "6. 不要编造材料中没有的信息；无法判断时请明确写“材料不足，不能判断”。",
    "",
    "## 证据等级",
    "",
    "请在重要结论后标注证据等级：",
    "",
    "- `全文证据`：判断来自论文全文切片，可用于深度综述。",
    "- `摘要证据`：判断只来自题录、摘要或关键词，只能用于初步判断。",
    "- `弱证据`：材料不足，只能作为线索，不能直接写成确定结论。",
    "",
    "## 请完成的分析任务",
    "",
    "1. 主题分类：这些论文可以分成哪几类？每类列出代表论文ID，并说明分类依据。",
    "2. 每类讨论重点：每一类主要讨论什么问题、使用什么概念、围绕什么对象展开。",
    "3. 反复出现的观点：哪些观点、判断、政策表达或理论说法反复出现？列出对应论文ID。",
    "4. 重复性研究：哪些论文只是重复已有说法、材料或论证较弱？说明判断依据，避免只凭题名下结论。",
    "5. 代表性论文：筛选值得精读的代表性论文，说明它们为什么代表性强，例如问题意识清楚、理论框架明确、方法扎实、材料充分、结论有启发。",
    "6. 已有研究贡献：总结这一批研究在概念界定、理论推进、经验材料、政策解释、方法应用上的贡献。",
    "7. 共同不足：归纳这些研究共同存在的问题，例如概念泛化、案例单一、方法薄弱、经验材料不足、理论创新不足、对反例讨论不够。",
    "8. 研究空白：指出可能继续推进的研究空白，区分“真正空白”和“已有研究提到但做得不充分”。",
    "9. 可写入文献综述的内容：提炼可以直接进入我论文文献综述的段落素材，要求学术表达、不要口语化，并保留论文ID。",
    "",
    "## 输出结构",
    "",
    "请按以下结构输出：",
    "",
    "### 一、主题分类表",
    "用表格列出：类别、核心问题、代表论文ID、证据等级、简要说明。",
    "",
    "### 二、反复观点与重复性研究",
    "分别列出高频观点、重复表达、可能只是跟随政策话语的论文，并说明依据。",
    "",
    "### 三、代表性论文清单",
    "列出值得精读的论文ID、题名、推荐理由、适合放入文献综述的用途。",
    "",
    "### 四、已有研究贡献",
    "按理论贡献、方法贡献、材料贡献、政策解释贡献分类总结。",
    "",
    "### 五、共同不足与研究空白",
    "把共同不足和研究空白分开写，不要混为一谈。",
    "",
    "### 六、可写入文献综述的段落素材",
    "给出若干段可直接改写进论文的中文学术段落，每段后保留相关论文ID。",
    "",
    "### 七、需要回到原文核对的问题",
    "列出你认为仍需我人工精读确认的地方。"
  ].join("\n");
}

export function buildReadme() {
  return [
    "知网文献综述材料包使用说明",
    "",
    "文件结构：",
    "",
    "1. 快速综述材料：给 DeepSeek、ChatGPT 等 AI 网页上传或粘贴使用，材料里已经包含分析要求。",
    "2. 知网文献列表.csv：全部采集论文的表格，包含论文ID、题名、作者、来源、摘要、关键词等信息。",
    "3. 使用说明.txt：当前说明文件。",
    "",
    "建议用法：",
    "",
    "1. 打开 DeepSeek 或 ChatGPT 网页。",
    "2. 上传或复制“快速综述材料”文件夹中的批次文件。",
    "3. 如果文件较多，可以逐批分析，再把各批次结论合并。",
    "4. AI 输出中提到的论文ID，可以回到“知网文献列表.csv”中核对具体论文。"
  ].join("\n");
}

export function buildExportFiles(records: CnkiRecord[], batchSize = 100): ExportFile[] {
  return [
    ...buildBatches(records, batchSize).map((batch) => ({
      filename: batch.filename,
      content: batch.content,
      mimeType: "text/plain;charset=utf-8"
    })),
    { filename: "知网文献列表.csv", content: buildCsv(records), mimeType: "text/csv;charset=utf-8" },
    { filename: "使用说明.txt", content: buildReadme(), mimeType: "text/plain;charset=utf-8" }
  ];
}
