// Dev convenience only (not one of the spec's 4 required endpoints): creates one
// tournament with the initial 8 Vorrunde tables (6 seats each) and seats player
// 1.1 as the bank, so there's something to look at locally. Run with
// `npm run db:seed`. Safe to run once; skips if a tournament already exists.
import { getDb } from "../lib/db/mongodb.js";
import {
  PHASES,
  TABLE_COLORS,
  DEFAULT_BASELINE,
  DEFAULT_DISSOLVE_THRESHOLD,
  DEFAULT_BALANCE_DIFF_THRESHOLD,
} from "../lib/constants.js";

const db = await getDb();

const existing = await db.collection("tournaments").findOne({});
if (existing) {
  console.log(`Turnier "${existing.name}" existiert bereits (${existing._id}), überspringe Seed.`);
  process.exit(0);
}

const phase = PHASES[0];
const now = new Date();

const { insertedId: tournamentId } = await db.collection("tournaments").insertOne({
  name: "Freundes-Pokerturnier",
  phaseIndex: 0,
  config: {
    baseline: DEFAULT_BASELINE,
    dissolveThreshold: DEFAULT_DISSOLVE_THRESHOLD,
    balanceDiffThreshold: DEFAULT_BALANCE_DIFF_THRESHOLD,
    rebuyPhaseActive: true,
  },
  createdAt: now,
});

const tableDocs = Array.from({ length: phase.targetTables }, (_, i) => ({
  tournamentId,
  phaseIndex: 0,
  label: `Tisch ${i + 1}`,
  color: TABLE_COLORS[i % TABLE_COLORS.length],
  maxSeats: phase.tableSize,
  active: true,
}));
const { insertedIds } = await db.collection("tables").insertMany(tableDocs);
const firstTableId = insertedIds[0];

await db.collection("players").insertOne({
  tournamentId,
  tableId: firstTableId,
  num: "1.1",
  name: "Spieler 1.1 (Bank)",
  isBank: true,
  status: "active",
  seatHistory: [{ tableId: firstTableId, timestamp: now, reason: "manual" }],
});

console.log(`Turnier angelegt: ${tournamentId}`);
console.log(`${tableDocs.length} Tische (${phase.tableSize} Plätze), Bank sitzt auf 1.1 an Tisch 1.`);
process.exit(0);
