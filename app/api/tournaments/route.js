import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createTournament } from "@/lib/db/tournamentEngine";
import {
  PHASES,
  DEFAULT_BASELINE,
  DEFAULT_DISSOLVE_THRESHOLD,
  DEFAULT_BALANCE_DIFF_THRESHOLD,
  DEFAULT_SMALL_TABLE_THRESHOLD,
  DEFAULT_SMALL_TABLE_ALERT_COUNT,
} from "@/lib/constants";

function validTableSize(n) {
  return Number.isInteger(n) && n >= 2 && n <= 10;
}

// POST /api/tournaments - admin-only: Turnier anlegen und alle Spieler sofort
// auf die gewünschte Tischanzahl/-größe verteilen (Admin-Setup-Screen).
export async function POST(request) {
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const name = body.name?.trim();
  const tableCount = Number(body.tableCount);
  const tableSize = Number(body.tableSize);
  const playerNames = Array.isArray(body.playerNames)
    ? body.playerNames.map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean)
    : [];

  // Halbfinale/Finale-Tischstruktur ist admin-konfigurierbar statt fest über
  // die globale PHASES-Konstante vorgegeben (siehe Chat) - defaultet auf die
  // spec-Werte, wenn nicht angegeben.
  const halbfinaleTableCount = Number.isInteger(Number(body.halbfinaleTableCount))
    ? Number(body.halbfinaleTableCount)
    : PHASES[1].targetTables;
  const halbfinaleTableSize = Number.isInteger(Number(body.halbfinaleTableSize))
    ? Number(body.halbfinaleTableSize)
    : PHASES[1].tableSize;
  const finaleTableSize = Number.isInteger(Number(body.finaleTableSize))
    ? Number(body.finaleTableSize)
    : PHASES[2].tableSize;

  if (!name) return NextResponse.json({ error: "Turniername fehlt" }, { status: 400 });
  if (!Number.isInteger(tableCount) || tableCount < 1) {
    return NextResponse.json({ error: "Ungültige Tischanzahl" }, { status: 400 });
  }
  if (!validTableSize(tableSize)) {
    return NextResponse.json({ error: "Tischgröße muss zwischen 2 und 10 liegen" }, { status: 400 });
  }
  if (!Number.isInteger(halbfinaleTableCount) || halbfinaleTableCount < 1) {
    return NextResponse.json({ error: "Ungültige Halbfinale-Tischanzahl" }, { status: 400 });
  }
  if (!validTableSize(halbfinaleTableSize)) {
    return NextResponse.json({ error: "Halbfinale-Tischgröße muss zwischen 2 und 10 liegen" }, { status: 400 });
  }
  if (!validTableSize(finaleTableSize)) {
    return NextResponse.json({ error: "Finale-Tischgröße muss zwischen 2 und 10 liegen" }, { status: 400 });
  }
  if (playerNames.length === 0) {
    return NextResponse.json({ error: "Mindestens ein Spieler nötig (der erste ist die Bank)" }, { status: 400 });
  }
  if (playerNames.length > tableCount * tableSize) {
    return NextResponse.json(
      { error: `${playerNames.length} Spieler passen nicht auf ${tableCount * tableSize} Plätze` },
      { status: 400 }
    );
  }

  const baseline = Number.isInteger(Number(body.baseline)) ? Number(body.baseline) : DEFAULT_BASELINE;
  const dissolveThreshold = Number.isInteger(Number(body.dissolveThreshold))
    ? Number(body.dissolveThreshold)
    : DEFAULT_DISSOLVE_THRESHOLD;
  const balanceDiffThreshold = Number.isInteger(Number(body.balanceDiffThreshold))
    ? Number(body.balanceDiffThreshold)
    : DEFAULT_BALANCE_DIFF_THRESHOLD;
  const smallTableThreshold = Number.isInteger(Number(body.smallTableThreshold))
    ? Number(body.smallTableThreshold)
    : DEFAULT_SMALL_TABLE_THRESHOLD;
  const smallTableAlertCount = Number.isInteger(Number(body.smallTableAlertCount))
    ? Number(body.smallTableAlertCount)
    : DEFAULT_SMALL_TABLE_ALERT_COUNT;

  const phasePlans = [
    { targetTables: tableCount, tableSize },
    { targetTables: halbfinaleTableCount, tableSize: halbfinaleTableSize },
    { targetTables: 1, tableSize: finaleTableSize },
  ];

  try {
    const result = await createTournament({
      name,
      tableCount,
      tableSize,
      playerNames,
      baseline,
      dissolveThreshold,
      balanceDiffThreshold,
      smallTableThreshold,
      smallTableAlertCount,
      rebuyPhaseActive: !!body.rebuyPhaseActive,
      phasePlans,
      sequentialSeating: !!body.sequentialSeating,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
