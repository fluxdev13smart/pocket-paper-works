export interface Region { x: number; y: number; w: number; h: number }
export interface CutoutClipboard { data: string; width: number; height: number }

export function moveRegion(region: Region, dx: number, dy: number): Region {
  return { ...region, x: Math.max(0, Math.min(1 - region.w, region.x + dx)), y: Math.max(0, Math.min(1 - region.h, region.y + dy)) };
}

export function resizeRegion(region: Region, dx: number, dy: number): Region {
  return { ...region, w: Math.max(0.02, Math.min(1 - region.x, region.w + dx)), h: Math.max(0.02, Math.min(1 - region.y, region.h + dy)) };
}

export function pasteRegion(clip: CutoutClipboard, pageWidth: number, pageHeight: number, x: number, y: number): Region {
  const scale = Math.min(1, pageWidth * 0.9 / clip.width, pageHeight * 0.9 / clip.height);
  const w = clip.width * scale / pageWidth;
  const h = clip.height * scale / pageHeight;
  return { x: Math.max(0, Math.min(1 - w, x)), y: Math.max(0, Math.min(1 - h, y)), w, h };
}

// Only accessed in browser interactions; no DOM objects are created during SSR.
const images = new Map<string, HTMLImageElement>();
export function cutoutImage(data: string) { return images.get(data); }
export async function prepareCutout(data: string) {
  const existing = images.get(data);
  if (existing) return existing;
  const image = new Image();
  image.src = data;
  await image.decode();
  images.set(data, image);
  return image;
}
export function clearCutoutImages() { images.clear(); }

/** Hit-test the entire stroke, not just sampled pointer positions. */
export function hitsStroke(points: [number, number][], x: number, y: number, ratio: number, tolerance: number) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[i + 1] ?? a;
    if (!a || !b) continue;
    const vx = b[0] - a[0], vy = (b[1] - a[1]) * ratio;
    const px = x - a[0], py = (y - a[1]) * ratio;
    const length = vx * vx + vy * vy;
    const t = length ? Math.max(0, Math.min(1, (px * vx + py * vy) / length)) : 0;
    if (Math.hypot(px - t * vx, py - t * vy) <= tolerance) return true;
  }
  return false;
}
