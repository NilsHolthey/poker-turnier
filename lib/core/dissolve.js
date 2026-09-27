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
