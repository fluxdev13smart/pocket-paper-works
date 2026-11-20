// Minimal GIF89a encoder: fixed 6x7x6 web palette + LZW. Runs fully in-browser.
const tick = () => new Promise((r) => setTimeout(r, 0));

function palette() {
  const p: number[] = [];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) p.push(Math.round((r * 255) / 5), Math.round((g * 255) / 6), Math.round((b * 255) / 5));
  while (p.length < 256 * 3) p.push(0);
  return p;
}

function lzw(indices: Uint8Array, out: number[]) {
  const minCode = 8;
  out.push(minCode);
  const clear = 256;
  const eoi = 257;
  let codeSize = 9;
  let next = 258;
  let dict = new Map<string, number>();
  let bitBuf = 0;
  let bitCnt = 0;
  const bytes: number[] = [];
  const emit = (code: number) => {
    bitBuf |= code << bitCnt;
    bitCnt += codeSize;
    while (bitCnt >= 8) {
      bytes.push(bitBuf & 255);
      bitBuf >>= 8;
      bitCnt -= 8;
    }
  };
  emit(clear);
  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = prefix + "," + k;
    if (dict.has(key)) {
      prefix = key;
      continue;
    }
    emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = 258;
      codeSize = 9;
    }
    prefix = String(k);
  }
  emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
  emit(eoi);
  if (bitCnt > 0) bytes.push(bitBuf & 255);
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
}

export async function encodeGif(frames: Uint8ClampedArray[], w: number, h: number, delayCs: number, onP: (p: number) => void) {
  const out: number[] = [];
  const str = (s: string) => [...s].forEach((c) => out.push(c.charCodeAt(0)));
  const u16 = (n: number) => out.push(n & 255, (n >> 8) & 255);
  str("GIF89a");
  u16(w);
  u16(h);
  out.push(0xf7, 0, 0);
  out.push(...palette());
  out.push(0x21, 0xff, 11);
  str("NETSCAPE2.0");
  out.push(3, 1, 0, 0, 0);
  for (let f = 0; f < frames.length; f++) {
    const d = frames[f]!;
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = Math.round((d[i * 4]! * 5) / 255);
      const g = Math.round((d[i * 4 + 1]! * 6) / 255);
      const b = Math.round((d[i * 4 + 2]! * 5) / 255);
      idx[i] = r * 42 + g * 6 + b;
    }
    out.push(0x21, 0xf9, 4, 0, delayCs & 255, (delayCs >> 8) & 255, 0, 0);
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(w);
    u16(h);
    out.push(0);
    lzw(idx, out);
    onP((f + 1) / frames.length);
    await tick();
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: "image/gif" });
}
