"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";

interface LogRecord {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

interface Meta {
  total: number;
  page: number;
  pages: number;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Connexion",
  LOGOUT: "Déconnexion",
  PDP_SAVED: "PDP enregistrée",
  PDP_IMPORTED: "PDP importée",
  GAMMES_SAVED: "Gammes enregistrées",
  GAMMES_IMPORTED: "Gammes importées",
  LIGNES_SAVED: "Lignes enregistrées",
  SCHEDULE_RUN: "Ordonnancement lancé",
  SCENARIO_CREATE: "Scénario créé",
  SCENARIO_CLONE: "Scénario cloné",
  PROPOSAL_SUBMIT: "Proposition soumise",
  PROPOSAL_APPROVED: "Proposition approuvée",
  PROPOSAL_REJECTED: "Proposition rejetée",
  USER_CREATED: "Utilisateur créé",
  USER_ROLE_CHANGED: "Rôle modifié",
  USER_DELETED: "Utilisateur supprimé",
};

function actionColor(action: string): string {
  if (action.includes("DELETE") || action.includes("REJECTED")) return "text-red-600";
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "text-gray-500";
  if (action.includes("APPROVED") || action.includes("CREATE")) return "text-green-600";
  return "text-blue-600";
}

export default function LogsClient() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?page=${p}`);
      const json = await res.json() as {
        success: boolean;
        data?: LogRecord[];
        meta?: Meta;
      };
      if (json.success && json.data) {
        setLogs(json.data);
        if (json.meta) setMeta(json.meta);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLogs(page); }, [fetchLogs, page]);

  return (
    <AppShell title="Journaux d'activité">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{meta.total} entrée{meta.total !== 1 ? "s" : ""} au total</p>
        <button
          onClick={() => void fetchLogs(page)}
          className="text-xs text-blue-600 hover:underline"
        >
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Chargement...</div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-lg">
          Aucune entrée dans le journal.
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Horodatage</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-xs font-medium text-gray-900">{log.user.name}</p>
                      <p className="text-xs text-gray-400">{log.user.email}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${actionColor(log.action)}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                      {log.details ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-xs text-gray-500">Page {meta.page} / {meta.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page === meta.pages}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
