import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { startManualTableMerge } from "@/lib/db/tournamentEngine";

// POST /api/tournaments/:tournamentId/tables/:tableId/merge - admin-only:
// manuelles Auflösen/Zusammenlegen eines gewählten Tisches (Chat-Wunsch: "we
// kind of need the possibility to merge tables"), z.B. wenn mehrere Tische
// unabhängig auf dieselbe kleine Größe geschrumpft sind und weder das
// automatische Auflösen noch Ausgleichen greift (siehe den
// smallTableAlertSent-Push in resolvePendingAction). Der Bestätigungsdialog
// im UI ("Tisch X wirklich auflösen?") ist Sache des Clients vor diesem Call.
export async function POST(request, { params }) {
  const { tournamentId, tableId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    const pendingAction = await startManualTableMerge(new ObjectId(tournamentId), tableId);
    return NextResponse.json({ pendingAction });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
