import { describe, expect, it } from "vitest";
import { parseDetailPage } from "../../extension/src/content/detailPage";

describe("parseDetailPage", () => {
  it("提取摘要、关键词和详情页元数据", () => {
    document.body.innerHTML = `
      <h1 class="title">关系产权视域下党建引领村集体经济组织治理研究</h1>
      <div class="authors"><a>许中缘</a><a>潘笛</a></div>
      <p class="abstract"><span>摘要：</span>构建具有中国特色的村集体经济组织治理体系，是推动村集体经济组织法治化运行。</p>
      <p class="keywords"><span>关键词：</span>集体经济组织；党建引领；关系产权；治理结构；</p>
      <p><strong>基金资助：</strong>湖南省普通本科高校教学改革研究一般项目</p>
      <p><strong>专辑：</strong>社会科学Ⅰ辑; 经济与管理科学</p>
      <p><strong>专题：</strong>中国共产党; 农业经济</p>
      <p><strong>分类号：</strong>F321.32;D267.2</p>`;

    const detail = parseDetailPage(document);

    expect(detail.title).toBe("关系产权视域下党建引领村集体经济组织治理研究");
    expect(detail.authors).toEqual(["许中缘", "潘笛"]);
    expect(detail.abstract).toContain("村集体经济组织治理体系");
    expect(detail.keywords).toEqual(["集体经济组织", "党建引领", "关系产权", "治理结构"]);
    expect(detail.funding).toContain("教学改革研究");
    expect(detail.album).toBe("社会科学Ⅰ辑; 经济与管理科学");
    expect(detail.topic).toBe("中国共产党; 农业经济");
    expect(detail.classification).toBe("F321.32;D267.2");
  });

  it("提取英文详情页的 Abstract、Keywords 和 Funding", () => {
    document.body.innerHTML = `
      <h1 class="title">Rural Governance and Collective Economy in China</h1>
      <div class="authors"><a>John Smith</a><a>Mary Lee</a></div>
      <p class="abstract"><span>Abstract:</span> This paper examines rural governance in China.</p>
      <p class="keywords"><span>Keywords:</span> rural governance; collective economy; China;</p>
      <p><strong>Funding:</strong> National Social Science Fund</p>`;

    const detail = parseDetailPage(document);

    expect(detail.title).toBe("Rural Governance and Collective Economy in China");
    expect(detail.authors).toEqual(["John Smith", "Mary Lee"]);
    expect(detail.abstract).toBe("This paper examines rural governance in China.");
    expect(detail.keywords).toEqual(["rural governance", "collective economy", "China"]);
    expect(detail.funding).toBe("National Social Science Fund");
  });
});
