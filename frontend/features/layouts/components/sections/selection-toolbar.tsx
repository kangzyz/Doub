"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type EditableEl = HTMLInputElement | HTMLTextAreaElement;

type SelectionState = {
  text: string;
  editable: EditableEl | null;
  rect: { top: number; bottom: number; left: number; width: number };
};

type Pos = { left: number; top: number; transform: string };

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * Only active inside the Capacitor native shell (the Android APK), where the
 * OS/OEM text-selection floating toolbar is suppressed natively (see
 * MainActivity.onWindowStartingActionMode). On a normal desktop or mobile
 * browser this returns false, so the platform's own selection UI is left
 * untouched.
 */
function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform() === true;
}

async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Distinguish a clipboard-read denial ({ ok: false }) from an empty clipboard. */
async function readClipboard(): Promise<{ ok: boolean; text: string }> {
  try {
    const text = await navigator.clipboard.readText();
    return { ok: true, text };
  } catch {
    return { ok: false, text: "" };
  }
}

/** Set a controlled input/textarea value so React's onChange still fires. */
function setEditableValue(el: EditableEl, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Nearest block-ish ancestor that actually holds text — the "select all" target. */
function selectableBlock(node: Node | null): HTMLElement | null {
  let el: HTMLElement | null = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el && el !== document.body) {
    if (
      (el.textContent ?? "").trim().length > 0 &&
      el.matches("p,li,article,section,blockquote,td,th,pre,h1,h2,h3,h4,h5,h6,div")
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      // Keep the active selection/focus: don't let the tap collapse it before onClick.
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent"
    >
      {label}
    </button>
  );
}

export function SelectionToolbar() {
  const t = useTranslations("common.selection");
  const [enabled, setEnabled] = React.useState(false);
  const [state, setState] = React.useState<SelectionState | null>(null);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const stateRef = React.useRef<SelectionState | null>(null);

  React.useEffect(() => {
    setEnabled(isCapacitorNative());
  }, []);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const compute = React.useCallback(() => {
    const active = document.activeElement;
    if (
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      typeof active.selectionStart === "number" &&
      typeof active.selectionEnd === "number" &&
      active.selectionEnd > active.selectionStart
    ) {
      const text = (active.value ?? "").slice(active.selectionStart, active.selectionEnd);
      if (!text.trim()) {
        setState(null);
        return;
      }
      const r = active.getBoundingClientRect();
      setState({ text, editable: active, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } });
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setState(null);
      return;
    }
    const text = sel.toString();
    if (!text.trim()) {
      setState(null);
      return;
    }
    const range = sel.getRangeAt(0);
    let r = range.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) {
      const rects = range.getClientRects();
      if (rects.length > 0) r = rects[rects.length - 1];
    }
    if (!r) {
      setState(null);
      return;
    }
    setState({ text, editable: null, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } });
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      // A scroll inside the toolbar itself must never dismiss it.
      if (toolbarRef.current && target instanceof Node && toolbarRef.current.contains(target)) {
        return;
      }
      // Scrolling inside the editable that owns the selection: reposition, keep open
      // (its anchor rect is the input box itself, so this just tracks it).
      const editable = stateRef.current?.editable ?? null;
      if (editable && target instanceof Node && (target === editable || editable.contains(target))) {
        schedule();
        return;
      }
      // Genuine page/content scroll moves the selection out from under the toolbar.
      setState(null);
    };
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Width change = real resize/rotation -> dismiss. Height-only change =
      // soft keyboard show/hide -> just reposition, don't lose the toolbar.
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        setState(null);
      } else {
        schedule();
      }
    };
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled, compute]);

  // Measure the rendered toolbar and clamp it fully on-screen before paint.
  useIsoLayoutEffect(() => {
    if (!state) return;
    const el = toolbarRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const half = w / 2 + 8;
    const rectCenter = state.rect.left + state.rect.width / 2;
    const left = Math.min(Math.max(rectCenter, half), Math.max(half, vw - half));
    const placeAbove = state.rect.top > h + 16;
    const top = placeAbove
      ? state.rect.top - 8
      : Math.min(state.rect.bottom + 8, Math.max(8, vh - h - 8));
    setPos({ left, top, transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)" });
  }, [state]);

  const hide = React.useCallback(() => setState(null), []);

  const doCopy = React.useCallback(async () => {
    if (!state) return;
    const ok = await copyText(state.text);
    if (ok) toast.success(t("copied"));
    else toast.error(t("failed"));
    hide();
  }, [state, t, hide]);

  const doShare = React.useCallback(async () => {
    if (!state) return;
    const shareApi = typeof navigator !== "undefined" ? navigator.share?.bind(navigator) : undefined;
    if (shareApi) {
      try {
        await shareApi({ text: state.text });
        hide();
        return;
      } catch {
        // user cancelled or payload unsupported -> fall back to copy
      }
    }
    const ok = await copyText(state.text);
    if (ok) toast.success(t("copied"));
    else toast.error(t("failed"));
    hide();
  }, [state, t, hide]);

  const doCut = React.useCallback(async () => {
    const el = state?.editable;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const ok = await copyText(state.text);
    const value = el.value ?? "";
    setEditableValue(el, value.slice(0, start) + value.slice(end));
    el.focus();
    try {
      el.setSelectionRange(start, start);
    } catch {
      // ignore
    }
    if (!ok) toast.error(t("failed"));
    hide();
  }, [state, t, hide]);

  const doPaste = React.useCallback(async () => {
    const el = state?.editable;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const res = await readClipboard();
    if (!res.ok) {
      toast.error(t("pasteFailed"));
      hide();
      return;
    }
    if (!res.text) {
      toast(t("pasteEmpty"));
      hide();
      return;
    }
    const value = el.value ?? "";
    setEditableValue(el, value.slice(0, start) + res.text + value.slice(end));
    const caret = start + res.text.length;
    el.focus();
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // ignore
    }
    hide();
  }, [state, t, hide]);

  const doSelectAll = React.useCallback(() => {
    if (!state) return;
    if (state.editable) {
      const el = state.editable;
      el.focus();
      try {
        el.select();
      } catch {
        // ignore
      }
      requestAnimationFrame(compute);
      return;
    }
    const sel = window.getSelection();
    const block = selectableBlock(sel?.anchorNode ?? null);
    if (sel && block) {
      const range = document.createRange();
      range.selectNodeContents(block);
      sel.removeAllRanges();
      sel.addRange(range);
      requestAnimationFrame(compute);
    }
  }, [state, compute]);

  if (!enabled || !state) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t("copy")}
      className={cn(
        "fixed z-[120] flex max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        transform: pos?.transform ?? "translate(-50%, 0)",
      }}
    >
      {state.editable ? (
        <>
          <ActionButton label={t("cut")} onClick={() => void doCut()} />
          <ActionButton label={t("copy")} onClick={() => void doCopy()} />
          <ActionButton label={t("paste")} onClick={() => void doPaste()} />
          <ActionButton label={t("selectAll")} onClick={doSelectAll} />
        </>
      ) : (
        <>
          <ActionButton label={t("copy")} onClick={() => void doCopy()} />
          <ActionButton label={t("selectAll")} onClick={doSelectAll} />
          <ActionButton label={t("share")} onClick={() => void doShare()} />
        </>
      )}
    </div>,
    document.body,
  );
}
