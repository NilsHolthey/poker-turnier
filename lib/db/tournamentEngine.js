import { ObjectId } from "mongodb";
import { getDb, getClient } from "./mongodb.js";
import {
  findTableToDissolve,
  nextDissolveTarget,
  needsBalance,
  findBalanceTables,
  drawBalanceCandidate,
  countSmallTables,
  findSimpleModeDissolve,
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
    // label mit dabei (Chat-Wunsch: "all active table operator should get a
    // message ... hf can start") - notifyTable() braucht das Label, um die
    // Push-Zielgruppe (Operator-Nickname) aufzulösen, siehe
    // halbfinale-ready-Block in resolvePendingAction.
    label: t.label,
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
//
// "Einfacher Modus" (config.simpleMode, Chat-Wunsch: "we want to reduce
// complexity, therefore we will build an einfacher Modus ... reseating only
// happens under one condition") - zwei Abweichungen vom Normalmodus:
// 1. Kein Ausgleichen (needsBalance) überhaupt, nur die eine Auflösungs-Regel
//    (findSimpleModeDissolve statt findTableToDissolve+dissolveThreshold).
// 2. Während des Halbfinales (phaseIndex 1) GAR kein automatisches Reseating -
//    Tische spielen unabhängig voneinander bis zum Schluss, admin entscheidet
//    von Hand, wann "nächste Phase"/endPhase() gedrückt wird (das verteilt
//    dann alle noch aktiven Spieler frisch auf den Finaltisch, siehe endPhase
//    unten - "top 4" ist dabei reine Admin-Konfiguration der Finaltischgröße,
//    keine eigene App-Regel).
// Der zurückgegebene Proposal bekommt bei simpleMode zusätzlich `simpleMode:
// true`, damit die UI (DrawDialog) den Reroll-Button ausblendet (Chat-Wunsch:
// "operators should not accept and reroll, this could get abused") -
// rerollMove() weiter unten lehnt einen Reroll-Versuch dafür zusätzlich
// serverseitig ab, nicht nur durch das ausgeblendete UI-Element.
export async function resolvePendingAction(tournamentId) {
  const db = await getDb();

  // Bounded by the number of active tables: each retire strictly shrinks that count.
  for (let i = 0; i < 64; i++) {
    const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
    if (!tournament) throw new Error("Turnier nicht gefunden");
    // ?? statt || : ältere Turniere ohne dieses Feld bekommen den spec-Default,
    // 0 als bewusst gesetzter Wert bliebe sonst fälschlich überschrieben.
    const { baseline, dissolveThreshold, balanceDiffThreshold, simpleMode } = tournament.config;
    const diffThreshold = balanceDiffThreshold ?? DEFAULT_BALANCE_DIFF_THRESHOLD;
    const smallTableThreshold = tournament.config.smallTableThreshold ?? DEFAULT_SMALL_TABLE_THRESHOLD;

    const tables = await loadActiveTables(db, tournamentId);
    const skipReseating = simpleMode && tournament.phaseIndex === 1;

    if (!skipReseating) {
      const dissolveTable = simpleMode
        ? findSimpleModeDissolve(tables, smallTableThreshold)
        : findTableToDissolve(tables, dissolveThreshold);

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
          ...(simpleMode ? { simpleMode: true } : null),
          dissolvedTableId: dissolveTable.id,
          playerId: player.id,
          toTableId: target?.id ?? null,
        };
      }

      if (!simpleMode && needsBalance(tables, baseline, diffThreshold)) {
        const { fromTable, toTable } = findBalanceTables(tables);
        const candidate = drawBalanceCandidate(fromTable, []);
        return {
          type: "balance",
          fromTableId: fromTable.id,
          toTableId: toTable.id,
          playerId: candidate?.id ?? null,
        };
      }
    }

    // Weder Auflösen noch Ausgleichen greift hier (siehe countSmallTables in
    // lib/core/dissolve.js) - genau der Fall aus dem Chat: mehrere Tische
    // unabhängig auf dieselbe kleine Größe geschrumpft. smallTableAlertSent
    // verhindert, dass admin bei jedem weiteren Bust-out erneut denselben
    // Push bekommt, solange die Situation unverändert fortbesteht - erst wenn
    // sie sich wieder auflöst (Anzahl fällt unter smallTableAlertCount), wird
    // das Flag zurückgesetzt und ein künftiges Wiederauftreten meldet erneut.
    // Läuft bewusst auch im Einfachen Modus mit (auch dort kann findSimpleModeDissolve
    // mangels freier Plätze leer bleiben, während mehrere Tische klein sind) -
    // eine nützliche Zusatzinfo, kein Widerspruch zu "reseating only happens
    // under one condition" (das bezieht sich auf automatisches Umsetzen, nicht
    // auf diesen rein informativen Push).
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

    // Chat-Wunsch: "add an alert for halbfinale reached ... not an automatic
    // start, but a push notification and popup. still admin triggers start."
    // Nur die Push-Seite hier - dasselbe Dedup-Flag-Muster wie
    // smallTableAlertSent oben (einmalig pushen, erst nach Rückgang wieder
    // scharf). Nur in der Vorrunde relevant (phaseIndex 0); das In-App-Popup
    // berechnet der Client selbst aus denselben Daten (siehe
    // TournamentBoard.js), unabhängig davon, ob gerade Normal- oder
    // Einfacher Modus läuft - "Halbfinale erreicht" gilt für beide.
    //
    // Bugreport: "semifinal trigger does not work ... no alert when only 16
    // left" - die ursprüngliche Bedingung verglich die AKTIVE TISCHZAHL gegen
    // das HF-Ziel (z.B. <= 2), nicht die Spielerzahl. Im Einfachen Modus
    // konsolidiert findSimpleModeDissolve aber NUR, wenn ein Tisch selbst auf
    // ≤3 Spieler geschrumpft ist UND anderswo Platz ist - bei z.B. 3 Tischen
    // mit je ~5 Spielern (16 insgesamt) greift das nie, die Tischzahl bleibt
    // bei 3 stehen, obwohl 16 Spieler längst exakt in die HF-Kapazität passen
    // (2 Tische × 8 Plätze = 16). Die eigentlich richtige Frage ist "passen
    // die verbliebenen Spieler schon an die HF-Tische", nicht "ist die
    // Vorrunden-Tischzahl zufällig runtergeschrumpft" - jetzt Spielerzahl
    // gegen HF-Gesamtkapazität statt Tischzahl gegen Tischzahl.
    if (tournament.phaseIndex === 0) {
      const hfTargetTables = tournament.phasePlans?.[1]?.targetTables ?? PHASES[1].targetTables;
      const hfTableSize = tournament.phasePlans?.[1]?.tableSize ?? PHASES[1].tableSize;
      const hfCapacity = hfTargetTables * hfTableSize;
      const activePlayerCount = tables.reduce((sum, t) => sum + t.players.length, 0);
      const hfReady = activePlayerCount <= hfCapacity;

      if (hfReady && !tournament.halbfinaleReadyAlertSent) {
        await db
          .collection("tournaments")
          .updateOne({ _id: tournamentId }, { $set: { halbfinaleReadyAlertSent: true } });
        const hfPushPayload = {
          title: "Halbfinale erreichbar",
          body: `Nur noch ${activePlayerCount} Spieler aktiv - Halbfinale kann starten, bitte Spiel pausieren.`,
          url: "/",
        };
        // Chat-Wunsch: "all active table operator should get a message ...
        // hf can start stop playing" - zusätzlich zu admin (Überblick) jetzt
        // auch an jeden gerade aktiven Tisch, damit die Operatoren direkt
        // wissen, dass sie pausieren sollen statt weiterzuspielen, bis admin
        // sie manuell einzeln informiert. Parallel statt sequentiell -
        // notifyTable() fängt eigene Fehler ab (siehe lib/server/push.js),
        // ein einzelner kaputter Tisch-Push blockiert die anderen nicht.
        await Promise.allSettled([
          notifyAdmin(hfPushPayload),
          ...tables.map((t) => notifyTable(t.label, hfPushPayload)),
        ]);
      } else if (!hfReady && tournament.halbfinaleReadyAlertSent) {
        await db
          .collection("tournaments")
          .updateOne({ _id: tournamentId }, { $set: { halbfinaleReadyAlertSent: false } });
      }
    }

    // Gleiche Logik eine Phase weiter (Chat-Wunsch: "add it also for finale"):
    // während des Halbfinales (phaseIndex 1) prüfen, ob die verbliebenen
    // Spieler schon an die Finale-Tischkapazität passen. Dedup-Flag-Muster
    // wie oben bei halbfinaleReadyAlertSent.
    if (tournament.phaseIndex === 1) {
      const finaleTargetTables = tournament.phasePlans?.[2]?.targetTables ?? PHASES[2].targetTables;
      const finaleTableSize = tournament.phasePlans?.[2]?.tableSize ?? PHASES[2].tableSize;
      const finaleCapacity = finaleTargetTables * finaleTableSize;
      const activePlayerCount = tables.reduce((sum, t) => sum + t.players.length, 0);
      const finaleReady = activePlayerCount <= finaleCapacity;

      if (finaleReady && !tournament.finaleReadyAlertSent) {
        await db
          .collection("tournaments")
          .updateOne({ _id: tournamentId }, { $set: { finaleReadyAlertSent: true } });
        const finalePushPayload = {
          title: "Finale erreichbar",
          body: `Nur noch ${activePlayerCount} Spieler aktiv - Finale kann starten, bitte Spiel pausieren.`,
          url: "/",
        };
        await Promise.allSettled([
          notifyAdmin(finalePushPayload),
          ...tables.map((t) => notifyTable(t.label, finalePushPayload)),
        ]);
      } else if (!finaleReady && tournament.finaleReadyAlertSent) {
        await db
          .collection("tournaments")
          .updateOne({ _id: tournamentId }, { $set: { finaleReadyAlertSent: false } });
      }
    }

    return null;
  }

  throw new Error("resolvePendingAction: zu viele Iterationen (mögliche Endlosschleife)");
}

// Chat-Wunsch: "I need a site with the full player list ... only admin can
// remove or add or edit here even after tournament start. this will an edit
// not a bust if a player gets removed" - anders als der Bust-out (DELETE
// .../players/:playerId, setzt status:"busted"+bustedAt, bleibt als
// ausgeschieden in Listen/Dashboard sichtbar) ist das hier eine ECHTE
// Löschung: der Spieler hat nie existiert statt "ausgeschieden zu sein" -
// für Korrekturen von Fehleingaben, nicht fürs eigentliche Spielgeschehen.
// Kein Tisch-Scoping (admin darf jeden Spieler entfernen, unabhängig vom
// eigenen Tisch - ergibt für admin ohnehin keinen Unterschied). Löst trotzdem
// denselben Tisch-Ausgleich wie resolvePendingAction aus, falls der
// betroffene Tisch dadurch zu klein für seine aktuelle Größe wird - das ist
// weiterhin dieselbe strukturelle Frage wie bei einem Bust, nur ohne die
// Bust-spezifische Markierung des Spielers selbst.
export async function removePlayerEntry(tournamentId, playerId) {
  const db = await getDb();
  const result = await db.collection("players").deleteOne({ _id: playerId, tournamentId });
  if (result.deletedCount === 0) throw new Error("Spieler nicht gefunden");
  return resolvePendingAction(tournamentId);
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
//
// simpleMode-Guard (Chat-Wunsch: "operators should not accept and reroll,
// this could get abused") - das UI blendet den Reroll-Button für simpleMode-
// Proposals zwar schon aus (siehe DrawDialog.js hideReroll), das allein
// verhindert aber keinen direkten API-Call. Serverseitige Ablehnung hier ist
// die eigentliche Durchsetzung.
export async function rerollMove(tournamentId, proposal, excludeIds = []) {
  if (proposal.simpleMode) {
    throw new Error("Neu auslosen ist im Einfachen Modus nicht verfügbar");
  }

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
    // Außerhalb der Transaktion gebraucht (Chat-Wunsch: "same as semi final,
    // we should send a message if semifinal starts") - Push-Versand darf
    // nicht TEIL der Transaktion sein (kein Rollback für bereits
    // rausgegangene Benachrichtigungen möglich/sinnvoll), aber die Labels der
    // neu angelegten Tische entstehen nur innerhalb des Transaktions-Callbacks.
    let newPhaseIndex;
    let newTableLabels;
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
      newPhaseIndex = nextIndex;
      newTableLabels = tableDocs.map((t) => t.label);
    });

    // Chat-Wunsch: "same as semi final, we should send a message if
    // semifinal starts" - eigener Push, zusätzlich zum schon bestehenden
    // "Halbfinale erreichbar"-Alert in resolvePendingAction() (der nur eine
    // Empfehlung ist, bevor admin überhaupt draufgedrückt hat). Dieser hier
    // feuert erst NACH dem tatsächlich abgeschlossenen Übergang. Beim Sprung
    // IN die Halbfinale- ODER die Finale-Phase (Chat-Wunsch: "add it also for
    // finale").
    if (newPhaseIndex === 1 || newPhaseIndex === 2) {
      const payload = {
        title: newPhaseIndex === 1 ? "Halbfinale hat begonnen" : "Finale hat begonnen",
        body: "Die neue Tischaufteilung steht - bitte Plätze einnehmen.",
        url: "/",
      };
      await Promise.allSettled([notifyAdmin(payload), ...newTableLabels.map((label) => notifyTable(label, payload))]);
    }

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
  // "Einfacher Modus" (Chat-Wunsch: "this can be selected when creating the
  // tournament by admin") - nur bei Erstellung wählbar, siehe
  // resolvePendingAction für die eigentliche Verhaltensänderung.
  simpleMode = false,
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
      simpleMode,
    },
    // phasePlans[0] (Vorrunde) spiegelt tableCount/tableSize nur zur
    // Konsistenz; die tatsächlichen Vorrunde-Tische entstehen unten direkt aus
    // tableCount/tableSize. [1]/[2] (Halbfinale/Finale) sind das, was endPhase()
    // später tatsächlich verwendet.
    phasePlans,
    createdAt: now,
    smallTableAlertSent: false,
    halbfinaleReadyAlertSent: false,
    finaleReadyAlertSent: false,
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
// pausedAt: null mit dabei (defensiv, sollte hier ohnehin schon null sein) -
// ein frischer Start soll nie versehentlich als pausiert gelten.
// firstStartedAt (Chat-Wunsch: "total tournament clock" fürs TV-Dashboard) -
// wird NUR beim allerersten Start gesetzt (anders als currentLevelStartedAt,
// das bei jedem Levelwechsel neu gesetzt wird) und bleibt danach stehen,
// bis resetBlindClock() es zurücksetzt - ein späterer manueller
// Levelsprung/Pause ändert die "seit wann läuft das Turnier"-Zeit nicht.
export async function startBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule) throw new Error("Keine Blindstruktur hinterlegt");
  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    {
      $set: {
        "blindSchedule.currentLevelStartedAt": new Date(),
        "blindSchedule.pausedAt": null,
        ...(tournament.blindSchedule.firstStartedAt ? {} : { "blindSchedule.firstStartedAt": new Date() }),
      },
    }
  );
}

// Setzt die Blind-Uhr komplett zurück: Level 0, nicht gestartet (Chat-Wunsch:
// "reset timer") - die Struktur selbst bleibt erhalten. pausedAt: null mit
// dabei - ein zurückgesetzter, nicht gestarteter Timer darf nicht als
// pausiert gelten (computeEffectiveBlindState prüft started zuerst und
// ignoriert pausedAt in dem Fall zwar ohnehin, aber sauberer Zustand statt
// eines stehengebliebenen Wertes für den nächsten Start). firstStartedAt
// ebenfalls zurück auf null - ein "echter" Reset soll auch die
// Turnier-Gesamtlaufzeit neu bei 0 anfangen lassen, der nächste
// startBlindClock() setzt sie dann frisch.
export async function resetBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule) throw new Error("Keine Blindstruktur hinterlegt");
  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    {
      $set: {
        "blindSchedule.currentLevelIndex": 0,
        "blindSchedule.currentLevelStartedAt": null,
        "blindSchedule.pausedAt": null,
        "blindSchedule.firstStartedAt": null,
      },
    }
  );
}

// Schaltet das aktuelle Level manuell weiter/zurück. Ersetzt gleichzeitig
// currentLevelStartedAt durch jetzt (Chat-Redesign: "blinds increase
// automatically, or if admin moves them up") - die Uhr für das neu gesetzte
// Level fängt bei 0 an, die vor dem Sprung verstrichene Zeit zählt nicht mehr
// mit. Ohne das würde computeEffectiveBlindState() beim nächsten Tick sofort
// wieder über den manuellen Sprung hinweg auto-vorspulen. pausedAt: null mit
// dabei - ein manueller Levelsprung setzt implizit "läuft jetzt wieder",
// sonst bliebe eine laufende Pause über den Sprung hinweg unbemerkt bestehen.
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
    {
      $set: {
        "blindSchedule.currentLevelIndex": currentLevelIndex,
        "blindSchedule.currentLevelStartedAt": new Date(),
        "blindSchedule.pausedAt": null,
      },
    }
  );
}

// Chat-Wunsch: "admin should have more control over the blindes and timer so
// pausing it should be a possibility ... especially before hf and finale
// table we should pause, no auto pause but possibility for admin" - rein
// manuell, kein automatisches Pausieren bei Phasenübergängen. Setzt nur
// pausedAt, computeEffectiveBlindState() friert die Restzeit darauf ein
// (siehe lib/core/blindSchedule.js).
export async function pauseBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  if (!tournament.blindSchedule?.currentLevelStartedAt) throw new Error("Blind-Uhr läuft noch nicht");
  if (tournament.blindSchedule.pausedAt) return; // schon pausiert, kein weiterer Schreibzugriff nötig
  await db.collection("tournaments").updateOne({ _id: tournamentId }, { $set: { "blindSchedule.pausedAt": new Date() } });
}

// Setzt fort: verschiebt currentLevelStartedAt um genau die Pausendauer nach
// vorne, statt die Pausenzeit separat mitzuführen - ein künftiges "jetzt"
// (computeEffectiveBlindState) zählt die Pause dadurch automatisch korrekt
// NICHT mit, ganz ohne zusätzliches Feld für "totale Pausendauer".
export async function resumeBlindClock(tournamentId) {
  const db = await getDb();
  const tournament = await db.collection("tournaments").findOne({ _id: tournamentId });
  if (!tournament) throw new Error("Turnier nicht gefunden");
  const pausedAt = tournament.blindSchedule?.pausedAt;
  if (!pausedAt) return; // nicht pausiert, kein weiterer Schreibzugriff nötig
  const startedAtMs = new Date(tournament.blindSchedule.currentLevelStartedAt).getTime();
  const pauseDurationMs = Date.now() - new Date(pausedAt).getTime();
  await db.collection("tournaments").updateOne(
    { _id: tournamentId },
    {
      $set: {
        "blindSchedule.currentLevelStartedAt": new Date(startedAtMs + pauseDurationMs),
        "blindSchedule.pausedAt": null,
      },
    }
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
