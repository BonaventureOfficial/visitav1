import { Eye, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { type MockVideo, formatCount } from "@/lib/mock-videos";
import { useI18n } from "@/lib/i18n";

export function VideoCard({ v }: { v: MockVideo }) {
  const { lang } = useI18n();
  return (
    <article className="group rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-primary/40 transition-all">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <img
          src={v.thumbnail}
          alt=""
          loading="lazy"
          width={1024}
          height={576}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span className="absolute bottom-2 right-2 text-[11px] font-medium bg-black/80 text-white px-1.5 py-0.5 rounded">
          {v.duration}
        </span>
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-semibold bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full">
          {v.category}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2">
          {v.title[lang]}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {v.channel} • {v.ago[lang]}
        </p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <Stat icon={Eye} n={v.views} />
          <Stat icon={Heart} n={v.likes} />
          <Stat icon={MessageCircle} n={v.comments} />
          <Stat icon={Repeat2} n={v.reposts} />
          <Stat icon={Share2} n={v.shares} />
        </div>
      </div>
    </article>
  );
}

function Stat({ icon: Icon, n }: { icon: typeof Eye; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" />
      {formatCount(n)}
    </span>
  );
}
