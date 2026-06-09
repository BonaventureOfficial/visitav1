import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "fr";

const dict = {
  en: {
    discover: "Discover", trending: "Trending now",
    emissions: "Shows", podcasts: "Podcasts", documentaries: "Documentaries",
    music: "Music", comedy: "Comedy", games: "Games", news: "News", sports: "Sports", kids: "Kids", lifestyle: "Lifestyle", tech: "Tech",
    all: "All", home: "Home", upload: "New Video", profile: "Profile",
    signIn: "Sign in", signUp: "Create account", email: "Email", channelName: "Channel name",
    password: "Password", showPassword: "Show password", hidePassword: "Hide password",
    createAccount: "Create account", alreadyAccount: "Already have an account? Sign in",
    noAccount: "No account? Create one", signOut: "Sign out",
    verifyEmail: "Check your inbox to verify your email.",
    passwordHint: "At least 8 characters, with uppercase, lowercase, number and symbol.",
    views: "views", likes: "likes", comments: "comments", reposts: "reposts", shares: "shares",
    uploadTitle: "Upload a new video", title: "Title", description: "Description",
    category: "Category", publish: "Publish",
    welcome: "Welcome to Visita", tagline: "Shows, podcasts and documentaries.",
    myChannel: "My channel", signInToUpload: "Sign in to upload your videos.",
    error: "Something went wrong", noVideosYet: "No videos yet. Be the first to publish.",
    uploadFirst: "Upload the first video",
    videoFile: "Video file", dropVideo: "Tap to select a video",
    dropVideoHint: "HD quality preserved · MP4, MOV, WEBM",
    titlePlaceholder: "Give your video a title",
    chooseThumb: "Choose a thumbnail", uploadCustomThumb: "Upload from device",
    titleRequired: "Title is required", videoRequired: "Please select a video",
    thumbRequired: "Please pick a thumbnail",
    library: "Library", featured: "Featured", follow: "Follow", following: "Following",
    nowPlaying: "Now playing",
  },
  fr: {
    discover: "Découvrir", trending: "Tendances",
    emissions: "Émissions", podcasts: "Podcasts", documentaries: "Documentaires",
    music: "Musique", comedy: "Comédie", games: "Jeux", news: "Actualité", sports: "Sports", kids: "Enfants", lifestyle: "Lifestyle", tech: "Tech",
    all: "Tous", home: "Accueil", upload: "Nouvelle vidéo", profile: "Profil",
    signIn: "Connexion", signUp: "Créer un compte", email: "Email", channelName: "Nom de la chaîne",
    password: "Mot de passe", showPassword: "Afficher le mot de passe", hidePassword: "Cacher le mot de passe",
    createAccount: "Créer le compte", alreadyAccount: "Déjà un compte ? Se connecter",
    noAccount: "Pas de compte ? En créer un", signOut: "Se déconnecter",
    verifyEmail: "Vérifiez votre boîte mail pour valider votre adresse.",
    passwordHint: "8 caractères min, avec majuscule, minuscule, chiffre et symbole.",
    views: "vues", likes: "j'aime", comments: "commentaires", reposts: "reposts", shares: "partages",
    uploadTitle: "Ajouter une nouvelle vidéo", title: "Titre", description: "Description",
    category: "Catégorie", publish: "Publier",
    welcome: "Bienvenue sur Visita", tagline: "Émissions, podcasts et documentaires.",
    myChannel: "Ma chaîne", signInToUpload: "Connectez-vous pour publier vos vidéos.",
    error: "Une erreur est survenue", noVideosYet: "Aucune vidéo pour l'instant. Soyez le premier à publier.",
    uploadFirst: "Publier la première vidéo",
    videoFile: "Fichier vidéo", dropVideo: "Touchez pour sélectionner une vidéo",
    dropVideoHint: "Qualité HD préservée · MP4, MOV, WEBM",
    titlePlaceholder: "Donnez un titre à votre vidéo",
    chooseThumb: "Choisissez une miniature", uploadCustomThumb: "Importer depuis l'appareil",
    titleRequired: "Le titre est obligatoire", videoRequired: "Veuillez sélectionner une vidéo",
    thumbRequired: "Veuillez choisir une miniature",
    library: "Bibliothèque", featured: "À la une", follow: "Suivre", following: "Suivi",
    nowPlaying: "En lecture",
  },
} as const;

type Key = keyof typeof dict.en;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en", setLang: () => {}, t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("visita.lang") as Lang | null) : null;
    if (saved === "en" || saved === "fr") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("visita.lang", l);
  };
  const t = (k: Key) => dict[lang][k] ?? dict.en[k];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export const CATEGORIES = [
  { id: "music", icon: "🎵" },
  { id: "podcast", icon: "🎙" },
  { id: "documentary", icon: "🎬" },
  { id: "news", icon: "📰" },
  { id: "comedy", icon: "😂" },
  { id: "games", icon: "🎮" },
  { id: "sports", icon: "⚽" },
  { id: "kids", icon: "🧸" },
  { id: "lifestyle", icon: "✨" },
  { id: "tech", icon: "💻" },
  { id: "emission", icon: "📺" },
] as const;
