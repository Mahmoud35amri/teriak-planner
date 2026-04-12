import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageScenarios")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json()) as { sourceId?: string; name?: string };
  const { sourceId, name } = body;

  if (!sourceId || !name?.trim()) {
    return NextResponse.json(
      { success: false, error: "sourceId et name requis" },
      { status: 400 }
    );
  }

  const source = await prisma.scenario.findUnique({ where: { id: sourceId } });
  if (!source) {
    return NextResponse.json({ success: false, error: "Scénario source introuvable" }, { status: 404 });
  }

  const cloned = await prisma.scenario.create({
    data: {
      name: name.trim(),
      description: source.description,
      pdpId: source.pdpId,
      schedulingRule: source.schedulingRule,
      schedule: source.schedule,
      kpis: source.kpis,
      pdpOverrides: source.pdpOverrides,
      lignesOverrides: source.lignesOverrides,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: "SCENARIO_CLONE",
      details: `"${source.name}" → "${name.trim()}"`,
    },
  });

  return NextResponse.json({ success: true, data: cloned });
}
