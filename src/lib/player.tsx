import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X, Play, Pause, Maximize2, Minimize2, UserPlus, Check, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCount } from "@/lib/format";

export interface PlayingVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  channel_name?: string | null;
  user_id?: string | null;
  views?: number | null;
}

interface PlayerCtx {
  current: PlayingVideo | null;
  play: (v: PlayingVideo) => void;
  stop: () => void;
  expanded: boolean;
  setExpanded: (e: boolean) => void;
  registerHost: (id: string, el: HTMLElement | null) => void;
}

const Ctx = createContext<PlayerCtx>({
  current: null, play: () => {}, stop: () => {}, expanded: false, setExpanded: () => {},
  registerHost: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PlayingVideo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);
  const hostMapRef = useRef<Map<string, HTMLElement>>(new Map());

  const registerHost = (id: string, el: HTMLElement | null) => {
    if (el) hostMapRef.current.set(id, el);
    else hostMapRef.current.delete(id);
    if (current && id === current.id) setHostEl(el ?? null);
  };

  useEffect(() => {
    if (!current) { setHostEl(null); return; }
    setHostEl(hostMapRef.current.get(current.id) ?? null);
  }, [current?.id]);

  return (
    <Ctx.Provider value={{
      current, expanded, setExpanded, registerHost,
      play: (v) => { setCurrent(v); setExpanded(false); },
      stop: () => { setCurrent(null); setExpanded(false); },
    }}>
      {children}
      <PersistentPlayer hostEl={hostEl} />
    </Ctx.Provider>
  );
}

export const usePlayer = () => useContext(Ctx);

/** Card-side hook: register a DOM node as the inline host for a given video id. */
export function useVideoHost(id: string | undefined, el: HTMLElement | null) {
  const { registerHost } = usePlayer();
  useEffect(() => {
    if (!id) return;
    registerHost(id, el);
    return () => registerHost(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, el]);
}

function PersistentPlayer({ hostEl }: { hostEl: HTMLElement | null }) {
  const { current, stop, expanded, setExpanded } = usePlayer();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [hostRect, setHostRect] = useState<DOMRectReadOnly | null>(null);

  // is host visible in viewport? throttled via rAF to avoid jank
  const [hostVisible, setHostVisible] = useState(false);
  useEffect(() => {
    if (!hostEl) { setHostVisible(false); setHostRect(null); return; }
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setHostRect(hostEl.getBoundingClientRect());
      });
    };
    schedule();
    const io = new IntersectionObserver(
      ([e]) => { setHostVisible(e.isIntersecting && e.intersectionRatio > 0.3); },
      { threshold: [0, 0.3, 0.6, 1] },
    );
    const ro = new ResizeObserver(schedule);
    io.observe(hostEl);
    ro.observe(hostEl);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { io.disconnect(); ro.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (raf) cancelAnimationFrame(raf); };
  }, [hostEl]);

  // mini drag/size
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [size, setSize] = useState({ w: 240, h: 135 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ d: number; w: number } | null>(null);

  // view tracking
  const watchedRef = useRef(0);
  const recordedRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onP = () => setPaused(v.paused);
    v.addEventListener("play", onP);
    v.addEventListener("pause", onP);
    return () => { v.removeEventListener("play", onP); v.removeEventListener("pause", onP); };
  }, [current?.id]);

  useEffect(() => { watchedRef.current = 0; lastTimeRef.current = 0; }, [current?.id]);

  useEffect(() => {
    const v = videoRef.current; if (!v || !current) return;
    const onTime = async () => {
      const t = v.currentTime;
      const dt = t - lastTimeRef.current;
      if (dt > 0 && dt < 1.5) watchedRef.current += dt;
      lastTimeRef.current = t;
      if (watchedRef.current >= 30 && user && current.id && !recordedRef.current.has(current.id)) {
        recordedRef.current.add(current.id);
        const { error } = await (supabase as any).from("video_views").insert({ user_id: user.id, video_id: current.id });
        if (error && (error as any).code !== "23505") recordedRef.current.delete(current.id);
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [current?.id, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPos({ x: window.innerWidth - 256, y: window.innerHeight - 240 });
  }, []);

  if (!current) return null;

  const inline = !!hostEl && !!hostRect && hostVisible && !expanded;

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  // mini-only drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (expanded || inline) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || expanded || inline) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - size.w - 8, dragRef.current.px + dx)),
      y: Math.max(8, Math.min(window.innerHeight - size.h - 80, dragRef.current.py + dy)),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onTouchStart = (e: React.TouchEvent) => {
    if (expanded || inline) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { d: Math.hypot(dx, dy), w: size.w };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (expanded || inline) return;
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

  const playerNode = (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={
        inline
          ? "fixed z-[55] bg-black overflow-hidden rounded-2xl"
          : expanded
            ? "fixed inset-0 z-[60] bg-black flex flex-col select-none"
            : "fixed z-[60] bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-primary/40 cursor-move touch-none select-none"
      }
      style={
        inline
          ? { left: hostRect.left, top: hostRect.top, width: hostRect.width, height: hostRect.height }
          : expanded
            ? undefined
            : { left: pos.x, top: pos.y, width: size.w, height: size.h + 36 }
      }
    >
      <div
        className={
          inline
            ? "absolute inset-0 bg-black"
            : expanded
              ? "flex-1 flex items-center justify-center bg-black relative"
              : "relative bg-black"
        }
        style={inline || expanded ? undefined : { height: size.h }}
      >
        <video
          ref={videoRef}
          src={current.video_url}
          poster={current.thumbnail_url ?? undefined}
          autoPlay
          playsInline
          preload="auto"
          controls={expanded || inline}
          className={
            inline
              ? "h-full w-full object-contain bg-black"
              : expanded
                ? "max-h-full max-w-full"
                : "h-full w-full object-contain bg-black pointer-events-none"
          }
        />

        {inline ? (
          <>
            <button
              data-no-drag
              onClick={stop}
              className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              data-no-drag
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center"
              aria-label="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </>
        ) : expanded ? (
          <>
            <button
              data-no-drag
              onClick={() => setExpanded(false)}
              className="absolute top-3 left-3 z-10 h-10 w-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white"
              aria-label="Minimize"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
            <button
              data-no-drag
              onClick={stop}
              className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <button data-no-drag onClick={stop} className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
            <button data-no-drag onClick={() => setExpanded(true)} className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center" aria-label="Expand">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              data-no-drag
              onClick={togglePlay}
              className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="h-4 w-4 ml-0.5 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            </button>
          </>
        )}
      </div>

      {expanded ? (
        <ChannelStrip video={current} />
      ) : !inline ? (
        <div className="px-2 py-1.5 bg-card border-t border-border/60">
          <span className="text-[11px] font-medium truncate block">{current.title}</span>
        </div>
      ) : null}
    </div>
  );

  return playerNode;
}

function ChannelStrip({ video }: { video: PlayingVideo }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const ownerId = video.user_id;
  const isSelf = !!(user && ownerId && user.id === ownerId);

  useEffect(() => {
    if (!user || !ownerId || isSelf) return;
    supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", ownerId).maybeSingle()
      .then(({ data }) => setFollowing(!!data));
  }, [user?.id, ownerId, isSelf]);

  useEffect(() => {
    supabase.from("videos").select("likes,views").eq("id", video.id).maybeSingle()
      .then(({ data }) => { if (data) { setLikeCount((data as any).likes ?? 0); setViewCount((data as any).views ?? 0); } });
    if (user) {
      (supabase as any).from("video_likes").select("id").eq("user_id", user.id).eq("video_id", video.id).maybeSingle()
        .then(({ data }: any) => setLiked(!!data));
    } else setLiked(false);
  }, [user?.id, video.id]);

  const toggleFollow = async () => {
    if (!user) { toast.error("Sign in to follow"); return; }
    if (!ownerId || isSelf) return;
    setBusy(true);
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", ownerId);
      setFollowing(false);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: ownerId });
      if (!error) setFollowing(true); else toast.error(error.message);
    }
    setBusy(false);
  };

  const toggleLike = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (liked) {
      setLiked(false); setLikeCount((c) => Math.max(0, c - 1));
      const { error } = await (supabase as any).from("video_likes").delete().eq("user_id", user.id).eq("video_id", video.id);
      if (error) { setLiked(true); setLikeCount((c) => c + 1); }
    } else {
      setLiked(true); setLikeCount((c) => c + 1);
      const { error } = await (supabase as any).from("video_likes").insert({ user_id: user.id, video_id: video.id });
      if (error && (error as any).code !== "23505") { setLiked(false); setLikeCount((c) => Math.max(0, c - 1)); }
    }
  };

  const initial = (video.channel_name ?? "V").slice(0, 1).toUpperCase();
  return (
    <div
      className="bg-card border-t border-border/60 px-4 py-3 flex items-center gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <Link to="/" className="h-11 w-11 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold shadow-lg shrink-0">{initial}</Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{video.channel_name ?? "Visita"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {formatCount(viewCount)} views · {formatCount(likeCount)} likes
        </p>
      </div>
      <button
        onClick={toggleLike}
        className={`rounded-full h-10 w-10 flex items-center justify-center transition shrink-0 ${liked ? "bg-primary/15 text-primary border border-primary/50" : "bg-secondary text-foreground border border-border"}`}
        aria-label="Like"
      >
        <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
      </button>
      {!isSelf && (
        <button
          onClick={toggleFollow}
          disabled={busy}
          className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition shrink-0 ${following ? "bg-secondary text-foreground border border-border" : "bg-primary text-primary-foreground hover:brightness-110"}`}
        >
          {following ? <><Check className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
        </button>
      )}
    </div>
  );
}
