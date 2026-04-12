import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KPIResult, Schedule, SchedulingRule } from "@/lib/data/types";

interface ScheduleState {
  schedule: Schedule | null;
  kpis: KPIResult | null;
  rule: SchedulingRule;
  loading: boolean;
  error: string | null;
  lastDataSavedAt: number | null;
  setRule: (rule: SchedulingRule) => void;
  setResult: (schedule: Schedule, kpis: KPIResult) => void;
  markDataSaved: () => void;
  runSchedule: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>()(persist((set, get) => ({
  schedule: null,
  kpis: null,
  rule: "EDD",
  loading: false,
  error: null,
  lastDataSavedAt: null,

  setRule: (rule) => set({ rule }),

  setResult: (schedule, kpis) => set({ schedule, kpis }),

  markDataSaved: () => set({ lastDataSavedAt: Date.now() }),

  runSchedule: async () => {
    const { rule } = get();
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { schedule: Schedule; kpis: KPIResult };
        error?: string;
      };
      if (!json.success || !json.data) {
        set({ error: json.error ?? "Erreur lors du calcul", loading: false });
        return;
      }
      set({ schedule: json.data.schedule, kpis: json.data.kpis, loading: false });
    } catch {
      set({ error: "Erreur réseau", loading: false });
    }
  },
}), {
  name: "teriak-schedule",
  partialize: (state) => ({
    schedule: state.schedule,
    kpis: state.kpis,
    rule: state.rule,
  }),
}));
