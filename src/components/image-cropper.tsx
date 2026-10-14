"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";

type Crop = { x: number; y: number; size: number }; // em pixels da imagem original
type Handle = "move" | "nw" | "ne" | "sw" | "se";

const STAGE_W = 440;
const STAGE_H = 340;
const MIN_DISPLAY = 40; // tamanho mínimo do recorte na tela (px)
const OUTPUT = 320; // tamanho final da foto (px)

/**
 * Mini editor de imagem: recorte quadrado com arrastar/redimensionar e pré-visualização ao vivo.
 * Devolve a foto final em WebP 320×320.
 */
export function ImageCropper({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [stageW, setStageW] = useState(STAGE_W);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Crop } | null>(null);

  // Carrega a imagem e posiciona o recorte inicial (centralizado, 80% do lado menor)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Em telas estreitas (celular), a área de recorte encolhe para caber
      setStageW(Math.max(220, Math.min(STAGE_W, window.innerWidth - 64)));
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const size = Math.round(Math.min(w, h) * 0.8);
      setNatural({ w, h });
      setCrop({ x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), size });
    };
    img.src = src;
    dialogRef.current?.showModal();
  }, [src]);

  const scale = natural ? Math.min(stageW / natural.w, STAGE_H / natural.h) : 1;
  const minSize = natural ? Math.min(MIN_DISPLAY / scale, natural.w, natural.h) : 1;

  const clamp = useCallback(
    (c: Crop): Crop => {
      if (!natural) return c;
      const size = Math.max(minSize, Math.min(c.size, natural.w, natural.h));
      return {
        size,
        x: Math.max(0, Math.min(c.x, natural.w - size)),
        y: Math.max(0, Math.min(c.y, natural.h - size)),
      };
    },
    [natural, minSize],
  );

  // Desenha as pré-visualizações sempre que o recorte muda
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !crop) return;
    previewRefs.current.forEach((canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height);
    });
  }, [crop]);

  function onPointerDown(e: ReactPointerEvent, handle: Handle) {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || !natural) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const s = d.start;
    let next: Crop = s;
    switch (d.handle) {
      case "move":
        next = { ...s, x: s.x + dx, y: s.y + dy };
        break;
      case "se": {
        const size = Math.min(s.size + (dx + dy) / 2, natural.w - s.x, natural.h - s.y);
        next = { x: s.x, y: s.y, size };
        break;
      }
      case "nw": {
        const size = Math.min(s.size - (dx + dy) / 2, s.x + s.size, s.y + s.size);
        next = { x: s.x + s.size - size, y: s.y + s.size - size, size };
        break;
      }
      case "ne": {
        const size = Math.min(s.size + (dx - dy) / 2, natural.w - s.x, s.y + s.size);
        next = { x: s.x, y: s.y + s.size - size, size };
        break;
      }
      case "sw": {
        const size = Math.min(s.size + (dy - dx) / 2, s.x + s.size, natural.h - s.y);
        next = { x: s.x + s.size - size, y: s.y, size };
        break;
      }
    }
    // Ao redimensionar abaixo do mínimo, mantém o canto oposto fixo
    if (next.size < minSize) {
      const size = minSize;
      if (d.handle === "nw") next = { x: s.x + s.size - size, y: s.y + s.size - size, size };
      else if (d.handle === "ne") next = { x: s.x, y: s.y + s.size - size, size };
      else if (d.handle === "sw") next = { x: s.x + s.size - size, y: s.y, size };
      else next = { ...next, size };
    }
    setCrop(clamp(next));
  }

  function onPointerUp() {
    drag.current = null;
  }

  /** Zoom pelo controle deslizante / botões, mantendo o centro do recorte. */
  function resizeCentered(size: number) {
    if (!crop) return;
    const cx = crop.x + crop.size / 2;
    const cy = crop.y + crop.size / 2;
    setCrop(clamp({ x: cx - size / 2, y: cy - size / 2, size }));
  }

  function reset() {
    if (!natural) return;
    const size = Math.round(Math.min(natural.w, natural.h) * 0.8);
    setCrop({ x: (natural.w - size) / 2, y: (natural.h - size) / 2, size });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!crop || !natural) return;
    const step = (e.shiftKey ? 20 : 4) / scale;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setCrop(clamp({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      resizeCentered(crop.size + step * 2);
    } else if (e.key === "-") {
      e.preventDefault();
      resizeCentered(crop.size - step * 2);
    }
  }

  function apply() {
    const img = imgRef.current;
    if (!img || !crop) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => {
      if (blob) {
        dialogRef.current?.close();
        onApply(blob);
      }
    }, "image/webp", 0.88);
  }

  const maxSize = natural ? Math.min(natural.w, natural.h) : 1;
  const disp = crop && { left: crop.x * scale, top: crop.y * scale, size: crop.size * scale };
  const zoomPct = crop ? Math.round(((maxSize - crop.size) / Math.max(1, maxSize - minSize)) * 100) : 0;

  const corner = (h: Exclude<Handle, "move">, cls: string, cursor: string) => (
    <span
      role="presentation"
      onPointerDown={(e) => onPointerDown(e, h)}
      className={cn("absolute size-4 rounded-full border-2 border-white bg-black/40 shadow touch-none", cls)}
      style={{ cursor }}
    />
  );

  return (
    <dialog
      ref={dialogRef}
      aria-label="Editar imagem"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-[760px] rounded-2xl border border-line bg-surface p-0 text-fg shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-base font-semibold">Editar imagem</h2>
        <button type="button" aria-label="Fechar" onClick={onCancel} className="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
          <X className="size-5" />
        </button>
      </div>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_200px] md:items-center">
        {/* Área de recorte */}
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--surface-2)_0%_25%,var(--surface-3)_0%_50%)] bg-[length:16px_16px] select-none"
            style={natural ? { width: natural.w * scale, height: natural.h * scale } : { width: STAGE_W, height: 240 }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {natural && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem local (blob) em edição
              <img src={src} alt="Imagem em edição" draggable={false} className="pointer-events-none block size-full" />
            )}
            {disp && (
              <div
                role="slider"
                tabIndex={0}
                aria-label="Área de recorte. Use as setas para mover e + ou − para redimensionar."
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={zoomPct}
                onKeyDown={onKeyDown}
                onPointerDown={(e) => onPointerDown(e, "move")}
                className="absolute cursor-move touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand"
                style={{
                  left: disp.left,
                  top: disp.top,
                  width: disp.size,
                  height: disp.size,
                  boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
                }}
              >
                {/* Moldura, grade de terços e guia circular do avatar */}
                <span className="pointer-events-none absolute inset-0 border-2 border-white/90" />
                <span className="pointer-events-none absolute inset-0 rounded-full border border-dashed border-white/70" />
                <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/25" />
                <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/25" />
                <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/25" />
                <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/25" />
                {corner("nw", "-top-2 -left-2", "nwse-resize")}
                {corner("ne", "-top-2 -right-2", "nesw-resize")}
                {corner("sw", "-bottom-2 -left-2", "nesw-resize")}
                {corner("se", "-right-2 -bottom-2", "nwse-resize")}
              </div>
            )}
          </div>
        </div>

        {/* Pré-visualização */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Pré-visualização</p>
          <canvas
            ref={(el) => {
              previewRefs.current[0] = el;
            }}
            width={256}
            height={256}
            aria-label="Pré-visualização da foto"
            className="size-32 rounded-full bg-surface-2 ring-1 ring-line"
          />
          <div className="flex items-end gap-4">
            <canvas
              ref={(el) => {
                previewRefs.current[1] = el;
              }}
              width={128}
              height={128}
              aria-hidden
              className="size-16 rounded-lg bg-surface-2 ring-1 ring-line"
            />
            <canvas
              ref={(el) => {
                previewRefs.current[2] = el;
              }}
              width={64}
              height={64}
              aria-hidden
              className="size-8 rounded-full bg-surface-2 ring-1 ring-line"
            />
          </div>
          <p className="text-center text-[11px] text-muted">Como aparece no perfil, nas listas e no chat</p>
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-3 px-5 pb-4">
        <button
          type="button"
          aria-label="Diminuir zoom"
          onClick={() => crop && resizeCentered(crop.size * 1.1)}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={zoomPct}
          aria-label="Zoom do recorte"
          onChange={(e) => resizeCentered(maxSize - (Number(e.target.value) / 100) * (maxSize - minSize))}
          className="h-1.5 flex-1 cursor-pointer accent-[var(--brand)]"
        />
        <button
          type="button"
          aria-label="Aumentar zoom"
          onClick={() => crop && resizeCentered(crop.size / 1.1)}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={reset} title="Restaurar" className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">
          <RotateCcw className="size-3.5" /> Restaurar
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <p className="hidden text-xs text-muted sm:block">Arraste o quadro para mover · puxe os cantos para redimensionar</p>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
            Cancelar
          </button>
          <button type="button" onClick={apply} disabled={!crop} className={buttonClass("primary")}>
            Aplicar
          </button>
        </div>
      </div>
    </dialog>
  );
}
