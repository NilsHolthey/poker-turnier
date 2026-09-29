import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatBlindLevel,
  computeEffectiveBlindState,
  computeLevelStartTimes,
  isRebuyPhaseActive,
  rebuyRemainingMs,
} from "./blindSchedule.js";

test("formatBlindLevel: formatiert Level und Pause, null liefert Platzhalter", () => {
  assert.equal(formatBlindLevel({ smallBlind: 500, bigBlind: 1000, isBreak: false }), "500/1.000");
  assert.equal(formatBlindLevel({ isBreak: true }), "Pause");
  assert.equal(formatBlindLevel(null), "-");
});

const LEVELS = [
  { smallBlind: 25, bigBlind: 50, durationMinutes: 20, isBreak: false },
  { smallBlind: 50, bigBlind: 100, durationMinutes: 20, isBreak: false },
  { smallBlind: 75, bigBlind: 150, durationMinutes: 20, isBreak: false },
];

test("computeEffectiveBlindState: direkt am Levelstart bleibt volle Dauer übrig", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs) };
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, startedAtMs);
  assert.equal(effectiveIndex, 0);
  assert.equal(remainingMs, 20 * 60000);
});

test("computeEffectiveBlindState: mitten im aktuellen Level, kein Levelwechsel", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs) };
  const tenMinutesLater = startedAtMs + 10 * 60000;
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, tenMinutesLater);
  assert.equal(effectiveIndex, 0);
  assert.equal(remainingMs, 10 * 60000);
});

test("computeEffectiveBlindState: springt nach Ablauf automatisch ins nächste Level", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs) };
  const twentyFiveMinutesLater = startedAtMs + 25 * 60000;
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, twentyFiveMinutesLater);
  assert.equal(effectiveIndex, 1);
  assert.equal(remainingMs, 15 * 60000);
});

test("computeEffectiveBlindState: überspringt mehrere abgelaufene Level auf einmal", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs) };
  const fortyFiveMinutesLater = startedAtMs + 45 * 60000;
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, fortyFiveMinutesLater);
  assert.equal(effectiveIndex, 2);
  assert.equal(remainingMs, 15 * 60000);
});

test("computeEffectiveBlindState: bleibt am letzten Level stehen statt zu überlaufen", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs) };
  const wayLater = startedAtMs + 500 * 60000;
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, wayLater);
  assert.equal(effectiveIndex, 2);
  assert.equal(remainingMs, 0);
});

test("computeEffectiveBlindState: currentLevelStartedAt=null heißt gespeichert aber nicht gestartet, keine laufende Uhr", () => {
  // Chat-Wunsch: "blindes speichern should not start the tournament just
  // when admin starts it" - setBlindSchedule() setzt currentLevelStartedAt
  // absichtlich auf null statt sofort auf jetzt.
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: null };
  const { effectiveIndex, remainingMs, started } = computeEffectiveBlindState(schedule, 9_999_999);
  assert.equal(started, false);
  assert.equal(effectiveIndex, 0);
  assert.equal(remainingMs, 20 * 60000);
});

test("computeEffectiveBlindState: manueller Sprung setzt die Uhr für das neue Level auf 0 zurück", () => {
  // Admin schaltet manuell auf Level 2, currentLevelStartedAt wird dabei neu
  // gesetzt (siehe lib/db/tournamentEngine.js setBlindLevelIndex) - die
  // verstrichene Zeit VOR dem Sprung darf sich nicht auf Level 2 auswirken.
  const jumpAtMs = 5_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 2, currentLevelStartedAt: new Date(jumpAtMs) };
  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, jumpAtMs + 60000);
  assert.equal(effectiveIndex, 2);
  assert.equal(remainingMs, 19 * 60000);
});

test("isRebuyPhaseActive: manueller Schalter aus gewinnt immer, unabhängig vom Level", () => {
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(0), rebuyEndLevelIndex: 5 };
  assert.equal(isRebuyPhaseActive({ rebuyPhaseActive: false }, schedule, 0), false);
});

test("isRebuyPhaseActive: ohne rebuyEndLevelIndex zählt nur der manuelle Schalter", () => {
  const schedule = { levels: LEVELS, currentLevelIndex: 2, currentLevelStartedAt: new Date(0), rebuyEndLevelIndex: null };
  assert.equal(isRebuyPhaseActive({ rebuyPhaseActive: true }, schedule, 0), true);
});

test("isRebuyPhaseActive: aktiv während der erlaubten Level, aus danach", () => {
  const startedAtMs = 1_000_000;
  // rebuyEndLevelIndex: 2 -> Level 1 und 2 (effectiveIndex 0 und 1) erlaubt, ab Level 3 (index 2) zu.
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs), rebuyEndLevelIndex: 2 };
  const config = { rebuyPhaseActive: true };

  assert.equal(isRebuyPhaseActive(config, schedule, startedAtMs), true); // Level 1
  assert.equal(isRebuyPhaseActive(config, schedule, startedAtMs + 25 * 60000), true); // Level 2
  assert.equal(isRebuyPhaseActive(config, schedule, startedAtMs + 45 * 60000), false); // Level 3
});

test("rebuyRemainingMs: null wenn Rebuy gar nicht aktiv ist", () => {
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(0), rebuyEndLevelIndex: 3 };
  assert.equal(rebuyRemainingMs({ rebuyPhaseActive: false }, schedule, 0), null);
});

test("rebuyRemainingMs: null ohne automatisches Ende (nur manueller Schalter)", () => {
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(0), rebuyEndLevelIndex: null };
  assert.equal(rebuyRemainingMs({ rebuyPhaseActive: true }, schedule, 0), null);
});

test("rebuyRemainingMs: Restzeit im aktuellen Level plus volle Dauer dazwischenliegender Level", () => {
  const startedAtMs = 1_000_000;
  // rebuyEndLevelIndex: 2 -> Level 1 und 2 (effectiveIndex 0 und 1) sind noch erlaubt, Level 3 (index 2) nicht mehr.
  const schedule = { levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: new Date(startedAtMs), rebuyEndLevelIndex: 2 };
  const config = { rebuyPhaseActive: true };

  // 5 Minuten in Level 1 (20min) vergangen -> 15min Rest in Level 1 + volle 20min Level 2, Level 3 zaehlt nicht mehr mit.
  const remaining = rebuyRemainingMs(config, schedule, startedAtMs + 5 * 60000);
  assert.equal(remaining, 15 * 60000 + 20 * 60000);
});

test("rebuyRemainingMs: direkt am Levelstart zaehlt nur die verbleibende Zeit bis zum Cutoff-Level", () => {
  const startedAtMs = 1_000_000;
  const schedule = { levels: LEVELS, currentLevelIndex: 1, currentLevelStartedAt: new Date(startedAtMs), rebuyEndLevelIndex: 2 };
  const config = { rebuyPhaseActive: true };
  // effectiveIndex 1 (Level 2), rebuyEndLevelIndex 2 -> Level 2 ist das letzte erlaubte, kein weiteres Level dazwischen.
  assert.equal(rebuyRemainingMs(config, schedule, startedAtMs), 20 * 60000);
});

test("computeLevelStartTimes: erstes Level startet um startTime, jedes weitere um die aufsummierte Dauer spaeter", () => {
  const schedule = { startTime: "15:00", levels: LEVELS, currentLevelIndex: 0, currentLevelStartedAt: null };
  assert.deepEqual(computeLevelStartTimes(schedule), ["15:00", "15:20", "15:40"]);
});

test("computeLevelStartTimes: laeuft ueber Mitternacht und faengt wieder bei 00 an", () => {
  const levels = [{ smallBlind: 25, bigBlind: 50, durationMinutes: 90, isBreak: false }];
  const schedule = { startTime: "23:00", levels, currentLevelIndex: 0, currentLevelStartedAt: null };
  assert.deepEqual(computeLevelStartTimes(schedule), ["23:00"]);
  // Ein zweites Level nach den 90 Minuten waere 00:30, nicht 24:30.
  const twoLevels = [...levels, { smallBlind: 50, bigBlind: 100, durationMinutes: 20, isBreak: false }];
  const schedule2 = { ...schedule, levels: twoLevels };
  assert.deepEqual(computeLevelStartTimes(schedule2), ["23:00", "00:30"]);
});
