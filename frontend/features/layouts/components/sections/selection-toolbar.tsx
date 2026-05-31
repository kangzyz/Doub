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

async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
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
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setEnabled(isCapacitorNative());
  }, []);

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
    const dismiss = () => setState(null);
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [enabled, compute]);

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
    const clip = await readClipboard();
    if (clip == null) {
      toast.error(t("pasteEmpty"));
      hide();
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = el.value ?? "";
    setEditableValue(el, value.slice(0, start) + clip + value.slice(end));
    const pos = start + clip.length;
    el.focus();
    try {
      el.setSelectionRange(pos, pos);
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

  const viewportWidth = window.innerWidth;
  const centerX = Math.min(Math.max(state.rect.left + state.rect.width / 2, 76), viewportWidth - 76);
  const placeAbove = state.rect.top > 56;
  const top = placeAbove ? state.rect.top - 8 : state.rect.bottom + 8;

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
        left: centerX,
        top,
        transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
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
