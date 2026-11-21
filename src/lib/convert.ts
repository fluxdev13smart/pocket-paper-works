import { baseName, categoryOf, extOf } from "./formats";

export interface Output {
  blob: Blob;
  name: string;
}
type Progress = (p: number) => void;
function context2d(c: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const ctx = c.getContext("2d", options);
  if (!ctx) throw new Error("This browser cannot create a drawing canvas.");
  return ctx;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("This image looks corrupt or uses an unsupported format.");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function canvasToBlob(c: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Encoding failed"))), type, q));
}

function imageToCanvas(img: HTMLImageElement, opaque: boolean, size?: number) {
  const c = document.createElement("canvas");
  const w = img.naturalWidth || 512;
  const h = img.naturalHeight || 512;
  if (size) {
    c.width = c.height = size;
  } else {
    c.width = w;
    c.height = h;
  }
  const ctx = context2d(c);
  if (opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  if (size) {
    const s = Math.min(size / w, size / h);
    ctx.drawImage(img, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
  } else ctx.drawImage(img, 0, 0);
  return c;
}

function encodeBMP(c: HTMLCanvasElement): Blob {
  const { width: w, height: h } = c;
  const data = context2d(c).getImageData(0, 0, w, h).data;
  const row = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + row * h;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  v.setUint16(0, 0x4d42, true);
  v.setUint32(2, size, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, row * h, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    const o = 54 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[o + x * 3] = (data[i + 2] ?? 0);
      out[o + x * 3 + 1] = (data[i + 1] ?? 0);
      out[o + x * 3 + 2] = (data[i] ?? 0);
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

async function encodeICO(c: HTMLCanvasElement): Promise<Blob> {
  const png = new Uint8Array(await (await canvasToBlob(c, "image/png")).arrayBuffer());
  const head = new ArrayBuffer(22);
  const v = new DataView(head);
  v.setUint16(2, 1, true);
  v.setUint16(4, 1, true);
  v.setUint8(6, 0);
  v.setUint8(7, 0);
  v.setUint16(10, 1, true);
  v.setUint16(12, 32, true);
  v.setUint32(14, png.length, true);
  v.setUint32(18, 22, true);
  return new Blob([head, png], { type: "image/x-icon" });
}

async function blobToDataUrl(b: Blob) {
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });
}

async function imagesToPdf(canvases: HTMLCanvasElement[]) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const c of canvases) {
    const jpg = await doc.embedJpg(new Uint8Array(await (await canvasToBlob(c, "image/jpeg", 0.92)).arrayBuffer()));
    const page = doc.addPage([c.width * 0.75, c.height * 0.75]);
    page.drawImage(jpg, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

async function convertImage(file: File, t: string): Promise<Blob> {
  const img = await loadImage(file);
  switch (t) {
    case "png":
      return canvasToBlob(imageToCanvas(img, false), "image/png");
    case "jpg":
      return canvasToBlob(imageToCanvas(img, true), "image/jpeg", 0.9);
    case "jpg-70":
      return canvasToBlob(imageToCanvas(img, true), "image/jpeg", 0.7);
    case "webp":
      return canvasToBlob(imageToCanvas(img, false), "image/webp", 0.9);
    case "bmp":
      return encodeBMP(imageToCanvas(img, true));
    case "ico":
      return encodeICO(imageToCanvas(img, false, 256));
    case "svg": {
      const c = imageToCanvas(img, false);
      const data = await blobToDataUrl(await canvasToBlob(c, "image/png"));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><image href="${data}" width="${c.width}" height="${c.height}"/></svg>`;
      return new Blob([svg], { type: "image/svg+xml" });
    }
    case "pdf":
      return imagesToPdf([imageToCanvas(img, true)]);
  }
  throw new Error("Unsupported target");
}

async function convertPdf(file: File, t: string, onP: Progress): Promise<Blob> {
  const { openPdf } = await import("./pdfjs");
  let pdf;
  try {
    pdf = await openPdf(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("This PDF is corrupt or password-protected.");
  }
  try {
  if (t === "txt") {
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") + "\n\n";
      onP(i / pdf.numPages);
    }
    return new Blob([text], { type: "text/plain" });
  }
  const dpi = t.endsWith("300") ? 300 : 150;
  const type = t.startsWith("jpg") ? "image/jpeg" : "image/png";
  const ext = t.startsWith("jpg") ? "jpg" : "png";
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: dpi / 72 });
    const c = document.createElement("canvas");
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    const ctx = context2d(c);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
    zip.file(`${baseName(file.name)}-page-${String(i).padStart(3, "0")}.${ext}`, await canvasToBlob(c, type, 0.9));
    c.width = c.height = 0;
    onP(i / pdf.numPages);
  }
  return await zip.generateAsync({ type: "blob", compression: "STORE" });
  } finally { await pdf.loadingTask.destroy(); }
}

async function decodeAudio(file: File): Promise<AudioBuffer> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("Couldn't read audio from this file. It may be corrupt or use a codec this browser can't decode.");
  } finally {
    void ctx.close();
  }
}

function encodeWav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels);
  const len = buf.length;
  const out = new ArrayBuffer(44 + len * ch * 2);
  const v = new DataView(out);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + len * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, (chans[c]?.[i] ?? 0)));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  return new Blob([out], { type: "audio/wav" });
}

async function encodeMp3(buf: AudioBuffer, kbps: number, onP: Progress): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const ch = Math.min(2, buf.numberOfChannels);
  const enc = new Mp3Encoder(ch, buf.sampleRate, kbps);
  const toI16 = (f: Float32Array) => {
    const o = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, (f[i] ?? 0)));
      o[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return o;
  };
  const L = toI16(buf.getChannelData(0));
  const R = ch > 1 ? toI16(buf.getChannelData(1)) : undefined;
  const parts: BlobPart[] = [];
  const block = 1152 * 200;
  for (let i = 0; i < L.length; i += block) {
    const l = L.subarray(i, i + block);
    const chunk = R ? enc.encodeBuffer(l, R.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (chunk.length) parts.push(new Uint8Array(chunk));
    onP(Math.min(0.99, i / L.length));
    await tick();
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: "audio/mpeg" });
}

async function convertAudio(file: File, t: string, onP: Progress) {
  const buf = await decodeAudio(file);
  onP(0.1);
  if (t === "wav") return encodeWav(buf);
  return encodeMp3(buf, t === "mp3-128" ? 128 : 320, (p) => onP(0.1 + p * 0.9));
}

async function loadVideo(file: File) {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      const timer = setTimeout(() => rej(new Error("Video loading timed out. Try another format.")), 20000);
      v.onloadeddata = () => { clearTimeout(timer); res(); };
      v.onerror = () => { clearTimeout(timer); rej(new Error("This browser can't decode this video file.")); };
      v.src = url;
    });
  } catch (error) { URL.revokeObjectURL(url); throw error; }
  return v;
}

async function recordVideo(file: File, t: string, onP: Progress): Promise<Blob> {
  const v = await loadVideo(file);
  try {
  if (!v.captureStream || typeof MediaRecorder === "undefined") throw new Error("Video recording is not supported in this browser. Try extracting a frame instead.");
  const mime =
    t === "mp4"
      ? MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
  const stream = (v as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve, reject) => {
    rec.onstop = () => resolve();
    rec.onerror = () => reject(new Error("Video encoding failed."));
  });
  v.muted = false;
  v.volume = 0.0001;
  v.ontimeupdate = () => onP(v.duration ? v.currentTime / v.duration : 0);
  v.onended = () => rec.stop();
  rec.start(1000);
  try {
    await v.play();
    await done;
    return new Blob(chunks, { type: mime.split(";")[0] ?? "video/webm" });
  } finally {
    if (rec.state !== "inactive") rec.stop();
    stream.getTracks().forEach((track) => track.stop());
  }
  } finally { v.pause(); URL.revokeObjectURL(v.src); v.removeAttribute("src"); v.load(); }
}

async function videoFrame(file: File): Promise<HTMLCanvasElement> {
  const v = await loadVideo(file);
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  context2d(c).drawImage(v, 0, 0);
  URL.revokeObjectURL(v.src);
  return c;
}

async function videoGif(file: File, onP: Progress): Promise<Blob> {
  const { encodeGif } = await import("./engines/gif");
  const v = await loadVideo(file);
  const scale = Math.min(1, 480 / v.videoWidth);
  const w = Math.round(v.videoWidth * scale);
  const h = Math.round(v.videoHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = context2d(c, { willReadFrequently: true });
  const frames: Uint8ClampedArray[] = [];
  const dur = Math.min(5, v.duration || 5);
  const fps = 10;
  try {
  for (let i = 0; i < dur * fps; i++) {
    const time = i / fps;
    if (Math.abs(v.currentTime - time) > 0.001) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Video frame seeking timed out.")), 10000);
        v.onseeked = () => { clearTimeout(timer); resolve(); };
        v.currentTime = time;
      });
    }
    ctx.drawImage(v, 0, 0, w, h);
    frames.push(ctx.getImageData(0, 0, w, h).data);
    onP((i / (dur * fps)) * 0.6);
  }
  return await encodeGif(frames, w, h, 100 / fps, (p) => onP(0.6 + p * 0.4));
  } finally { URL.revokeObjectURL(v.src); v.removeAttribute("src"); v.load(); }
}

async function convertVideo(file: File, t: string, onP: Progress) {
  if (t === "wav" || t.startsWith("mp3")) return convertAudio(file, t, onP);
  if (t === "png-frame") return canvasToBlob(await videoFrame(file), "image/png");
  if (t === "gif") return videoGif(file, onP);
  return recordVideo(file, t, onP);
}

function csvParse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = (text[i] ?? "");
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function htmlToText(html: string) {
  const d = new DOMParser().parseFromString(html, "text/html");
  d.querySelectorAll("script,style").forEach((n) => n.remove());
  return (d.body.innerText || d.body.textContent || "").trim();
}

function htmlToMd(html: string) {
  const d = new DOMParser().parseFromString(html, "text/html");
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return n.textContent ?? "";
    if (!(n instanceof Element)) return "";
    const inner = [...n.childNodes].map(walk).join("");
    const tag = n.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1] ?? 1))} ${inner.trim()}\n\n`;
    if (tag === "p") return `\n${inner.trim()}\n\n`;
    if (tag === "strong" || tag === "b") return `**${inner}**`;
    if (tag === "em" || tag === "i") return `*${inner}*`;
    if (tag === "code") return `\`${inner}\``;
    if (tag === "a") return `[${inner}](${n.getAttribute("href") ?? ""})`;
    if (tag === "li") return `- ${inner.trim()}\n`;
    if (tag === "br") return "\n";
    if (tag === "script" || tag === "style") return "";
    return inner;
  };
  return walk(d.body).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function toCsv(data: unknown): string {
  const arr = Array.isArray(data) ? data : [data];
  const keys = [...new Set(arr.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : ["value"])))];
  const cell = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    keys.map(cell).join(","),
    ...arr.map((r) => keys.map((k) => cell(r && typeof r === "object" ? (r as Record<string, unknown>)[k] : r)).join(",")),
  ].join("\n");
}

async function textToPdf(text: string) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const margin = 56;
  const maxW = 612 - margin * 2;
  const safe = text.replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
  const lines: string[] = [];
  for (const para of safe.split(/\r?\n/)) {
    let line = "";
    for (const word of para.replace(/\t/g, "    ").split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  let page = doc.addPage([612, 792]);
  let y = 792 - margin;
  for (const l of lines) {
    if (y < margin) {
      page = doc.addPage([612, 792]);
      y = 792 - margin;
    }
    page.drawText(l, { x: margin, y, size, font });
    y -= size * 1.45;
  }
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

async function convertText(file: File, t: string): Promise<Blob> {
  const src = await file.text();
  let ext = extOf(file.name);
  if (ext === "markdown") ext = "md";
  if (ext === "htm") ext = "html";
  const { marked } = await import("marked");
  const asHtml = async () => {
    if (ext === "html") return src;
    if (ext === "md") return await marked.parse(src);
    if (ext === "csv") {
      const rows = csvParse(src);
      return `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join("")}</tr>`).join("")}</table>`;
    }
    if (ext === "json") return `<pre>${esc(JSON.stringify(JSON.parse(src), null, 2))}</pre>`;
    return src.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n");
  };
  const asText = async () => (ext === "html" || ext === "md" ? htmlToText(await asHtml()) : src);
  try {
    switch (t) {
      case "html": {
        const body = await asHtml();
        const doc = ext === "html" ? body : `<!doctype html><html><head><meta charset="utf-8"><title>${esc(baseName(file.name))}</title></head><body>${body}</body></html>`;
        return new Blob([doc], { type: "text/html" });
      }
      case "md":
        return new Blob([ext === "html" || ext === "csv" || ext === "json" ? htmlToMd(await asHtml()) : src], { type: "text/markdown" });
      case "txt":
        return new Blob([await asText()], { type: "text/plain" });
      case "json": {
        const [head, ...rows] = csvParse(src);
        const objs = rows.map((r) => Object.fromEntries((head ?? []).map((h, i) => [h, r[i] ?? ""])));
        return new Blob([JSON.stringify(objs, null, 2)], { type: "application/json" });
      }
      case "csv":
        return new Blob([toCsv(JSON.parse(src))], { type: "text/csv" });
      case "pdf":
        return textToPdf(ext === "json" ? JSON.stringify(JSON.parse(src), null, 2) : await asText());
    }
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error("This file isn't valid JSON.");
    throw e;
  }
  throw new Error("Unsupported target");
}

export async function convertFile(file: File, targetId: string, targetExt: string, onP: Progress): Promise<Output> {
  const cat = categoryOf(file);
  let blob: Blob;
  if (cat === "image") blob = await convertImage(file, targetId);
  else if (cat === "pdf") blob = await convertPdf(file, targetId, onP);
  else if (cat === "audio") blob = await convertAudio(file, targetId, onP);
  else if (cat === "video") blob = await convertVideo(file, targetId, onP);
  else if (cat === "text") blob = await convertText(file, targetId);
  else throw new Error("This file type isn't supported yet.");
  onP(1);
  const suffix = cat === "pdf" && targetExt === "zip" ? `-${targetId}` : "";
  return { blob, name: `${baseName(file.name)}${suffix}.${targetExt}` };
}

export { imagesToPdf };
