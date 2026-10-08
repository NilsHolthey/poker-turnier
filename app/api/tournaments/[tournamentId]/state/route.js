import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/authz";
import { checkBlindLevelNotification } from "@/lib/db/tournamentEngine";

// GET /api/tournaments/:tournamentId/state - Read-Model fürs UI: Turnier + aktive
// Tische + aktive Spieler. Nicht Teil der 4 spec-geforderten Endpunkte, aber ohne
// das kann das Frontend nichts anzeigen.
export async function GET(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const db = await getDb();
  const tId = new ObjectId(tournamentId);
  // Chat-Wunsch: "push notifications for blind level increase and for start
  // of tournament" - kein Server-Cron verfügbar, daher an den ohnehin alle 8s
  // laufenden Poll dieser Route angehängt (siehe checkBlindLevelNotification,
  // lib/db/tournamentEngine.js, für die Dedup-Logik dahinter).
  await checkBlindLevelNotification(tId);
  const [tournament, tables, players] = await Promise.all([
    db.collection("tournaments").findOne({ _id: tId }),
    db
      .collection("tables")
      .find({ tournamentId: tId, active: true })
      .sort({ label: 1 })
      .toArray(),
    db.collection("players").find({ tournamentId: tId, status: "active" }).toArray(),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ tournament, tables, players });
}
