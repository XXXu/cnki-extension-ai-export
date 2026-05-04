import { describe, expect, it } from "vitest";
import { parseResultPage } from "../../extension/src/content/resultPage";

describe("parseResultPage", () => {
  it("提取知网检索结果页中的可见论文行", () => {
    document.body.innerHTML = `
      <table class="result-table-list">
        <tbody>
          <tr>
            <td class="seq">1</td>
            <td class="name"><a href="https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CJFD&filename=ABC123">关系产权视域下党建引领村集体经济组织治理研究</a></td>
            <td class="author">许中缘; 潘笛</td>
            <td class="source">中南大学学报(社会科学版)</td>
            <td class="date">2026-04-23</td>
            <td class="data">期刊</td>
            <td class="quote">112</td>
            <td class="download">18</td>
          </tr>
        </tbody>
      </table>`;

    const records = parseResultPage(document);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("关系产权视域下党建引领村集体经济组织治理研究");
    expect(records[0].authors).toEqual(["许中缘", "潘笛"]);
    expect(records[0].source).toBe("中南大学学报(社会科学版)");
    expect(records[0].publishedAt).toBe("2026-04-23");
    expect(records[0].database).toBe("期刊");
    expect(records[0].citations).toBe(112);
    expect(records[0].downloads).toBe(18);
    expect(records[0].detailUrl).toContain("detail.aspx");
    expect(records[0].status).toBe("list-only");
  });

  it("提取新版知网列表表格中的论文行", () => {
    document.body.innerHTML = `
      <table class="kns-result">
        <thead>
          <tr>
            <th></th>
            <th>题名</th>
            <th>作者</th>
            <th>来源</th>
            <th>发表时间</th>
            <th>数据库</th>
            <th>被引</th>
            <th>下载</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><input type="checkbox" />1</td>
            <td><a href="/kcms/detail/detail.aspx?dbcode=CJFD&filename=ABC123">乡村振兴视角下商丘市“美丽乡村”建设路径探析</a></td>
            <td><a>王媛萦</a></td>
            <td>山西农经</td>
            <td>2026-04-30</td>
            <td>期刊</td>
            <td></td>
            <td></td>
            <td><a>AI</a></td>
          </tr>
          <tr>
            <td><input type="checkbox" />7</td>
            <td><a href="/kcms/detail/detail.aspx?dbcode=CJFD&filename=DEF456">关系产权视域下党建引领村集体经济组织治理研究</a></td>
            <td><a>许中缘</a><a>潘笛</a></td>
            <td>中南大学学报(社会科学版)</td>
            <td>2026-04-23 15:37</td>
            <td>期刊</td>
            <td>112</td>
            <td>18</td>
            <td><a>AI</a></td>
          </tr>
        </tbody>
      </table>`;

    const records = parseResultPage(document);

    expect(records).toHaveLength(2);
    expect(records[0].title).toBe("乡村振兴视角下商丘市“美丽乡村”建设路径探析");
    expect(records[0].authors).toEqual(["王媛萦"]);
    expect(records[0].source).toBe("山西农经");
    expect(records[0].publishedAt).toBe("2026-04-30");
    expect(records[1].authors).toEqual(["许中缘", "潘笛"]);
    expect(records[1].citations).toBe(112);
    expect(records[1].downloads).toBe(18);
    expect(records[1].detailUrl).toContain("detail.aspx");
  });

  it("提取使用 div 模拟表格的知网列表论文行", () => {
    document.body.innerHTML = `
      <div class="result-list">
        <div class="result-header">
          <span></span>
          <span>题名</span>
          <span>作者</span>
          <span>来源</span>
          <span>发表时间</span>
          <span>数据库</span>
          <span>被引</span>
          <span>下载</span>
          <span>操作</span>
        </div>
        <div class="result-row">
          <span><input type="checkbox" />1</span>
          <span><a href="/kcms/detail/detail.aspx?dbcode=CJFD&filename=ABC123">乡村振兴视角下商丘市“美丽乡村”建设路径探析</a></span>
          <span>王媛萦</span>
          <span>山西农经</span>
          <span>2026-04-30</span>
          <span>期刊</span>
          <span></span>
          <span></span>
          <span><a>AI</a></span>
        </div>
      </div>`;

    const records = parseResultPage(document);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("乡村振兴视角下商丘市“美丽乡村”建设路径探析");
    expect(records[0].authors).toEqual(["王媛萦"]);
    expect(records[0].source).toBe("山西农经");
    expect(records[0].publishedAt).toBe("2026-04-30");
  });

  it("从没有标准详情链接的页面中提取疑似论文标题", () => {
    document.body.innerHTML = `
      <div>
        <div>题名 作者 来源 发表时间 数据库 被引 下载 操作</div>
        <div>
          <a href="javascript:void(0)" data-url="/kcms/detail/detail.aspx?filename=ABC123">党建引领基层治理的实践路径研究</a>
          <span>李四</span>
          <span>测试期刊</span>
          <span>2026-04-30</span>
        </div>
      </div>`;

    const records = parseResultPage(document);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("党建引领基层治理的实践路径研究");
    expect(records[0].detailUrl).toContain("detail.aspx");
  });

  it("提取英文论文列表中的作者", () => {
    document.body.innerHTML = `
      <table class="result-table-list">
        <tbody>
          <tr>
            <td class="name"><a href="/kcms/detail/detail.aspx?filename=EN123">Rural Governance and Collective Economy in China</a></td>
            <td class="author">John Smith and Mary Lee</td>
            <td class="source">Journal of Rural Studies</td>
            <td class="date">2025</td>
          </tr>
        </tbody>
      </table>`;

    const records = parseResultPage(document);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("Rural Governance and Collective Economy in China");
    expect(records[0].authors).toEqual(["John Smith", "Mary Lee"]);
  });
});
