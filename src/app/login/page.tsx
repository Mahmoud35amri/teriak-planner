"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { type Role } from "@/lib/auth/roles";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json() as {
        success: boolean;
        data?: { id: string; name: string; email: string; role: string };
        error?: string;
      };

      if (!json.success || !json.data) {
        setError(json.error ?? "Erreur de connexion");
        return;
      }

      setUser({ id: json.data.id, name: json.data.name, email: json.data.email, role: json.data.role as Role });
      router.push("/dashboard");
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-full flex"
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Left panel — dark brand */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col justify-between p-10 shrink-0">
        <div>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-base font-bold mb-10"
            style={{ background: "var(--accent)", fontFamily: "var(--font-display)" }}
          >
            T
          </div>
          <h1
            className="text-3xl font-bold text-white leading-tight mb-3"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
          >
            TERIAK
            <br />
            PLANNER
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
            Système de planification de la production industrielle — Laboratoires Teriak
          </p>
        </div>

        <div className="space-y-3">
          {[
            "Ordonnancement multi-ateliers (A–J)",
            "4 règles heuristiques + optimiseur AG",
            "Indicateurs de performance temps réel",
            "Gestion des rôles et traçabilité",
          ].map((feat) => (
            <div key={feat} className="flex items-start gap-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: "var(--accent)" }}
              />
              <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
                {feat}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white text-base font-bold mb-4"
              style={{ background: "var(--accent)", fontFamily: "var(--font-display)" }}
            >
              T
            </div>
            <h1
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
            >
              TERIAK PLANNER
            </h1>
            <p className="text-xs text-gray-500 mt-1">Laboratoires Teriak</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-9">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Connexion</h2>
            <p className="text-xs text-gray-400 mb-6">Entrez vos identifiants pour accéder au système</p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 transition-colors focus:outline-none"
                  style={{ fontFamily: "var(--font-sans)" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px rgba(13,148,136,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 transition-colors focus:outline-none"
                  style={{ fontFamily: "var(--font-sans)" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px rgba(13,148,136,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-white font-semibold rounded-lg transition-all text-sm disabled:opacity-60"
                style={{
                  background: loading ? "var(--accent-hover)" : "var(--accent)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)"; }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = "var(--accent)"; }}
              >
                {loading ? "Connexion en cours..." : "SE CONNECTER"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Laboratoires Teriak — Système de gestion industrielle
          </p>
        </div>
      </div>
    </div>
  );
}
