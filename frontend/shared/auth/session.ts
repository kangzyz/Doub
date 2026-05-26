export type SessionSnapshot = {
  accessToken: string;
  sessionID: string;
};

export const SESSION_SNAPSHOT_CHANGED_EVENT = "doub-chat:session-snapshot-changed";

const SESSION_SNAPSHOT_STORAGE_KEY = "doub-chat:session-snapshot:v1";

const sessionSnapshot: SessionSnapshot = {
  accessToken: "",
  sessionID: "",
};

let didLoadStoredSessionSnapshot = false;

function normalizeStoredSessionSnapshot(value: unknown): SessionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<Record<keyof SessionSnapshot, unknown>>;
  const accessToken = typeof snapshot.accessToken === "string" ? snapshot.accessToken : "";
  const sessionID = typeof snapshot.sessionID === "string" ? snapshot.sessionID : "";
  if (!accessToken && !sessionID) {
    return null;
  }

  return {
    accessToken,
    sessionID,
  };
}

function readStoredSessionSnapshot(): SessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(SESSION_SNAPSHOT_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return normalizeStoredSessionSnapshot(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

function writeStoredSessionSnapshot(snapshot: SessionSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!snapshot.accessToken && !snapshot.sessionID) {
      window.localStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SESSION_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        accessToken: snapshot.accessToken,
        sessionID: snapshot.sessionID,
      }),
    );
  } catch {
    // Storage can be unavailable in private modes or locked-down WebViews.
  }
}

function loadStoredSessionSnapshotIfEmpty(): void {
  if (didLoadStoredSessionSnapshot || sessionSnapshot.accessToken || sessionSnapshot.sessionID) {
    return;
  }

  didLoadStoredSessionSnapshot = true;
  const stored = readStoredSessionSnapshot();
  if (!stored) {
    return;
  }

  sessionSnapshot.accessToken = stored.accessToken;
  sessionSnapshot.sessionID = stored.sessionID;
}

function dispatchSessionSnapshotChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(
      new CustomEvent<SessionSnapshot>(SESSION_SNAPSHOT_CHANGED_EVENT, {
        detail: {
          ...sessionSnapshot,
        },
      }),
    );
  } catch {
    // Ignore browser event failures; storage and in-memory state are already updated.
  }
}

export function readAccessToken(): string {
  loadStoredSessionSnapshotIfEmpty();
  return sessionSnapshot.accessToken;
}

export function readSessionID(): string {
  loadStoredSessionSnapshotIfEmpty();
  return sessionSnapshot.sessionID;
}

export function readSessionSnapshot(): SessionSnapshot {
  loadStoredSessionSnapshotIfEmpty();
  return {
    ...sessionSnapshot,
  };
}

export function writeSessionSnapshot(next: Partial<SessionSnapshot>): void {
  loadStoredSessionSnapshotIfEmpty();
  const previousAccessToken = sessionSnapshot.accessToken;
  const previousSessionID = sessionSnapshot.sessionID;
  if (typeof next.accessToken === "string") {
    sessionSnapshot.accessToken = next.accessToken;
  }
  if (typeof next.sessionID === "string") {
    sessionSnapshot.sessionID = next.sessionID;
  }
  writeStoredSessionSnapshot(sessionSnapshot);
  if (sessionSnapshot.accessToken !== previousAccessToken || sessionSnapshot.sessionID !== previousSessionID) {
    dispatchSessionSnapshotChanged();
  }
}

export function writeAccessToken(token: string): void {
  writeSessionSnapshot({ accessToken: token });
}

export function clearSessionSnapshot(): void {
  writeSessionSnapshot({
    accessToken: "",
    sessionID: "",
  });
}

export function clearSessionAndRedirectToLogin(): void {
  clearSessionSnapshot();
  if (typeof window !== "undefined") {
    try {
      window.location.replace("/login");
    } catch {
      // Ignore redirect failures in non-browser-like runtimes.
    }
  }
}
