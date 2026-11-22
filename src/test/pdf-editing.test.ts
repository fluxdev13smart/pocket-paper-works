import { beforeEach, describe, expect, it, vi } from "vitest";
import { hitsStroke, moveRegion, pasteRegion, resizeRegion } from "@/lib/pdf-cutout";
import { drawOps, pdfStore, type Op } from "@/lib/pdf-store";

const image: Op = { id: "paste", kind: "image", data: "data:image/png;base64,test", x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
beforeEach(() => { pdfStore.load("example.pdf", new Uint8Array([1]), 3); });

describe("PDF cut and paste", () => {
  it("renders cut source regions as opaque white blanks", () => {
    const fillRect = vi.fn();
    const context = { fillStyle: "", fillRect } as unknown as CanvasRenderingContext2D;
    drawOps(context, [{ id: "blank", kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.1 }], 1000, 2000);
    expect(context.fillStyle).toBe("#ffffff");
    expect(fillRect).toHaveBeenCalledWith(100, 400, 300, 200);
  });
  it("leaves a white rectangle at the source while keeping pasted content separate", () => {
    pdfStore.addOp(1, { id: "blank", kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.1 });
    pdfStore.addOp(2, image);
    pdfStore.updateOp(2, "paste", { x: 0.5, y: 0.6, w: 0.2, h: 0.2 });
    expect(pdfStore.get().ops[1]).toEqual([{ id: "blank", kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.1 }]);
    expect(pdfStore.get().ops[2]?.[0]).toMatchObject({ x: 0.5, y: 0.6, w: 0.2, h: 0.2 });
  });
  it("undoes and redoes pasted cutout resizing", () => {
    pdfStore.addOp(1, image);
    pdfStore.updateOp(1, "paste", { x: 0.1, y: 0.2, w: 0.6, h: 0.4 });
    pdfStore.undo();
    expect(pdfStore.get().ops[1]?.[0]).toMatchObject({ w: 0.3, h: 0.1 });
    pdfStore.redo();
    expect(pdfStore.get().ops[1]?.[0]).toMatchObject({ w: 0.6, h: 0.4 });
  });
  it("removes a pasted region without restoring the blank source", () => {
    pdfStore.addOp(1, { id: "blank", kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.1 });
    pdfStore.addOp(1, image);
    pdfStore.removeOps(1, ["paste"]);
    expect(pdfStore.get().ops[1]?.map(op => op.id)).toEqual(["blank"]);
    pdfStore.undo();
    expect(pdfStore.get().ops[1]?.map(op => op.id)).toEqual(["blank", "paste"]);
  });
  it("keeps moved cutouts within the page", () => {
    expect(moveRegion(image, 2, -2)).toMatchObject({ x: 0.7, y: 0, w: 0.3, h: 0.1 });
  });
  it("resizes cutouts without leaving the page or collapsing to zero", () => {
    expect(resizeRegion(image, 2, 2)).toMatchObject({ w: 0.9, h: 0.8 });
    expect(resizeRegion(image, -2, -2)).toMatchObject({ w: 0.02, h: 0.02 });
  });
  it("pastes on a differently sized page with the original physical proportions", () => {
    const region = pasteRegion({ data: "test", width: 200, height: 100 }, 400, 800, 0.9, 0.9);
    expect(region).toEqual({ x: 0.5, y: 0.875, w: 0.5, h: 0.125 });
  });
  it("clears the private cutout clipboard when closing a document", () => {
    pdfStore.setClipboard({ data: "private", width: 200, height: 100 });
    pdfStore.close();
    expect(pdfStore.get().clipboard).toBeNull();
  });
});

describe("PDF editor safeguards", () => {
  it("keeps at least one page in the export", () => {
    pdfStore.toggleExcluded(1); pdfStore.toggleExcluded(2); pdfStore.toggleExcluded(3);
    expect(pdfStore.get().excluded).toEqual([1, 2]);
  });
  it("ignores invalid page selection", () => {
    pdfStore.toggleExcluded(0); pdfStore.toggleExcluded(4);
    expect(pdfStore.get().excluded).toEqual([]);
  });
  it("eraser detects the middle of long marker segments", () => {
    expect(hitsStroke([[0.1, 0.5], [0.9, 0.5]], 0.5, 0.5, 1.3, 0.01)).toBe(true);
    expect(hitsStroke([[0.1, 0.5], [0.9, 0.5]], 0.5, 0.8, 1.3, 0.01)).toBe(false);
  });
});
