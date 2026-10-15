"use client";

import { useEffect, useRef } from "react";

// Clicar e segurar (mouse) pra arrastar o Kanban pros lados — só ativa fora
// de cards/botões/links (checagem por `closest`), pra não brigar com o
// drag-and-drop do dnd-kit (que já cuida do próprio card via listeners
// próprios) nem com cliques normais. Touch já rola nativo com scroll-snap,
// então só liga para `pointerType === "mouse"`.
export function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const state = { isPanning: false, startX: 0, scrollLeft: 0 };

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 || e.pointerType !== "mouse") return;
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, [data-kanban-card]")) return;

      state.isPanning = true;
      state.startX = e.clientX;
      state.scrollLeft = el!.scrollLeft;
      el!.setPointerCapture(e.pointerId);
      el!.classList.add("cursor-grabbing", "select-none");
    }

    function onPointerMove(e: PointerEvent) {
      if (!state.isPanning) return;
      el!.scrollLeft = state.scrollLeft - (e.clientX - state.startX);
    }

    function endPan(e: PointerEvent) {
      if (!state.isPanning) return;
      state.isPanning = false;
      el!.classList.remove("cursor-grabbing", "select-none");
      try {
        el!.releasePointerCapture(e.pointerId);
      } catch {
        // já liberado — sem problema
      }
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
    };
  }, []);

  return ref;
}
