"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Role, ROLE_LABELS } from "@/lib/auth/roles";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLES: Role[] = ["PLANIFICATEUR", "RESPONSABLE_ATELIER", "ADMINISTRATEUR", "DIRECTION"];

export default function UsersClient() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<Role>("RESPONSABLE_ATELIER");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline role editing
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json() as { success: boolean; data?: UserRecord[]; error?: string };
      if (json.success && json.data) setUsers(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
      setCreateError("Tous les champs sont requis");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, email: createEmail, password: createPassword, role: createRole }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setShowCreate(false);
        setCreateName(""); setCreateEmail(""); setCreatePassword("");
        setCreateRole("RESPONSABLE_ATELIER");
        void fetchUsers();
      } else {
        setCreateError(json.error ?? "Erreur lors de la création");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: Role) => {
    setRoleLoading(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: newRole }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
        setEditingRole(null);
      } else {
        setError(json.error ?? "Erreur lors de la modification");
      }
    } finally {
      setRoleLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        setError(json.error ?? "Erreur lors de la suppression");
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <AppShell title="Gestion des utilisateurs">
      {error && (
        <div className="mb-4 p-3 rounded-md text-sm border bg-red-50 border-red-200 text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} utilisateur{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          {showCreate ? "Annuler" : "+ Nouvel utilisateur"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Nouvel utilisateur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="Nom complet *"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="email"
              placeholder="Email *"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="password"
              placeholder="Mot de passe *"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as Role)}
              className="px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {createError && <p className="text-xs text-red-600 mb-2">{createError}</p>}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {creating ? "Création..." : "Créer"}
          </button>
        </div>
      )}

      {/* Users table */}
      {loading && users.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Chargement...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Créé le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {editingRole === user.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          defaultValue={user.role}
                          onChange={(e) => void handleRoleChange(user.id, e.target.value as Role)}
                          disabled={roleLoading === user.id}
                          className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none"
                          autoFocus
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <button
                          onClick={() => setEditingRole(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRole(user.id)}
                        className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium hover:bg-blue-100"
                      >
                        {ROLE_LABELS[user.role as Role] ?? user.role}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void handleDelete(user.id)}
                      disabled={deleteLoading === user.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deleteLoading === user.id ? "..." : "Supprimer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
