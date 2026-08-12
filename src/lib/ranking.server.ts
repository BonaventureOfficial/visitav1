// Serveur uniquement : logique du VISITA RANKING ENGINE.
// Toutes les opérations critiques (événements, SupaV, recalcul des scores,
// analytics admin) sont validées ici, jamais depuis le client.

export const EVENT_TYPES = [
  "impression",
  "watch",
  "complete",
  "skip",
  "replay",
  "like",
  "comment",
  "share",
  "follow",
  "not_interested",
  "hide",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

/** Bornes de sécurité appliquées aux valeurs envoyées par le client. */
export function sanitizeEventNumbers(input: {
  watchMs?: number;
  positionMs?: number;
  durationMs?: number;
}) {
  const clamp = (n: unknown, max: number) => {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
    return Math.max(0, Math.min(v, max));
  };
  const FOUR_HOURS = 4 * 3600 * 1000;
  return {
    watchMs: clamp(input.watchMs, FOUR_HOURS),
    positionMs: clamp(input.positionMs, FOUR_HOURS),
    durationMs: clamp(input.durationMs, FOUR_HOURS),
  };
}

export async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
}
