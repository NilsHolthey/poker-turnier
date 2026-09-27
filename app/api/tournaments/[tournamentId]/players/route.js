import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireRole, canManageTable } from "@/lib/authz";
import { nextFreeSeatNum, tableOrdinalFromLabel, seatOf } from "@/lib/core";

// POST /api/tournaments/:tournamentId/players - Spieler hinzufügen.
// admin: immer erlaubt. operator: nur solange config.rebuyPhaseActive === true
// (spec, "Bank / Rebuy-Sonderregel") UND nur am eigenen Tisch (Chat-Wunsch,
// siehe lib/authz.js canManageTable - Abweichung von der ursprünglichen
// "kein tableIds-Scoping"-Spec-Entscheidung).
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden" }, { status: 404 });
  }

  const allowedRoles = tournament.config.rebuyPhaseActive ? ["admin", "operator"] : ["admin"];
  const auth = await requireRole(request, allowedRoles);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.tableId) {
    return NextResponse.json({ error: "tableId fehlt" }, { status: 400 });
  }
  const tableId = new ObjectId(body.tableId);
  const table = await db
    .collection("tables")
    .findOne({ _id: tableId, tournamentId: tournament._id, active: true });
  if (!table) {
    return NextResponse.json({ error: "Tisch nicht gefunden" }, { status: 404 });
  }
  if (!canManageTable(auth.role, auth.session, table.label)) {
    return NextResponse.json({ error: "Du darfst nur deinen eigenen Tisch verwalten" }, { status: 403 });
  }

  const existingPlayers = await db
    .collection("players")
    .find({ tableId, status: "active" })
    .toArray();
  if (existingPlayers.length >= table.maxSeats) {
    return NextResponse.json({ error: "Tisch ist voll" }, { status: 409 });
  }

  const ordinal = tableOrdinalFromLabel(table.label);
  let num;
  if (Number.isInteger(body.seatIndex)) {
    // Quick-add on a specific empty seat circle - must land exactly there, not
    // wherever nextFreeSeatNum() would otherwise pick.
    const taken = existingPlayers.some((p) => seatOf(p.num, table.maxSeats) === body.seatIndex);
    if (taken || body.seatIndex < 0 || body.seatIndex >= table.maxSeats) {
      return NextResponse.json({ error: "Sitzplatz ist bereits belegt" }, { status: 409 });
    }
    num = `${ordinal}.${body.seatIndex + 1}`;
  } else {
    num = nextFreeSeatNum(
      existingPlayers.map((p) => p.num),
      table.maxSeats,
      ordinal
    );
  }
  const now = new Date();
  const player = {
    tournamentId: tournament._id,
    tableId,
    num,
    name: body.name?.trim() || `Spieler ${num}`,
    isBank: false,
    status: "active",
    seatHistory: [{ tableId, timestamp: now, reason: "manual" }],
  };

  try {
    const { insertedId } = await db.collection("players").insertOne(player);
    return NextResponse.json({ player: { ...player, _id: insertedId } }, { status: 201 });
  } catch (err) {
    // z.B. Duplicate-Key auf {tournamentId,num} bei einer Concurrency-Race
    // zwischen zwei Operatoren, die gleichzeitig denselben freien Sitz füllen
    // (spec, "Offene Architektur-Fragen: Concurrency") - lieber eine
    // verständliche 409 als ein nackter 500 ohne jede Diagnose.
    if (err.code === 11000) {
      return NextResponse.json({ error: "Sitzplatz wurde gerade von jemand anderem belegt" }, { status: 409 });
    }
    throw err;
  }
}
