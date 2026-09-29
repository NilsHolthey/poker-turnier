import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { setBlindSchedule, setBlindLevelIndex, startBlindClock, resetBlindClock } from "@/lib/db/tournamentEngine";

function isValidLevel(level) {
  return (
    level &&
    Number.isInteger(level.smallBlind) &&
    level.smallBlind >= 0 &&
    Number.isInteger(level.bigBlind) &&
    level.bigBlind >= 0 &&
    Number.isInteger(level.durationMinutes) &&
    level.durationMinutes >= 1 &&
    typeof level.isBreak === "boolean"
  );
}

// PUT /api/tournaments/:tournamentId/blind-schedule - admin-only: komplette
// Blindstruktur (er)setzen. levels kommen bereits strukturiert vom
// BlindScheduleSheet-Formular (ein Feld-Set pro Level).
export async function PUT(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const levels = Array.isArray(body.levels) ? body.levels : [];
  // 1-basiert, "Rebuy endet nach Level X" (Chat-Wunsch) - leer/null heißt kein
  // automatisches Ende, siehe isRebuyPhaseActive() in lib/core/blindSchedule.js.
  const rebuyEndLevelIndex =
    body.rebuyEndLevelIndex === null || body.rebuyEndLevelIndex === undefined || body.rebuyEndLevelIndex === ""
      ? null
      : Number(body.rebuyEndLevelIndex);

  if (!startTime) return NextResponse.json({ error: "Startzeit fehlt" }, { status: 400 });
  if (levels.length === 0) return NextResponse.json({ error: "Mindestens ein Level nötig" }, { status: 400 });
  if (!levels.every(isValidLevel)) {
    return NextResponse.json({ error: "Ungültige Level-Daten" }, { status: 400 });
  }
  if (
    rebuyEndLevelIndex !== null &&
    (!Number.isInteger(rebuyEndLevelIndex) || rebuyEndLevelIndex < 1 || rebuyEndLevelIndex > levels.length)
  ) {
    return NextResponse.json({ error: "Ungültiges Rebuy-Ende-Level" }, { status: 400 });
  }

  try {
    await setBlindSchedule(new ObjectId(tournamentId), { startTime, levels, rebuyEndLevelIndex });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// PATCH /api/tournaments/:tournamentId/blind-schedule - admin-only: aktuelles
// Level manuell weiter-/zurückschalten (spec: kein automatisches Voranschreiten).
export async function PATCH(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const currentLevelIndex = Number(body.currentLevelIndex);
  if (!Number.isInteger(currentLevelIndex) || currentLevelIndex < 0) {
    return NextResponse.json({ error: "Ungültiger Level-Index" }, { status: 400 });
  }

  try {
    await setBlindLevelIndex(new ObjectId(tournamentId), currentLevelIndex);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// POST /api/tournaments/:tournamentId/blind-schedule - admin-only: startet die
// Blind-Uhr explizit (Chat-Fix: "blindes speichern should not start the
// tournament just when admin starts it") - getrennt vom Speichern (PUT), das
// currentLevelStartedAt jetzt bewusst auf null lässt statt sofort loszuticken.
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    await startBlindClock(new ObjectId(tournamentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// DELETE /api/tournaments/:tournamentId/blind-schedule - admin-only: Blind-Uhr
// zurücksetzen (Level 0, nicht gestartet), Struktur bleibt erhalten.
export async function DELETE(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    await resetBlindClock(new ObjectId(tournamentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
