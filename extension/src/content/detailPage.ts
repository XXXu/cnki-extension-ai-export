import { cleanText, splitAuthors } from "../shared/normalize";

export type DetailFields = {
  title: string;
  authors: string[];
  abstract: string;
  keywords: string[];
  funding: string;
  album: string;
  topic: string;
  classification: string;
};

function removeLabel(text: string, labels: string[]) {
  let result = cleanText(text);
  for (const label of labels) {
    if (result.toLowerCase().startsWith(label.toLowerCase())) {
      result = result.slice(label.length);
      break;
    }
  }
  return cleanText(result.replace(/^[:：]\s*/, ""));
}

function findTextByLabels(doc: Document, labels: string[]) {
  const nodes = Array.from(doc.querySelectorAll("p, div, li"));
  const matched = nodes.find((node) => {
    const text = cleanText(node.textContent);
    const lowerText = text.toLowerCase();
    return labels.some((label) => {
      const lowerLabel = label.toLowerCase();
      return lowerText.startsWith(lowerLabel) || lowerText.startsWith(`${lowerLabel}：`) || lowerText.startsWith(`${lowerLabel}:`);
    });
  });

  return matched ? removeLabel(matched.textContent ?? "", labels) : "";
}

function textAfterStrong(doc: Document, labels: string[]) {
  const strong = Array.from(doc.querySelectorAll("strong, b")).find((node) => {
    const text = cleanText(node.textContent);
    return labels.some((label) => text.toLowerCase().startsWith(label.toLowerCase()));
  });

  if (!strong?.parentElement) return "";
  return removeLabel(strong.parentElement.textContent ?? "", labels);
}

function splitKeywords(value: string) {
  return value
    .split(/[;；,，、]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

export function parseDetailPage(doc: Document): DetailFields {
  const title = cleanText(doc.querySelector("h1.title, .wx-tit h1, h1")?.textContent);
  const authorLinks = Array.from(doc.querySelectorAll(".authors a, .author a, .wx-tit h3 a"));
  const authors = authorLinks.length > 0
    ? authorLinks.map((node) => cleanText(node.textContent)).filter(Boolean)
    : splitAuthors(cleanText(doc.querySelector(".authors, .author, .wx-tit h3")?.textContent));

  const abstractLabels = ["摘要", "Abstract"];
  const keywordLabels = ["关键词", "关键字", "Keywords", "Key words"];
  const abstractText = cleanText(doc.querySelector(".abstract")?.textContent) || findTextByLabels(doc, abstractLabels);
  const keywordText = cleanText(doc.querySelector(".keywords")?.textContent) || findTextByLabels(doc, keywordLabels);

  return {
    title,
    authors,
    abstract: removeLabel(abstractText, abstractLabels),
    keywords: splitKeywords(removeLabel(keywordText, keywordLabels)),
    funding: textAfterStrong(doc, ["基金资助", "基金", "Funding", "Fund"]),
    album: textAfterStrong(doc, ["专辑"]),
    topic: textAfterStrong(doc, ["专题"]),
    classification: textAfterStrong(doc, ["分类号", "中图分类号"])
  };
}
