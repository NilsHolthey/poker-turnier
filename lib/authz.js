import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { tableOrdinalFromLabel } from "@/lib/core/seating";
import { touchPresence } from "@/lib/db/presence";

// Spec calls for the role coming from a custom `app_metadata.role` claim
// injected via an Auth0 Action (see "Rollenmodell (Auth0)"). That Action was
// wired up correctly (verified: attached to the post-login flow, correct code,
// correct app_metadata) but the custom claim never showed up in the session -
// root cause not found. Falling back to deriving the role from the Auth0
// username instead, since usernames are already fixed per spec ("ein
// Operator-Account pro Tisch"): admin -> admin, tisch1..tisch8 -> operator.
// Revisit the Action approach if this needs to support more than a fixed set
// of accounts.
export function getRole(session) {
  const username = session?.user?.nickname;
  if (username === "admin") return "admin";
  if (username && /^tisch[1-8]$/.test(username)) return "operator";
  return null;
}

// Route handler guard: verifies a session exists and its role is in allowedRoles.
// Returns { error: NextResponse } to return as-is on failure, or { session, role }.
export async function requireRole(request, allowedRoles) {
  const session = await auth0.getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }

  const role = getRole(session);
  if (!role || !allowedRoles.includes(role)) {
    return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }

  // Chat-Wunsch: "admin ... site where we see which users are currently
  // logged in" - jede erfolgreich autorisierte Route läuft hier durch, das
  // ist der zentrale Punkt für den "zuletzt aktiv"-Zeitstempel (siehe
  // lib/db/presence.js), ohne dass jede einzelne Route das selbst tun muss.
  await touchPresence(session.user?.nickname, role);

  return { session, role };
}

// Policy-Wechsel gegenüber der ursprünglichen Spec (siehe
// docs/poker-turnier-mvp-spec.md, "Rollenmodell": "kein tableIds-Scoping" war dort
// eine bewusste Entscheidung) - Chat-Wunsch: ohne Scoping konnte jeder
// Operator-Account an JEDEM Tisch Spieler umbenennen/entfernen, was als
// Abuse-Vektor für Späße auf Kosten anderer Tische erkannt wurde. Extrahiert
// die Tisch-Ziffer aus dem Nickname ("tisch3" -> "3") - dieselbe Quelle, die
// app/page.js schon fürs "Mein Tisch"-Bookmark nutzt.
export function operatorTableOrdinal(session) {
  const match = session?.user?.nickname?.match(/^tisch([1-8])$/);
  return match ? match[1] : null;
}

// admin darf jeden Tisch verwalten; operator nur den eigenen (Ziffernabgleich
// wie beim "Mein Tisch"-Bookmark). Muss serverseitig in jeder
// Roster-verändernden Route geprüft werden - ein deaktivierter Button im UI
// allein verhindert nichts, ein direkter API-Call würde ihn umgehen.
export function canManageTable(role, session, tableLabel) {
  if (role === "admin") return true;
  if (role !== "operator") return false;
  return operatorTableOrdinal(session) === tableOrdinalFromLabel(tableLabel);
}
