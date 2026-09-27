import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBlindLevel, computeEffectiveBlindState } from "./blindSchedule.js";

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
