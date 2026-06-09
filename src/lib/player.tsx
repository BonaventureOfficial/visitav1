import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X, Play, Pause, Maximize2, UserPlus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface PlayingVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  channel_name?: string | null;
  user_id?: string | null;
}

interface PlayerCtx {
  current: PlayingVideo | null;
  play: (v: PlayingVideo) => void;
  stop: () => void;
  expanded: boolean;
  setExpanded: (e: boolean) => void;
}

const Ctx = createContext<PlayerCtx>({
  current: null, play: () => {}, stop: () => {}, expanded: false, setExpanded: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PlayingVideo | null>(null);
  const [expanded, setExpanded] = useState(false);
  return (
    <Ctx.Provider value={{
      current, expanded, setExpanded,
      play: (v) => { setCurrent(v); setExpanded(true); },
      stop: () => { setCurrent(null); setExpanded(false); },
    }}>
      {children}
      <PersistentPlayer />
    </Ctx.Provider>
  );
}

export const usePlayer = () => useContext(Ctx);

// ---------- Persistent floating player ----------
function PersistentPlayer() {
  const { current, stop, expanded, setExpanded } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // mini player position & size (persisted)
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [size, setSize] = useState({ w: 240, h: 135 });

  // gesture state
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ d: number; w: number; h: number } | null>(null);

  // Keep playback when switching pages
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onP = () => setPaused(v.paused);
    v.addEventListener("play", onP);
    v.addEventListener("pause", onP);
    return () => { v.removeEventListener("play", onP); v.removeEventListener("pause", onP); };
  }, [current?.id]);

  // Position mini on bottom-right by default
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPos({ x: window.innerWidth - 256, y: window.innerHeight - 240 });
  }, []);

  if (!current) return null;

  // === Expanded full-screen overlay ===
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col" role="dialog">
        <button
          onClick={() => setExpanded(false)}
          className="absolute top-3 left-3 z-10 h-10 w-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white"
          aria-label="Minimize"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={current.video_url}
            autoPlay
            controls
            playsInline
            preload="auto"
            className="max-h-full max-w-full"
          />
        </div>
        <ChannelStrip video={current} />
      </div>
    );
  }

  // === Floating mini player (draggable + pinch-resizable) ===
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - size.w - 8, dragRef.current.px + dx)),
      y: Math.max(8, Math.min(window.innerHeight - size.h - 8, dragRef.current.py + dy)),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { d: Math.hypot(dx, dy), w: size.w, h: size.h };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const nd = Math.hypot(dx, dy);
      const scale = nd / pinchRef.current.d;
      const w = Math.max(160, Math.min(window.innerWidth - 16, pinchRef.current.w * scale));
      setSize({ w, h: w * (9 / 16) });
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="fixed z-[55] rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/80 border border-primary/40 cursor-move select-none touch-none"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h + 36 }}
    >
      <div className="relative bg-black" style={{ height: size.h }}>
        <video
          ref={videoRef}
          src={current.video_url}
          autoPlay
          playsInline
          preload="auto"
          className="h-full w-full object-contain bg-black pointer-events-none"
        />
        <button
          data-no-drag
          onClick={togglePlay}
          className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="h-4 w-4 ml-0.5 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
        </button>
        <button
          data-no-drag
          onClick={() => setExpanded(true)}
          className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
          aria-label="Expand"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          data-no-drag
          onClick={stop}
          className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between bg-card border-t border-border/60">
        <span className="text-[11px] font-medium truncate flex-1">{current.title}</span>
      </div>
    </div>
  );
}

// ---------- Channel strip (avatar + Follow) ----------
function ChannelStrip({ video }: { video: PlayingVideo }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ownerId = video.user_id;
  const isSelf = user && ownerId && user.id === ownerId;

  useEffect(() => {
    if (!user || !ownerId || isSelf) return;
    supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", ownerId).maybeSingle()
      .then(({ data }) => setFollowing(!!data));
  }, [user?.id, ownerId, isSelf]);

  const toggle = async () => {
    if (!user) { toast.error("Sign in to follow"); return; }
    if (!ownerId || isSelf) return;
    setBusy(true);
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", ownerId);
      setFollowing(false);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: ownerId });
      if (!error) setFollowing(true);
    }
    setBusy(false);
  };

  const initial = (video.channel_name ?? "V").slice(0, 1).toUpperCase();
  return (
    <div className="bg-card border-t border-border/60 px-4 py-3 flex items-center gap-3">
      <Link
        to="/"
        className="h-11 w-11 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold shadow-lg"
      >
        {initial}
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{video.channel_name ?? "Visita"}</p>
        <p className="text-xs text-muted-foreground truncate">{video.title}</p>
      </div>
      {!isSelf && (
        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition ${
            following
              ? "bg-secondary text-foreground border border-border"
              : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          {following ? <><Check className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
        </button>
      )}
    </div>
  );
}
