import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { applyMove } from "@/lib/db/tournamentEngine";

// POST /api/tournaments/:tournamentId/moves/confirm
// Body: die zuvor per DELETE .../players/:id oder .../moves/reroll erhaltene
// pendingAction/proposal ({ type, playerId, toTableId, ... }). Jede Umsetzung
// braucht diese explizite Bestätigung, auch wenn die Bank nicht beteiligt ist
// (spec, "Auslosung: UX-Ablauf").
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const proposal = await request.json();
  if (!proposal?.playerId || !proposal?.toTableId) {
    return NextResponse.json({ error: "Ungültiger Move-Vorschlag" }, { status: 400 });
  }

  const confirmedBy = auth.session.user.email ?? auth.session.user.sub;
  const pendingAction = await applyMove(new ObjectId(tournamentId), proposal, confirmedBy);
  return NextResponse.json({ pendingAction });
}
