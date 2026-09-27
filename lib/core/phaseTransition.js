import { pickRandomAmong, fisherYatesShuffle } from "./random.js";

// endPhase(): shuffle all remaining players, then round-robin them onto the next
// phase's tables (always filling the currently smallest new table), renumbering
// seats per new table as 1.1, 1.2, ... / 2.1, 2.2, ...
// `phaseConfig` is the PHASES[nextIndex] entry ({ targetTables, tableSize }).
export function planPhaseTransition(players, phaseConfig, rng = Math.random) {
  const shuffled = fisherYatesShuffle(players, rng);
  const newTables = Array.from({ length: phaseConfig.targetTables }, (_, i) => ({
    tableIndex: i,
    players: [],
  }));

  for (const player of shuffled) {
    const target = pickRandomAmong(newTables, (t) => t.players.length, "min", rng);
    target.players.push(player);
  }

  const assignments = newTables.flatMap((table) =>
    table.players.map((player, seatIdx) => ({
      player,
      tableIndex: table.tableIndex,
      num: `${table.tableIndex + 1}.${seatIdx + 1}`,
    }))
  );

  return { newTables, assignments };
}
