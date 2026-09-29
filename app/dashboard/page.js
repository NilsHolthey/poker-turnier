import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import { getRole } from "@/lib/authz";
import DashboardBoard from "@/components/DashboardBoard";
import LoginGate from "@/components/LoginGate";
import styles from "../page.module.css";

// TV-Dashboard (Chat-Wunsch: "dashboard like overview page ... airplay on a
// big tv ... implement it for admin first, that once implementation is ready
// we create the overview account. for now reachable via admin") - admin-only
// Gate ist bewusst vorläufig: sobald es den geplanten eigenen
// "overview"-Account gibt, wird die Rollen-Prüfung hier durch dessen Rolle
// ersetzt statt durch role === "admin".
export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Dashboard" />;
  }

  const role = getRole(session);
  if (role !== "admin") {
    return (
      <main className={styles.gate}>
        <h1>Keine Berechtigung</h1>
        <p>Dieser Bereich ist nur für Admins zugänglich.</p>
        <Link className={styles.loginButton} href="/">
          Zurück zum Board
        </Link>
      </main>
    );
  }

  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({}, { sort: { createdAt: -1 } });

  if (!tournament) {
    return (
      <main className={styles.gate}>
        <h1>Kein aktives Turnier</h1>
        <Link className={styles.loginButton} href="/admin">
          Zum Admin-Bereich
        </Link>
      </main>
    );
  }

  // Alle Tische der AKTUELLEN Phase, nicht nur aktive (Chat-Wunsch: "do not
  // remove the table when it's deleted but rather show a greyed out
  // version") - gleiche Query wie .../dashboard-state fürs spätere Polling,
  // siehe dort für die Begründung.
  const [tables, players] = await Promise.all([
    db
      .collection("tables")
      .find({ tournamentId: tournament._id, phaseIndex: tournament.phaseIndex })
      .sort({ label: 1 })
      .toArray(),
    // Auch gebustete Spieler (Chat-Wunsch: "if player is out, the list
    // should not shrink ... get appended at the end greyed out").
    db.collection("players").find({ tournamentId: tournament._id }).toArray(),
  ]);

  const initialState = JSON.parse(JSON.stringify({ tournament, tables, players }));

  return <DashboardBoard tournamentId={tournament._id.toString()} initialState={initialState} />;
}
