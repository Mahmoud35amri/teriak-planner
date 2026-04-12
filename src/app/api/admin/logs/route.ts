import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canViewLogs")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.activityLog.count(),
  ]);

  return NextResponse.json({
    success: true,
    data: logs,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
