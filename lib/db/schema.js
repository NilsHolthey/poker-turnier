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
        // Optional (nicht in required) - "mehrere kleine Tische gleichzeitig"
        // (Chat: "all tables with 3 players left needs to be tackled"), siehe
        // countSmallTables in lib/core/dissolve.js.
        smallTableThreshold: { bsonType: "int", minimum: 0 },
        smallTableAlertCount: { bsonType: "int", minimum: 1 },
        // Optional (nicht in required) - "Einfacher Modus" (Chat-Wunsch: "we
        // will build an einfachen Modus ... selectable when creating the
        // tournament") - nur bei der Erstellung gesetzt, siehe
        // resolvePendingAction (lib/db/tournamentEngine.js) für die
        // eigentliche Verhaltensänderung.
        simpleMode: { bsonType: "bool" },
        // Optional (nicht in required) - bisher nur ein Erstellungs-Parameter
        // für planInitialSeating, jetzt persistiert (Chat-Wunsch: "push
        // notification ... only einfacher modus with randomized seats" -
        // resolvePendingAction muss später wissen, ob zufällig oder fest
        // gesetzt wurde, siehe lib/db/tournamentEngine.js).
        sequentialSeating: { bsonType: "bool" },
      },
    },
    createdAt: { bsonType: "date" },
    // Verhindert wiederholte Push-Benachrichtigungen bei jedem weiteren
    // Bust-out, solange die Kleine-Tische-Situation unverändert fortbesteht -
    // wird zurückgesetzt, sobald die Anzahl kleiner Tische wieder unter
    // config.smallTableAlertCount fällt (siehe resolvePendingAction).
    smallTableAlertSent: { bsonType: "bool" },
    // Gleiches Dedup-Muster wie smallTableAlertSent (Chat-Wunsch: "add an
    // alert for halbfinale reached ... push notification and popup") -
    // verhindert wiederholte Pushes, solange die Vorrunden-Tischzahl auf/unter
    // dem für Halbfinale konfigurierten Ziel bleibt.
    halbfinaleReadyAlertSent: { bsonType: "bool" },
    // Gleiches Dedup-Muster, eine Phase weiter (Chat-Wunsch: "add it also for
    // finale") - verhindert wiederholte Pushes, solange die Halbfinale-
    // Spielerzahl auf/unter dem für Finale konfigurierten Ziel bleibt.
    finaleReadyAlertSent: { bsonType: "bool" },
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
        // 1-basierte Levelnummer, bis zu der Rebuy erlaubt ist (Chat-Wunsch:
        // "set after which level rebuy is over") - null/nicht gesetzt heißt
        // kein automatisches Ende, siehe isRebuyPhaseActive() in
        // lib/core/blindSchedule.js. Optional (nicht in required), ältere
        // Turniere haben das Feld noch nicht.
        rebuyEndLevelIndex: { bsonType: ["int", "null"], minimum: 1 },
        // Chat-Wunsch: "admin should have more control over the blindes and
        // timer so pausing it should be a possibility" - gesetzt = Uhr
        // pausiert, computeEffectiveBlindState() friert die Restzeit auf
        // diesen Zeitpunkt ein statt der echten Realzeit (siehe
        // lib/core/blindSchedule.js). null/nicht gesetzt = läuft normal.
        // Optional (nicht in required), ältere Turniere haben das Feld noch
        // nicht.
        pausedAt: { bsonType: ["date", "null"] },
        // Chat-Wunsch: "total tournament clock" fürs TV-Dashboard - anders
        // als currentLevelStartedAt (wird bei JEDEM Levelwechsel neu
        // gesetzt) bleibt dieser Zeitstempel ab dem ERSTEN startBlindClock()
        // stehen, bis resetBlindClock() ihn wieder auf null setzt. Optional
        // (nicht in required), ältere Turniere haben das Feld noch nicht.
        firstStartedAt: { bsonType: ["date", "null"] },
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
        required: ["targetTables"],
        properties: {
          targetTables: { bsonType: "int", minimum: 1 },
          // tableSize (Halbfinale/Finale, weiterhin EINHEITLICH pro Phase,
          // docs/table-size-kickoff-prompt.md "Nicht in diesem Ticket") ODER
          // tableSizes (Vorrunde, §1: ein Eintrag pro individuell
          // konfiguriertem Tisch, z.B. 2×7 + 6×6) - je Phasen-Eintrag ist nur
          // eines der beiden gesetzt, deshalb keines der beiden required.
          tableSize: { bsonType: "int", minimum: 2, maximum: 10 },
          tableSizes: {
            bsonType: "array",
            items: { bsonType: "int", minimum: 2, maximum: 10 },
          },
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
    // Optional (nicht in required) - Dedup-Flag fürs "Tisch kann auf 6
    // verkleinert werden"-Alert (Chat-Wunsch: "push notification for admin
    // if you can remove seat to reduce table to 6"), siehe
    // resolvePendingAction in lib/db/tournamentEngine.js. Pro Tisch statt pro
    // Turnier, anders als halbfinaleReadyAlertSent/finaleReadyAlertSent.
    reducibleAlertSent: { bsonType: "bool" },
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
    // Optional (nicht in required) - nur beim Bust-out gesetzt (Chat-Wunsch
    // fürs TV-Dashboard: "highlighted red then get appended at the end
    // greyed out"). Erlaubt zwei rein zeitbasierte, zustandslose Berechnungen
    // im Dashboard statt fragilem Client-seitigem "hab ich das schon
    // gesehen"-Tracking: die Sortierreihenfolge gebusteter Spieler (nach
    // bustedAt) und ob ein Bust noch "frisch" genug fürs rote Aufblitzen ist.
    bustedAt: { bsonType: ["date", "null"] },
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

// Chat-Wunsch: "admin ... site where we see which users are currently
// logged in" - eigene, selbst getrackte Presence statt einer Abfrage der
// Auth0-Management-API (bräuchte eigene Management-API-Credentials +
// Token-Handling und ist je nach Auth0-Tenant-Plan evtl. gar nicht
// verfügbar). _id ist bewusst der feste Nickname (admin, tisch1..tisch8,
// siehe lib/authz.js getRole) statt einer generierten ObjectId - ein Upsert
// pro Account trifft dadurch immer genau EIN Dokument, unabhängig davon, wie
// viele Geräte/Tabs dieser Account gerade offen hat.
export const presenceSchema = {
  bsonType: "object",
  required: ["_id", "role", "lastSeenAt"],
  properties: {
    _id: { bsonType: "string" },
    role: { bsonType: "string" },
    lastSeenAt: { bsonType: "date" },
  },
};

const COLLECTIONS = {
  tournaments: tournamentSchema,
  tables: tableSchema,
  players: playerSchema,
  moves: moveSchema,
  pushSubscriptions: pushSubscriptionSchema,
  presence: presenceSchema,
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
