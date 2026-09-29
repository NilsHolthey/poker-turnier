import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireRole, canManageTable } from "@/lib/authz";
import { seatOf, tableOrdinalFromLabel, isRebuyPhaseActive } from "@/lib/core";

// PATCH /api/tournaments/:tournamentId/players/:playerId/seat - Spieler
// innerhalb SEINES aktuellen Tisches auf einen anderen Sitzplatz verschieben
// (Drag & Drop, spec-Erweiterung aus dem Chat). Kein Tischwechsel, keine
// moves-Audit-Zeile - das ist reines Umsetzen am selben Tisch, kein
// balance/dissolve-Zug. Gleiche Rollenlogik wie Umbenennen/Hinzufügen
// ("korrigieren" nach Rebuy-Phase nur noch admin).
export async function PATCH(request, { params }) {
  const { tournamentId, playerId } = await params;
  const db = await getDb();
  const tId = new ObjectId(tournamentId);

  const tournament = await db.collection("tournaments").findOne({ _id: tId });
  if (!tournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden" }, { status: 404 });
  }
  const allowedRoles = isRebuyPhaseActive(tournament.config, tournament.blindSchedule)
    ? ["admin", "operator"]
    : ["admin"];
  const auth = await requireRole(request, allowedRoles);
  if (auth.error) return auth.error;

  const body = await request.json();
  const targetSeatIndex = Number(body.seatIndex);
  if (!Number.isInteger(targetSeatIndex) || targetSeatIndex < 0) {
    return NextResponse.json({ error: "Ungültiger Sitzplatz" }, { status: 400 });
  }

  const player = await db
    .collection("players")
    .findOne({ _id: new ObjectId(playerId), tournamentId: tId, status: "active" });
  if (!player) {
    return NextResponse.json({ error: "Spieler nicht gefunden" }, { status: 404 });
  }

  const table = await db.collection("tables").findOne({ _id: player.tableId, tournamentId: tId });
  if (!table) {
    return NextResponse.json({ error: "Tisch nicht gefunden" }, { status: 404 });
  }
  if (!canManageTable(auth.role, auth.session, table.label)) {
    return NextResponse.json({ error: "Du darfst nur deinen eigenen Tisch verwalten" }, { status: 403 });
  }
  if (targetSeatIndex >= table.maxSeats) {
    return NextResponse.json({ error: "Sitzplatz existiert an diesem Tisch nicht" }, { status: 400 });
  }

  const currentSeatIndex = seatOf(player.num, table.maxSeats);
  if (currentSeatIndex === targetSeatIndex) {
    return NextResponse.json({ ok: true });
  }

  const ordinal = tableOrdinalFromLabel(table.label);
  const targetNum = `${ordinal}.${targetSeatIndex + 1}`;

  const occupant = await db
    .collection("players")
    .findOne({ tableId: player.tableId, status: "active", num: targetNum });

  // Swap braucht einen Zwischenschritt: player.num direkt auf targetNum zu
  // setzen würde kurzzeitig zwei aktive Spieler mit demselben num im
  // Turnier haben und am partiellen unique-Index {tournamentId,num,
  // status:"active"} scheitern (dieselbe Bug-Klasse wie beim Bust-out/Re-add,
  // siehe Chat weiter oben - num ist beim Zug niemals kurzzeitig doppelt
  // vergeben, egal in welcher Reihenfolge man die Updates schreibt, außer man
  // räumt den Zielwert vorher über einen garantiert einzigartigen Platzhalter).
  if (occupant) {
    const tempNum = `9999.${Date.now()}`;
    await db.collection("players").updateOne({ _id: player._id }, { $set: { num: tempNum } });
    await db.collection("players").updateOne({ _id: occupant._id }, { $set: { num: player.num } });
    await db.collection("players").updateOne({ _id: player._id }, { $set: { num: targetNum } });
  } else {
    await db.collection("players").updateOne({ _id: player._id }, { $set: { num: targetNum } });
  }

  return NextResponse.json({ ok: true });
}
