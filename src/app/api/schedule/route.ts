import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_GAMMES, DEFAULT_OUVERTURE_LIGNES, DEFAULT_PDP } from "@/lib/data/defaults";
import { GammesData, KPIResult, OuvertureLignesData, PDPData, Schedule, SchedulingRule } from "@/lib/data/types";
import { runScheduler } from "@/lib/scheduler/engine";
import { computeKPIs } from "@/lib/scheduler/metrics";

const VALID_RULES: SchedulingRule[] = ["SPT", "EDD", "CR", "LPT", "GA_OPTIMIZED"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canRunScheduler")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { rule?: string };
  const rule = body.rule as SchedulingRule | undefined;

  if (!rule || !VALID_RULES.includes(rule)) {
    return NextResponse.json(
      { success: false, error: `Règle invalide. Valeurs acceptées: ${VALID_RULES.join(", ")}` },
      { status: 400 }
    );
  }

  // Load data from DB, fall back to defaults if not seeded
  const [pdpRecord, gammesRecord, lignesRecord] = await Promise.all([
    prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.gammesProduits.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const pdp: PDPData = pdpRecord
    ? (JSON.parse(pdpRecord.data) as PDPData)
    : DEFAULT_PDP;

  const gammes: GammesData = gammesRecord
    ? (JSON.parse(gammesRecord.data) as GammesData)
    : DEFAULT_GAMMES;

  const lignes: OuvertureLignesData = lignesRecord
    ? (JSON.parse(lignesRecord.data) as OuvertureLignesData)
    : DEFAULT_OUVERTURE_LIGNES;

  const schedule: Schedule = runScheduler(pdp, gammes, rule);
  const kpis: KPIResult = computeKPIs(schedule, lignes);

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: "SCHEDULE_RUN",
      details: `Règle: ${rule} — ${schedule.lots.length} lots — makespan: ${schedule.makespan.toFixed(1)}h`,
    },
  });

  return NextResponse.json({ success: true, data: { schedule, kpis } });
}
