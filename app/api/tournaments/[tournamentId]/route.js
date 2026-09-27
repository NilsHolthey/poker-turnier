import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { deleteTournament, updateTournamentSettings } from "@/lib/db/tournamentEngine";

// DELETE /api/tournaments/:tournamentId - admin-only: Turnier + Tische/Spieler/
// Moves vollständig löschen (Chat-Wunsch: "need also a clear tournament or so
// for admin", siehe AdminBoard.js "Turnier löschen").
export async function DELETE(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    await deleteTournament(new ObjectId(tournamentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

const validTableSize = (n) => Number.isInteger(n) && n >= 2 && n <= 10;

// PATCH /api/tournaments/:tournamentId - admin-only: Turnier-Einstellungen
// ändern (Name, Rebuy, Balancing-Regeln, Halbfinale/Finale-Struktur).
export async function PATCH(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const baseline = Number(body.baseline);
  const dissolveThreshold = Number(body.dissolveThreshold);
  const balanceDiffThreshold = Number(body.balanceDiffThreshold);
  const halbfinaleTableCount = Number(body.halbfinaleTableCount);
  const halbfinaleTableSize = Number(body.halbfinaleTableSize);
  const finaleTableSize = Number(body.finaleTableSize);

  if (!name) return NextResponse.json({ error: "Turniername fehlt" }, { status: 400 });
  if (!Number.isInteger(baseline) || baseline < 1) {
    return NextResponse.json({ error: "Ungültige Mindestgröße" }, { status: 400 });
  }
  if (!Number.isInteger(dissolveThreshold) || dissolveThreshold < 0) {
    return NextResponse.json({ error: "Ungültiger Auflösungs-Schwellwert" }, { status: 400 });
  }
  if (!Number.isInteger(balanceDiffThreshold) || balanceDiffThreshold < 1) {
    return NextResponse.json({ error: "Ungültiger Ausgleichs-Schwellwert" }, { status: 400 });
  }
  if (!Number.isInteger(halbfinaleTableCount) || halbfinaleTableCount < 1) {
    return NextResponse.json({ error: "Ungültige Halbfinale-Tischanzahl" }, { status: 400 });
  }
  if (!validTableSize(halbfinaleTableSize) || !validTableSize(finaleTableSize)) {
    return NextResponse.json({ error: "Tischgröße muss zwischen 2 und 10 liegen" }, { status: 400 });
  }

  try {
    await updateTournamentSettings(new ObjectId(tournamentId), {
      name,
      rebuyPhaseActive: !!body.rebuyPhaseActive,
      baseline,
      dissolveThreshold,
      balanceDiffThreshold,
      halbfinale: { targetTables: halbfinaleTableCount, tableSize: halbfinaleTableSize },
      finale: { targetTables: 1, tableSize: finaleTableSize },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
