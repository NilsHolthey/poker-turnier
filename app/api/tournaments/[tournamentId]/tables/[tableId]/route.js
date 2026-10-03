import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { removeTableSeat } from "@/lib/db/tournamentEngine";

// PATCH /api/tournaments/:tournamentId/tables/:tableId - admin-only:
// reduziert maxSeats eines bestehenden Tisches um 1 (docs/table-size-
// kickoff-prompt.md, §3 "Sitzplätze nachträglich entfernen"). Eigene Route
// statt eines generischen Body-Patch-Felds, weil die eigentliche Validierung
// (höchste belegte Sitznummer vs. neue Kapazität, siehe removeTableSeat)
// ausschließlich serverseitig gegen den aktuellen Spielerstand sinnvoll ist.
export async function PATCH(request, { params }) {
  const { tournamentId, tableId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    const result = await removeTableSeat(new ObjectId(tournamentId), tableId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
