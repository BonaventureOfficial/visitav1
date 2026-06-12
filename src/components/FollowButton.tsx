import { useEffect, useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCount } from "@/lib/format";

export function FollowButton({
  ownerId,
  size = "sm",
  showCount = true,
}: {
  ownerId: string | null | undefined;
  size?: "sm" | "md";
  showCount?: boolean;
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const isSelf = !!(user && ownerId && user.id === ownerId);

  useEffect(() => {
    if (!ownerId) return;
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", ownerId)
      .then(({ count }) => setCount(count ?? 0));
    if (user && !isSelf) {
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", ownerId)
        .maybeSingle()
        .then(({ data }) => setFollowing(!!data));
    } else setFollowing(false);
  }, [user?.id, ownerId, isSelf]);

  if (!ownerId || isSelf) {
    return showCount ? (
      <span className="text-[11px] text-muted-foreground">{formatCount(count)} followers</span>
    ) : null;
  }

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to follow"); return; }
    setBusy(true);
    if (following) {
      setFollowing(false); setCount((c) => Math.max(0, c - 1));
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", ownerId);
      if (error) { setFollowing(true); setCount((c) => c + 1); }
    } else {
      setFollowing(true); setCount((c) => c + 1);
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: ownerId });
      if (error && (error as any).code !== "23505") { setFollowing(false); setCount((c) => Math.max(0, c - 1)); }
    }
    setBusy(false);
  };

  const cls =
    size === "md"
      ? "px-4 py-2 text-sm gap-1.5"
      : "px-3 py-1 text-xs gap-1";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-full font-semibold flex items-center transition shrink-0 ${cls} ${following ? "bg-secondary text-foreground border border-border" : "bg-primary text-primary-foreground hover:brightness-110"}`}
      >
        {following ? <><Check className="h-3.5 w-3.5" /> Suivi</> : <><UserPlus className="h-3.5 w-3.5" /> Suivre</>}
      </button>
      {showCount && <span className="text-[11px] text-muted-foreground">{formatCount(count)}</span>}
    </div>
  );
}
