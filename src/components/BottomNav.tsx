import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Plus, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: Array<{ to: "/" | "/upload" | "/profile"; label: string; icon: typeof Home; primary?: boolean }> = [
    { to: "/", label: t("home"), icon: Home },
    { to: "/upload", label: t("upload"), icon: Plus, primary: true },
    { to: "/profile", label: t("profile"), icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 glass border-t border-border/40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto max-w-7xl grid grid-cols-3 h-16">
        {items.map(({ to, label, icon: Icon, primary }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex">
              <Link
                to={to}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-xs"
                aria-label={label}
              >
                {primary ? (
                  <span className={`flex items-center justify-center h-11 w-11 rounded-full gradient-brand shadow-lg shadow-primary/30 -mt-3 ${active ? "scale-105" : ""}`}>
                    <Icon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <span className={`${active ? "text-foreground" : "text-muted-foreground"} ${primary ? "mt-0" : ""}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
