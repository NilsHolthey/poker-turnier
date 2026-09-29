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
