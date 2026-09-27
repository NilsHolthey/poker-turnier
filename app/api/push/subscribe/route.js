import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/authz";

// POST /api/push/subscribe - registriert die Push-Subscription eines Geräts.
// Nicht turnier-gebunden (siehe lib/server/push.js): ein Gerät bleibt "tisch3",
// unabhängig davon, welches Turnier gerade läuft oder welche Tisch-Dokumente
// dahinterstecken.
export async function POST(request) {
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Ungültige Subscription" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("pushSubscriptions").updateOne(
    { endpoint: sub.endpoint },
    {
      $set: { nickname: auth.session.user.nickname, keys: sub.keys },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}
