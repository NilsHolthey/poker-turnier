import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db/mongodb";
import { getRole } from "@/lib/authz";
import { tableOrdinalFromLabel } from "@/lib/core";
import TournamentBoard from "@/components/TournamentBoard";
import TournamentSetupForm from "@/components/TournamentSetupForm";
import LoginGate from "@/components/LoginGate";
import styles from "./page.module.css";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate />;
  }

  const role = getRole(session);
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({}, { sort: { createdAt: -1 } });

  if (!tournament) {
    return (
      <main className={styles.gate}>
        <h1>Kein aktives Turnier</h1>
        {role === "admin" ? (
          <TournamentSetupForm />
        ) : (
          <p>Es wurde noch kein Turnier angelegt. Bitte an den Admin wenden.</p>
        )}
      </main>
    );
  }

  const [tables, players] = await Promise.all([
    db
      .collection("tables")
      .find({ tournamentId: tournament._id, active: true })
      .sort({ label: 1 })
      .toArray(),
    db.collection("players").find({ tournamentId: tournament._id, status: "active" }).toArray(),
  ]);

  // ObjectId/Date instances aren't valid Server->Client props; round-trip through
  // JSON (same shape the GET .../state route returns for client-side refetches).
  const initialState = JSON.parse(JSON.stringify({ tournament, tables, players }));

  // Jeder Operator-Account ist fest einem Tisch zugeordnet (spec, "ein
  // Operator-Account pro Tisch"). Beim Login soll dieser Tisch automatisch als
  // "Mein Tisch" gelten und direkt angezeigt werden - das ersetzt für echte
  // Logins die manuelle Chip-Reihen-Auswahl, die nur eine Simulation dafür war.
  const tableMatch = session.user.nickname?.match(/^tisch([1-8])$/);
  const myTable = tableMatch
    ? tables.find((t) => tableOrdinalFromLabel(t.label) === tableMatch[1])
    : null;

  const user = {
    name: session.user.nickname || session.user.name || session.user.sub,
    role,
    myTableId: myTable ? myTable._id.toString() : null,
  };

  return <TournamentBoard tournamentId={tournament._id.toString()} initialState={initialState} user={user} />;
}
