import { cookies } from "next/headers";
import { Role } from "./roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const SESSION_COOKIE = "teriak_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  try {
    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf8");
    const data = JSON.parse(decoded) as SessionUser;
    return data;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  const encoded = Buffer.from(JSON.stringify(user)).toString("base64");
  cookieStore.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
