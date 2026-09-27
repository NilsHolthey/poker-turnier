import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/authz";

// POST /api/push/unsubscribe - entfernt die Push-Subscription eines Geräts
// (z.B. wenn der Nutzer Benachrichtigungen im Browser wieder abschaltet).
export async function POST(request) {
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint fehlt" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("pushSubscriptions").deleteOne({ endpoint: body.endpoint });

  return NextResponse.json({ success: true });
}
