import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { endPhase } from "@/lib/db/tournamentEngine";

// POST /api/tournaments/:tournamentId/end-phase - admin-only (spec,
// "Rollenmodell": Phasenübergänge sind Admin-Sache). Der Bestätigungsdialog
// ("Alle X Spieler werden neu verteilt...") ist UI-Zuständigkeit vor diesem Call.
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    const confirmedBy = auth.session.user.email ?? auth.session.user.sub;
    const result = await endPhase(new ObjectId(tournamentId), confirmedBy);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
