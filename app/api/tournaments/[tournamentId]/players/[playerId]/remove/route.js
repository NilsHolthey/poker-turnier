import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { removePlayerEntry } from "@/lib/db/tournamentEngine";

// DELETE /api/tournaments/:tournamentId/players/:playerId/remove - admin-only,
// harte Entfernung aus dem Turnier (Chat-Wunsch: "full player list ... only
// admin can remove ... even after tournament start. this will an edit not a
// bust"). Eigene Sub-Route statt des bestehenden DELETE
// .../players/:playerId (das ist der Bust-out, admin+operator, nur am
// eigenen Tisch, setzt status:"busted") - beide bleiben unabhängig
// voneinander bestehen, unterschiedliche Semantik.
export async function DELETE(request, { params }) {
  const { tournamentId, playerId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    const pendingAction = await removePlayerEntry(new ObjectId(tournamentId), new ObjectId(playerId));
    return NextResponse.json({ pendingAction });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
