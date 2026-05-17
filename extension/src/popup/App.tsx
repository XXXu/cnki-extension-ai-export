import { useEffect, useRef, useState } from "react";
import { generateDeepReview, generateQuickReview, login, register, type AuthSession } from "./api";
import { matchFullTextToRecord } from "../fulltext/fullText";
import type { CnkiRecord } from "../shared/types";

type ProjectSnapshot = {
  records: CnkiRecord[];
  failures: Array<{ url: string; reason: string }>;
  quickReviewReport?: {
    content: string;
    generatedAt: string;
  };
  deepReviewReport?: {
    content: string;
    generatedAt: string;
  };
};

type RuntimeResponse<T = unknown> = {
  ok: boolean;
  error?: string;
} & T;

type ContentResponse = RuntimeResponse<{
  kind?: "result" | "detail" | "unknown";
  records?: CnkiRecord[];
}>;

type FrameCollectionResult = {
  records: CnkiRecord[];
  diagnostics: {
    url: string;
    title: string;
    tables: number;
    resultTables: number;
    titleLinks: number;
    textSample: string;
  };
};

type DetailFrameResult = {
  detail: Partial<Pick<CnkiRecord, "title" | "authors" | "abstract" | "keywords" | "funding" | "album" | "topic" | "classification">>;
  diagnostics: {
    title: string;
    abstractLength: number;
    keywordCount: number;
  };
};

const AUTH_STORAGE_KEY = "cnkiReviewAuth";

function sendRuntimeMessage<T>(message: object): Promise<RuntimeResponse<T>> {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

function saveAuthSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab));
  });
}

function parseCurrentTab(tabId: number): Promise<ContentResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "PARSE_CURRENT_PAGE" }, resolve);
  });
}

function extractCnkiRecordsFromFrame(): FrameCollectionResult {
  const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  const splitAuthors = (value: string) => cleanText(value)
    .split(/[;；,，、]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
  const parseCount = (value: string) => {
    const text = cleanText(value);
    if (!text || text === "-") return null;
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : null;
  };
  const absolutizeUrl = (href: string) => {
    try {
      return new URL(href, window.location.href).toString();
    } catch {
      return href;
    }
  };
  const linkHref = (link: HTMLAnchorElement | null) => {
    if (!link) return "";
    const candidates = [
      link.getAttribute("href"),
      link.getAttribute("data-url"),
      link.getAttribute("data-href"),
      link.dataset.url,
      link.dataset.href
    ];
    return candidates.find((value) => value && !value.startsWith("javascript:")) ?? "";
  };
  const authorNames = (cell: Element | null) => {
    if (!cell) return [];
    const links = Array.from(cell.querySelectorAll("a"))
      .map((node) => cleanText(node.textContent))
      .filter(Boolean);
    return links.length > 0 ? links : splitAuthors(cleanText(cell.textContent));
  };
  const makeRecord = (row: Element, index: number): CnkiRecord | null => {
    const titleLink = row.querySelector<HTMLAnchorElement>(
      "td.name a.fz14, td.name a, .name a.fz14, .name a, a.fz14, a[href*='abstract'], a[href*='detail']"
    );
    const title = cleanText(titleLink?.textContent);
    if (!title) return null;

    return {
      id: `P${String(index + 1).padStart(4, "0")}`,
      title,
      authors: authorNames(row.querySelector(".author, td.author")),
      source: cleanText(row.querySelector(".source, td.source")?.textContent),
      publishedAt: cleanText(row.querySelector(".date, td.date")?.textContent),
      database: cleanText(row.querySelector(".data, td.data")?.textContent),
      citations: parseCount(cleanText(row.querySelector(".quote, td.quote")?.textContent)),
      downloads: parseCount(cleanText(row.querySelector(".download, td.download")?.textContent)),
      detailUrl: absolutizeUrl(linkHref(titleLink)),
      abstract: "",
      keywords: [],
      funding: "",
      album: "",
      topic: "",
      classification: "",
      collectedAt: new Date().toISOString(),
      status: "list-only"
    };
  };

  const rows = Array.from(document.querySelectorAll("table.result-table-list tbody tr"));
  const records = rows
    .map((row, index) => makeRecord(row, index))
    .filter((record): record is CnkiRecord => record !== null);

  return {
    records,
    diagnostics: {
      url: window.location.href,
      title: document.title,
      tables: document.querySelectorAll("table").length,
      resultTables: document.querySelectorAll("table.result-table-list").length,
      titleLinks: document.querySelectorAll("a.fz14, td.name a, .name a, a[href*='abstract'], a[href*='detail']").length,
      textSample: (document.body?.innerText ?? document.body?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 300)
    }
  };
}

async function collectFromAllFrames(tabId: number) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: extractCnkiRecordsFromFrame
  });
  const frames = results.map((item) => item.result).filter(Boolean) as FrameCollectionResult[];
  return {
    records: frames.flatMap((frame) => frame.records),
    diagnostics: frames.map((frame) => frame.diagnostics)
  };
}

function extractCnkiDetailFromFrame(): DetailFrameResult {
  const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  const splitList = (value: string) => cleanText(value)
    .replace(/^(关键词|关键字|摘要|Keywords|Key words|Abstract)[:：]\s*/i, "")
    .split(/[;；,，、]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
  const removeLabel = (value: string, labels: string[]) => {
    let text = cleanText(value);
    for (const label of labels) {
      if (text.toLowerCase().startsWith(label.toLowerCase())) {
        text = text.slice(label.length);
        break;
      }
    }
    return cleanText(text.replace(/^[:：]\s*/, ""));
  };
  const textBySelector = (selectors: string[]) => {
    for (const selector of selectors) {
      const text = cleanText(document.querySelector(selector)?.textContent);
      if (text) return text;
    }
    return "";
  };
  const textByLabel = (labels: string[]) => {
    const nodes = Array.from(document.querySelectorAll("p, div, li"));
    const matched = nodes.find((node) => {
      const text = cleanText(node.textContent);
      const lowerText = text.toLowerCase();
      return labels.some((label) => {
        const lowerLabel = label.toLowerCase();
        return lowerText.startsWith(lowerLabel) || lowerText.startsWith(`${lowerLabel}：`) || lowerText.startsWith(`${lowerLabel}:`);
      });
    });
    return matched ? removeLabel(matched.textContent ?? "", labels) : "";
  };
  const textAfterStrong = (labels: string[]) => {
    const strong = Array.from(document.querySelectorAll("strong, b")).find((node) => {
      const text = cleanText(node.textContent);
      return labels.some((label) => text.toLowerCase().startsWith(label.toLowerCase()));
    });
    return strong?.parentElement ? removeLabel(strong.parentElement.textContent ?? "", labels) : "";
  };

  const title = textBySelector(["h1.title", ".wx-tit h1", "h1"]);
  const authorLinks = Array.from(document.querySelectorAll(".authors a, .author a, .wx-tit h3 a"));
  const authors = authorLinks.map((node) => cleanText(node.textContent)).filter(Boolean);
  const abstractLabels = ["摘要", "Abstract"];
  const keywordLabels = ["关键词", "关键字", "Keywords", "Key words"];
  const abstract = removeLabel(
    textBySelector([".abstract", "#ChDivSummary", "[id*='Summary']", "[class*='abstract']"]) || textByLabel(abstractLabels),
    abstractLabels
  );
  const keywordText = textBySelector([".keywords", "#ChDivKeyWord", "[id*='KeyWord']", "[class*='keyword']"]) || textByLabel(keywordLabels);
  const keywords = splitList(keywordText);

  return {
    detail: {
      title,
      authors,
      abstract,
      keywords,
      funding: textAfterStrong(["基金资助", "基金", "Funding", "Fund"]),
      album: textAfterStrong(["专辑"]),
      topic: textAfterStrong(["专题"]),
      classification: textAfterStrong(["分类号", "中图分类号"])
    },
    diagnostics: {
      title: document.title,
      abstractLength: abstract.length,
      keywordCount: keywords.length
    }
  };
}

function createDetailTab(url: string): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

async function extractDetailFromTab(tabId: number) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: extractCnkiDetailFromFrame
  });
  const frames = results.map((item) => item.result).filter(Boolean) as DetailFrameResult[];
  return frames.find((frame) => (frame.detail.abstract?.length ?? 0) > 0 || (frame.detail.keywords?.length ?? 0) > 0) ?? frames[0];
}

export function App() {
  const [project, setProject] = useState<ProjectSnapshot>({ records: [], failures: [] });
  const [status, setStatus] = useState("等待采集");
  const [auth, setAuth] = useState<AuthSession | null>(() => loadAuthSession());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completeCount = project.records.filter((record) => record.status === "complete").length;
  const fullTextCount = project.records.filter((record) => Boolean(record.fullText)).length;
  const hasRecords = project.records.length > 0;
  const hasQuickReviewReport = Boolean(project.quickReviewReport?.content);
  const hasDeepReviewReport = Boolean(project.deepReviewReport?.content);

  async function refresh() {
    const response = await sendRuntimeMessage<{ project: ProjectSnapshot }>({ type: "GET_PROJECT" });
    if (response.ok) {
      setProject({
        records: response.project.records ?? [],
        failures: response.project.failures ?? [],
        quickReviewReport: response.project.quickReviewReport,
        deepReviewReport: response.project.deepReviewReport
      });
    }
  }

  async function handleAuth(mode: "login" | "register") {
    if (!email || !password) {
      setStatus("请填写邮箱和密码");
      return;
    }

    try {
      setStatus(mode === "login" ? "正在登录" : "正在注册");
      const session = mode === "login"
        ? await login(email, password)
        : await register(email, password);
      setAuth(session);
      saveAuthSession(session);
      setStatus(mode === "login" ? "登录成功" : "注册成功");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "账号操作失败");
    }
  }

  async function collectRecordsFromCurrentPage() {
    setStatus("正在采集当前页");
    const tab = await queryActiveTab();
    if (!tab?.id) {
      setStatus("未找到当前标签页");
      return null;
    }

    let records: CnkiRecord[] = [];
    try {
      const frameResult = await collectFromAllFrames(tab.id);
      records = frameResult.records;
      if (records.length === 0) {
        const summary = frameResult.diagnostics
          .map((item) => `表格${item.tables}/结果表${item.resultTables}/题名链接${item.titleLinks}`)
          .join("；");
        setStatus(`未找到论文列表。诊断：${summary || "没有可读取的页面框架"}`);
        return null;
      }
    } catch {
      const response = await parseCurrentTab(tab.id);
      if (!response?.ok || response.kind !== "result") {
        setStatus(response?.error ?? "当前页面不是知网检索结果页");
        return null;
      }
      records = response.records ?? [];
    }

    return records;
  }

  async function completePendingRecords(pending: CnkiRecord[]) {
    const completed: CnkiRecord[] = [];
    let failed = 0;

    for (let index = 0; index < pending.length; index += 1) {
      const record = pending[index];
      setStatus(`正在补全 ${index + 1}/${pending.length}`);
      let tabId: number | undefined;
      try {
        const tab = await createDetailTab(record.detailUrl);
        tabId = tab.id;
        if (!tabId) throw new Error("详情页标签页创建失败");
        await waitForTabLoad(tabId);
        const result = await extractDetailFromTab(tabId);
        const detail = result?.detail ?? {};
        if (!detail.abstract && (!detail.keywords || detail.keywords.length === 0)) {
          throw new Error("详情页未识别到摘要或关键词");
        }

        completed.push({
          ...record,
          title: detail.title || record.title,
          authors: detail.authors && detail.authors.length > 0 ? detail.authors : record.authors,
          abstract: detail.abstract || record.abstract,
          keywords: detail.keywords && detail.keywords.length > 0 ? detail.keywords : record.keywords,
          funding: detail.funding || record.funding,
          album: detail.album || record.album,
          topic: detail.topic || record.topic,
          classification: detail.classification || record.classification,
          collectedAt: new Date().toISOString(),
          status: "complete"
        });
      } catch {
        failed += 1;
      } finally {
        if (tabId) await closeTab(tabId);
      }
    }

    return { completed, failed };
  }

  async function collectAndCompleteCurrentPage() {
    const records = await collectRecordsFromCurrentPage();
    if (!records) return;

    await sendRuntimeMessage({ type: "SAVE_RECORDS", records });
    const pending = records.filter((record) => record.detailUrl && record.status !== "complete");
    if (pending.length === 0) {
      await refresh();
      setStatus(`已采集 ${records.length} 篇，但没有可补全链接`);
      return;
    }

    setStatus(`已采集 ${records.length} 篇，正在补全摘要和关键词`);
    const { completed, failed } = await completePendingRecords(pending);
    if (completed.length > 0) {
      await sendRuntimeMessage({ type: "SAVE_RECORDS", records: completed });
    }
    await refresh();
    setStatus(`已采集 ${records.length} 篇，已补全 ${completed.length} 篇，失败 ${failed} 篇`);
  }

  async function exportPackage() {
    setStatus("正在导出");
    const response = await sendRuntimeMessage<{ count: number }>({ type: "EXPORT_PACKAGE" });
    setStatus(response.ok ? `已导出 ${response.count} 篇` : response.error ?? "导出失败");
  }

  async function createQuickReview() {
    if (!hasRecords) {
      setStatus("请先采集当前页");
      return;
    }
    if (!auth) {
      setStatus("请先登录后生成快速综述");
      return;
    }

    try {
      setStatus("正在生成快速综述");
      const response = await generateQuickReview(auth.token, project.records);
      const nextAuth = {
        ...auth,
        user: {
          ...auth.user,
          quickReviewQuota: response.quota.quickReviewQuota,
          deepReviewQuota: response.quota.deepReviewQuota
        }
      };
      setAuth(nextAuth);
      saveAuthSession(nextAuth);
      const saveResponse = await sendRuntimeMessage<{ project: ProjectSnapshot }>({
        type: "SAVE_QUICK_REVIEW_REPORT",
        report: response.report
      });
      if (saveResponse.ok) {
      setProject({
        records: saveResponse.project.records ?? [],
        failures: saveResponse.project.failures ?? [],
        quickReviewReport: saveResponse.project.quickReviewReport,
        deepReviewReport: saveResponse.project.deepReviewReport
      });
      }
      setStatus("快速综述已生成");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "快速综述生成失败");
    }
  }

  async function downloadQuickReviewReport() {
    const response = await sendRuntimeMessage({ type: "DOWNLOAD_QUICK_REVIEW_REPORT" });
    setStatus(response.ok ? "已下载快速综述报告" : response.error ?? "下载快速综述报告失败");
  }

  async function createDeepReview() {
    if (!hasRecords) {
      setStatus("请先采集当前页");
      return;
    }
    if (!auth) {
      setStatus("请先登录后生成深度综述");
      return;
    }
    if (fullTextCount === 0) {
      setStatus("请先导入并匹配 PDF 全文");
      return;
    }

    try {
      setStatus("正在生成深度综述");
      const response = await generateDeepReview(auth.token, project.records);
      const nextAuth = {
        ...auth,
        user: {
          ...auth.user,
          quickReviewQuota: response.quota.quickReviewQuota,
          deepReviewQuota: response.quota.deepReviewQuota
        }
      };
      setAuth(nextAuth);
      saveAuthSession(nextAuth);
      const saveResponse = await sendRuntimeMessage<{ project: ProjectSnapshot }>({
        type: "SAVE_DEEP_REVIEW_REPORT",
        report: response.report
      });
      if (saveResponse.ok) {
        setProject({
          records: saveResponse.project.records ?? [],
          failures: saveResponse.project.failures ?? [],
          quickReviewReport: saveResponse.project.quickReviewReport,
          deepReviewReport: saveResponse.project.deepReviewReport
        });
      }
      setStatus("深度综述已生成");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "深度综述生成失败");
    }
  }

  async function downloadDeepReviewReport() {
    const response = await sendRuntimeMessage({ type: "DOWNLOAD_DEEP_REVIEW_REPORT" });
    setStatus(response.ok ? "已下载深度综述报告" : response.error ?? "下载深度综述报告失败");
  }

  async function importFullTextPdfs(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    setStatus(`正在读取 ${selectedFiles.length} 个 PDF`);
    const response = await sendRuntimeMessage<{ project: ProjectSnapshot }>({ type: "GET_PROJECT" });
    if (!response.ok) {
      setStatus(response.error ?? "读取本地项目失败");
      return;
    }

    const records = response.project.records ?? [];
    const matchedRecords: CnkiRecord[] = [];
    let unmatched = 0;
    let failed = 0;
    const { extractPdfText } = await import("../fulltext/pdfText");

    for (const file of selectedFiles) {
      try {
        const fullText = await extractPdfText(file);
        const match = matchFullTextToRecord(records, file.name, fullText);
        if (!match.record) {
          unmatched += 1;
          continue;
        }

        matchedRecords.push({
          ...match.record,
          fullText,
          fullTextFileName: file.name,
          fullTextImportedAt: new Date().toISOString(),
          fullTextMatchScore: match.score,
          fullTextStatus: "matched"
        });
      } catch {
        failed += 1;
      }
    }

    if (matchedRecords.length > 0) {
      await sendRuntimeMessage({ type: "SAVE_RECORDS", records: matchedRecords });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refresh();
    setStatus(`已读取 ${selectedFiles.length} 个 PDF，匹配 ${matchedRecords.length} 篇，未匹配 ${unmatched} 个，失败 ${failed} 个`);
  }

  async function clearProject() {
    const response = await sendRuntimeMessage<{ project: ProjectSnapshot }>({ type: "CLEAR_PROJECT" });
    if (response.ok) {
      setProject({
        records: response.project.records ?? [],
        failures: response.project.failures ?? [],
        quickReviewReport: response.project.quickReviewReport,
        deepReviewReport: response.project.deepReviewReport
      });
      setStatus("已清空当前项目");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="popup-shell">
      <header>
        <div>
          <h1>知网文献综述助手</h1>
          <p>{status}</p>
        </div>
      </header>

      <section className="stats-grid" aria-label="采集统计">
        <div>
          <span>已采集</span>
          <strong>{project.records.length} 篇</strong>
        </div>
        <div>
          <span>已补摘要</span>
          <strong>{completeCount} 篇</strong>
        </div>
        <div>
          <span>失败</span>
          <strong>{project.failures.length} 篇</strong>
        </div>
        <div>
          <span>已导全文</span>
          <strong>{fullTextCount} 篇</strong>
        </div>
      </section>

      <section className="auth-panel" aria-label="账号">
        {auth ? (
          <div className="account-row">
            <div>
              <span>当前账号</span>
              <strong>{auth.user.email}</strong>
            </div>
            <div>
              <span>快速综述</span>
              <strong>{auth.user.quickReviewQuota} 次</strong>
            </div>
            <div>
              <span>深度综述</span>
              <strong>{auth.user.deepReviewQuota} 次</strong>
            </div>
          </div>
        ) : (
          <div className="auth-form">
            <label>
              邮箱
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              密码
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button type="button" onClick={() => handleAuth("login")}>登录</button>
              <button type="button" className="secondary" onClick={() => handleAuth("register")}>注册</button>
            </div>
          </div>
        )}
      </section>

      <section className="compact-actions" aria-label="主要操作">
        <div className="action-row primary-row">
          <span>采集</span>
          <button type="button" onClick={collectAndCompleteCurrentPage}>采集当前页</button>
          <button type="button" className="secondary" onClick={exportPackage} disabled={!hasRecords}>下载结果</button>
        </div>

        <div className="action-row">
          <span>快速</span>
          <button
            type="button"
            onClick={createQuickReview}
            disabled={!hasRecords || !auth || auth.user.quickReviewQuota < 1}
          >
            生成快速综述
          </button>
          <button
            type="button"
            className="secondary"
            onClick={downloadQuickReviewReport}
            disabled={!hasQuickReviewReport}
          >
            下载报告
          </button>
        </div>

        <div className="action-row">
          <span>深度</span>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!hasRecords}>导入PDF</button>
          <button
            type="button"
            onClick={createDeepReview}
            disabled={!hasRecords || !auth || fullTextCount === 0 || auth.user.deepReviewQuota < 1}
          >
            生成深度综述
          </button>
          <button
            type="button"
            className="secondary"
            onClick={downloadDeepReviewReport}
            disabled={!hasDeepReviewReport}
          >
            下载报告
          </button>
        </div>
      </section>

      <div className="footer-actions">
        <button type="button" className="secondary" onClick={clearProject}>清空当前项目</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => importFullTextPdfs(event.currentTarget.files)}
      />
    </main>
  );
}
