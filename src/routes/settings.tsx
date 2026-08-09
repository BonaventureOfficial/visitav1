import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  ChevronLeft,
  IdCard,
  Check,
  Loader2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  HeartCrack,
  LogOut,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { setMyAvatar } from "@/lib/avatar-store";
import { deleteMyAccount } from "@/lib/account.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Visita" },
      { name: "description", content: "Manage your Visita member identity, email, password and account." },
      { property: "og:title", content: "Settings — Visita" },
      { property: "og:description", content: "Manage your Visita member identity and account security." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

type IdentityKey = "full_name" | "nationality" | "birth_place" | "birth_date" | "gender";

const FIELDS: Array<{ key: IdentityKey; label: string; type: "text" | "dob" | "select"; options?: string[] }> = [
  { key: "full_name", label: "Nom et Prénom", type: "text" },
  { key: "nationality", label: "Nationalité", type: "text" },
  { key: "birth_place", label: "Lieu de Naissance", type: "text" },
  { key: "birth_date", label: "Date de naissance (Mois/Jour/Année)", type: "dob" },
  { key: "gender", label: "Genre (Sexe)", type: "select", options: ["Homme", "Femme", "Autre"] },
];

/** "1990-04-27" -> "04/27/1990" */
function isoToMdy(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

/** "04/27/1990" -> "1990-04-27" (null si invalide) */
function mdyToIso(v: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > new Date().getFullYear()) return null;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() + 1 !== month) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Masque de saisie manuelle MM/JJ/AAAA */
function maskMdy(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}


function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [identity, setIdentity] = useState<Record<IdentityKey, string>>({
    full_name: "",
    nationality: "",
    birth_place: "",
    birth_date: "",
    gender: "",
  });
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<IdentityKey | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("member_identity")
      .select("full_name,nationality,birth_place,birth_date,gender")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const next: Record<IdentityKey, string> = {
          full_name: data.full_name ?? "",
          nationality: data.nationality ?? "",
          birth_place: data.birth_place ?? "",
          birth_date: data.birth_date ? isoToMdy(data.birth_date) : "",
          gender: data.gender ?? "",
        };
        setIdentity(next);
        const marks: Record<string, boolean> = {};
        (Object.keys(next) as IdentityKey[]).forEach((k) => {
          if (next[k]) marks[k] = true;
        });
        setSaved(marks);
      });
  }, [user]);

  const confirmField = async (key: IdentityKey) => {
    if (!user) return;
    const raw = identity[key].trim();
    if (!raw) {
      toast.error("Ce champ est obligatoire");
      return;
    }
    let value = raw;
    if (key === "birth_date") {
      const iso = mdyToIso(raw);
      if (!iso) {
        toast.error("Format attendu : Mois/Jour/Année (ex : 04/27/1990)");
        return;
      }
      value = iso;
    }
    setSavingKey(key);
    const { error } = await supabase
      .from("member_identity")
      .upsert({ user_id: user.id, [key]: value } as never, { onConflict: "user_id" });
    setSavingKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSaved((s) => ({ ...s, [key]: true }));
    toast.success("Confirmé ✓");
  };


  const signOut = async () => {
    await supabase.auth.signOut();
    setMyAvatar(null);
    toast.success("👋");
    navigate({ to: "/", search: {} });
  };

  if (!user) return null;

  const completed = FIELDS.filter((f) => saved[f.key]).length;

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl px-4 pt-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            className="rounded-full p-2 bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" /> Paramètres
          </h1>
        </div>

        {/* Identité du membre */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" /> Identité du membre
            </p>
            <span className="text-[11px] text-muted-foreground">{completed}/5</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Ces informations sont requises pour générer bientôt votre carte numérique unique de membre. Confirmez chaque
            champ un par un. Elles restent privées et sécurisées.
          </p>

          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`f-${f.key}`}>
                  {f.label} <span className="text-primary">*</span>
                </label>
                <div className="mt-1 flex items-center gap-2">
                  {f.type === "select" ? (
                    <select
                      id={`f-${f.key}`}
                      value={identity[f.key]}
                      onChange={(e) => {
                        setIdentity((s) => ({ ...s, [f.key]: e.target.value }));
                        setSaved((s) => ({ ...s, [f.key]: false }));
                      }}
                      className="flex-1 h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      type="text"
                      inputMode={f.type === "dob" ? "numeric" : "text"}
                      placeholder={f.type === "dob" ? "MM/JJ/AAAA" : undefined}
                      value={identity[f.key]}
                      maxLength={f.type === "dob" ? 10 : 120}
                      onChange={(e) => {
                        const val = f.type === "dob" ? maskMdy(e.target.value) : e.target.value;
                        setIdentity((s) => ({ ...s, [f.key]: val }));
                        setSaved((s) => ({ ...s, [f.key]: false }));
                      }}
                      className="flex-1 h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary"
                    />

                  )}
                  <button
                    type="button"
                    onClick={() => confirmField(f.key)}
                    disabled={savingKey === f.key}
                    aria-label={`Confirmer ${f.label}`}
                    className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition ${
                      saved[f.key] ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {savingKey === f.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ChangeEmailCard currentEmail={user.email ?? ""} />
        <ChangePasswordCard email={user.email ?? ""} />
        <DangerZone email={user.email ?? ""} />

        <div className="rounded-2xl bg-card border border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
        <div className="h-8" />
      </section>
    </AppLayout>
  );
}

function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [oldEmail, setOldEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldEmail.trim().toLowerCase() !== currentEmail.toLowerCase()) {
      toast.error("Ancien email incorrect");
      return;
    }
    if (newEmail.trim() !== confirmEmail.trim()) {
      toast.error("Les nouveaux emails ne correspondent pas");
      return;
    }
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    if (authErr) {
      setBusy(false);
      toast.error("Mot de passe invalide");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Vérifiez votre nouvelle boîte email pour confirmer le changement");
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" /> Changer l'email
      </p>
      <input
        type="email"
        required
        value={oldEmail}
        onChange={(e) => setOldEmail(e.target.value)}
        placeholder="Ancien email"
        className="w-full h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary"
      />
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe actuel"
          className="w-full h-10 rounded-xl bg-secondary border border-border px-3 pr-10 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <input
        type="email"
        required
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="Nouvel email"
        className="w-full h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary"
      />
      <input
        type="email"
        required
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        placeholder="Confirmer le nouvel email"
        className="w-full h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary"
      />
      <button
        disabled={busy}
        className="w-full h-10 rounded-xl gradient-brand text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mettre à jour l'email
      </button>
    </form>
  );
}

function ChangePasswordCard({ email }: { email: string }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRegex.test(newPassword)) {
      toast.error("8+ caractères avec majuscule, minuscule, chiffre et symbole");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (authErr) {
      setBusy(false);
      toast.error("Ancien mot de passe invalide");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Mot de passe mis à jour");
  };

  const field = (value: string, set: (v: string) => void, placeholder: string) => (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-xl bg-secondary border border-border px-3 pr-10 text-sm outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" /> Changer le mot de passe
      </p>
      {field(oldPassword, setOldPassword, "Ancien mot de passe")}
      {field(newPassword, setNewPassword, "Nouveau mot de passe")}
      {field(confirmPassword, setConfirmPassword, "Confirmer le nouveau mot de passe")}
      <button
        disabled={busy}
        className="w-full h-10 rounded-xl gradient-brand text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mettre à jour le mot de passe
      </button>
    </form>
  );
}

function DangerZone({ email }: { email: string }) {
  const navigate = useNavigate();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"form" | "farewell">("form");
  const [busy, setBusy] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error("Email incorrect");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Mot de passe invalide");
      return;
    }
    setStep("farewell");
  };

  const destroy = async () => {
    setBusy(true);
    try {
      await deleteMyAccount({ data: undefined as never });
      await supabase.auth.signOut();
      setMyAvatar(null);
      toast.success("Votre compte a été supprimé définitivement.");
      navigate({ to: "/", search: {} });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-red-500/30 p-4 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2 text-red-400">
        <HeartCrack className="h-4 w-4" /> Quitter la communauté
      </p>
      <p className="text-[11px] text-muted-foreground">
        La suppression du compte est définitive : vidéos, abonnés et historique seront perdus.
      </p>

      {step === "form" ? (
        <form onSubmit={verify} className="space-y-3">
          <input
            type="email"
            required
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Votre email"
            className="w-full h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-red-400"
          />
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="w-full h-10 rounded-xl bg-secondary border border-border px-3 pr-10 text-sm outline-none focus:border-red-400"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            disabled={busy}
            className="w-full h-10 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-500/25 transition disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continuer
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">
            La communauté Visita regrette profondément votre départ. Vous étiez l'un de nos agents de changement, et
            votre voix comptait ici. Les portes vous resteront toujours ouvertes.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("form")}
              className="flex-1 h-10 rounded-xl bg-secondary text-sm font-semibold"
            >
              Rester
            </button>
            <button
              onClick={destroy}
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer mon départ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
