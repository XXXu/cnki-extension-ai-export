export function isUsableAbstract(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return !/^(正文快照|正文摘录|正文|内容快照)[:：\s]/.test(text);
}

export function cleanAbstract(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return isUsableAbstract(text) ? text : "";
}
