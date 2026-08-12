import { recordEvent } from "./ranking.functions";
import type { EventType } from "./ranking.server";

/**
 * Collecteur d'événements côté client : il ne fait qu'émettre des signaux,
 * toute la validation (bornes, quotas, anti-spam) se fait côté serveur.
 */

let sessionId: string | null = null;
function getSessionId() {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "ssr";
  const key = "visita_session_id";
  let v = window.sessionStorage.getItem(key);
  if (!v) {
    v = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.sessionStorage.setItem(key, v);
  }
  sessionId = v;
  return v;
}

const sent = new Set<string>();

export async function track(
  eventType: EventType,
  videoId: string,
  extra?: { watchMs?: number; positionMs?: number; durationMs?: number; once?: boolean },
) {
  if (!videoId) return;
  if (extra?.once) {
    const key = `${eventType}:${videoId}`;
    if (sent.has(key)) return;
    sent.add(key);
  }
  try {
    await recordEvent({
      data: {
        videoId,
        eventType,
        watchMs: extra?.watchMs,
        positionMs: extra?.positionMs,
        durationMs: extra?.durationMs,
        sessionId: getSessionId(),
      },
    });
  } catch {
    /* signal non critique : on ignore silencieusement */
  }
}

/** Impression : une seule par vidéo et par session. */
export function trackImpression(videoId: string) {
  void track("impression", videoId, { once: true });
}
