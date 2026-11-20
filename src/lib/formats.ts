export type Category = "image" | "audio" | "video" | "pdf" | "text" | "unknown";

export interface Target {
  id: string;
  label: string;
  ext: string;
}

const IMAGE = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico", "avif"];
const AUDIO = ["wav", "mp3", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"];
const VIDEO = ["mp4", "mov", "webm", "mkv", "m4v", "avi", "ogv"];
const TEXT = ["txt", "md", "markdown", "html", "htm", "json", "csv"];

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? name : name.slice(0, i);
}

export function categoryOf(file: { name: string; type: string }): Category {
  const ext = extOf(file.name);
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (IMAGE.includes(ext) || file.type.startsWith("image/")) return "image";
  if (VIDEO.includes(ext) || file.type.startsWith("video/")) return "video";
  if (AUDIO.includes(ext) || file.type.startsWith("audio/")) return "audio";
  if (TEXT.includes(ext) || file.type.startsWith("text/") || file.type === "application/json") return "text";
  return "unknown";
}

export function supportsMp4Recording() {
  if (typeof MediaRecorder === "undefined") return false;
  return MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") || MediaRecorder.isTypeSupported("video/mp4");
}

export function targetsFor(cat: Category, ext: string): Target[] {
  switch (cat) {
    case "image":
      return [
        { id: "png", label: "PNG", ext: "png" },
        { id: "jpg", label: "JPG (90%)", ext: "jpg" },
        { id: "jpg-70", label: "JPG (70%, smaller)", ext: "jpg" },
        { id: "webp", label: "WebP", ext: "webp" },
        { id: "bmp", label: "BMP", ext: "bmp" },
        { id: "ico", label: "ICO (256px)", ext: "ico" },
        { id: "svg", label: "SVG (embedded)", ext: "svg" },
        { id: "pdf", label: "PDF", ext: "pdf" },
      ].filter((t) => t.ext !== ext && !(ext === "jpeg" && t.ext === "jpg" && t.id === "jpg"));
    case "pdf":
      return [
        { id: "png-300", label: "PNG (300 DPI)", ext: "zip" },
        { id: "png-150", label: "PNG (150 DPI)", ext: "zip" },
        { id: "jpg-150", label: "JPG (150 DPI)", ext: "zip" },
        { id: "txt", label: "TXT (text only)", ext: "txt" },
      ];
    case "audio":
      return [
        { id: "mp3-320", label: "MP3 (320k)", ext: "mp3" },
        { id: "mp3-128", label: "MP3 (128k)", ext: "mp3" },
        { id: "wav", label: "WAV", ext: "wav" },
      ].filter((t) => t.ext !== ext || t.id.startsWith("mp3"));
    case "video": {
      const list: Target[] = [];
      if (supportsMp4Recording()) list.push({ id: "mp4", label: "MP4 (H.264)", ext: "mp4" });
      list.push(
        { id: "webm", label: "WebM (VP9)", ext: "webm" },
        { id: "mp3-320", label: "MP3 (320k audio)", ext: "mp3" },
        { id: "wav", label: "WAV (audio)", ext: "wav" },
        { id: "png-frame", label: "PNG (first frame)", ext: "png" },
        { id: "gif", label: "GIF (first 5s)", ext: "gif" },
      );
      return list;
    }
    case "text": {
      const all: Target[] = [
        { id: "html", label: "HTML", ext: "html" },
        { id: "md", label: "Markdown", ext: "md" },
        { id: "txt", label: "TXT", ext: "txt" },
        { id: "json", label: "JSON", ext: "json" },
        { id: "csv", label: "CSV", ext: "csv" },
        { id: "pdf", label: "PDF", ext: "pdf" },
      ];
      const e = ext === "markdown" ? "md" : ext === "htm" ? "html" : ext;
      return all.filter((t) => {
        if (t.ext === e) return false;
        if (t.id === "json") return e === "csv";
        if (t.id === "csv") return e === "json";
        return true;
      });
    }
    default:
      return [];
  }
}

export function engineFor(cat: Category, targetId: string) {
  if (cat === "image") return targetId === "pdf" ? "Local PDF Engine" : "Local Canvas";
  if (cat === "pdf") return "Local PDF Engine";
  if (cat === "audio") return "Local Audio Worker";
  if (cat === "video") {
    if (targetId.startsWith("mp3") || targetId === "wav") return "Local Audio Worker";
    if (targetId === "png-frame" || targetId === "gif") return "Local Canvas";
    return "Local Media Encoder";
  }
  if (cat === "text") return targetId === "pdf" ? "Local PDF Engine" : "Local Text Parser";
  return "Unsupported";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
