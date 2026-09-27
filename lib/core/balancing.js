import { pickRandomAmong, randomPick } from "./random.js";

// Tables are { id, players: [...] }. Only .id and .players.length/.players matter here;
// the rest of the player/table document shape is irrelevant to the algorithm.

// diffThreshold: wie groß der Unterschied zwischen größtem und kleinstem Tisch
// sein muss, bevor ausgeglichen wird (admin-konfigurierbar, spec-Default war 2).
export function needsBalance(tables, baseline, diffThreshold = 2) {
  if (tables.length < 2) return false;
  const sizes = tables.map((t) => t.players.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  return min < baseline && max - min >= diffThreshold;
}

// Picks the source (most players) and destination (fewest players) table for a
// balance move, breaking ties randomly per the spec's pickRandomAmong fix.
export function findBalanceTables(tables, rng = Math.random) {
  const fromTable = pickRandomAmong(tables, (t) => t.players.length, "max", rng);
  const toTable = pickRandomAmong(tables, (t) => t.players.length, "min", rng);
  return { fromTable, toTable };
}

// Draws a random player from fromTable to move, excluding any candidates already
// rejected via "Neu auslosen" in this balance event. Returns null when exhausted.
export function drawBalanceCandidate(fromTable, excludePlayerIds = [], rng = Math.random) {
  const candidates = fromTable.players.filter((p) => !excludePlayerIds.includes(p.id));
  if (candidates.length === 0) return null;
  return randomPick(candidates, rng);
}
