import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/authz";
import { pauseBlindClock, resumeBlindClock } from "@/lib/db/tournamentEngine";

// POST /api/tournaments/:tournamentId/blind-schedule/pause - admin-only:
// pausiert die Blind-Uhr (Chat-Wunsch: "admin should have more control over
// the blindes and timer so pausing it should be a possibility ... especially
// before hf and finale table we should pause, no auto pause but possibility
// for admin"). Eigene Sub-Route statt eines weiteren HTTP-Verbs auf
// .../blind-schedule - PUT/PATCH/POST/DELETE sind dort schon für
// setzen/Level springen/starten/zurücksetzen vergeben.
export async function POST(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    await pauseBlindClock(new ObjectId(tournamentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// DELETE /api/tournaments/:tournamentId/blind-schedule/pause - admin-only:
// setzt die Blind-Uhr wieder fort (spiegelt "DELETE hebt einen Zustand wieder
// auf" wie schon bei DELETE .../blind-schedule = zurücksetzen).
export async function DELETE(request, { params }) {
  const { tournamentId } = await params;
  const auth = await requireRole(request, ["admin"]);
  if (auth.error) return auth.error;

  try {
    await resumeBlindClock(new ObjectId(tournamentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
