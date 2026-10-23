import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Appearance = "day" | "night";
const AppearanceContext = createContext({ appearance: "night" as Appearance, toggle: () => {} });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>("night");
  useEffect(() => {
    const saved = localStorage.getItem("visita.appearance");
    if (saved === "day" || saved === "night") setAppearance(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.classList.toggle("dark", appearance === "night");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", appearance === "night" ? "#000000" : "#ffffff");
  }, [appearance]);
  const toggle = () => setAppearance((current) => {
    const next = current === "night" ? "day" : "night";
    localStorage.setItem("visita.appearance", next);
    return next;
  });
  return <AppearanceContext.Provider value={{ appearance, toggle }}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);