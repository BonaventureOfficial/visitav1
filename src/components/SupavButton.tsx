import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { formatCount } from "@/lib/format";
import { toast } from "sonner";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function utcDayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface Props {
  videoId: string;
  initialCount: number;
}

export function SupavButton({ videoId, initialCount }: Props) {
  const { user } = useAuth();
  const { watched } = usePlayer();
  const [count, setCount] = useState(initialCount);
  const [usedToday, setUsedToday] = useState<boolean | null>(null);
  const [thisVideo, setThisVideo] = useState(false);
  const [busy, setBusy] = useState(false);

  const seconds = watched[videoId] ?? 0;
  const eligible = seconds >= 60;

  useEffect(() => {
    if (!user) { setUsedToday(false); setThisVideo(false); return; }
    const today = utcDayKey();
    (supabase as any).from("video_supavs")
      .select("video_id").eq("user_id", user.id).eq("day_key", today).maybeSingle()
      .then(({ data }: any) => {
        setUsedToday(!!data);
        setThisVideo(data?.video_id === videoId);
      });
  }, [user?.id, videoId]);

  const click = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to give a SupaV"); return; }
    if (usedToday) { toast.info("You already gave your SupaV today. Come back in 24h."); return; }
    if (!eligible) { toast.info(`Watch at least 60s to unlock SupaV (${Math.floor(seconds)}s)`); return; }
    setBusy(true);
    const res = await giveSupav({ data: { videoId } }).catch(() => ({ ok: false, reason: "network" }));
    setBusy(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        already_today: "You already gave your SupaV today.",
        not_enough_watch: "Watch at least 60s (validated server-side) to unlock SupaV.",
        self: "You cannot SupaV your own video.",
        account_too_new: "Your account is too new to give a SupaV.",
        auth: "Sign in to give a SupaV",
      };
      const reason = (res as { reason?: string }).reason ?? "";
      if (reason === "already_today") setUsedToday(true);
      toast.info(map[reason] ?? "SupaV unavailable right now.");
      return;
    }
    setCount((c) => c + 1);
    setUsedToday(true);
    setThisVideo(true);
    toast.success("⚡ SupaV boost sent for 24h!");
  };


  const disabled = busy || usedToday === true || !eligible;
  const active = thisVideo;

  return (
    <button
      onClick={click}
      disabled={busy}
      title={eligible ? (usedToday ? "SupaV used today" : "Give your SupaV boost") : `Watch 60s to unlock (${Math.floor(seconds)}s)`}
      className={`flex items-center gap-1 transition ${
        active
          ? "text-primary"
          : disabled
            ? "text-muted-foreground/50"
            : "text-primary/90 hover:text-primary hover:drop-shadow-[0_0_6px_hsl(var(--primary))]"
      }`}
      aria-label="SupaV"
    >
      <Zap className={`h-4 w-4 ${active ? "fill-current" : ""} ${eligible && !usedToday ? "animate-pulse" : ""}`} />
      {formatCount(count)}
    </button>
  );
}
