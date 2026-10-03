import { test } from "node:test";
import assert from "node:assert/strict";
import { planInitialSeating } from "./initialSeating.js";
import { mulberry32 } from "./test-helpers.js";

test("planInitialSeating: die Bank sitzt immer fest auf 1.1, unabhängig vom Zufall", () => {
  const players = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));
  const { assignments } = planInitialSeating(players, { tableSizes: [6, 6] }, mulberry32(1));

  const bankAssignment = assignments.find((a) => a.isBank);
  assert.equal(bankAssignment.player.id, "p0"); // erster Spieler in der Liste
  assert.equal(bankAssignment.num, "1.1");
  assert.equal(assignments.filter((a) => a.isBank).length, 1);
});

test("planInitialSeating: alle Spieler landen genau einmal auf einem Platz, jeder Tisch respektiert seine EIGENE Kapazität", () => {
  // Gemischte Größen statt uniform (docs/table-size-kickoff-prompt.md, §1) -
  // stellt sicher, dass der Random-Pfad wirklich t.size pro Tisch liest statt
  // eines globalen tableSize.
  const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }));
  const { tables, assignments } = planInitialSeating(players, { tableSizes: [6, 7, 8] }, mulberry32(7));

  assert.equal(assignments.length, 14);
  const assignedIds = assignments.map((a) => a.player.id).sort();
  assert.deepEqual(assignedIds, players.map((p) => p.id).sort());
  for (const table of tables) {
    assert.ok(table.players.length <= table.size);
  }
});

test("planInitialSeating: zufällige Verteilung weicht nie um mehr als 1 Spieler zwischen Tischen ab (greedy 'kleinster Tisch zuerst'), bei uniformer Tischgröße", () => {
  // Bugreport: "I realized that the seating is already random. but it's also
  // possible that we get 7x6 and 1x3" - das random-Verfahren weist jeden
  // Spieler dem/den aktuell KLEINSTEN Tisch(en) zu (pickRandomAmong mit
  // mode="min" in initialSeating.js), das garantiert rein durch die
  // Konstruktion eine maximale Differenz von 1 zwischen irgendwelchen zwei
  // Tischen - über mehrere Seeds geprüft, damit kein Zufalls-Seed zufällig
  // den ungünstigen Fall trifft.
  const players = Array.from({ length: 43 }, (_, i) => ({ id: `p${i}` }));
  for (const seed of [1, 2, 3, 4, 5]) {
    const { tables } = planInitialSeating(players, { tableSizes: Array(8).fill(6) }, mulberry32(seed));
    const sizes = tables.map((t) => t.players.length);
    assert.equal(Math.max(...sizes) - Math.min(...sizes), 1, `seed ${seed}: sizes ${sizes}`);
  }
});

test("planInitialSeating: gemischte Tischgrößen, Spieleranzahl passt exakt auf die Summe aller Größen (random)", () => {
  // docs/table-size-kickoff-prompt.md Beispiel: "50 Spieler = 2×7 + 6×6" -
  // bei exaktem Fit füllt der Greedy-Algorithmus JEDEN Tisch bis zu seiner
  // eigenen konfigurierten Größe, unabhängig von der Zugriffsreihenfolge
  // (jeder volle Tisch scheidet aus den Kandidaten aus, der Rest verteilt
  // sich zwangsläufig auf die übrigen, bis am Ende nichts übrig ist).
  const tableSizes = [7, 7, 6, 6, 6, 6, 6, 6];
  const players = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` }));
  const { tables } = planInitialSeating(players, { tableSizes }, mulberry32(3));
  assert.deepEqual(
    tables.map((t) => t.players.length),
    tableSizes
  );
});

test("planInitialSeating: zu viele Spieler für die gewählten Tischgrößen wirft einen Fehler", () => {
  const players = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}` }));
  assert.throws(() => planInitialSeating(players, { tableSizes: [7, 7, 6, 6, 6, 6, 6, 6] }));
});

test("planInitialSeating: keine Spieler wirft einen Fehler", () => {
  assert.throws(() => planInitialSeating([], { tableSizes: [6, 6] }));
});

test("planInitialSeating: sequential füllt jeden Tisch in Listenreihenfolge bis zur konfigurierten Größe, kein automatischer Ausgleich mehr", () => {
  // 14 Spieler / 3 Tische á 6 Plätze - füllt Tisch 1 und 2 komplett (6, 6),
  // Tisch 3 bekommt den Rest (2). KEIN automatisches Umverteilen auf (5, 5,
  // 4) mehr (anders als vor dem Tischgrößen-Ticket) - wer unterschiedliche
  // Größen will, konfiguriert sie jetzt explizit pro Tisch statt sich auf
  // eine automatische Umverteilung zu verlassen (siehe Kommentar in
  // initialSeating.js).
  const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }));
  const { tables, assignments } = planInitialSeating(players, { tableSizes: [6, 6, 6], sequential: true });

  assert.equal(assignments.length, 14);
  assert.deepEqual(tables.map((t) => t.players.length), [6, 6, 2]);
  assert.equal(assignments[0].num, "1.1");
  assert.equal(assignments[5].num, "1.6"); // letzter Platz an Tisch 1
  assert.equal(assignments[6].num, "2.1"); // erster Platz an Tisch 2
  assert.equal(assignments[13].num, "3.2"); // letzter Spieler, Tisch 3 (nur 2 von 6 Plätzen belegt)
  assert.deepEqual(
    assignments.map((a) => a.player.id),
    players.map((p) => p.id)
  );
  assert.equal(assignments.filter((a) => a.isBank).length, 1);
});

test("planInitialSeating: sequential mit gemischten Tischgrößen, Spieleranzahl passt exakt auf die Summe aller Größen", () => {
  const tableSizes = [7, 7, 6, 6, 6, 6, 6, 6];
  const players = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` }));
  const { tables, assignments } = planInitialSeating(players, { tableSizes, sequential: true });

  assert.deepEqual(tables.map((t) => t.players.length), tableSizes);
  assert.equal(assignments[0].num, "1.1");
  assert.equal(assignments[6].num, "1.7"); // letzter Platz an Tisch 1 (7 Plätze)
  assert.equal(assignments[7].num, "2.1"); // erster Platz an Tisch 2
});
