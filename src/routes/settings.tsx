import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Settings as SettingsIcon, ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { setMyAvatar } from "@/lib/avatar-store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Visita" },
      { name: "description", content: "Manage your Visita account settings and sign out securely." },
      { property: "og:title", content: "Settings — Visita" },
      { property: "og:description", content: "Manage your Visita account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMyAvatar(null);
    toast.success("👋");
    navigate({ to: "/", search: {} });
  };

  if (!user) return null;

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl px-4 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <Link to="/profile" className="rounded-full p-2 bg-secondary text-muted-foreground hover:text-foreground" aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" /> Settings
          </h1>
        </div>

        <div className="rounded-2xl bg-card border border-border divide-y divide-border">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Account</p>
            <p className="text-sm mt-1">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-4 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition rounded-b-2xl"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        <div className="h-6" />
      </section>
    </AppLayout>
  );
}
