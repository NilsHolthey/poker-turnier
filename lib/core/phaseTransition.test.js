import { test } from "node:test";
import assert from "node:assert/strict";
import { planPhaseTransition } from "./phaseTransition.js";
import { mulberry32 } from "./test-helpers.js";

test("planPhaseTransition: verteilt alle Spieler round-robin auf die Zieltische und nummeriert neu (1.1, 1.2, ... / 2.1, ...)", () => {
  const players = Array.from({ length: 16 }, (_, i) => ({ id: `p${i}` }));
  const { newTables, assignments } = planPhaseTransition(
    players,
    { targetTables: 2, tableSize: 8 },
    mulberry32(7)
  );

  assert.equal(newTables.length, 2);
  assert.equal(assignments.length, 16);

  // Round-robin auf den jeweils kleinsten Tisch -> bei gleicher Spielerzahl (16/2) exakt 8/8.
  const perTable = newTables.map((t) => t.players.length);
  assert.deepEqual(perTable.sort(), [8, 8]);

  // Jede Spieler-ID kommt genau einmal vor, keine Duplikate/Verluste beim Shuffle.
  const assignedIds = assignments.map((a) => a.player.id).sort();
  assert.deepEqual(assignedIds, players.map((p) => p.id).sort());

  // Nummerierung ist pro Tisch fortlaufend ab 1.
  for (const table of newTables) {
    const nums = assignments
      .filter((a) => a.tableIndex === table.tableIndex)
      .map((a) => a.num)
      .sort();
    const expected = table.players.map((_, i) => `${table.tableIndex + 1}.${i + 1}`).sort();
    assert.deepEqual(nums, expected);
  }
});
