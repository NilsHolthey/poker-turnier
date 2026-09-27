export function formatBlindLevel(level) {
  if (!level) return "-";
  if (level.isBreak) return "Pause";
  return `${level.smallBlind.toLocaleString("de-DE")}/${level.bigBlind.toLocaleString("de-DE")}`;
}

// Berechnet, welches Level GERADE JETZT gelten sollte, rein aus verstrichener
// Zeit seit currentLevelStartedAt (Chat-Redesign: "blinds increase
// automatically, or if admin moves them up"). Bewusst eine reine Funktion
// ohne Server-Round-Trip/Cron: jeder Client tickt das selbst lokal weiter
// (siehe BlindPill.js), alle sehen aber denselben Stand, weil
// currentLevelIndex/currentLevelStartedAt vom Server kommen und ein manuelles
// Vor-/Zurückschalten (setBlindLevelIndex) beides zusammen setzt - die
// Zeitrechnung für das neue Level startet dann bei 0, nicht rückwirkend.
// Läuft am letzten Level aus (bleibt dort stehen, remainingMs geht auf 0),
// kein Überlauf in ein nicht existierendes Level.
export function computeEffectiveBlindState(schedule, now = Date.now()) {
  const { levels, currentLevelIndex, currentLevelStartedAt } = schedule;
  const index0 = Math.min(Math.max(currentLevelIndex, 0), levels.length - 1);

  // Gespeichert, aber noch nicht gestartet (Chat-Wunsch: "blindes speichern
  // should not start the tournament just when admin starts it") -
  // currentLevelStartedAt ist erst ab startBlindClock() gesetzt, nicht schon
  // bei setBlindSchedule(). Zeigt das erste/aktuelle Level mit voller Dauer,
  // tickt nicht.
  if (!currentLevelStartedAt) {
    const level = levels[index0];
    return { effectiveIndex: index0, level, elapsedMs: 0, remainingMs: level.durationMinutes * 60000, started: false };
  }

  const startedAtMs = new Date(currentLevelStartedAt).getTime();
  let index = index0;
  let elapsedMs = Math.max(0, now - startedAtMs);

  while (index < levels.length - 1) {
    const levelMs = levels[index].durationMinutes * 60000;
    if (elapsedMs < levelMs) break;
    elapsedMs -= levelMs;
    index += 1;
  }

  const level = levels[index];
  const levelMs = level.durationMinutes * 60000;
  const remainingMs = Math.max(0, levelMs - elapsedMs);

  return { effectiveIndex: index, level, elapsedMs, remainingMs, started: true };
}
