import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Sun, Moon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ChannelSearch } from "@/components/ChannelSearch";
import { useIsAdmin } from "@/lib/use-admin";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/lib/appearance";

export function Header() {
  const { lang, setLang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showLang = pathname === "/";
  const isAdmin = useIsAdmin();
  const { appearance, toggle } = useAppearance();

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-border/40">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 h-14 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link to="/" className="flex items-center gap-2 group shrink-0" aria-label="Visita home">
          <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-display font-bold text-lg tracking-tight hidden xs:inline sm:inline">
            Visi<span className="text-primary">ta</span>
          </span>
        </Link>
        <div className="min-w-0">{pathname === "/" && <ChannelSearch />}</div>

        <div className="flex shrink-0 items-center gap-1">

        {isAdmin && (
          <Link
            to="/admin"
            className="shrink-0 rounded-full p-1.5 bg-primary/15 text-primary hover:bg-primary/25 transition"
            aria-label="Console de contrôle absolu"
            title="Console de contrôle absolu"
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        )}

        <Button type="button" variant="ghost" size="icon" onClick={toggle}
          aria-label={appearance === "night" ? "Jour" : "Nuit"}
          title={appearance === "night" ? "Jour" : "Nuit"} className="shrink-0 h-8 w-8 text-primary">
          {appearance === "night" ? <Sun /> : <Moon />}
        </Button>
        {showLang && (
          <div className="flex shrink-0 items-center rounded-full bg-secondary p-0.5 text-xs font-medium">
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => setLang("en")}
              className={`h-7 px-2 rounded-full transition ${lang === "en" ? "bg-primary text-primary-foreground hover:bg-primary" : "text-muted-foreground"}`}
              aria-pressed={lang === "en"}
            >
              ENG
            </Button>
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => setLang("fr")}
              className={`h-7 px-2 rounded-full transition ${lang === "fr" ? "bg-primary text-primary-foreground hover:bg-primary" : "text-muted-foreground"}`}
              aria-pressed={lang === "fr"}
            >
              FR
            </Button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
