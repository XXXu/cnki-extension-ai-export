# 知网 PDF 全文导入 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让浏览器插件支持导入用户主动选择的 PDF 全文，并在导出 AI 分析包时生成快速摘要分析包和全文增强分析包。

**Architecture:** 在现有插件内增加全文字段、PDF 文本提取模块、自动匹配模块和全文导出模块。弹窗保持简单，只增加一个“导入全文 PDF”按钮；所有数据继续保存在 `chrome.storage.local` 的项目记录中。

**Tech Stack:** Chrome Extension Manifest V3、React、TypeScript、Vitest、JSZip、PapaParse、PDF.js（`pdfjs-dist`）。

---

### Task 1: 扩展论文记录类型

**Files:**
- Modify: `extension/src/shared/types.ts`
- Test: `tests/extension/storage.test.ts`

- [ ] **Step 1: 给 `CnkiRecord` 增加全文字段**

在 `CnkiRecord` 中加入：

```ts
fullText?: string;
fullTextFileName?: string;
fullTextImportedAt?: string;
fullTextMatchScore?: number;
fullTextStatus?: "none" | "matched" | "unmatched" | "failed";
```

- [ ] **Step 2: 更新存储合并测试**

在 `tests/extension/storage.test.ts` 增加断言：同一论文导入全文后，`mergeRecords` 保留原 ID，并补入 `fullText`、`fullTextFileName`、`fullTextStatus`。

- [ ] **Step 3: 修改 `keepBestRecord`**

在 `extension/src/background/storage.ts` 中保留更完整的全文字段：

```ts
fullText: prior.fullText || incoming.fullText,
fullTextFileName: prior.fullTextFileName || incoming.fullTextFileName,
fullTextImportedAt: prior.fullTextImportedAt || incoming.fullTextImportedAt,
fullTextMatchScore: prior.fullTextMatchScore ?? incoming.fullTextMatchScore,
fullTextStatus: prior.fullTextStatus || incoming.fullTextStatus
```

- [ ] **Step 4: 运行测试**

Run: `npm.cmd test --prefix .worktrees\cnki-extension-ai-export -- tests/extension/storage.test.ts`

Expected: storage tests pass.

### Task 2: 增加全文清洗、切片和匹配模块

**Files:**
- Create: `extension/src/fulltext/fullText.ts`
- Test: `tests/extension/fullText.test.ts`

- [ ] **Step 1: 写全文切片测试**

覆盖行为：

```ts
splitFullText("一段很长的文本", { chunkSize: 10, overlapSize: 2 })
```

应返回多个切片，并且相邻切片保留重叠。

- [ ] **Step 2: 写匹配测试**

构造两篇论文记录和一个 PDF 文本，要求题名完全出现时匹配到正确论文，匹配分数大于等于 `0.72`。

- [ ] **Step 3: 实现清洗函数**

实现：

```ts
export function normalizeForMatch(value: string): string
export function cleanFullText(value: string): string
```

- [ ] **Step 4: 实现切片函数**

实现：

```ts
export function splitFullText(text: string, options?: { chunkSize?: number; overlapSize?: number }): string[]
```

默认 `chunkSize = 7000`，`overlapSize = 500`。

- [ ] **Step 5: 实现匹配函数**

实现：

```ts
export function matchFullTextToRecord(records: CnkiRecord[], fileName: string, text: string): { record: CnkiRecord | null; score: number }
```

题名完整出现直接高分；文件名和作者命中加分；低于 `0.72` 返回 `record: null`。

- [ ] **Step 6: 运行测试**

Run: `npm.cmd test --prefix .worktrees\cnki-extension-ai-export -- tests/extension/fullText.test.ts`

Expected: fullText tests pass.

### Task 3: PDF 文本提取

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `extension/src/fulltext/pdfText.ts`
- Test: `tests/extension/pdfText.test.ts`

- [ ] **Step 1: 安装 PDF.js**

Run: `npm.cmd install --prefix .worktrees\cnki-extension-ai-export pdfjs-dist`

- [ ] **Step 2: 实现 PDF 文本提取接口**

创建：

```ts
export async function extractPdfText(file: File): Promise<string>
```

使用 `pdfjs-dist` 逐页读取 `getTextContent()`，把文字项拼接成纯文本。

- [ ] **Step 3: 单元测试清洗边界**

PDF.js 的真实解析不在 Vitest 中强测，测试 `cleanFullText` 对解析后的文本有效。真实 PDF 解析通过构建和浏览器手动验证。

### Task 4: 弹窗导入 PDF

**Files:**
- Modify: `extension/src/popup/App.tsx`
- Test: `tests/extension/popup.test.tsx`

- [ ] **Step 1: 写弹窗测试**

测试点击“导入全文 PDF”会触发隐藏文件输入框；模拟导入后会向后台发送 `SAVE_RECORDS`，记录包含 `fullTextStatus: "matched"`。

- [ ] **Step 2: 增加文件输入框**

在弹窗中加入隐藏的 `<input type="file" accept="application/pdf" multiple />`。

- [ ] **Step 3: 增加导入按钮**

按钮文字：

```text
导入全文 PDF
```

- [ ] **Step 4: 实现导入流程**

读取当前项目记录，逐个 PDF：

1. 提取文本。
2. 自动匹配论文。
3. 匹配成功则生成带全文字段的记录。
4. 匹配失败则计入未匹配数量。
5. 失败则计入失败数量。

状态显示：

```text
已读取 X 个 PDF，匹配 Y 篇，未匹配 Z 个，失败 N 个
```

### Task 5: 升级导出结构

**Files:**
- Modify: `extension/src/export/exporters.ts`
- Test: `tests/extension/exporters.test.ts`

- [ ] **Step 1: 写导出测试**

构造两篇论文，其中一篇带 `fullText`。断言 zip 内容包含：

```text
01_快速摘要分析包.md
02_全文增强分析包/batch_001.md
02_全文论文索引.md
03_最终汇总提示词.md
```

- [ ] **Step 2: 保留基础文件**

继续导出 `papers.csv`、`papers.jsonl`、`papers_for_ai.md`、`analysis_prompt.md`、`merge_prompt.md`，避免破坏用户已有使用方式。

- [ ] **Step 3: 新增快速摘要分析包**

用现有摘要 Markdown 内容生成 `01_快速摘要分析包.md`。

- [ ] **Step 4: 新增全文增强分析包**

对全部记录生成全文增强材料：有 `fullText` 的记录包含题录、摘要、关键词和全文切片；没有 `fullText` 的记录标明“全文：未导入”。按约 60000 字组批，生成 `02_全文增强分析包/batch_XXX.md`。

- [ ] **Step 5: 新增索引和汇总提示词**

生成 `02_全文论文索引.md` 和 `03_最终汇总提示词.md`。

### Task 6: 最终验证

**Files:**
- All modified files

- [ ] **Step 1: 跑完整测试**

Run: `npm.cmd test --prefix .worktrees\cnki-extension-ai-export`

Expected: all tests pass.

- [ ] **Step 2: 构建插件**

Run: `npm.cmd run --prefix .worktrees\cnki-extension-ai-export build`

Expected: build succeeds and `dist` updates.

- [ ] **Step 3: 检查变更范围**

Run: `git -C .worktrees\cnki-extension-ai-export status --short`

Expected: only planned files changed.
