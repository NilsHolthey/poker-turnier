import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import { getRole } from "@/lib/authz";
import AdminBoard from "@/components/AdminBoard";
import {
  PHASES,
  DEFAULT_BALANCE_DIFF_THRESHOLD,
  DEFAULT_SMALL_TABLE_THRESHOLD,
  DEFAULT_SMALL_TABLE_ALERT_COUNT,
} from "@/lib/constants";
import LoginGate from "@/components/LoginGate";
import styles from "../page.module.css";

// Eigene, admin-exklusive Seite statt Modals über dem Board (Chat-Wunsch: "the
// new admin site", erreichbar über das Hamburger-Menü) - Neues Turnier/
// Blindstruktur-Bearbeitung leben jetzt hier statt als Hamburger-Menüpunkte,
// die das Board-Overlay öffnen.
export default async function AdminPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Admin-Bereich" />;
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
  const schedule = tournament?.blindSchedule ? JSON.parse(JSON.stringify(tournament.blindSchedule)) : null;

  const settings = tournament
    ? {
        name: tournament.name,
        rebuyPhaseActive: !!tournament.config.rebuyPhaseActive,
        baseline: tournament.config.baseline,
        dissolveThreshold: tournament.config.dissolveThreshold,
        balanceDiffThreshold: tournament.config.balanceDiffThreshold ?? DEFAULT_BALANCE_DIFF_THRESHOLD,
        smallTableThreshold: tournament.config.smallTableThreshold ?? DEFAULT_SMALL_TABLE_THRESHOLD,
        smallTableAlertCount: tournament.config.smallTableAlertCount ?? DEFAULT_SMALL_TABLE_ALERT_COUNT,
        halbfinaleTableCount: tournament.phasePlans?.[1]?.targetTables ?? PHASES[1].targetTables,
        halbfinaleTableSize: tournament.phasePlans?.[1]?.tableSize ?? PHASES[1].tableSize,
        finaleTableSize: tournament.phasePlans?.[2]?.tableSize ?? PHASES[2].tableSize,
        // Chat-Wunsch: "if the new modus was selected, I should not be able
        // to edit anything except the title" - siehe TournamentEditForm.js.
        simpleMode: !!tournament.config.simpleMode,
      }
    : null;

  return (
    <AdminBoard
      tournamentId={tournament ? tournament._id.toString() : null}
      tournamentName={tournament?.name ?? null}
      schedule={schedule}
      settings={settings}
    />
  );
}
