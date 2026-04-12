"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_LINES,
  LineId,
  LigneParams,
  PDPData,
  GammesData,
  OuvertureLignesData,
  MONTH_LABELS,
} from "@/lib/data/types";
import { LIGNE_CONSTRAINTS, clampLigneParam, LigneParamKey } from "@/lib/data/constraints";
import { detectSuggestions, Suggestion } from "@/lib/scheduler/suggestions";
import { useScheduleStore } from "@/stores/scheduleStore";

interface ProposalRecord {
  id: string;
  workshop: string;
  changes: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: { name: string; email: string };
}

export interface ProposalsPanelProps {
  canSubmit: boolean;
  canApprove: boolean;
  defaultWorkshop?: LineId;
  onApplied?: () => void;
}

const PARAM_LABELS: Record<string, string> = {
  weeks: "Semaines",
  coeff: "Coeff. rendement",
  shifts: "Postes/jour",
  days: "Jours/semaine",
  hours: "Heures/poste",
};

const EDITABLE_PARAMS: LigneParamKey[] = ["weeks", "coeff", "shifts", "days"];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

function statusColor(status: string): string {
  if (status === "APPROVED") return "bg-green-100 text-green-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function parseChanges(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

export default function ProposalsPanel({ canSubmit, canApprove, defaultWorkshop, onApplied }: ProposalsPanelProps) {
  const markDataSaved = useScheduleStore((s) => s.markDataSaved);
  const lastDataSavedAt = useScheduleStore((s) => s.lastDataSavedAt);

  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data for problem detection
  const [pdp, setPdp] = useState<PDPData | null>(null);
  const [gammes, setGammes] = useState<GammesData | null>(null);
  const [lignes, setLignes] = useState<OuvertureLignesData | null>(null);

  // Submit form state
  const [showForm, setShowForm] = useState(false);
  const [workshop, setWorkshop] = useState<LineId>(defaultWorkshop ?? "A");
  const [formChanges, setFormChanges] = useState<Partial<Record<string, string>>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync defaultWorkshop when it changes
  useEffect(() => {
    if (defaultWorkshop) setWorkshop(defaultWorkshop);
  }, [defaultWorkshop]);

  // ---- Data fetching ----
  const fetchAll = useCallback(() => {
    fetch("/api/pdp")
      .then((r) => r.json())
      .then((j: ApiResponse<PDPData>) => { if (j.success && j.data) setPdp(j.data); })
      .catch(() => undefined);
    fetch("/api/gammes")
      .then((r) => r.json())
      .then((j: ApiResponse<GammesData>) => { if (j.success && j.data) setGammes(j.data); })
      .catch(() => undefined);
    fetch("/api/lignes")
      .then((r) => r.json())
      .then((j: ApiResponse<OuvertureLignesData>) => { if (j.success && j.data) setLignes(j.data); })
      .catch(() => undefined);
  }, []);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals");
      const json = await res.json() as { success: boolean; data?: ProposalRecord[]; error?: string };
      if (json.success && json.data) setProposals(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); void fetchProposals(); }, [fetchAll, fetchProposals]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (lastDataSavedAt) fetchAll(); }, [lastDataSavedAt]);

  // ---- Problem detection ----
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!pdp || !gammes || !lignes) return [];
    return detectSuggestions(pdp, gammes, lignes);
  }, [pdp, gammes, lignes]);

  // ---- Real-time TO calculation for form ----
  const formTO = useMemo(() => {
    if (!lignes) return null;
    const currentParams = lignes[workshop];
    const merged = { ...currentParams };
    for (const [key, val] of Object.entries(formChanges)) {
      if (val && val.trim() !== "") {
        const n = parseFloat(val);
        if (!isNaN(n)) (merged as Record<string, number>)[key] = n;
      }
    }
    return merged.weeks * merged.coeff * merged.shifts * merged.days * merged.hours;
  }, [lignes, workshop, formChanges]);

  const currentTO = useMemo(() => {
    if (!lignes) return null;
    const p = lignes[workshop];
    return p.weeks * p.coeff * p.shifts * p.days * p.hours;
  }, [lignes, workshop]);

  // ---- Real-time form validation ----
  useEffect(() => {
    const errors: string[] = [];
    for (const [key, val] of Object.entries(formChanges)) {
      if (!val || val.trim() === "") continue;
      const n = parseFloat(val);
      if (isNaN(n)) { errors.push(`${PARAM_LABELS[key]}: valeur invalide`); continue; }
      const c = LIGNE_CONSTRAINTS[key as LigneParamKey];
      if (!c) continue;
      if (c.fixed) { errors.push(`${PARAM_LABELS[key]}: fixé à ${c.min}`); continue; }
      if (n < c.min) errors.push(`${PARAM_LABELS[key]}: min = ${c.min}`);
      if (n > c.max) errors.push(`${PARAM_LABELS[key]}: max = ${c.max}`);
    }
    setFormErrors(errors);
  }, [formChanges]);

  // ---- Handlers ----
  const handleSubmit = async () => {
    if (formErrors.length > 0) return;
    const numericChanges: Record<string, number> = {};
    for (const [key, val] of Object.entries(formChanges)) {
      if (val && val.trim() !== "") {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) numericChanges[key] = clampLigneParam(key as LigneParamKey, n);
      }
    }
    if (Object.keys(numericChanges).length === 0) {
      setSubmitError("Veuillez renseigner au moins un paramètre à modifier");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshop, changes: numericChanges, note }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setShowForm(false);
        setFormChanges({});
        setNote("");
        void fetchProposals();
      } else {
        setSubmitError(json.error ?? "Erreur lors de la soumission");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(id + action);
    setError(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        if (action === "APPROVE") {
          markDataSaved();
          onApplied?.();
        }
        void fetchProposals();
        fetchAll();
      } else {
        setError(json.error ?? "Erreur");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const prefillFromSuggestion = (s: Suggestion) => {
    setWorkshop(s.line);
    const changes: Partial<Record<string, string>> = {};
    const keys: LigneParamKey[] = ["weeks", "coeff", "shifts", "days"];
    for (const key of keys) {
      if (s.suggestedParams[key] !== s.currentParams[key]) {
        changes[key] = String(s.suggestedParams[key]);
      }
    }
    setFormChanges(changes);
    setNote(`Suggestion auto — réduire l'occupation de ${s.peakOccupation}% à ≤85% (${MONTH_LABELS[s.peakMonth]})`);
    setShowForm(true);
  };

  const applyDirectly = async (s: Suggestion) => {
    if (!lignes) return;
    setActionLoading(`apply-${s.line}`);
    setError(null);
    setSuccessMsg(null);
    try {
      const updatedLignes = { ...lignes, [s.line]: { ...s.suggestedParams } };
      const res = await fetch("/api/lignes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updatedLignes }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        markDataSaved();
        setLignes(updatedLignes);
        setSuccessMsg(`Atelier ${s.line} mis à jour avec succès — occupation cible ≤85%.`);
        onApplied?.();
      } else {
        setError(json.error ?? "Erreur lors de l'application");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-md text-sm border bg-red-50 border-red-200 text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 rounded-md text-sm border bg-green-50 border-green-200 text-green-700">
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-2 text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* ===== Problem Detection Panel ===== */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Détection automatique des surcharges</h2>

        {!pdp || !gammes || !lignes ? (
          <div className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
            Chargement des données de capacité...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-3 rounded-md border bg-green-50 border-green-300">
            <p className="text-sm font-medium text-green-700">
              ✓ Aucune surcharge détectée — toutes les lignes sont sous 85% d&apos;occupation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.line}
                className={`p-4 rounded-lg border ${
                  s.severity === "critical"
                    ? "bg-red-50 border-red-300"
                    : "bg-amber-50 border-amber-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          s.severity === "critical"
                            ? "bg-red-200 text-red-800"
                            : "bg-amber-200 text-amber-800"
                        }`}
                      >
                        {s.severity === "critical" ? "Critique" : "Attention"}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        Atelier {s.line} — {s.peakOccupation}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      Mois affectés : {s.affectedMonths.map((m) => MONTH_LABELS[m]).join(", ")}
                      {" "}— pic en {MONTH_LABELS[s.peakMonth]}
                    </p>

                    {/* Current vs Suggested comparison */}
                    <div className="grid grid-cols-5 gap-1 text-[11px] mb-1">
                      <span className="text-gray-400 font-medium">Param.</span>
                      {EDITABLE_PARAMS.map((k) => (
                        <span key={k} className="text-center text-gray-500 font-medium">{PARAM_LABELS[k]}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-xs mb-0.5">
                      <span className="text-gray-400">Actuel</span>
                      {EDITABLE_PARAMS.map((k) => (
                        <span key={k} className="text-center text-gray-600">{s.currentParams[k]}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      <span className="text-gray-400">Suggéré</span>
                      {EDITABLE_PARAMS.map((k) => {
                        const changed = s.suggestedParams[k] !== s.currentParams[k];
                        return (
                          <span
                            key={k}
                            className={`text-center font-medium ${changed ? "text-blue-700" : "text-gray-400"}`}
                          >
                            {s.suggestedParams[k]}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      TO : {s.currentTO} h → {s.suggestedTO} h — occupation cible : {s.targetOccupation}%
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {canSubmit && (
                      <button
                        onClick={() => prefillFromSuggestion(s)}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium whitespace-nowrap"
                      >
                        Proposer
                      </button>
                    )}
                    {canApprove && (
                      <button
                        onClick={() => void applyDirectly(s)}
                        disabled={actionLoading === `apply-${s.line}`}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        {actionLoading === `apply-${s.line}` ? "..." : "Appliquer directement"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Proposals Section ===== */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {proposals.length} proposition{proposals.length !== 1 ? "s" : ""}
          {canApprove && pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
              {pendingCount} en attente
            </span>
          )}
        </p>
        {canSubmit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            {showForm ? "Annuler" : "+ Nouvelle proposition"}
          </button>
        )}
      </div>

      {/* Submit form — enhanced with constraints */}
      {showForm && canSubmit && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Proposer une modification d&apos;ouverture de ligne</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Atelier</label>
              <select
                value={workshop}
                onChange={(e) => { setWorkshop(e.target.value as LineId); setFormChanges({}); }}
                className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {ALL_LINES.map((l) => <option key={l} value={l}>Atelier {l}</option>)}
              </select>
            </div>
            {EDITABLE_PARAMS.map((key) => {
              const c = LIGNE_CONSTRAINTS[key];
              const raw = formChanges[key] ?? "";
              const n = parseFloat(raw);
              const outOfRange = raw !== "" && !isNaN(n) && (n < c.min || n > c.max);
              return (
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {PARAM_LABELS[key]}
                    <span className="text-gray-400 ml-1">({c.min}–{c.max})</span>
                  </label>
                  <input
                    type="number"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={raw}
                    onChange={(e) => setFormChanges((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={lignes ? String(lignes[workshop][key]) : "Inchangé"}
                    className={`w-full px-3 py-1.5 text-sm text-gray-900 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      outOfRange ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {outOfRange && (
                    <p className="text-[10px] text-red-500 mt-0.5">Hors limites ({c.min}–{c.max})</p>
                  )}
                </div>
              );
            })}
            {/* Hours — fixed, read-only */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {PARAM_LABELS.hours} <span className="text-gray-400">(fixé)</span>
              </label>
              <input
                type="number"
                value={7}
                disabled
                className="w-full px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Real-time TO calculation */}
          {formTO !== null && currentTO !== null && (
            <div className="mb-3 p-2 rounded bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700">
                <span className="font-medium">TO (h/mois) :</span>{" "}
                {currentTO.toFixed(2)} → <span className="font-bold">{formTO.toFixed(2)}</span>
                {formTO !== currentTO && (
                  <span className={`ml-1 ${formTO > currentTO ? "text-green-600" : "text-red-600"}`}>
                    ({formTO > currentTO ? "+" : ""}{(formTO - currentTO).toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Current values for reference */}
          {lignes && (
            <div className="mb-3 text-xs text-gray-500">
              Valeurs actuelles (Atelier {workshop}) :{" "}
              {EDITABLE_PARAMS.map((k) => `${PARAM_LABELS[k]}=${lignes[workshop][k]}`).join(", ")}
              , {PARAM_LABELS.hours}=7
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Justification (optionnel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Raison de la demande..."
              className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {formErrors.length > 0 && (
            <div className="mb-2 p-2 rounded bg-red-50 border border-red-200">
              {formErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
            </div>
          )}
          {submitError && <p className="text-xs text-red-600 mb-2">{submitError}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || formErrors.length > 0}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {submitting ? "Envoi en cours..." : "Soumettre la proposition"}
          </button>
        </div>
      )}

      {/* Proposals list */}
      {loading && proposals.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Chargement...</div>
      ) : proposals.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-lg">
          Aucune proposition.
          {canSubmit && " Soumettez votre première proposition via le bouton ci-dessus."}
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const changes = parseChanges(p.changes);
            const { note: changeNote, ...params } = changes;
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900">Atelier {p.workshop}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(p.status)}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    {canApprove && (
                      <p className="text-xs text-gray-500 mb-1">{p.user.name} — {p.user.email}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-1">
                      {Object.entries(params).map(([key, val]) => (
                        <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {PARAM_LABELS[key] ?? key}: {String(val)}
                        </span>
                      ))}
                    </div>
                    {typeof changeNote === "string" && changeNote.trim() !== "" && (
                      <p className="text-xs text-gray-500 italic">{changeNote}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {canApprove && p.status === "PENDING" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => void handleAction(p.id, "APPROVE")}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {actionLoading === p.id + "APPROVE" ? "..." : "Approuver"}
                      </button>
                      <button
                        onClick={() => void handleAction(p.id, "REJECT")}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        {actionLoading === p.id + "REJECT" ? "..." : "Rejeter"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
