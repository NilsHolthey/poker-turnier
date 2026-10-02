import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import { getRole } from "@/lib/authz";
import { tableOrdinalFromLabel } from "@/lib/core/seating";
import LoginGate from "@/components/LoginGate";
import gateStyles from "../../page.module.css";
import styles from "./page.module.css";

// Admin-exklusive, bewusst simple Druckversion der Spielerliste (Chat-Wunsch:
// "share the new playerlist with all players ... open normal in browser not
// as installed pwa than create a screenshot of full page and share it") -
// KEIN glassChrome/backdrop-filter irgendwo auf dieser Seite (Chat: "if I
// create a screenshot it will not get grabbed" - manche Screenshot-Pfade
// rendern backdrop-filter-Bereiche nicht zuverlässig mit), eigenes
// vollflächiges .page-Hintergrund statt des body::before-Stimmungsbilds
// (app/globals.css) für maximalen Kontrast beim Fotografieren/Teilen.
export default async function PlayerListPrintPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Sitzplan" />;
  }

  const role = getRole(session);
  if (role !== "admin") {
    return (
      <main className={gateStyles.gate}>
        <h1>Keine Berechtigung</h1>
        <p>Dieser Bereich ist nur für Admins zugänglich.</p>
        <Link className={gateStyles.loginButton} href="/">
          Zurück zum Board
        </Link>
      </main>
    );
  }

  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({}, { sort: { createdAt: -1 } });

  if (!tournament) {
    return (
      <main className={gateStyles.gate}>
        <h1>Kein aktives Turnier</h1>
        <Link className={gateStyles.loginButton} href="/">
          Zurück
        </Link>
      </main>
    );
  }

  // Nur AKTIVE Spieler/Tische (Chat-Wunsch: "share ... with all players" -
  // ein Sitzplan zum Platz-Finden, kein vollständiges Teilnehmerverzeichnis
  // mit bereits ausgeschiedenen Spielern).
  const [players, tables] = await Promise.all([
    db.collection("players").find({ tournamentId: tournament._id, status: "active" }).toArray(),
    db.collection("tables").find({ tournamentId: tournament._id, active: true }).toArray(),
  ]);

  const sortedTables = [...tables].sort(
    (a, b) => Number(tableOrdinalFromLabel(a.label)) - Number(tableOrdinalFromLabel(b.label))
  );

  const groups = sortedTables.map((table) => ({
    table,
    players: players
      .filter((p) => p.tableId.toString() === table._id.toString())
      .sort((a, b) => Number(a.num.split(".")[1]) - Number(b.num.split(".")[1])),
  }));

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{tournament.name}</h1>
      <p className={styles.subtitle}>Sitzplan &middot; {players.length} Spieler</p>

      <div className={styles.groups}>
        {groups.map(({ table, players: tablePlayers }) => (
          <section key={table._id.toString()} className={styles.group}>
            <h2 className={styles.groupTitle}>{table.label}</h2>
            {/* Echte <table> statt Flex-Zeilen (Chat: "is it a table? ...
                platz part is not aligned ... always slightly more to the
                right because of character width") - in einer Tabellenspalte
                bekommen alle Zellen dieselbe Breite, dadurch startet "Platz
                X.Y" in jeder Zeile an derselben X-Position, unabhängig von
                der Namenslänge links davon (bei Flex+space-between hing die
                Startposition vom jeweils übrig bleibenden Platz ab). */}
            <table className={styles.table}>
              <tbody>
                {tablePlayers.map((p) => (
                  <tr key={p._id.toString()}>
                    <td className={styles.name}>
                      {p.name}
                      {p.isBank && <span className={styles.bank}>Bank $</span>}
                    </td>
                    <td className={styles.seat}>Platz {p.num}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}
