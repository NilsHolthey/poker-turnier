import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRandomAmong } from "./random.js";
import { mulberry32, sequenceRng, makeTable } from "./test-helpers.js";

test("pickRandomAmong: Gleichstand zwischen mehreren Tischen wird nicht immer zugunsten des ersten Elements aufgelöst (Tie-Breaking-Fix)", () => {
  // Four tables, two tied at the max (A, B) and two tied at the min (C, D).
  const tables = [
    makeTable("A", 5),
    makeTable("B", 5),
    makeTable("C", 2),
    makeTable("D", 2),
  ];

  // Deterministic: rng=0 must pick the first candidate, a value near 1 the last one.
  const first = pickRandomAmong(tables, (t) => t.players.length, "max", sequenceRng([0]));
  assert.equal(first.id, "A");
  const last = pickRandomAmong(tables, (t) => t.players.length, "max", sequenceRng([0.99]));
  assert.equal(last.id, "B");

  const minFirst = pickRandomAmong(tables, (t) => t.players.length, "min", sequenceRng([0]));
  assert.equal(minFirst.id, "C");
  const minLast = pickRandomAmong(tables, (t) => t.players.length, "min", sequenceRng([0.99]));
  assert.equal(minLast.id, "D");

  // Statistical fairness over many trials with a seeded (reproducible) PRNG: both
  // tied candidates must show up, i.e. the bug ("always the lowest table number")
  // must not reproduce.
  const rng = mulberry32(42);
  const picks = new Set();
  for (let i = 0; i < 200; i++) {
    picks.add(pickRandomAmong(tables, (t) => t.players.length, "max", rng).id);
  }
  assert.deepEqual(picks, new Set(["A", "B"]));
});

test("pickRandomAmong: einzelner Kandidat wird immer gewählt, kein Gleichstand", () => {
  const tables = [makeTable("A", 3), makeTable("B", 7)];
  const winner = pickRandomAmong(tables, (t) => t.players.length, "max", sequenceRng([0.5]));
  assert.equal(winner.id, "B");
});

test("pickRandomAmong: leere Liste liefert undefined", () => {
  assert.equal(pickRandomAmong([], (t) => t.players.length, "max"), undefined);
});
