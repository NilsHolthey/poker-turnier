import { NextResponse } from "next/server";

// TEMPORÄR (Push-Debugging, siehe Chat): sw.js kann Fehler/DevTools-Konsole
// nicht zuverlässig zeigen (Extension-Service-Worker verwechselt, kein
// "inspect"-Link) - hier landen die Logs stattdessen direkt im
// `npm run dev`-Terminal. Nach Abschluss der Fehlersuche wieder entfernen.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  console.log("[push-debug]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
