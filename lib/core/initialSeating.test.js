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

test("planInitialSeating: zufällige Verteilung weicht nie um mehr als 1 Spieler zwischen Tischen ab (greedy 'kleinster Tisch zuerst')", () => {
  // Bugreport: "I realized that the seating is already random. but it's also
  // possible that we get 7x6 and 1x3" - das random-Verfahren weist jeden
  // Spieler dem/den aktuell KLEINSTEN Tisch(en) zu (pickRandomAmong mit
  // mode="min" in initialSeating.js), das garantiert rein durch die
  // Konstruktion eine maximale Differenz von 1 zwischen irgendwelchen zwei
  // Tischen - über mehrere Seeds geprüft, damit kein Zufalls-Seed zufällig
  // den ungünstigen Fall trifft.
  const players = Array.from({ length: 43 }, (_, i) => ({ id: `p${i}` }));
  for (const seed of [1, 2, 3, 4, 5]) {
    const { tables } = planInitialSeating(players, { tableCount: 8, tableSize: 6 }, mulberry32(seed));
    const sizes = tables.map((t) => t.players.length);
    assert.equal(Math.max(...sizes) - Math.min(...sizes), 1, `seed ${seed}: sizes ${sizes}`);
  }
});

test("planInitialSeating: zu viele Spieler für die verfügbaren Plätze wirft einen Fehler", () => {
  const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
  assert.throws(() => planInitialSeating(players, { tableCount: 2, tableSize: 6 }));
});

test("planInitialSeating: keine Spieler wirft einen Fehler", () => {
  assert.throws(() => planInitialSeating([], { tableCount: 2, tableSize: 6 }));
});

test("planInitialSeating: sequential setzt Spieler in Listenreihenfolge exakt auf die Sitznummern, Tische gleichmäßig gefüllt statt nacheinander voll", () => {
  // 14 Spieler / 3 Tische á 6 Plätze - gleichmäßig verteilt: 5, 5, 4 (die
  // ersten 2 Tische bekommen den einen Spieler extra), NICHT 6, 6, 2 (Chat-
  // Bugreport: "it's also possible that we get 7x6 and 1x3 ... this should
  // be prevented").
  const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }));
  const { tables, assignments } = planInitialSeating(players, { tableCount: 3, tableSize: 6, sequential: true });

  assert.equal(assignments.length, 14);
  assert.deepEqual(tables.map((t) => t.players.length), [5, 5, 4]);
  assert.equal(assignments[0].num, "1.1");
  assert.equal(assignments[4].num, "1.5"); // letzter Platz an Tisch 1
  assert.equal(assignments[5].num, "2.1"); // erster Platz an Tisch 2
  assert.equal(assignments[13].num, "3.4"); // letzter Spieler, Tisch 3 (nur 4 statt 6 Plätze belegt)
  assert.deepEqual(
    assignments.map((a) => a.player.id),
    players.map((p) => p.id)
  );
  assert.equal(assignments.filter((a) => a.isBank).length, 1);
});

test("planInitialSeating: sequential verteilt den Fehlbetrag bei nicht teilbarer Spielerzahl über alle Tische statt nur den letzten zu leeren", () => {
  // 43 Spieler / 8 Tische á 6 Plätze (Chat-Beispiel: "we only have 43 or 44
  // players ... distribute evenly") - base=floor(43/8)=5, remainder=3, also
  // 3 Tische mit 6 + 5 Tische mit 5 (43 = 3*6 + 5*5), kein Tisch weicht um
  // mehr als 1 vom Durchschnitt ab.
  const players = Array.from({ length: 43 }, (_, i) => ({ id: `p${i}` }));
  const { tables } = planInitialSeating(players, { tableCount: 8, tableSize: 6, sequential: true });

  const sizes = tables.map((t) => t.players.length);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 43);
  assert.ok(sizes.every((s) => s >= 5 && s <= 6));
  assert.deepEqual(
    [...sizes].sort((a, b) => b - a),
    [6, 6, 6, 5, 5, 5, 5, 5]
  );
});
