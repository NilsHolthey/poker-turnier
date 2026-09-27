import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { rerollMove } from "@/lib/db/tournamentEngine";

// POST /api/tournaments/:tournamentId/moves/reroll
// Body: { proposal, excludeIds }. excludeIds sammelt die im Client bereits
// verworfenen Kandidaten (Spieler-IDs bei balance, Tisch-IDs bei dissolve) über
// mehrere Reroll-Runden. proposal.toTableId/playerId === null => "Keine
// Alternative verfügbar", Reroll im UI deaktivieren.
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const { proposal, excludeIds } = await request.json();
  if (!proposal?.type) {
    return NextResponse.json({ error: "Ungültiger Move-Vorschlag" }, { status: 400 });
  }

  const nextProposal = await rerollMove(new ObjectId(tournamentId), proposal, excludeIds ?? []);
  return NextResponse.json({ proposal: nextProposal });
}
