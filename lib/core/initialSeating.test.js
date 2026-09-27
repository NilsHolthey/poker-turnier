import { test } from "node:test";
import assert from "node:assert/strict";
import { planInitialSeating } from "./initialSeating.js";
import { mulberry32 } from "./test-helpers.js";

test("planInitialSeating: die Bank sitzt immer fest auf 1.1, unabhängig vom Zufall", () => {
  const players = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));
  const { assignments } = planInitialSeating(players, { tableCount: 2, tableSize: 6 }, mulberry32(1));

  const bankAssignment = assignments.find((a) => a.isBank);
  assert.equal(bankAssignment.player.id, "p0"); // erster Spieler in der Liste
  assert.equal(bankAssignment.num, "1.1");
  assert.equal(assignments.filter((a) => a.isBank).length, 1);
});

test("planInitialSeating: alle Spieler landen genau einmal auf einem Platz, keine Überfüllung", () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }));
  const { tables, assignments } = planInitialSeating(players, { tableCount: 3, tableSize: 6 }, mulberry32(7));

  assert.equal(assignments.length, 14);
  const assignedIds = assignments.map((a) => a.player.id).sort();
  assert.deepEqual(assignedIds, players.map((p) => p.id).sort());
  for (const table of tables) {
    assert.ok(table.players.length <= 6);
  }
});

test("planInitialSeating: zu viele Spieler für die verfügbaren Plätze wirft einen Fehler", () => {
  const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
  assert.throws(() => planInitialSeating(players, { tableCount: 2, tableSize: 6 }));
});

test("planInitialSeating: keine Spieler wirft einen Fehler", () => {
  assert.throws(() => planInitialSeating([], { tableCount: 2, tableSize: 6 }));
});

test("planInitialSeating: sequential setzt Spieler in Listenreihenfolge exakt auf die Sitznummern", () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }));
  const { assignments } = planInitialSeating(players, { tableCount: 3, tableSize: 6, sequential: true });

  assert.equal(assignments.length, 14);
  assert.equal(assignments[0].num, "1.1");
  assert.equal(assignments[5].num, "1.6");
  assert.equal(assignments[6].num, "2.1");
  assert.equal(assignments[13].num, "3.2");
  assert.deepEqual(
    assignments.map((a) => a.player.id),
    players.map((p) => p.id)
  );
  assert.equal(assignments.filter((a) => a.isBank).length, 1);
});
