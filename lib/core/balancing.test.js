import { test } from "node:test";
import assert from "node:assert/strict";
import { needsBalance, findBalanceTables, drawBalanceCandidate } from "./balancing.js";
import { makeTable, sequenceRng } from "./test-helpers.js";

test("needsBalance: greift nur, wenn Minimum unter Baseline liegt UND die Differenz >= 2 ist", () => {
  assert.equal(needsBalance([makeTable("A", 3), makeTable("B", 4)], 4), false); // Diff nur 1
  assert.equal(needsBalance([makeTable("A", 6), makeTable("B", 5)], 4), false); // Min nicht unter Baseline
  assert.equal(needsBalance([makeTable("A", 6), makeTable("B", 3)], 4), true);
  assert.equal(needsBalance([makeTable("A", 5)], 4), false); // nur 1 Tisch
});

test("needsBalance: diffThreshold ist admin-konfigurierbar statt fest bei 2", () => {
  const tables = [makeTable("A", 5), makeTable("B", 4)]; // Diff 1, Min 4 < Baseline 6
  assert.equal(needsBalance(tables, 6, 2), false); // Default-Schwelle 2 -> noch kein Ausgleich
  assert.equal(needsBalance(tables, 6, 1), true); // Schwelle 1 -> greift schon bei Diff 1
});

test("findBalanceTables: Gleichstand zwischen mehreren Tischen bei Quelle und Ziel wird zufällig aufgelöst", () => {
  const tables = [makeTable("A", 6), makeTable("B", 6), makeTable("C", 2), makeTable("D", 2)];
  const { fromTable, toTable } = findBalanceTables(tables, sequenceRng([0.99, 0]));
  assert.equal(fromTable.id, "B"); // max-Kandidaten A/B, letzter Slot -> B
  assert.equal(toTable.id, "C"); // min-Kandidaten C/D, erster Slot -> C
});

test("drawBalanceCandidate: Reroll schließt bereits verworfene Spieler aus, keine Alternative -> null", () => {
  const table = makeTable("A", 2);
  const [p1, p2] = table.players;
  const first = drawBalanceCandidate(table, [], sequenceRng([0]));
  assert.equal(first.id, p1.id);
  const second = drawBalanceCandidate(table, [p1.id], sequenceRng([0]));
  assert.equal(second.id, p2.id);
  assert.equal(drawBalanceCandidate(table, [p1.id, p2.id]), null);
});

test("Bank-Sonderfall: Bank kann als Umsetzungs-Kandidat gezogen werden (weggezogen werden), kein Blocken im Kern-Algorithmus", () => {
  const fromTable = {
    id: "A",
    players: [
      { id: "p-bank", isBank: true },
      { id: "p-other", isBank: false },
    ],
  };
  const candidate = drawBalanceCandidate(fromTable, ["p-other"]);
  assert.equal(candidate.id, "p-bank");
  assert.equal(candidate.isBank, true);
});
