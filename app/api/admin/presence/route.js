import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { listPresence } from "@/lib/db/presence";
import { KNOWN_ACCOUNTS, PRESENCE_ONLINE_THRESHOLD_MS } from "@/lib/constants";

// GET /api/admin/presence - Chat-Wunsch: "admin ... site where we see which
// users are currently logged in ... is there a way to display it on app as
// admin" - listet ALLE festen Accounts (nicht nur die mit einem bisherigen
// Presence-Dokument), damit auch "noch nie aktiv gewesen" sichtbar wird statt
// einfach zu fehlen.
export async function GET(request) {
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const presenceByNickname = new Map((await listPresence()).map((p) => [p._id, p]));
  const now = Date.now();

  const accounts = KNOWN_ACCOUNTS.map(({ nickname, role }) => {
    const presence = presenceByNickname.get(nickname);
    const lastSeenAt = presence?.lastSeenAt ?? null;
    return {
      nickname,
      role,
      lastSeenAt,
      online: !!lastSeenAt && now - new Date(lastSeenAt).getTime() < PRESENCE_ONLINE_THRESHOLD_MS,
    };
  });

  return NextResponse.json({ accounts });
}
