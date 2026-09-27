import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireRole, canManageTable } from "@/lib/authz";
import { resolvePendingAction } from "@/lib/db/tournamentEngine";

// DELETE /api/tournaments/:tournamentId/players/:playerId - Spieler entfernen
// (Bust-out). Policy-Wechsel gegenüber der ursprünglichen Spec ("kein
// tableIds-Scoping"): operator darf nur noch am eigenen Tisch entfernen, sonst
// könnte jeder Operator-Account an jedem Tisch Spieler rauswerfen (Chat-Wunsch,
// siehe lib/authz.js canManageTable). Triggert danach den Dissolve-/Balance-Check.
export async function DELETE(request, { params }) {
  const { tournamentId, playerId } = await params;
  const auth = await requireRole(request, ["admin", "operator"]);
  if (auth.error) return auth.error;

  const db = await getDb();
  const tId = new ObjectId(tournamentId);
  const player = await db
    .collection("players")
    .findOne({ _id: new ObjectId(playerId), tournamentId: tId, status: "active" });
  if (!player) {
    return NextResponse.json({ error: "Spieler nicht gefunden oder bereits ausgeschieden" }, { status: 404 });
  }
  const table = await db.collection("tables").findOne({ _id: player.tableId, tournamentId: tId });
  if (!table || !canManageTable(auth.role, auth.session, table.label)) {
    return NextResponse.json({ error: "Du darfst nur deinen eigenen Tisch verwalten" }, { status: 403 });
  }

  await db.collection("players").updateOne({ _id: player._id }, { $set: { status: "busted" } });

  const pendingAction = await resolvePendingAction(tId);
  return NextResponse.json({ pendingAction });
}

// PATCH /api/tournaments/:tournamentId/players/:playerId - Namen bearbeiten
// (jederzeit editierbar, spec "Eigener 'Namen bearbeiten'-Button pro Tisch").
// Gleiche Rollenlogik wie Hinzufügen: "hinzufügen/korrigieren" ist nach Ende der
// Rebuy-Phase admin-only (spec, "Bank / Rebuy-Sonderregel"), UND operator darf
// nur am eigenen Tisch umbenennen (Chat-Wunsch: sonst könnten Spieler an
// fremden Tischen zum Spaß umbenannt werden, siehe lib/authz.js canManageTable).
export async function PATCH(request, { params }) {
  const { tournamentId, playerId } = await params;
  const db = await getDb();
  const tId = new ObjectId(tournamentId);
  const tournament = await db.collection("tournaments").findOne({ _id: tId });
  if (!tournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden" }, { status: 404 });
  }

  const allowedRoles = tournament.config.rebuyPhaseActive ? ["admin", "operator"] : ["admin"];
  const auth = await requireRole(request, allowedRoles);
  if (auth.error) return auth.error;

  const player = await db.collection("players").findOne({ _id: new ObjectId(playerId), tournamentId: tId });
  if (!player) {
    return NextResponse.json({ error: "Spieler nicht gefunden" }, { status: 404 });
  }
  const table = await db.collection("tables").findOne({ _id: player.tableId, tournamentId: tId });
  if (!table || !canManageTable(auth.role, auth.session, table.label)) {
    return NextResponse.json({ error: "Du darfst nur deinen eigenen Tisch verwalten" }, { status: 403 });
  }

  const { name } = await request.json();
  const trimmed = name?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });
  }

  const result = await db
    .collection("players")
    .updateOne({ _id: player._id }, { $set: { name: trimmed } });
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Spieler nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
