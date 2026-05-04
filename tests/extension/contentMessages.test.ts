import { describe, expect, it } from "vitest";
import { detectPageKind, handleContentMessage } from "../../extension/src/content/index";

describe("content message handling", () => {
  it("识别知网检索结果页", () => {
    document.body.innerHTML = `<table class="result-table-list"><tbody><tr></tr></tbody></table>`;

    expect(detectPageKind(document)).toBe("result");
  });

  it("识别只有中文表头的新版知网检索结果页", () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th>题名</th><th>作者</th><th>来源</th><th>发表时间</th><th>数据库</th><th>被引</th><th>下载</th></tr></thead>
        <tbody><tr><td><a href="/kcms/detail/detail.aspx?filename=ABC123">测试论文</a></td><td>张三</td><td>测试期刊</td><td>2026</td><td>期刊</td><td>1</td><td>2</td></tr></tbody>
      </table>`;

    expect(detectPageKind(document)).toBe("result");
  });

  it("识别 div 列表结构的知网检索结果页", () => {
    document.body.innerHTML = `
      <div>
        <div><span>题名</span><span>作者</span><span>来源</span><span>发表时间</span><span>数据库</span><span>被引</span><span>下载</span></div>
        <div><span><a href="/kcms/detail/detail.aspx?filename=ABC123">测试论文</a></span><span>张三</span><span>测试期刊</span></div>
      </div>`;

    expect(detectPageKind(document)).toBe("result");
  });

  it("未知页面返回诊断信息", () => {
    document.body.innerHTML = `<main><h1>普通页面</h1><a href="/test">普通链接</a></main>`;

    const response = handleContentMessage({ type: "PARSE_CURRENT_PAGE" }, document);

    expect(response.ok).toBe(false);
    expect(response.diagnostics?.tables).toBe(0);
    expect(response.error).toContain("页面诊断");
  });

  it("识别知网详情页", () => {
    document.body.innerHTML = `
      <h1 class="title">测试论文</h1>
      <p class="abstract"><span>摘要：</span>这是一段摘要。</p>
      <p class="keywords"><span>关键词：</span>基层治理；乡村振兴；</p>`;

    expect(detectPageKind(document)).toBe("detail");
  });

  it("识别英文标签的知网详情页", () => {
    document.body.innerHTML = `
      <h1 class="title">Rural Governance and Collective Economy in China</h1>
      <p class="abstract"><span>Abstract:</span> This paper examines rural governance in China.</p>
      <p class="keywords"><span>Keywords:</span> rural governance; collective economy;</p>`;

    expect(detectPageKind(document)).toBe("detail");
  });

  it("返回当前结果页解析出的论文列表", () => {
    document.body.innerHTML = `
      <table class="result-table-list"><tbody>
        <tr><td class="name"><a href="/detail">测试论文</a></td><td class="author">张三</td></tr>
      </tbody></table>`;

    const response = handleContentMessage({ type: "PARSE_CURRENT_PAGE" }, document);

    expect(response.ok).toBe(true);
    expect(response.kind).toBe("result");
    expect(response.records).toHaveLength(1);
    expect(response.records?.[0].title).toBe("测试论文");
  });

  it("返回当前详情页解析出的论文详情", () => {
    document.body.innerHTML = `
      <h1 class="title">测试论文</h1>
      <div class="authors"><a>张三</a></div>
      <p class="abstract"><span>摘要：</span>这是一段摘要。</p>
      <p class="keywords"><span>关键词：</span>基层治理；乡村振兴；</p>`;

    const response = handleContentMessage({ type: "PARSE_CURRENT_PAGE" }, document);

    expect(response.ok).toBe(true);
    expect(response.kind).toBe("detail");
    expect(response.detail?.title).toBe("测试论文");
    expect(response.detail?.keywords).toEqual(["基层治理", "乡村振兴"]);
  });
});
