import { useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

export function setMyAvatar(url: string | null) {
  if (current === url) return;
  current = url;
  listeners.forEach((l) => l());
}

export function useMyAvatar() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
