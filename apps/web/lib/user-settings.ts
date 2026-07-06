import { prisma, type Role } from "@axona/db";

// SET.3 — user profile + sessions read model (server-only, own-user).
export interface DeviceSession {
  id: string;
  device: string;
  ip: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface UserSettings {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarKey: string | null;
  sessions: DeviceSession[];
}

export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, avatarKey: true },
  });
  if (!user) return null;
  const sessions = await prisma.loginSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    take: 12,
    select: {
      id: true,
      device: true,
      ip: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  return { ...user, sessions };
}

// Turn a raw user-agent into a friendly device label for the list.
export function deviceLabel(ua: string): string {
  const os = /Mac/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : "Device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Safari/.test(ua)
        ? "Safari"
        : /Firefox/.test(ua)
          ? "Firefox"
          : "Browser";
  return `${browser} on ${os}`;
}
