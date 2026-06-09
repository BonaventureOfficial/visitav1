import { CATEGORIES, useI18n } from "@/lib/i18n";

const labelKey = (id: string) => {
  switch (id) {
    case "music": return "music";
    case "podcast": return "podcasts";
    case "documentary": return "documentaries";
    case "news": return "news";
    case "comedy": return "comedy";
    case "games": return "games";
    case "sports": return "sports";
    case "kids": return "kids";
    case "lifestyle": return "lifestyle";
    case "tech": return "tech";
    case "emission": return "emissions";
    default: return "all";
  }
};

export function CategoryMarquee({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const items = [...CATEGORIES, ...CATEGORIES]; // duplicate for seamless loop

  return (
    <div className="relative overflow-hidden mask-fade py-1">
      <div className="marquee-track flex gap-3 w-max">
        {items.map((c, i) => {
          const isActive = active === c.id;
          return (
            <button
              key={`${c.id}-${i}`}
              onClick={() => onSelect(c.id)}
              className={`shrink-0 flex items-center gap-2 rounded-2xl px-5 py-3 border transition-all panel-glow ${
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 bg-card text-foreground/90 hover:border-primary/40"
              }`}
              style={{ animationDelay: `${(i % CATEGORIES.length) * 0.4}s` }}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              <span className="text-sm font-semibold whitespace-nowrap">
                {t(labelKey(c.id) as never)}
              </span>
            </button>
          );
        })}
      </div>
      <style>{`
        .mask-fade {
          -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
                  mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
        }
      `}</style>
    </div>
  );
}
