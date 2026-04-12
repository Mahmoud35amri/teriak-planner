"use client";

import { useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { GammesData, ALL_PRODUCTS, ALL_LINES, ProductId, LineId } from "@/lib/data/types";
import { exportGammesToExcel } from "@/lib/excel/exporter";
import { parseGammesExcel } from "@/lib/excel/parser";
import { useScheduleStore } from "@/stores/scheduleStore";

interface Props {
  initialData: GammesData;
  canEdit: boolean;
}

type ViewMode = "production" | "cleaning";

export default function GammesClient({ initialData, canEdit }: Props) {
  const markDataSaved = useScheduleStore((s) => s.markDataSaved);
  const [data, setData] = useState<GammesData>(initialData);
  const [view, setView] = useState<ViewMode>("production");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateCell = useCallback(
    (product: ProductId, line: LineId, type: ViewMode, value: string) => {
      const raw = parseFloat(value.replace(",", "."));
      const num = isNaN(raw) || raw < 0 ? 0 : raw;
      setData((prev) => ({
        ...prev,
        [product]: {
          ...prev[product],
          [type]: { ...prev[product][type], [line]: num },
        },
      }));
      setDirty(true);
    },
    []
  );

  const getCellValue = (product: ProductId, line: LineId, type: ViewMode): number =>
    data[product][type][line] ?? 0;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gammes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setDirty(false);
        markDataSaved();
        setMessage({ type: "success", text: "Gammes enregistrées avec succès." });
      } else {
        setMessage({ type: "error", text: json.error ?? "Erreur lors de l'enregistrement." });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau." });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const result = parseGammesExcel(buffer);
      if (result.success) {
        setData(result.data);
        setDirty(true);
        setMessage({ type: "success", text: "Fichier importé. Vérifiez les données puis enregistrez." });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <AppShell title="Gammes Produits">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView("production")}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              view === "production"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Temps de production
          </button>
          <button
            onClick={() => setView("cleaning")}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              view === "cleaning"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Temps de nettoyage
          </button>
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
              Non enregistré
            </span>
          )}
          <button
            onClick={() => exportGammesToExcel(data)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            Exporter Excel
          </button>
          {canEdit && (
            <>
              <label className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors cursor-pointer">
                Importer Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              </label>
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-medium"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-700 w-16 border-r border-gray-200">
                Produit
              </th>
              {ALL_LINES.map((l) => (
                <th key={l} className="px-2 py-2.5 text-center font-semibold text-gray-700 min-w-[80px]">
                  Ligne {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PRODUCTS.map((product, idx) => (
              <tr key={product} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-semibold text-gray-800 border-r border-gray-200">
                  {product}
                </td>
                {ALL_LINES.map((line) => {
                  const val = getCellValue(product, line, view);
                  const hasValue = val > 0;
                  return (
                    <td key={line} className="px-1 py-1 text-center">
                      {canEdit ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={val === 0 ? "" : val}
                          placeholder="—"
                          onChange={(e) => updateCell(product, line, view, e.target.value)}
                          className="w-[72px] px-1.5 py-1 text-center text-sm text-gray-900 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-300"
                        />
                      ) : (
                        <span className={`inline-block w-[72px] py-1 text-center ${hasValue ? "text-gray-900 font-medium" : "text-gray-300"}`}>
                          {hasValue ? val : "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Unité: heures par lot. Les cellules vides indiquent que le produit ne passe pas par cette ligne.
      </p>
    </AppShell>
  );
}
