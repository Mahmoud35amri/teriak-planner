"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Ouvrir le menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            <rect x="1" y="3" width="16" height="2" rx="1" />
            <rect x="1" y="8" width="16" height="2" rx="1" />
            <rect x="1" y="13" width="16" height="2" rx="1" />
          </svg>
        </button>
        <h1
          className="text-sm font-semibold text-gray-800 truncate tracking-wide"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
        >
          {title.toUpperCase()}
        </h1>
      </div>
      <button
        onClick={handleLogout}
        className="text-xs font-medium shrink-0 ml-4 px-3 py-1.5 rounded-md border transition-colors"
        style={{
          color: "#64748b",
          borderColor: "#e2e8f0",
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "#ef4444";
          (e.currentTarget as HTMLElement).style.borderColor = "#fecaca";
          (e.currentTarget as HTMLElement).style.background = "#fef2f2";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "#64748b";
          (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        Déconnexion
      </button>
    </header>
  );
}
