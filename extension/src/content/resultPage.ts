import type { CnkiRecord } from "../shared/types";
import { cleanText, makeRecordId, parseCount, splitAuthors } from "../shared/normalize";

type ColumnMap = {
  title: number;
  authors?: number;
  source?: number;
  publishedAt?: number;
  database?: number;
  citations?: number;
  downloads?: number;
};

const resultHeaderLabels = ["题名", "作者", "来源", "发表时间", "数据库", "被引", "下载"];

function absolutizeUrl(href: string) {
  try {
    return new URL(href, window.location.href).toString();
  } catch {
    return href;
  }
}

function cellText(row: Element, selectors: string[]) {
  for (const selector of selectors) {
    const value = cleanText(row.querySelector(selector)?.textContent);
    if (value) return value;
  }
  return "";
}

function authorNames(cell: Element | undefined) {
  if (!cell) return [];
  const links = Array.from(cell.querySelectorAll("a"))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean);
  return links.length > 0 ? links : splitAuthors(cleanText(cell.textContent));
}

function findHeaderIndex(headers: string[], labels: string[]) {
  const index = headers.findIndex((header) => labels.some((label) => header.includes(label)));
  return index >= 0 ? index : undefined;
}

function mapHeaderCells(headerCells: Element[]): ColumnMap | null {
  const headers = headerCells.map((cell) => cleanText(cell.textContent));
  const title = findHeaderIndex(headers, ["题名", "篇名", "论文题名"]);
  if (title === undefined) return null;

  return {
    title,
    authors: findHeaderIndex(headers, ["作者"]),
    source: findHeaderIndex(headers, ["来源", "刊名"]),
    publishedAt: findHeaderIndex(headers, ["发表时间", "发表日期", "年份", "出版时间"]),
    database: findHeaderIndex(headers, ["数据库", "文献来源"]),
    citations: findHeaderIndex(headers, ["被引", "引用"]),
    downloads: findHeaderIndex(headers, ["下载"])
  };
}

function hasHeaderLabels(text: string) {
  const normalized = cleanText(text);
  return resultHeaderLabels.filter((label) => normalized.includes(label)).length >= 5;
}

function childCells(element: Element) {
  const children = Array.from(element.children);
  return children.length > 0 ? children : [element];
}

function titleAnchor(cell: Element | undefined) {
  if (!cell) return null;
  if (cell instanceof HTMLAnchorElement) return cell;
  return cell.querySelector<HTMLAnchorElement>(
    "a.fz14, a[href*='detail'], a[href*='abstract'], a[href*='kcms'], a[href*='KCMS'], a[href*='kns.cnki'], a"
  );
}

function linkHref(link: HTMLAnchorElement | null) {
  if (!link) return "";
  const candidates = [
    link.getAttribute("href"),
    link.getAttribute("data-url"),
    link.getAttribute("data-href"),
    link.dataset.url,
    link.dataset.href
  ];
  return candidates.find((value) => value && !value.startsWith("javascript:")) ?? "";
}

function cellAt(cells: Element[], index: number | undefined) {
  return index === undefined ? undefined : cells[index];
}

function buildRecordFromCells(cells: Element[], columns: ColumnMap, index: number): CnkiRecord | null {
  const titleCell = cellAt(cells, columns.title);
  const link = titleAnchor(titleCell);
  const title = cleanText(link?.textContent || titleCell?.textContent);
  if (!title) return null;

  return {
    id: makeRecordId(index),
    title,
    authors: authorNames(cellAt(cells, columns.authors)),
    source: cleanText(cellAt(cells, columns.source)?.textContent),
    publishedAt: cleanText(cellAt(cells, columns.publishedAt)?.textContent),
    database: cleanText(cellAt(cells, columns.database)?.textContent),
    citations: parseCount(cleanText(cellAt(cells, columns.citations)?.textContent)),
    downloads: parseCount(cleanText(cellAt(cells, columns.downloads)?.textContent)),
    detailUrl: absolutizeUrl(linkHref(link)),
    abstract: "",
    keywords: [],
    funding: "",
    album: "",
    topic: "",
    classification: "",
    collectedAt: new Date().toISOString(),
    status: "list-only"
  };
}

function parseKnownResultTable(doc: Document) {
  const rows = Array.from(doc.querySelectorAll("table.result-table-list tbody tr"));
  return rows
    .map((row, index): CnkiRecord | null => {
      const titleLink = row.querySelector<HTMLAnchorElement>("td.name a, .name a, a[href*='detail']");
      const title = cleanText(titleLink?.textContent);
      if (!title) return null;

      return {
        id: makeRecordId(index),
        title,
        authors: splitAuthors(cellText(row, [".author", "td.author"])),
        source: cellText(row, [".source", "td.source"]),
        publishedAt: cellText(row, [".date", "td.date"]),
        database: cellText(row, [".data", "td.data"]),
        citations: parseCount(cellText(row, [".quote", "td.quote"])),
        downloads: parseCount(cellText(row, [".download", "td.download"])),
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
    })
    .filter((record): record is CnkiRecord => record !== null);
}

function parseHeaderBasedTables(doc: Document) {
  const records: CnkiRecord[] = [];

  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const headerRow = Array.from(table.querySelectorAll("tr")).find((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      return mapHeaderCells(cells) !== null;
    });
    if (!headerRow) continue;

    const columns = mapHeaderCells(Array.from(headerRow.querySelectorAll("th, td")));
    if (!columns) continue;

    const bodyRows = Array.from(table.querySelectorAll("tbody tr")).filter((row) => row !== headerRow);
    const rows = bodyRows.length > 0
      ? bodyRows
      : Array.from(table.querySelectorAll("tr")).slice(Array.from(table.querySelectorAll("tr")).indexOf(headerRow) + 1);

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      const record = buildRecordFromCells(cells, columns, records.length);
      if (record) records.push(record);
    }
  }

  return records;
}

function parseHeaderBasedBlocks(doc: Document) {
  const records: CnkiRecord[] = [];

  for (const container of Array.from(doc.querySelectorAll("main, section, div"))) {
    const children = Array.from(container.children).filter((child) => cleanText(child.textContent));
    const headerIndex = children.findIndex((child) => {
      const cells = childCells(child);
      return mapHeaderCells(cells) !== null || hasHeaderLabels(child.textContent ?? "");
    });
    if (headerIndex < 0) continue;

    const headerCells = childCells(children[headerIndex]);
    const columns = mapHeaderCells(headerCells);
    if (!columns) continue;

    for (const row of children.slice(headerIndex + 1)) {
      const rowText = cleanText(row.textContent);
      if (!rowText || hasHeaderLabels(rowText)) continue;

      const cells = childCells(row);
      if (cells.length <= columns.title) continue;

      const record = buildRecordFromCells(cells, columns, records.length);
      if (record) records.push(record);
    }

    if (records.length > 0) return records;
  }

  return records;
}

export function hasResultPageRecords(doc: Document) {
  return parseResultPage(doc).length > 0 || hasHeaderLabels(doc.body?.textContent ?? "");
}

export function parseResultPage(doc: Document): CnkiRecord[] {
  const knownRecords = parseKnownResultTable(doc);
  if (knownRecords.length > 0) return knownRecords;
  const tableRecords = parseHeaderBasedTables(doc);
  if (tableRecords.length > 0) return tableRecords;
  return parseHeaderBasedBlocks(doc);
}
