import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Visita" }] }),
  component: AuthPage,
});

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [channelName, setChannelName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate({ to: "/profile" });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!passwordRegex.test(password)) {
          toast.error(t("passwordHint"));
          setLoading(false);
          return;
        }
        if (!channelName.trim()) {
          toast.error(t("channelName"));
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { channel_name: channelName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success(t("verifyEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/profile" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <section className="mx-auto max-w-md px-4 pt-8">
        <div className="rounded-3xl bg-card border border-border p-6 md:p-8">
          <h1 className="text-2xl font-display font-bold">
            {mode === "signup" ? t("signUp") : t("signIn")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field
                label={t("channelName")}
                value={channelName}
                onChange={setChannelName}
                type="text"
                required
                autoComplete="nickname"
              />
            )}
            <Field
              label={t("email")}
              value={email}
              onChange={setEmail}
              type="email"
              required
              autoComplete="email"
            />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t("password")}
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-xl bg-input border border-border px-4 py-3 pr-12 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? t("hidePassword") : t("showPassword")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t("passwordHint")}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl gradient-brand text-primary-foreground font-semibold py-3 text-sm shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? t("createAccount") : t("signIn")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signup" ? t("alreadyAccount") : t("noAccount")}
          </button>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← {t("home")}
            </Link>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function Field({
  label, value, onChange, type, required, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
