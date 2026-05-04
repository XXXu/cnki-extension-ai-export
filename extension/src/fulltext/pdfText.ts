import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { cleanFullText } from "./fullText";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfTextItem = {
  str?: string;
};

export async function extractPdfText(file: File) {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => (item as PdfTextItem).str ?? "")
      .filter(Boolean)
      .join(" ");
    pageTexts.push(text);
  }

  return cleanFullText(pageTexts.join("\n"));
}

