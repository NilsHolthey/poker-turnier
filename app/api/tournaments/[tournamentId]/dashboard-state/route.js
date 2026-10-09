import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/authz";
import { checkBlindLevelNotification } from "@/lib/db/tournamentEngine";

// GET /api/tournaments/:tournamentId/dashboard-state - eigenes Read-Model nur
// fürs TV-Dashboard (Chat-Wunsch: "do not remove the table when it's deleted
// but rather show a greyed out version so we always have the 8 tables") -
// anders als .../state (das für TournamentBoard nur AKTIVE Tische liefert)
// gibt diese Route ALLE Tische der AKTUELLEN Phase zurück, aufgelöste
// inklusive, damit das Dashboard sie ausgegraut an ihrem Platz zeigen kann
// statt sie verschwinden zu lassen. Tische alter Phasen bleiben draußen, weil
// jeder Tisch sein eigenes phaseIndex fest zum Anlagezeitpunkt trägt
// (endPhase() erzeugt neue Tisch-Dokumente statt alte umzuschreiben).
export async function GET(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const db = await getDb();
  const tId = new ObjectId(tournamentId);
  // Chat-Wunsch: "push notifications for blind level increase and for start
  // of tournament" - kein Server-Cron verfügbar, daher an den Poll des
  // TV-Dashboards angehängt (siehe checkBlindLevelNotification,
  // lib/db/tournamentEngine.js). Das Dashboard läuft typischerweise
  // durchgängig, ist also ein zuverlässiger zweiter "Entdecker" neben den
  // Tisch-Polls in .../state.
  await checkBlindLevelNotification(tId);
  const tournament = await db.collection("tournaments").findOne({ _id: tId });
  if (!tournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden" }, { status: 404 });
  }

  const [tables, players] = await Promise.all([
    db
      .collection("tables")
      .find({ tournamentId: tId, phaseIndex: tournament.phaseIndex })
      .sort({ label: 1 })
      .toArray(),
    // Auch gebustete Spieler (nicht nur aktive) - Chat-Wunsch: "if player is
    // out, the list should not shrink ... get appended at the end greyed
    // out". DashboardBoard.js trennt anhand von status/bustedAt selbst in
    // aktive und angehängte gebustete Zeilen.
    db.collection("players").find({ tournamentId: tId }).toArray(),
  ]);

  return NextResponse.json({ tournament, tables, players });
}
