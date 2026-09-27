import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import OverviewBoard from "@/components/OverviewBoard";
import LoginGate from "@/components/LoginGate";
import styles from "../page.module.css";

// Eigene Seite statt Modal (Chat-Wunsch: "overview siete that shows the full
// blind table inclusive of time and breaks and also players left ... reached
// via hamburger menu") - für ALLE angemeldeten Rollen, kein Admin-Gate.
export default async function OverviewPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Übersicht" />;
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

  const playerCount = await db
    .collection("players")
    .countDocuments({ tournamentId: tournament._id, status: "active" });

  // Date-Instanzen sind kein gültiges Server->Client-Prop, gleiches
  // JSON-Roundtrip-Muster wie initialState in app/page.js.
  const schedule = tournament.blindSchedule ? JSON.parse(JSON.stringify(tournament.blindSchedule)) : null;

  return <OverviewBoard tournamentName={tournament.name} schedule={schedule} playerCount={playerCount} />;
}
