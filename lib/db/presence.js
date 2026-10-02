import { getDb } from "./mongodb.js";

// Chat-Wunsch: "admin ... site where we see which users are currently logged
// in ... is there a way to display it on app as admin" - jeder erfolgreich
// authentifizierte Request aktualisiert den "zuletzt aktiv"-Zeitstempel
// seines Accounts (siehe requireRole in lib/authz.js), kein eigener
// Heartbeat-Call nötig: TournamentBoard.js pollt .../state bereits alle 8s,
// solange ein Operator die Seite offen hat.
export async function touchPresence(nickname, role) {
  if (!nickname || !role) return;
  const db = await getDb();
  await db
    .collection("presence")
    .updateOne({ _id: nickname }, { $set: { role, lastSeenAt: new Date() } }, { upsert: true });
}

export async function listPresence() {
  const db = await getDb();
  return db.collection("presence").find({}).toArray();
}
