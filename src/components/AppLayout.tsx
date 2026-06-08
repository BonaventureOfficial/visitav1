import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-14 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
