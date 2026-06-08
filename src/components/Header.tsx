import { Link, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/logo.png";

export function Header() {
  const { lang, setLang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showLang = pathname === "/";

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-border/40">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" aria-label="Visita home">
          <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-display font-bold text-lg tracking-tight">
            Visi<span className="text-primary">ta</span>
          </span>
        </Link>
        {showLang && (
          <div className="flex items-center gap-1 rounded-full bg-secondary p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full transition ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={lang === "en"}
            >
              ENG
            </button>
            <button
              type="button"
              onClick={() => setLang("fr")}
              className={`px-3 py-1 rounded-full transition ${lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={lang === "fr"}
            >
              FR
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
