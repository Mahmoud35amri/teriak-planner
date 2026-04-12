import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (session) {
    await prisma.activityLog.create({
      data: { userId: session.id, action: "LOGOUT", details: `User ${session.email} logged out` },
    });
  }
  await destroySession();
  return NextResponse.json({ success: true });
}
