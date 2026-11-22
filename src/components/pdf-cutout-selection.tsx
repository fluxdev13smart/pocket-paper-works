import { useRef, type PointerEvent } from "react";
import { Move, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveRegion, resizeRegion, type Region } from "@/lib/pdf-cutout";

export function CutoutSelection({ region, selected, width, height, onSelect, onPreview, onCommit, onDelete }: {
  region: Region; selected: boolean; width: number; height: number;
  onSelect: () => void; onPreview: (region: Region | null) => void;
  onCommit: (region: Region) => void; onDelete: () => void;
}) {
  const gesture = useRef<{ x: number; y: number; region: Region; resizing: boolean; last: Region } | null>(null);
  const start = (event: PointerEvent<HTMLButtonElement>, resizing: boolean) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, region, resizing, last: region };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    const dx = (event.clientX - drag.x) / width, dy = (event.clientY - drag.y) / height;
    drag.last = drag.resizing ? resizeRegion(drag.region, dx, dy) : moveRegion(drag.region, dx, dy);
    onPreview(drag.last);
  };
  const end = () => {
    const drag = gesture.current;
    gesture.current = null;
    if (drag && (drag.last.x !== drag.region.x || drag.last.y !== drag.region.y || drag.last.w !== drag.region.w || drag.last.h !== drag.region.h)) onCommit(drag.last);
    onPreview(null);
  };
  const cancel = () => { gesture.current = null; onPreview(null); };
  return (
    <div className="pointer-events-none absolute z-10" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}>
      <Button variant="unstyled" size="unstyled" aria-label="Move pasted cutout" aria-pressed={selected}
        className={`pointer-events-auto absolute inset-0 h-full w-full cursor-move rounded-none touch-none ${selected ? "border-2 border-primary" : "border border-transparent hover:border-primary/60"}`}
        onPointerDown={event => start(event, false)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
        onFocus={onSelect}
        onKeyDown={event => {
          if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onDelete(); return; }
          const step = event.shiftKey ? 0.02 : 0.005;
          const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
          if (delta) { event.preventDefault(); onCommit(moveRegion(region, delta[0] ?? 0, delta[1] ?? 0)); }
        }}>
        {selected && <Move className="pointer-events-none absolute left-1 top-1 text-primary" />}
      </Button>
      {selected && <>
        <Button variant="unstyled" size="unstyled" aria-label="Delete pasted cutout" title="Delete pasted cutout"
          className="pointer-events-auto absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-sm bg-card text-destructive shadow-kit" onClick={onDelete}><Trash2 /></Button>
        <Button variant="unstyled" size="unstyled" aria-label="Resize pasted cutout" title="Resize pasted cutout"
          className="pointer-events-auto absolute -bottom-2 -right-2 h-5 w-5 touch-none cursor-nwse-resize rounded-sm border-2 border-primary-foreground bg-primary"
          onPointerDown={event => start(event, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} />
      </>}
    </div>
  );
}
