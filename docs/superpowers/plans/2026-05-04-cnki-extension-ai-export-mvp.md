# 知网浏览器插件 AI 分析包 MVP 实施计划

## 目标

实现一个 Chrome / Edge 浏览器插件 MVP。插件在用户已登录知网的浏览器页面中运行，采集知网检索结果页中的论文题录，保存到浏览器本地，并导出适合上传到 ChatGPT / DeepSeek 的 AI 分析包。

## 范围

第一版只做浏览器插件，不做本地工作台，不接 AI API，不批量下载全文，不绕过验证码或登录限制。

## 已完成任务

- [x] 搭建 TypeScript、Vite、React、Vitest 和 Manifest V3 插件脚手架。
- [x] 实现知网检索结果页解析器。
- [x] 实现知网论文详情页解析器。
- [x] 实现内容脚本消息处理和页面识别。
- [x] 实现本地项目状态、论文去重和记录追加。
- [x] 实现 CSV、JSONL、Markdown 批次和中文提示词导出。
- [x] 实现后台消息处理和 zip 下载。
- [x] 实现弹窗采集、统计、导出和清空操作。

## 当前文件结构

- `extension/manifest.json`：插件清单。
- `extension/src/content/resultPage.ts`：检索结果页解析。
- `extension/src/content/detailPage.ts`：详情页解析。
- `extension/src/content/index.ts`：内容脚本消息处理。
- `extension/src/background/storage.ts`：本地状态、去重和保存。
- `extension/src/background/serviceWorker.ts`：后台消息、导出和下载。
- `extension/src/export/exporters.ts`：AI 分析包文件生成。
- `extension/src/popup/App.tsx`：弹窗交互。
- `extension/src/popup/styles.css`：弹窗样式。
- `tests/extension/*.test.ts` 和 `tests/extension/*.test.tsx`：单元测试。
- `tests/fixtures/*.html`：知网页面样例。

## 验证清单

- [x] `npm.cmd test`
- [x] `npm.cmd run build`
- [x] 构建后 `dist/manifest.json` 存在。
- [x] `dist/manifest.json` 的弹窗入口指向 `extension/src/popup/popup.html`。

## 手动使用步骤

1. 运行 `npm.cmd install`。
2. 运行 `npm.cmd run build`。
3. 在 Chrome 或 Edge 扩展管理页开启“开发者模式”。
4. 选择“加载已解压的扩展”，目录选择 `dist`。
5. 打开知网并登录。
6. 使用知网检索论文，进入结果列表页。
7. 点击插件图标，选择“采集当前页”。
8. 翻页后重复采集，直到覆盖需要的范围。
9. 点击“导出 AI 分析包”。
10. 将 `analysis_prompt.md` 和 `batch_*.md` 上传到 ChatGPT / DeepSeek 分析，再用 `merge_prompt.md` 合并结果。

## 下一阶段建议

- 接入“自动打开详情页并补全摘要/关键词”的流程。
- 支持多页自动采集、暂停、继续和失败重试。
- 在弹窗中显示最近采集的论文列表和失败原因。
- 增加导出前筛选：只导出期刊、只导出高被引、按年份范围导出等。
