import { pickRandomAmong } from "./random.js";

// Finds the table to dissolve: smallest table at or below the threshold, but only
// if dissolving would still leave at least one active table standing.
export function findTableToDissolve(tables, dissolveThreshold, rng = Math.random) {
  if (tables.length <= 1) return null;
  const candidates = tables.filter((t) => t.players.length <= dissolveThreshold);
  if (candidates.length === 0) return null;
  return pickRandomAmong(candidates, (t) => t.players.length, "min", rng);
}

// Draws the next destination table for one player of a dissolving table: always the
// currently smallest remaining table, excluding any targets already rejected via
// "Neu auslosen" for this player. `remainingTables` must exclude the dissolved table
// itself. The player is fixed per the spec ("das Zieltisch wird neu ausgelost, nicht
// die Person") — only the target table is redrawn on reroll.
export function nextDissolveTarget(remainingTables, excludeTableIds = [], rng = Math.random) {
  const candidates = remainingTables.filter((t) => !excludeTableIds.includes(t.id));
  if (candidates.length === 0) return null;
  return pickRandomAmong(candidates, (t) => t.players.length, "min", rng);
}

// "Einfacher Modus" (Chat-Wunsch: "reseating only happens under one
// condition. if a table has 3 or less player the app checks if the table can
// be resolved. if enough spaces are available we will reseat, remove the
// empty table. if not enough free seats table continues with three") - im
// Unterschied zu findTableToDissolve/needsBalance oben ist das die EINZIGE
// Reseating-Regel in diesem Modus (kein separates Ausgleichen). Löst nur auf,
// wenn ALLE Spieler des kleinen Tisches auf den ÜBRIGEN aktiven Tischen
// zusammen noch Platz finden - reicht der Platz nicht, bleibt der Tisch
// einfach mit seiner aktuellen (kleinen) Größe stehen, statt z.B. nur einen
// Teil der Spieler umzusetzen. Wird nach jedem Bust-out neu geprüft (siehe
// resolvePendingAction in lib/db/tournamentEngine.js), holt die Auflösung
// also automatisch nach, sobald anderswo wieder wer aussteigt und Platz
// macht.
export function findSimpleModeDissolve(tables, smallTableThreshold, rng = Math.random) {
  if (tables.length <= 1) return null;
  const candidates = tables.filter((t) => t.players.length <= smallTableThreshold);
  if (candidates.length === 0) return null;
  const dissolveTable = pickRandomAmong(candidates, (t) => t.players.length, "min", rng);
  const others = tables.filter((t) => t.id !== dissolveTable.id);
  const freeSeats = others.reduce((sum, t) => sum + Math.max(0, t.maxSeats - t.players.length), 0);
  if (freeSeats < dissolveTable.players.length) return null;
  return dissolveTable;
}

// Zählt Tische mit smallTableThreshold Spielern oder weniger (Chat-Wunsch:
// "situation ... all tables with 3 players left needs to be tackled").
// Auflösen/Ausgleichen greifen hier bewusst NICHT: Auflösen braucht Platz auf
// einem KLEINEREN Tisch (dissolveThreshold, meist 2), Ausgleichen einen
// UNTERSCHIED zwischen Tischen (balanceDiffThreshold) - mehrere Tische, die
// unabhängig voneinander auf dieselbe kleine Größe schrumpfen, lösen keins
// von beiden aus und blieben ohne diese Erkennung unangetastet stehen. Reine
// Zählfunktion, die eigentliche Entscheidung (Alert ja/nein, Reset) sitzt in
// resolvePendingAction (lib/db/tournamentEngine.js), weil die dafür auch den
// zuletzt gesendeten Alert-Status kennen muss.
export function countSmallTables(tables, smallTableThreshold) {
  return tables.filter((t) => t.players.length <= smallTableThreshold).length;
}
