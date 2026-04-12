import { create } from "zustand";
import { LignesOverrides, PDPOverrides, SchedulingRule } from "@/lib/data/types";

export interface ScenarioRecord {
  id: string;
  name: string;
  description: string | null;
  pdpId: string;
  schedulingRule: string;
  schedule: string;
  kpis: string;
  pdpOverrides: string | null;
  lignesOverrides: string | null;
  createdAt: string;
}

interface ScenarioState {
  scenarios: ScenarioRecord[];
  loading: boolean;
  error: string | null;
  fetchScenarios: () => Promise<void>;
  createScenario: (
    name: string,
    description: string,
    rule: SchedulingRule,
    pdpOverrides?: PDPOverrides,
    lignesOverrides?: LignesOverrides
  ) => Promise<ScenarioRecord | null>;
  deleteScenario: (id: string) => Promise<boolean>;
  cloneScenario: (sourceId: string, newName: string) => Promise<ScenarioRecord | null>;
  renameScenario: (id: string, name: string, description?: string) => Promise<boolean>;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,

  fetchScenarios: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/scenarios");
      const json = (await res.json()) as { success: boolean; data?: ScenarioRecord[]; error?: string };
      if (json.success && json.data) {
        set({ scenarios: json.data, loading: false });
      } else {
        set({ error: json.error ?? "Erreur de chargement", loading: false });
      }
    } catch {
      set({ error: "Erreur réseau", loading: false });
    }
  },

  createScenario: async (name, description, rule, pdpOverrides, lignesOverrides) => {
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, rule, pdpOverrides, lignesOverrides }),
      });
      const json = (await res.json()) as { success: boolean; data?: ScenarioRecord; error?: string };
      if (json.success && json.data) {
        set((state) => ({ scenarios: [json.data!, ...state.scenarios] }));
        return json.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  deleteScenario: async (id) => {
    try {
      const res = await fetch(`/api/scenarios?id=${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean };
      if (json.success) {
        set((state) => ({ scenarios: state.scenarios.filter((s) => s.id !== id) }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  cloneScenario: async (sourceId, newName) => {
    try {
      const res = await fetch("/api/scenarios/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, name: newName }),
      });
      const json = (await res.json()) as { success: boolean; data?: ScenarioRecord; error?: string };
      if (json.success && json.data) {
        set((state) => ({ scenarios: [json.data!, ...state.scenarios] }));
        return json.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  renameScenario: async (id, name, description) => {
    try {
      const res = await fetch("/api/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, description }),
      });
      const json = (await res.json()) as { success: boolean; data?: ScenarioRecord };
      if (json.success && json.data) {
        set((state) => ({
          scenarios: state.scenarios.map((s) => (s.id === id ? json.data! : s)),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
