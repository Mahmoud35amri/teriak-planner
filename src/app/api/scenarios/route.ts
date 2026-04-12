import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_GAMMES, DEFAULT_OUVERTURE_LIGNES, DEFAULT_PDP } from "@/lib/data/defaults";
import {
  GammesData,
  KPIResult,
  LignesOverrides,
  OuvertureLignesData,
  PDPData,
  PDPOverrides,
  Schedule,
  SchedulingRule,
} from "@/lib/data/types";
import { mergeLignes, mergePDP } from "@/lib/data/merge";
import { generateLots, runScheduler } from "@/lib/scheduler/engine";
import { computeKPIs } from "@/lib/scheduler/metrics";
import { runGA } from "@/lib/scheduler/genetic";

const VALID_RULES: SchedulingRule[] = ["SPT", "EDD", "CR", "LPT", "GA_OPTIMIZED"];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageScenarios")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const scenarios = await prisma.scenario.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: scenarios });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageScenarios")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    description?: string;
    rule?: string;
    pdpOverrides?: PDPOverrides;
    lignesOverrides?: LignesOverrides;
  };
  const { name, description, rule: ruleRaw, pdpOverrides, lignesOverrides } = body;

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Nom du scénario requis" }, { status: 400 });
  }

  const rule = ruleRaw as SchedulingRule;
  if (!VALID_RULES.includes(rule)) {
    return NextResponse.json({ success: false, error: "Règle invalide" }, { status: 400 });
  }

  const [pdpRecord, gammesRecord, lignesRecord] = await Promise.all([
    prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.gammesProduits.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const basePdp: PDPData = pdpRecord ? (JSON.parse(pdpRecord.data) as PDPData) : DEFAULT_PDP;
  const gammes: GammesData = gammesRecord
    ? (JSON.parse(gammesRecord.data) as GammesData)
    : DEFAULT_GAMMES;
  const baseLignes: OuvertureLignesData = lignesRecord
    ? (JSON.parse(lignesRecord.data) as OuvertureLignesData)
    : DEFAULT_OUVERTURE_LIGNES;

  // Merge overrides for this scenario
  const effectivePdp = mergePDP(basePdp, pdpOverrides ?? null);
  const effectiveLignes = mergeLignes(baseLignes, lignesOverrides ?? null);

  let schedule: Schedule;
  if (rule === "GA_OPTIMIZED") {
    const lots = generateLots(effectivePdp, gammes);
    // Use EDD as baseline to measure GA improvement
    const baseline = runScheduler(effectivePdp, gammes, "EDD");
    const gaResult = runGA(lots, baseline.makespan);
    schedule = gaResult.schedule;
  } else {
    schedule = runScheduler(effectivePdp, gammes, rule);
  }
  const kpis: KPIResult = computeKPIs(schedule, effectiveLignes);

  // Serialize overrides (only non-empty)
  const pdpOvStr = pdpOverrides && Object.keys(pdpOverrides).length > 0
    ? JSON.stringify(pdpOverrides)
    : null;
  const lignesOvStr = lignesOverrides && Object.keys(lignesOverrides).length > 0
    ? JSON.stringify(lignesOverrides)
    : null;

  const scenario = await prisma.scenario.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? null,
      pdpId: pdpRecord?.id ?? "default",
      schedulingRule: rule,
      schedule: JSON.stringify(schedule),
      kpis: JSON.stringify(kpis),
      pdpOverrides: pdpOvStr,
      lignesOverrides: lignesOvStr,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: "SCENARIO_CREATE",
      details: `"${name.trim()}" — Règle: ${rule} — makespan: ${schedule.makespan.toFixed(1)}h`,
    },
  });

  return NextResponse.json({ success: true, data: scenario });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageScenarios")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json()) as { id?: string; name?: string; description?: string };
  const { id, name, description } = body;

  if (!id) {
    return NextResponse.json({ success: false, error: "ID requis" }, { status: 400 });
  }

  try {
    const updated = await prisma.scenario.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() || null } : {}),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Scénario introuvable" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageScenarios")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "ID requis" }, { status: 400 });
  }

  try {
    await prisma.scenario.delete({ where: { id } });
  } catch {
    return NextResponse.json({ success: false, error: "Scénario introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
