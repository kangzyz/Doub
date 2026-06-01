export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const candidates = [
    nav.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent,
  ].filter(Boolean);
  return candidates.some((value) => /Mac|iPhone|iPad|iPod|Darwin/i.test(value)) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function platformModifierLabel(): "Command" | "Ctrl" {
  return isApplePlatform() ? "Command" : "Ctrl";
}

export function hasPlatformModifierKey(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  if (isApplePlatform()) {
    return event.metaKey && !event.ctrlKey;
  }
  return event.ctrlKey && !event.metaKey;
}

export function platformSendShortcut(): "ctrl_enter" | "meta_enter" {
  return isApplePlatform() ? "meta_enter" : "ctrl_enter";
}

export function shouldUseMultilineEnterForTouchInput(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  // Only treat as touch-primary device when the primary pointer is coarse (touch)
  // AND there is no hover capability (no mouse/trackpad available).
  // This correctly identifies phones and tablets while excluding laptops with
  // touchscreens where the user has a physical keyboard for newlines.
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  return coarsePointer && noHover;
}

export function isSendShortcutEvent(
  shortcut: "enter" | "ctrl_enter" | "meta_enter",
  event: {
    key: string;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  },
): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.altKey) {
    return false;
  }
  if (shortcut === "enter") {
    return !event.ctrlKey && !event.metaKey;
  }
  return hasPlatformModifierKey(event);
}
