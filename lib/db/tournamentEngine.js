import { ObjectId } from "mongodb";
import { getDb, getClient } from "./mongodb.js";
import {
  findTableToDissolve,
  nextDissolveTarget,
  needsBalance,
  findBalanceTables,
  drawBalanceCandidate,
  countSmallTables,
  planPhaseTransition,
  planInitialSeating,
  nextFreeSeatNum,
  tableOrdinalFromLabel,
} from "../core/index.js";
import {
  PHASES,
  TABLE_COLORS,
  DEFAULT_BALANCE_DIFF_THRESHOLD,
  DEFAULT_SMALL_TABLE_THRESHOLD,
  DEFAULT_SMALL_TABLE_ALERT_COUNT,
} from "../constants.js";
import { notifyTable, notifyAdmin } from "../server/push.js";

// Maps active tables + their active players into the plain { id, players } shape
// lib/core's pure functions expect.
async function loadActiveTables(db, tournamentId) {
  const [tables, players] = await Promise.all([
    db.collection("tables").find({ tournamentId, active: true }).toArray(),
    db.collection("players").find({ tournamentId, status: "active" }).toArray(),
  ]);
  return tables.map((t) => ({
    id: t._id.toString(),
    maxSeats: t.maxSeats,
    // lib/core's drawBalanceCandidate/reroll logic keys players by `.id` (string);
    // keep `_id` around too since callers need it for DB writes.
    players: players
      .filter((p) => p.tableId.toString() === t._id.toString())
      .map((p) => ({ ...p, id: p._id.toString() })),
  }));
}

async function retireTable(db, tournamentId, tableId) {
  await db
    .collection("tables")
    .updateOne({ _id: new ObjectId(tableId), tournamentId }, { $set: { active: false } });
}

// Runs the dissolve-check-first-then-balance-check algorithm once against the
// current committed state and returns the next action that needs a manual
// accept/reroll confirmation, or null if the tables are already balanced.
// "retireEmptyTable" (a dissolving table with no active players left to move) is
// applied immediately and skipped - it needs no confirmation, it's bookkeeping.
export async function resolvePendingAction(tournamentId) {
  const db = await getDb();

  // Bounded by the number of active tables: each retire strictly shrinks that count.
  for (let i = 0; i < 64; i++) {
    const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
    if (!tournament) throw new Error("Turnier nicht gefunden");
    // ?? statt || : ältere Turniere ohne dieses Feld bekommen den spec-Default,
    // 0 als bewusst gesetzter Wert bliebe sonst fälschlich überschrieben.
    const { baseline, dissolveThreshold, balanceDiffThreshold } = tournament.config;
    const diffThreshold = balanceDiffThreshold ?? DEFAULT_BALANCE_DIFF_THRESHOLD;

    const tables = await loadActiveTables(db, tournamentId);

    const dissolveTable = findTableToDissolve(tables, dissolveThreshold);
    if (dissolveTable) {
      const player = dissolveTable.players[0];
      if (!player) {
        await retireTable(db, tournamentId, dissolveTable.id);
        continue;
      }
      const remaining = tables.filter((t) => t.id !== dissolveTable.id);
      const target = nextDissolveTarget(remaining, []);
      return {
        type: "dissolve",
        dissolvedTableId: dissolveTable.id,
        playerId: player.id,
        toTableId: target?.id ?? null,
      };
    }

    if (needsBalance(tables, baseline, diffThreshold)) {
      const { fromTable, toTable } = findBalanceTables(tables);
      const candidate = drawBalanceCandidate(fromTable, []);
      return {
        type: "balance",
        fromTableId: fromTable.id,
        toTableId: toTable.id,
        playerId: candidate?.id ?? null,
      };
    }

    // Weder Auflösen noch Ausgleichen greift hier (siehe countSmallTables in
    // lib/core/dissolve.js) - genau der Fall aus dem Chat: mehrere Tische
    // unabhängig auf dieselbe kleine Größe geschrumpft. smallTableAlertSent
    // verhindert, dass admin bei jedem weiteren Bust-out erneut denselben
    // Push bekommt, solange die Situation unverändert fortbesteht - erst wenn
    // sie sich wieder auflöst (Anzahl fällt unter smallTableAlertCount), wird
    // das Flag zurückgesetzt und ein künftiges Wiederauftreten meldet erneut.
    const smallTableThreshold = tournament.config.smallTableThreshold ?? DEFAULT_SMALL_TABLE_THRESHOLD;
    const smallTableAlertCount = tournament.config.smallTableAlertCount ?? DEFAULT_SMALL_TABLE_ALERT_COUNT;
    const smallCount = countSmallTables(tables, smallTableThreshold);
    const shouldAlert = smallCount >= smallTableAlertCount;

    if (shouldAlert && !tournament.smallTableAlertSent) {
      await db.collection("tournaments").updateOne({ _id: tournamentId }, { $set: { smallTableAlertSent: true } });
      await notifyAdmin({
        title: "Mehrere kleine Tische",
        body: `${smallCount} Tische haben nur noch ≤${smallTableThreshold} Spieler - manuell zusammenlegen?`,
        url: "/",
      });
    } else if (!shouldAlert && tournament.smallTableAlertSent) {
      await db.collection("tournaments").updateOne({ _id: tournamentId }, { $set: { smallTableAlertSent: false } });
    }

    return null;
  }

  throw new Error("resolvePendingAction: zu viele Iterationen (mögliche Endlosschleife)");
}

// Admin-ausgelöstes manuelles Auflösen/Zusammenlegen eines gewählten Tisches
// (Chat-Wunsch: "we kind of need the possibility to merge tables") - für
// genau die Situation, in der mehrere Tische unabhängig auf dieselbe kleine
// Größe geschrumpft sind und weder Auflösen noch Ausgleichen automatisch
// greift (siehe smallTableAlertSent-Push in resolvePendingAction). Spiegelt
// den automatischen Dissolve-Zweig 1:1, nur ohne die dissolveThreshold-Prüfung
// - admin darf jeden aktiven Tisch auflösen, nicht nur einen, der zufällig
// unter dem Schwellwert liegt. Der erste Zug läuft danach durch denselben
// Auslosungs-/Bestätigungs-Ablauf (DrawDialog) wie ein automatischer Dissolve;
// applyMove() ruft am Ende wieder resolvePendingAction() auf, das die Kette
// bis zum letzten Spieler des Tisches fortsetzt.
export async function startManualTableMerge(tournamentId, tableId) {
  const db = await getDb();
  const tables = await loadActiveTables(db, tournamentId);
  const dissolveTable = tables.find((t) => t.id === tableId);
  if (!dissolveTable) throw new Error("Tisch nicht gefunden oder nicht aktiv");
  if (tables.length <= 1) throw new Error("Kein anderer aktiver Tisch zum Zusammenlegen vorhanden");

  const player = dissolveTable.players[0];
  if (!player) {
    await retireTable(db, tournamentId, dissolveTable.id);
    return null;
  }
  const remaining = tables.filter((t) => t.id !== dissolveTable.id);
  const target = nextDissolveTarget(remaining, []);
  return {
    type: "dissolve",
    dissolvedTableId: dissolveTable.id,
    playerId: player.id,
    toTableId: target?.id ?? null,
  };
}

// Redraws just the varying part of a proposal ("Neu auslosen"), excluding
// candidates already rejected in this round. The fixed side (source table for
// balance, the player for dissolve) stays as proposed.
export async function rerollMove(tournamentId, proposal, excludeIds = []) {
  const db = await getDb();
  const tables = await loadActiveTables(db, tournamentId);

  if (proposal.type === "dissolve") {
    const remaining = tables.filter((t) => t.id !== proposal.dissolvedTableId);
    const target = nextDissolveTarget(remaining, excludeIds);
    return { ...proposal, toTableId: target?.id ?? null };
  }

  if (proposal.type === "balance") {
    const fromTable = tables.find((t) => t.id === proposal.fromTableId);
    if (!fromTable) throw new Error("Quelltisch nicht mehr aktiv");
    const candidate = drawBalanceCandidate(fromTable, excludeIds);
    return { ...proposal, playerId: candidate?.id ?? null };
  }

  throw new Error(`Unbekannter proposal.type: ${proposal.type}`);
}

// Persists a confirmed move (player + audit log entry), retires a dissolved table
// once its last player has been placed, and returns the next pending action.
export async function applyMove(tournamentId, proposal, confirmedBy) {
  const db = await getDb();
  const playerId = new ObjectId(proposal.playerId);
  const toTableId = new ObjectId(proposal.toTableId);
  const now = new Date();

  const player = await db.collection("players").findOne({ _id: playerId, tournamentId });
  if (!player) throw new Error("Spieler nicht gefunden");
  const fromTableId = player.tableId ?? null;
  const fromTable = fromTableId ? await db.collection("tables").findOne({ _id: fromTableId, tournamentId }) : null;

  // Ohne Neuvergabe der num würde der Spieler seine alte Sitznummer vom
  // Herkunftstisch mitnehmen - seatOf() schaut nur auf das Segment nach dem
  // Punkt (mod maxSeats), das kann rein zufällig mit der Sitznummer eines
  // bereits am Zieltisch sitzenden Spielers auf denselben visuellen Platz
  // fallen, obwohl beide num-Strings unterschiedlich und beide gültig aktiv
  // sind (kein DB-Unique-Verstoß, aber zwei Spieler auf demselben Sitz).
  const toTable = await db.collection("tables").findOne({ _id: toTableId, tournamentId });
  if (!toTable) throw new Error("Zieltisch nicht gefunden");
  const destinationPlayers = await db
    .collection("players")
    .find({ tableId: toTableId, status: "active" })
    .toArray();
  const num = nextFreeSeatNum(
    destinationPlayers.map((p) => p.num),
    toTable.maxSeats,
    tableOrdinalFromLabel(toTable.label)
  );
  if (!num) throw new Error("Zieltisch hat keinen freien Platz mehr");

  await db.collection("players").updateOne(
    { _id: playerId },
    {
      $set: { tableId: toTableId, num },
      $push: { seatHistory: { tableId: toTableId, timestamp: now, reason: proposal.type } },
    }
  );

  await db.collection("moves").insertOne({
    tournamentId,
    playerId,
    fromTableId,
    toTableId,
    reason: proposal.type,
    confirmedBy,
    timestamp: now,
  });

  if (proposal.type === "dissolve") {
    const stillActive = await db.collection("players").countDocuments({
      tournamentId,
      tableId: new ObjectId(proposal.dissolvedTableId),
      status: "active",
    });
    if (stillActive === 0) {
      await retireTable(db, tournamentId, proposal.dissolvedTableId);
    }
  }

  // Web Push ans Quell- und Zieltisch-Gerät (spec-Erweiterung, siehe Chat: "die
  // anderen Tische aware, dass ein Spieler umgesetzt wurde"). notifyTable fängt
  // alle eigenen Fehler ab (fehlende VAPID-Konfiguration, tote Subscription,
  // Versandfehler) - ein await hier kann also nie den eigentlichen Spielzug
  // scheitern lassen, stellt aber sicher, dass der Versand vor Response-Ende
  // abgeschlossen ist statt evtl. mit dem Prozess abgebrochen zu werden.
  const bankTag = player.isBank ? " (Bank)" : "";
  await Promise.allSettled([
    notifyTable(toTable.label, {
      title: "Neuer Spieler",
      body: `${player.name}${bankTag} kommt an Platz ${num}`,
      url: "/",
    }),
    fromTable
      ? notifyTable(fromTable.label, {
          title: "Spieler umgesetzt",
          body: `${player.name}${bankTag} wechselt zu ${toTable.label}`,
          url: "/",
        })
      : null,
    // Admin hat keinen eigenen Tisch, bekommt aber jeden Zug an jedem Tisch
    // als Überblick (Chat-Wunsch: "notify admin on every table's move").
    notifyAdmin({
      title: "Spieler umgesetzt",
      body: fromTable
        ? `${player.name}${bankTag}: ${fromTable.label} → ${toTable.label}`
        : `${player.name}${bankTag} kommt an ${toTable.label}, Platz ${num}`,
      url: "/",
    }),
  ]);

  return resolvePendingAction(tournamentId);
}

// endPhase(): shuffles + round-robins all remaining active players onto the next
// phase's freshly created tables, renumbers seats, retires the old tables, and
// advances tournament.phaseIndex.
//
// Bugreport aus dem Chat: ein E11000-Duplicate-Key auf {tournamentId,num}
// mitten in der ursprünglichen Promise.all-Spieler-Update-Schleife ließ das
// Turnier in einem kaputten Zwischenzustand zurück - neue Halbfinale-Tische
// bereits angelegt, aber phaseIndex nie erhöht und die alten Tische nie
// retired, weil der Fehler den Rest der Funktion nie erreichen ließ. Zwei
// unabhängige Fixes dagegen:
// 1. Zwei-Phasen-Update der Spieler-num (erst auf einen garantiert
//    kollisionsfreien Platzhalter, dann erst auf den finalen Wert) - alte
//    und neue Phase nutzen dieselbe "<Tisch>.<Sitz>"-Notation, ein direkter
//    Sprung auf den finalen Wert konnte kurzzeitig zwei aktive Spieler mit
//    demselben num erzeugen und am partiellen Unique-Index scheitern (exakt
//    dieselbe Bug-Klasse wie beim einzelnen Sitzplatz-Tausch in
//    .../players/[playerId]/seat/route.js, hier nur für N Spieler statt 2).
// 2. Eine echte Mongo-Transaktion um die GESAMTE Funktion - falls trotzdem
//    irgendein Schritt fehlschlägt (dieser oder ein künftiger, unbekannter
//    Fehler), werden ALLE Schreibvorgänge zurückgerollt statt einen
//    Halbfinale-Tisch ohne passenden Phasenwechsel stehen zu lassen. Eine
//    Session erlaubt nur eine Operation gleichzeitig, deshalb sequentielle
//    for-Schleifen statt Promise.all innerhalb der Transaktion.
export async function endPhase(tournamentId, confirmedBy) {
  const db = await getDb();
  const client = await getClient();
  const session = client.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const tournament = await db.collection("tournaments").findOne({ _id: tournamentId }, { session });
      if (!tournament) throw new Error("Turnier nicht gefunden");

      const nextIndex = tournament.phaseIndex + 1;
      if (!PHASES[nextIndex]) throw new Error("Es gibt keine weitere Phase nach der aktuellen");
      // Tischanzahl/-größe kommen vom Admin-Setup (tournament.phasePlans), falls
      // hinterlegt - sonst Fallback auf die globalen PHASES-Defaults. Der
      // Phasenname selbst (Vorrunde/Halbfinale/Finale) bleibt fix.
      const planOverride = tournament.phasePlans?.[nextIndex];
      const phaseConfig = {
        name: PHASES[nextIndex].name,
        targetTables: planOverride?.targetTables ?? PHASES[nextIndex].targetTables,
        tableSize: planOverride?.tableSize ?? PHASES[nextIndex].tableSize,
      };

      const activePlayers = await db
        .collection("players")
        .find({ tournamentId, status: "active" }, { session })
        .toArray();

      const { newTables, assignments } = planPhaseTransition(activePlayers, phaseConfig);

      const tableDocs = newTables.map((t, i) => ({
        tournamentId,
        phaseIndex: nextIndex,
        label: `${phaseConfig.name} ${i + 1}`,
        color: TABLE_COLORS[i % TABLE_COLORS.length],
        maxSeats: phaseConfig.tableSize,
        active: true,
      }));
      const { insertedIds } = await db.collection("tables").insertMany(tableDocs, { session });
      const newTableIdByIndex = tableDocs.map((_, i) => insertedIds[i]);

      const now = new Date();
      const moveDocs = assignments.map(({ player, tableIndex }) => ({
        tournamentId,
        playerId: player._id,
        fromTableId: player.tableId ?? null,
        toTableId: newTableIdByIndex[tableIndex],
        reason: "phaseTransition",
        confirmedBy,
        timestamp: now,
      }));

      for (const [i, { player }] of assignments.entries()) {
        await db.collection("players").updateOne({ _id: player._id }, { $set: { num: `9999.${i}` } }, { session });
      }
      for (const { player, tableIndex, num } of assignments) {
        await db.collection("players").updateOne(
          { _id: player._id },
          {
            $set: { tableId: newTableIdByIndex[tableIndex], num },
            $push: {
              seatHistory: { tableId: newTableIdByIndex[tableIndex], timestamp: now, reason: "phaseTransition" },
            },
          },
          { session }
        );
      }
      if (moveDocs.length) await db.collection("moves").insertMany(moveDocs, { session });

      await db
        .collection("tables")
        .updateMany({ tournamentId, phaseIndex: tournament.phaseIndex }, { $set: { active: false } }, { session });
      await db.collection("tournaments").updateOne({ _id: tournamentId }, { $set: { phaseIndex: nextIndex } }, { session });

      result = { phaseIndex: nextIndex, phaseName: phaseConfig.name, tableIds: newTableIdByIndex.map(String) };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

// Admin-Setup: legt ein neues Turnier an und setzt alle Spieler sofort auf die
// gewünschte Anzahl/Größe von Tischen (spec-Lücke, siehe Chat - es gab bisher
// keinen Weg, ein Turnier überhaupt anzulegen). Der erste Name in playerNames
// ist immer die Bank (lib/core/initialSeating.js).
export async function createTournament({
  name,
  tableCount,
  tableSize,
  playerNames,
  baseline,
  dissolveThreshold,
  balanceDiffThreshold,
  rebuyPhaseActive,
  smallTableThreshold = DEFAULT_SMALL_TABLE_THRESHOLD,
  smallTableAlertCount = DEFAULT_SMALL_TABLE_ALERT_COUNT,
  phasePlans,
  sequentialSeating = false,
}) {
  const db = await getDb();
  const now = new Date();

  const players = playerNames.map((playerName, i) => ({ name: playerName || `Spieler ${i + 1}` }));
  const { tables: seatedTables, assignments } = planInitialSeating(players, {
    tableCount,
    tableSize,
    sequential: sequentialSeating,
  });

  const { insertedId: tournamentId } = await db.collection("tournaments").insertOne({
    name,
    phaseIndex: 0,
    config: {
      baseline,
      dissolveThreshold,
      balanceDiffThreshold,
      rebuyPhaseActive,
      smallTableThreshold,
      smallTableAlertCount,
    },
    // phasePlans[0] (Vorrunde) spiegelt tableCount/tableSize nur zur
    // Konsistenz; die tatsächlichen Vorrunde-Tische entstehen unten direkt aus
    // tableCount/tableSize. [1]/[2] (Halbfinale/Finale) sind das, was endPhase()
    // später tatsächlich verwendet.
    phasePlans,
    createdAt: now,
    smallTableAlertSent: false,
  });

  const tableDocs = seatedTables.map((_, i) => ({
    tournamentId,
    phaseIndex: 0,
    label: `Tisch ${i + 1}`,
    color: TABLE_COLORS[i % TABLE_COLORS.length],
    maxSeats: tableSize,
    active: true,
  }));
  const { insertedIds } = await db.collection("tables").insertMany(tableDocs);
  const tableIdByIndex = tableDocs.map((_, i) => insertedIds[i]);

  const playerDocs = assignments.map(({ player, tableIndex, num, isBank }) => {
    const tableId = tableIdByIndex[tableIndex];
    return {
      tournamentId,
      tableId,
      num,
      name: player.name,
      isBank,
      status: "active",
      seatHistory: [{ tableId, timestamp: now, reason: "manual" }],
    };
  });
  if (playerDocs.length) await db.collection("players").insertMany(playerDocs);

  return { tournamentId: tournamentId.toString() };
}

// Legt die Blindstruktur fest (oder ersetzt sie komplett) und setzt den
// Fortschritt auf Level 0 zurück. levels kommen bereits als strukturierte,
// validierte Objekte vom Formular (BlindScheduleSheet.js, ein Feld-Set pro
// Level); hier wird nur noch die Struktur der Werte geprüft.
// currentLevelStartedAt = null statt jetzt (Chat-Fix: "blindes speichern
// should not start the tournament just when admin starts it") - Speichern
// Bearbeiten der Blindstruktur passiert oft lange VOR dem eigentlichen
// Turnierstart (z.B. beim Vorbereiten), die automatische Weiterschaltung darf
// da noch nicht mitlaufen. Erst startBlindClock() setzt den Zeitstempel -
// das ist der bewusste, separate "Admin startet jetzt"-Moment.
export async function setBlindSchedule(tournamentId, { startTime, levels, rebuyEndLevelIndex = null }) {
  const db = await getDb();
  const result = await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    {
      $set: {
        blindSchedule: { startTime, levels, currentLevelIndex: 0, currentLevelStartedAt: null, rebuyEndLevelIndex },
      },
    }
  );
  if (result.matchedCount === 0) throw new Error("Turnier nicht gefunden");
}

// Startet die Blind-Uhr für das aktuell hinterlegte Level (typischerweise
// Level 0 direkt nach dem Speichern) - der explizite "Admin startet jetzt"-
// Moment, getrennt vom bloßen Speichern/Bearbeiten der Struktur.
export async function startBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule) throw new Error("Keine Blindstruktur hinterlegt");
  await db
    .collection("tournaments")
    .updateOne({ _id: tournamentId }, { $set: { "blindSchedule.currentLevelStartedAt": new Date() } });
}

// Setzt die Blind-Uhr komplett zurück: Level 0, nicht gestartet (Chat-Wunsch:
// "reset timer") - die Struktur selbst bleibt erhalten.
export async function resetBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule) throw new Error("Keine Blindstruktur hinterlegt");
  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    { $set: { "blindSchedule.currentLevelIndex": 0, "blindSchedule.currentLevelStartedAt": null } }
  );
}

// Schaltet das aktuelle Level manuell weiter/zurück. Ersetzt gleichzeitig
// currentLevelStartedAt durch jetzt (Chat-Redesign: "blinds increase
// automatically, or if admin moves them up") - die Uhr für das neu gesetzte
// Level fängt bei 0 an, die vor dem Sprung verstrichene Zeit zählt nicht mehr
// mit. Ohne das würde computeEffectiveBlindState() beim nächsten Tick sofort
// wieder über den manuellen Sprung hinweg auto-vorspulen.
export async function setBlindLevelIndex(tournamentId, currentLevelIndex) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule) throw new Error("Keine Blindstruktur hinterlegt");
  if (currentLevelIndex < 0 || currentLevelIndex >= tournament.blindSchedule.levels.length) {
    throw new Error("Level-Index außerhalb der Blindstruktur");
  }
  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    { $set: { "blindSchedule.currentLevelIndex": currentLevelIndex, "blindSchedule.currentLevelStartedAt": new Date() } }
  );
}

// Löscht ein Turnier vollständig samt Tischen/Spielern/Moves (Chat-Wunsch:
// "need also a clear tournament or so for admin" - nach dem E11000-Vorfall gab
// es keinen App-Weg, ein Test-/Fehlturnier loszuwerden, nur manuelle Skripte
// direkt gegen Atlas). pushSubscriptions bleiben unangetastet: die sind per
// nickname statt tournamentId gekeyt und gelten turnierübergreifend weiter.
export async function deleteTournament(tournamentId) {
  const db = await getDb();
  const result = await db.collection("tournaments").deleteOne({ _id: tournamentId });
  if (result.deletedCount === 0) throw new Error("Turnier nicht gefunden");
  await Promise.all([
    db.collection("tables").deleteMany({ tournamentId }),
    db.collection("players").deleteMany({ tournamentId }),
    db.collection("moves").deleteMany({ tournamentId }),
  ]);
}

// Turnier-Einstellungen nachträglich ändern (Chat-Wunsch: "edit turnier
// possibilities"). Bewusst nur, was ohne Umbau der bereits gesetzten Tische
// änderbar ist: Name, Rebuy-Phase, Balancing-Regeln und die Struktur der
// NOCH KOMMENDEN Phasen (Halbfinale/Finale). Tischanzahl/-größe der laufenden
// Vorrunde und Spieler werden weiterhin über Verwalten/Sitzplätze geändert.
// phasePlans[0] bleibt unangetastet (spiegelt nur die Vorrunde-Erstellung).
export async function updateTournamentSettings(
  tournamentId,
  {
    name,
    rebuyPhaseActive,
    baseline,
    dissolveThreshold,
    balanceDiffThreshold,
    smallTableThreshold,
    smallTableAlertCount,
    halbfinale,
    finale,
  }
) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");

  const existing = tournament.phasePlans ?? [];
  const phasePlans = [
    existing[0] ?? { targetTables: PHASES[0].targetTables, tableSize: PHASES[0].tableSize },
    halbfinale,
    finale,
  ];

  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    {
      $set: {
        name,
        "config.rebuyPhaseActive": rebuyPhaseActive,
        "config.baseline": baseline,
        "config.dissolveThreshold": dissolveThreshold,
        "config.balanceDiffThreshold": balanceDiffThreshold,
        "config.smallTableThreshold": smallTableThreshold,
        "config.smallTableAlertCount": smallTableAlertCount,
        phasePlans,
      },
    }
  );
}
