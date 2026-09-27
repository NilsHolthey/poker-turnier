import { test } from "node:test";
import assert from "node:assert/strict";
import { findTableToDissolve, nextDissolveTarget } from "./dissolve.js";
import { makeTable, sequenceRng } from "./test-helpers.js";

test("findTableToDissolve: Auflösung bei nur noch 1 Spieler an einem Tisch", () => {
  const tables = [makeTable("T1", 1), makeTable("T2", 5), makeTable("T3", 5)];
  const result = findTableToDissolve(tables, 2);
  assert.equal(result.id, "T1");
});

test("findTableToDissolve: kein Auflösen, wenn nur noch 1 aktiver Tisch übrig ist", () => {
  const tables = [makeTable("T1", 1)];
  assert.equal(findTableToDissolve(tables, 2), null);
});

test("findTableToDissolve: kein Kandidat oberhalb des Schwellwerts", () => {
  const tables = [makeTable("T1", 4), makeTable("T2", 5)];
  assert.equal(findTableToDissolve(tables, 2), null);
});

test("nextDissolveTarget: greedy Verteilung an den jeweils aktuell kleinsten Tisch", () => {
  // T2 and T3 start tied at 3; the dissolved table's players are placed one at a
  // time, and each placement must shrink the target's lead for the next pick.
  let remaining = [makeTable("T2", 3), makeTable("T3", 3)];

  const firstTarget = nextDissolveTarget(remaining, [], sequenceRng([0]));
  assert.equal(firstTarget.id, "T2");

  // Apply the assignment before drawing the next target, as the real caller must.
  remaining = remaining.map((t) =>
    t.id === firstTarget.id ? { ...t, players: [...t.players, { id: "new" }] } : t
  );

  const secondTarget = nextDissolveTarget(remaining, []);
  assert.equal(secondTarget.id, "T3"); // now strictly the smallest, no tie left
});

test("nextDissolveTarget: Reroll schließt bereits verworfene Zieltische aus", () => {
  const remaining = [makeTable("T2", 3), makeTable("T3", 3)];
  const rejected = nextDissolveTarget(remaining, [], sequenceRng([0]));
  const rerolled = nextDissolveTarget(
    remaining,
    [rejected.id],
    sequenceRng([0])
  );
  assert.notEqual(rerolled.id, rejected.id);
});

test("nextDissolveTarget: keine Alternative mehr verfügbar liefert null", () => {
  const remaining = [makeTable("T2", 3)];
  assert.equal(nextDissolveTarget(remaining, ["T2"]), null);
});

test("Bank-Sonderfall: Bank wird bei Tisch-Auflösung wie jeder andere Spieler als Auffüller verteilt (kein Blocken, keine Sonderlogik im Kern-Algorithmus)", () => {
  const dissolvedTable = {
    id: "T1",
    players: [
      { id: "p-other", isBank: false },
      { id: "p-bank", isBank: true },
    ],
  };
  let remaining = [makeTable("T2", 2), makeTable("T3", 2)];

  const assignments = [];
  for (const player of dissolvedTable.players) {
    const target = nextDissolveTarget(remaining, [], sequenceRng([0]));
    assignments.push({ player, toTableId: target.id });
    remaining = remaining.map((t) =>
      t.id === target.id ? { ...t, players: [...t.players, player] } : t
    );
  }

  const bankAssignment = assignments.find((a) => a.player.isBank);
  assert.ok(bankAssignment, "Bank muss eine Zielzuweisung erhalten");
  assert.ok(
    remaining.some((t) => t.id === bankAssignment.toTableId),
    "Zieltisch der Bank muss unter den verbleibenden Tischen sein"
  );
});
