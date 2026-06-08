import v1 from "@/assets/video1.jpg";
import v2 from "@/assets/video2.jpg";
import v3 from "@/assets/video3.jpg";
import v4 from "@/assets/video4.jpg";

export type Category = "emission" | "podcast" | "documentary";

export interface MockVideo {
  id: string;
  title: { en: string; fr: string };
  channel: string;
  category: Category;
  thumbnail: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  ago: { en: string; fr: string };
}

export const mockVideos: MockVideo[] = [
  {
    id: "1",
    title: { en: "Sahel — Land of Light", fr: "Sahel — Terre de Lumière" },
    channel: "Visita Originals",
    category: "documentary",
    thumbnail: v1,
    duration: "42:18",
    views: 1_284_300,
    likes: 86_400,
    comments: 4_210,
    reposts: 1_980,
    shares: 5_440,
    ago: { en: "2 days ago", fr: "il y a 2 jours" },
  },
  {
    id: "2",
    title: { en: "Late Night Frequencies #14", fr: "Fréquences Nocturnes #14" },
    channel: "Studio Neon",
    category: "podcast",
    thumbnail: v2,
    duration: "1:08:42",
    views: 312_750,
    likes: 22_310,
    comments: 1_842,
    reposts: 612,
    shares: 1_120,
    ago: { en: "5 hours ago", fr: "il y a 5 heures" },
  },
  {
    id: "3",
    title: { en: "Prime Time Talk — Episode 9", fr: "Prime Time Talk — Épisode 9" },
    channel: "Visita TV",
    category: "emission",
    thumbnail: v3,
    duration: "54:02",
    views: 768_900,
    likes: 48_200,
    comments: 6_140,
    reposts: 2_310,
    shares: 3_870,
    ago: { en: "1 week ago", fr: "il y a 1 semaine" },
  },
  {
    id: "4",
    title: { en: "Neon Cities — After Dark", fr: "Néons — Après la nuit" },
    channel: "Urban Lens",
    category: "documentary",
    thumbnail: v4,
    duration: "27:55",
    views: 451_200,
    likes: 31_800,
    comments: 2_980,
    reposts: 1_124,
    shares: 2_010,
    ago: { en: "3 days ago", fr: "il y a 3 jours" },
  },
  {
    id: "5",
    title: { en: "Voices of the Continent", fr: "Voix du Continent" },
    channel: "Visita Originals",
    category: "podcast",
    thumbnail: v2,
    duration: "48:11",
    views: 198_440,
    likes: 14_200,
    comments: 920,
    reposts: 480,
    shares: 660,
    ago: { en: "Yesterday", fr: "Hier" },
  },
  {
    id: "6",
    title: { en: "Morning Show Highlights", fr: "Le Meilleur du Matin" },
    channel: "Visita TV",
    category: "emission",
    thumbnail: v3,
    duration: "12:34",
    views: 89_300,
    likes: 6_410,
    comments: 412,
    reposts: 188,
    shares: 320,
    ago: { en: "6 hours ago", fr: "il y a 6 heures" },
  },
];

export function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
