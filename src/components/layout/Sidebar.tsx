"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { can, ROLE_LABELS, type Permission, type Role } from "@/lib/auth/roles";

interface NavItem {
  href: string;
  label: string;
  group?: string;
  requiredPermission?: keyof Permission;
  anyPermission?: (keyof Permission)[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/data/pdp", label: "PDP", group: "Données", requiredPermission: "canViewBusinessData" },
  { href: "/data/gammes", label: "Gammes", group: "Données", requiredPermission: "canViewBusinessData" },
  { href: "/data/lignes", label: "Ouverture Lignes", group: "Données", requiredPermission: "canViewBusinessData" },
  { href: "/planning/charge", label: "Analyse de Faisabilité", group: "Planification", requiredPermission: "canViewBusinessData" },
  { href: "/planning/gantt", label: "Diagramme Gantt", group: "Planification", requiredPermission: "canViewBusinessData" },
  { href: "/scenarios", label: "Scénarios What-If", group: "Planification", requiredPermission: "canManageScenarios" },
  { href: "/admin/users", label: "Utilisateurs", group: "Administration", requiredPermission: "canManageUsers" },
  { href: "/admin/logs", label: "Journaux", group: "Administration", requiredPermission: "canViewLogs" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.anyPermission) return item.anyPermission.some((p) => can(user.role, p));
    if (!item.requiredPermission) return true;
    return can(user.role, item.requiredPermission);
  });

  // Group items for rendering
  const groups: { label: string | null; items: typeof visibleItems }[] = [];
  const seen = new Set<string>();
  for (const item of visibleItems) {
    const g = item.group ?? null;
    const key = g ?? "__root__";
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({ label: g, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }

  return (
    <aside
      className={[
        "fixed md:relative z-30 md:z-auto",
        "w-56 h-full md:h-auto md:min-h-screen flex flex-col",
        "border-r transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
    >
      {/* Logo */}
      <div
        className="px-4 py-5 shrink-0"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: "var(--accent)", fontFamily: "var(--font-display)" }}
          >
            T
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold text-white leading-tight truncate"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
            >
              TERIAK PLANNER
            </p>
            <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>
              Labo. Teriak
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto sidebar-scroll space-y-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p
                className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#475569", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center px-3 py-2 rounded-md text-sm transition-all duration-150"
                    style={{
                      color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                      background: active ? "var(--sidebar-active-bg)" : "transparent",
                      borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)";
                        (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text-active)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)";
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--sidebar-border)", background: "rgba(255,255,255,0.03)" }}
      >
        <p className="text-xs font-medium text-white truncate">{user.name}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--sidebar-text)" }}>{user.email}</p>
        <span
          className="inline-block text-xs mt-2 px-2 py-0.5 rounded font-medium"
          style={{ background: "rgba(13,148,136,0.15)", color: "var(--accent)" }}
        >
          {ROLE_LABELS[user.role as Role] ?? user.role.replace(/_/g, " ")}
        </span>
      </div>
    </aside>
  );
}
