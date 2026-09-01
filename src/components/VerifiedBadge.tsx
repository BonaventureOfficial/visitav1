import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "platinum" | "gold" | "blue";

const STYLES: Record<Tier, { className: string; label: string }> = {
  platinum: { className: "text-slate-200 drop-shadow-[0_0_6px_rgba(226,232,240,0.75)]", label: "Vérifié Platinum" },
  gold: { className: "text-primary drop-shadow-[0_0_6px_rgba(255,138,0,0.7)]", label: "Vérifié Gold" },
  blue: { className: "text-sky-400", label: "Vérifié" },
};

export function VerifiedBadge({ tier, className = "h-4 w-4" }: { tier: Tier; className?: string }) {
  const s = STYLES[tier];
  return <BadgeCheck aria-label={s.label} title={s.label} className={`${className} ${s.className}`} />;
}

/** Récupère le niveau de vérification d'un utilisateur (public). */
export function useVerification(userId: string | null | undefined) {
  const [tier, setTier] = useState<Tier | null>(null);
  useEffect(() => {
    if (!userId) {
      setTier(null);
      return;
    }
    let alive = true;
    supabase
      .from("profile_verifications")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setTier((data?.tier as Tier | undefined) ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return tier;
}
