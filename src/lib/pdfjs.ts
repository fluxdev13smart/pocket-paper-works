// Browser-only: import this module dynamically.
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
export async function openPdf(bytes: Uint8Array) {
  // pdf.js transfers the buffer; give it a copy so the caller keeps the original.
  return pdfjsLib.getDocument({ data: bytes.slice() }).promise;
}
