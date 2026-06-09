import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X, Play, Pause, Maximize2, Minimize2, UserPlus, Check } from "lucide-react";
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

function PersistentPlayer() {
  const { current, stop, expanded, setExpanded } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  // Mini player position & size
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [size, setSize] = useState({ w: 240, h: 135 });

  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ d: number; w: number } | null>(null);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onP = () => setPaused(v.paused);
    v.addEventListener("play", onP);
    v.addEventListener("pause", onP);
    return () => { v.removeEventListener("play", onP); v.removeEventListener("pause", onP); };
  }, [current?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPos({ x: window.innerWidth - 256, y: window.innerHeight - 240 });
  }, []);

  if (!current) return null;

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  // ----- gesture handlers (mini only) -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (expanded) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || expanded) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - size.w - 8, dragRef.current.px + dx)),
      y: Math.max(8, Math.min(window.innerHeight - size.h - 80, dragRef.current.py + dy)),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (expanded) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { d: Math.hypot(dx, dy), w: size.w };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (expanded) return;
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

  // Style: expanded fills viewport; mini floats
  const containerStyle: React.CSSProperties = expanded
    ? { left: 0, top: 0, width: "100vw", height: "100vh" }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h + 36 };

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`fixed z-[60] bg-black select-none ${
          expanded
            ? "flex flex-col"
            : "rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-primary/40 cursor-move touch-none"
        }`}
        style={containerStyle}
      >
        <div className={expanded ? "flex-1 flex items-center justify-center bg-black relative" : "relative bg-black"} style={expanded ? undefined : { height: size.h }}>
          <video
            ref={videoRef}
            src={current.video_url}
            poster={current.thumbnail_url ?? undefined}
            autoPlay
            playsInline
            preload="auto"
            controls={expanded}
            className={expanded ? "max-h-full max-w-full" : "h-full w-full object-contain bg-black pointer-events-none"}
          />

          {/* Top-left close (mini) / minimize (expanded) */}
          {expanded ? (
            <button
              data-no-drag
              onClick={() => setExpanded(false)}
              className="absolute top-3 left-3 z-10 h-10 w-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white"
              aria-label="Minimize"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          ) : (
            <button
              data-no-drag
              onClick={stop}
              className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Top-right expand (mini) / close (expanded) */}
          {expanded ? (
            <button
              data-no-drag
              onClick={stop}
              className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              data-no-drag
              onClick={() => setExpanded(true)}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
              aria-label="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Play/Pause bottom-right (mini only — expanded uses native controls) */}
          {!expanded && (
            <button
              data-no-drag
              onClick={togglePlay}
              className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="h-4 w-4 ml-0.5 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            </button>
          )}
        </div>

        {expanded ? (
          <ChannelStrip video={current} />
        ) : (
          <div className="px-2 py-1.5 bg-card border-t border-border/60">
            <span className="text-[11px] font-medium truncate block">{current.title}</span>
          </div>
        )}
      </div>
    </>
  );
}

function ChannelStrip({ video }: { video: PlayingVideo }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ownerId = video.user_id;
  const isSelf = !!(user && ownerId && user.id === ownerId);

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
      else toast.error(error.message);
    }
    setBusy(false);
  };

  const initial = (video.channel_name ?? "V").slice(0, 1).toUpperCase();
  return (
    <div className="bg-card border-t border-border/60 px-4 py-3 flex items-center gap-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <Link to="/" className="h-11 w-11 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold shadow-lg shrink-0">
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
          className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition shrink-0 ${
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
