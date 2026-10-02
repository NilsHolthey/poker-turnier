import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import { getRole } from "@/lib/authz";
import PlayerListBoard from "@/components/PlayerListBoard";
import LoginGate from "@/components/LoginGate";
import styles from "../page.module.css";

// Eigene Seite statt Modal (Chat-Wunsch: "as admin I need a site with the
// full player list. this list can be reachable via hamburger menu by all.
// but only admin can remove or add or edit here even after tournament
// start") - für ALLE angemeldeten Rollen sichtbar (kein Admin-Gate beim
// Zugriff selbst, nur bei den Mutations-Aktionen innerhalb der Seite, siehe
// PlayerListBoard.js), gleiches Muster wie /overview.
export default async function PlayersPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Spielerliste" />;
  }

  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({}, { sort: { createdAt: -1 } });

  if (!tournament) {
    return (
      <main className={styles.gate}>
        <h1>Kein aktives Turnier</h1>
        <Link className={styles.loginButton} href="/">
          Zurück
        </Link>
      </main>
    );
  }

  // Kein status-Filter (Chat-Wunsch: "full player list") - anders als die
  // übrigen Read-Modelle (.../state, .../dashboard-state), die bewusst nur
  // AKTIVE Spieler zeigen. Hier soll admin auch gebustete Spieler sehen
  // (und bei Bedarf entfernen) können.
  const [players, tables] = await Promise.all([
    db.collection("players").find({ tournamentId: tournament._id }).sort({ num: 1 }).toArray(),
    // Nur aktive Tische - für die Tisch-Auswahl beim Hinzufügen (ein
    // aufgelöster Tisch kann keine neuen Spieler mehr bekommen) und um
    // aktiven Spielern ihr aktuelles Tisch-Label anzuzeigen.
    db.collection("tables").find({ tournamentId: tournament._id, active: true }).sort({ label: 1 }).toArray(),
  ]);

  const user = { role: getRole(session) };

  return (
    <PlayerListBoard
      tournamentId={tournament._id.toString()}
      tournamentName={tournament.name}
      initialPlayers={JSON.parse(JSON.stringify(players))}
      tables={JSON.parse(JSON.stringify(tables))}
      user={user}
    />
  );
}
