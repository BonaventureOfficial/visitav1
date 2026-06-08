import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "New video — Visita" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"emission" | "podcast" | "documentary">("emission");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    return (
      <AppLayout>
        <section className="mx-auto max-w-md px-4 pt-16 text-center">
          <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">{t("signInToUpload")}</p>
          <Link
            to="/auth"
            className="inline-flex mt-6 rounded-xl gradient-brand text-primary-foreground font-semibold px-6 py-3 text-sm"
          >
            {t("signIn")}
          </Link>
        </section>
      </AppLayout>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("videos").insert({
      user_id: user.id,
      title,
      description,
      category,
      channel_name: user.email?.split("@")[0],
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("✓");
    navigate({ to: "/" });
  };

  return (
    <AppLayout>
      <section className="mx-auto max-w-xl px-4 pt-8">
        <h1 className="font-display text-2xl font-bold">{t("uploadTitle")}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("title")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("category")}</label>
            <div className="grid grid-cols-3 gap-2">
              {(["emission", "podcast", "documentary"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border py-2.5 text-xs font-medium capitalize ${
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl gradient-brand text-primary-foreground font-semibold py-3 text-sm shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("publish")}
          </button>
        </form>
      </section>
    </AppLayout>
  );
}
