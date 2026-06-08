import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Visita" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [channelName, setChannelName] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("channel_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.channel_name) setChannelName(data.channel_name);
      });
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("👋");
    navigate({ to: "/" });
  };

  if (!user) return null;

  return (
    <AppLayout>
      <section className="mx-auto max-w-2xl px-4 pt-8">
        <div className="rounded-3xl bg-card border border-border p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full gradient-brand flex items-center justify-center text-primary-foreground">
            <UserIcon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">
              {channelName || t("myChannel")}
            </h1>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-full p-2.5 bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label={t("signOut")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { label: t("views"), val: "0" },
            { label: t("likes"), val: "0" },
            { label: t("comments"), val: "0" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-4">
              <p className="font-display text-2xl font-bold">{s.val}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
