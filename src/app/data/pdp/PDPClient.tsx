"use client";

import { useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { PDPData, ALL_PRODUCTS, ALL_MONTHS, MONTH_LABELS, ProductId, MonthKey } from "@/lib/data/types";
import { exportPDPToExcel } from "@/lib/excel/exporter";
import { parsePDPExcel } from "@/lib/excel/parser";
import { useScheduleStore } from "@/stores/scheduleStore";

interface Props {
  initialData: PDPData;
  canEdit: boolean;
}

export default function PDPClient({ initialData, canEdit }: Props) {
  const markDataSaved = useScheduleStore((s) => s.markDataSaved);
  const [data, setData] = useState<PDPData>(initialData);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const draftKey = (product: ProductId, month: MonthKey) => `${product}-${month}`;

  const handleChange = useCallback((product: ProductId, month: MonthKey, value: string) => {
    setDrafts((prev) => ({ ...prev, [`${product}-${month}`]: value }));
    setDirty(true);
  }, []);

  const handleBlur = useCallback((product: ProductId, month: MonthKey) => {
    const key = `${product}-${month}`;
    setDrafts((prev) => {
      const draft = prev[key];
      if (draft === undefined) return prev;
      const n = parseInt(draft, 10);
      const num = isNaN(n) || n < 0 ? 0 : n;
      setData((d) => ({ ...d, [product]: { ...d[product], [month]: num } }));
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setDirty(false);
        markDataSaved();
        setMessage({ type: "success", text: "PDP enregistré avec succès." });
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
      const result = parsePDPExcel(buffer);
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

  const totalByMonth = (month: MonthKey): number =>
    ALL_PRODUCTS.reduce((sum, p) => sum + (data[p][month] ?? 0), 0);

  return (
    <AppShell title="Plan Directeur de Production">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
              Modifications non enregistrées
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPDPToExcel(data)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            Exporter Excel
          </button>
          {canEdit && (
            <>
              <label className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors cursor-pointer">
                Importer Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                />
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
              {ALL_MONTHS.map((m) => (
                <th key={m} className="px-2 py-2.5 text-center font-semibold text-gray-700 min-w-[72px]">
                  {MONTH_LABELS[m].slice(0, 3)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700 min-w-[60px] border-l border-gray-200">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {ALL_PRODUCTS.map((product, idx) => {
              const rowTotal = ALL_MONTHS.reduce((sum, m) => sum + (data[product][m] ?? 0), 0);
              return (
                <tr
                  key={product}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-semibold text-gray-800 border-r border-gray-200">
                    {product}
                  </td>
                  {ALL_MONTHS.map((month) => (
                    <td key={month} className="px-1 py-1 text-center">
                      {canEdit ? (
                        <input
                          type="number"
                          min="0"
                          value={drafts[draftKey(product, month)] ?? String(data[product][month] ?? 0)}
                          onChange={(e) => handleChange(product, month, e.target.value)}
                          onBlur={() => handleBlur(product, month)}
                          onFocus={(e) => e.target.select()}
                          className="w-16 px-1.5 py-1 text-center text-sm text-gray-900 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                      ) : (
                        <span className={`inline-block w-16 py-1 text-center ${data[product][month] > 0 ? "text-gray-900 font-medium" : "text-gray-300"}`}>
                          {data[product][month] ?? 0}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center font-semibold text-gray-700 border-l border-gray-200">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-100">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">
                Total
              </td>
              {ALL_MONTHS.map((m) => {
                const total = totalByMonth(m);
                return (
                  <td key={m} className="px-1 py-2 text-center font-semibold text-gray-700">
                    {total > 0 ? total : <span className="text-gray-300">0</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center font-bold text-gray-900 border-l border-gray-200">
                {ALL_PRODUCTS.reduce((sum, p) => sum + ALL_MONTHS.reduce((s, m) => s + (data[p][m] ?? 0), 0), 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Unité: nombre de lots par mois. Toutes les valeurs sont des entiers.
      </p>
    </AppShell>
  );
}
