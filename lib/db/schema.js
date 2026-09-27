import { PLAYER_STATUS, MOVE_REASONS } from "../constants.js";

// $jsonSchema validators mirror the "Datenmodell" section of docs/poker-turnier-mvp-spec.md
// field-for-field, so the DB rejects anything that drifts from the spec.

export const tournamentSchema = {
  bsonType: "object",
  required: ["name", "phaseIndex", "config", "createdAt"],
  properties: {
    name: { bsonType: "string" },
    phaseIndex: { bsonType: "int", minimum: 0 },
    config: {
      bsonType: "object",
      required: ["baseline", "dissolveThreshold", "balanceDiffThreshold", "rebuyPhaseActive"],
      properties: {
        baseline: { bsonType: "int", minimum: 1 },
        dissolveThreshold: { bsonType: "int", minimum: 0 },
        balanceDiffThreshold: { bsonType: "int", minimum: 1 },
        rebuyPhaseActive: { bsonType: "bool" },
      },
    },
    createdAt: { bsonType: "date" },
    // Optional (nicht in required) - ältere Turniere haben noch keine
    // Blindstruktur. Levels/Pausen werden admin-seitig gepflegt.
    // currentLevelStartedAt (Chat-Redesign: "blinds increase automatically, or
    // if admin moves them up") ist der Zeitstempel, seit dem currentLevelIndex
    // gilt - lib/core/blindSchedule.js computeEffectiveBlindState() rechnet
    // rein aus verstrichener Zeit seitdem das JEWEILS aktuelle Level aus, ganz
    // ohne Server-Cron. Ein manuelles Vor-/Zurückschalten setzt beide Felder
    // zusammen neu (siehe setBlindLevelIndex in tournamentEngine.js) - die Uhr
    // für das neue Level fängt dann bei 0 an, nicht rückwirkend.
    // null erlaubt (Chat-Fix: "blindes speichern should not start the
    // tournament just when admin starts it") - setBlindSchedule() setzt es
    // bewusst NICHT mehr automatisch auf jetzt, erst startBlindClock() tut das.
    blindSchedule: {
      bsonType: "object",
      required: ["startTime", "levels", "currentLevelIndex", "currentLevelStartedAt"],
      properties: {
        startTime: { bsonType: "string" },
        currentLevelIndex: { bsonType: "int", minimum: 0 },
        currentLevelStartedAt: { bsonType: ["date", "null"] },
        levels: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["smallBlind", "bigBlind", "durationMinutes", "isBreak"],
            properties: {
              smallBlind: { bsonType: "int", minimum: 0 },
              bigBlind: { bsonType: "int", minimum: 0 },
              durationMinutes: { bsonType: "int", minimum: 1 },
              isBreak: { bsonType: "bool" },
            },
          },
        },
      },
    },
    // Optional (nicht in required) - ältere Turniere haben noch keine
    // phasePlans. Ein Eintrag pro PHASES-Index (Vorrunde/Halbfinale/Finale):
    // admin-konfigurierbar bei der Turnier-Erstellung, statt die globale
    // PHASES-Konstante für jedes Turnier fest vorzuschreiben. endPhase() fällt
    // ohne diesen Wert auf PHASES[nextIndex] zurück.
    phasePlans: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["targetTables", "tableSize"],
        properties: {
          targetTables: { bsonType: "int", minimum: 1 },
          tableSize: { bsonType: "int", minimum: 2, maximum: 10 },
        },
      },
    },
  },
};

export const tableSchema = {
  bsonType: "object",
  required: ["tournamentId", "phaseIndex", "label", "color", "maxSeats", "active"],
  properties: {
    tournamentId: { bsonType: "objectId" },
    phaseIndex: { bsonType: "int", minimum: 0 },
    label: { bsonType: "string" },
    color: { bsonType: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    // 6/8 sind die spec-Phasen-Defaults (Vorrunde/HF/Finale); beim Admin-Setup
    // (Tournament-Erstellung) ist die Tischgröße frei wählbar innerhalb dieser
    // Grenzen.
    maxSeats: { bsonType: "int", minimum: 2, maximum: 10 },
    active: { bsonType: "bool" },
  },
};

export const playerSchema = {
  bsonType: "object",
  required: ["tournamentId", "tableId", "num", "name", "isBank", "status", "seatHistory"],
  properties: {
    tournamentId: { bsonType: "objectId" },
    tableId: { bsonType: "objectId" },
    num: { bsonType: "string", pattern: "^\\d+\\.\\d+$" },
    name: { bsonType: "string" },
    isBank: { bsonType: "bool" },
    status: { enum: PLAYER_STATUS },
    seatHistory: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["tableId", "timestamp", "reason"],
        properties: {
          tableId: { bsonType: "objectId" },
          timestamp: { bsonType: "date" },
          reason: { enum: MOVE_REASONS },
        },
      },
    },
  },
};

export const moveSchema = {
  bsonType: "object",
  required: ["tournamentId", "playerId", "toTableId", "reason", "confirmedBy", "timestamp"],
  properties: {
    tournamentId: { bsonType: "objectId" },
    playerId: { bsonType: "objectId" },
    fromTableId: { bsonType: ["objectId", "null"] },
    toTableId: { bsonType: "objectId" },
    reason: { enum: MOVE_REASONS },
    confirmedBy: { bsonType: "string" },
    timestamp: { bsonType: "date" },
  },
};

// Web Push (spec-Erweiterung, siehe Chat: "push-Benachrichtigungen ... aber
// gezielt nur an Quell-/Zieltisch-Gerät"). Keyed by nickname statt tableId, weil
// die Tisch-Zuordnung eines Operator-Accounts sich pro Phase ändert (neue
// Tisch-Dokumente bei endPhase) - der Nickname->Tisch-Abgleich passiert beim
// Versand dynamisch, genau wie beim "Mein Tisch"-Login-Mapping in app/page.js.
export const pushSubscriptionSchema = {
  bsonType: "object",
  required: ["nickname", "endpoint", "keys", "createdAt"],
  properties: {
    nickname: { bsonType: "string" },
    endpoint: { bsonType: "string" },
    keys: {
      bsonType: "object",
      required: ["p256dh", "auth"],
      properties: {
        p256dh: { bsonType: "string" },
        auth: { bsonType: "string" },
      },
    },
    createdAt: { bsonType: "date" },
  },
};

const COLLECTIONS = {
  tournaments: tournamentSchema,
  tables: tableSchema,
  players: playerSchema,
  moves: moveSchema,
  pushSubscriptions: pushSubscriptionSchema,
};

// Creates collections with $jsonSchema validation (or updates the validator on an
// existing collection) and ensures the indexes the app's query patterns rely on.
export async function ensureSchema(db) {
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const [name, schema] of Object.entries(COLLECTIONS)) {
    const validator = { $jsonSchema: schema };
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: "moderate" });
    } else {
      await db.createCollection(name, { validator, validationLevel: "moderate" });
    }
  }

  await db.collection("tables").createIndexes([
    { key: { tournamentId: 1, active: 1 } },
  ]);
  await db.collection("players").createIndexes([{ key: { tournamentId: 1, tableId: 1 } }]);
  await ensurePlayerNumIndex(db);
  await db.collection("moves").createIndexes([
    { key: { tournamentId: 1, timestamp: -1 } },
  ]);
  await db.collection("pushSubscriptions").createIndexes([
    { key: { endpoint: 1 }, unique: true },
    { key: { nickname: 1 } },
  ]);
}

// num muss nur unter AKTIVEN Spielern eindeutig sein: gebustete Spieler behalten
// ihre num im Dokument (Audit-Log/seatHistory), aber der Sitzplatz muss für
// einen neuen Spieler wieder frei werden. Eine normale unique-Index würde die
// num für immer blockieren, sobald ihr erster Inhaber gebustet ist - genau der
// Bug, der "Spieler hinzufügen" nach ein paar Bust-outs/Tests stillschweigend
// mit 500 hat scheitern lassen (Duplicate-Key-Fehler, unbehandelt).
async function ensurePlayerNumIndex(db) {
  const indexes = await db.collection("players").listIndexes().toArray();
  const stale = indexes.find((idx) => idx.name === "tournamentId_1_num_1" && !idx.partialFilterExpression);
  if (stale) {
    await db.collection("players").dropIndex("tournamentId_1_num_1");
  }
  await db.collection("players").createIndex(
    { tournamentId: 1, num: 1 },
    { unique: true, partialFilterExpression: { status: "active" } }
  );
}
