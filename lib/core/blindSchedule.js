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

// Uhrzeit, zu der jedes Level beginnt (Chat-Wunsch fürs TV-Dashboard: "list
// should not only carry duration also time") - schedule.startTime ("HH:MM")
// plus die aufsummierte Dauer aller vorherigen Level. % 24 für Turniere, die
// über Mitternacht laufen, statt mit einer Stunde >23 zu enden.
export function computeLevelStartTimes(schedule) {
  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  let minutes = startHour * 60 + startMinute;
  return schedule.levels.map((level) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    minutes += level.durationMinutes;
    return time;
  });
}

// Ob die Rebuy-Phase gerade läuft (Chat-Wunsch: "lets add it to blindes
// setting so we can set after which level rebuy is over"). Zwei Bedingungen,
// UND-verknüpft:
// - config.rebuyPhaseActive: der manuelle Admin-Schalter ("Turnier
//   bearbeiten") - aus, egal welches Level, ist Rebuy sofort komplett zu.
// - schedule.rebuyEndLevelIndex: 1-basierte Levelnummer, BIS ZU der Rebuy
//   noch erlaubt ist (in "Blindstruktur bearbeiten" gesetzt). null/undefined
//   heißt kein automatisches Ende - nur der manuelle Schalter zählt dann.
//   Der gespeicherte Wert wird direkt gegen effectiveIndex (0-basiert)
//   verglichen: effectiveIndex 0..N-1 entspricht Level 1..N, also ist
//   effectiveIndex < rebuyEndLevelIndex genau "noch in Level 1..N aktiv".
// Reine Funktion wie computeEffectiveBlindState - kein Cron, jeder Client
// (und jede Route serverseitig) rechnet das bei Bedarf selbst aus.
export function isRebuyPhaseActive(config, schedule, now = Date.now()) {
  if (!config?.rebuyPhaseActive) return false;
  const endLevelIndex = schedule?.rebuyEndLevelIndex;
  if (endLevelIndex == null || !schedule?.levels?.length) return true;
  const { effectiveIndex } = computeEffectiveBlindState(schedule, now);
  return effectiveIndex < endLevelIndex;
}

// Wie viel Zeit noch bis zum automatischen Rebuy-Ende bleibt (Chat-Wunsch fürs
// TV-Dashboard: "if rebuy for how long"). null, wenn es nichts Zählbares gibt:
// Rebuy ist gerade gar nicht aktiv, oder es gibt kein automatisches Ende
// (rebuyEndLevelIndex), nur den manuellen Schalter - dann läuft Rebuy, bis
// jemand ihn von Hand abschaltet, ohne bekannten Zeitpunkt.
export function rebuyRemainingMs(config, schedule, now = Date.now()) {
  // Kein Schedule (z.B. frisch angelegtes Turnier ohne Blindstruktur) -
  // isRebuyPhaseActive() behandelt das per Optional Chaining bereits als
  // "aktiv, kein automatisches Ende" und gibt true zurück, ohne selbst auf
  // schedule.* zuzugreifen. Hier direkt danach würde `schedule.rebuyEndLevelIndex`
  // ohne diese Prüfung crashen, weil schedule dann `undefined` ist.
  if (!schedule || !isRebuyPhaseActive(config, schedule, now)) return null;
  const endLevelIndex = schedule.rebuyEndLevelIndex;
  if (endLevelIndex == null) return null;

  const { effectiveIndex, remainingMs } = computeEffectiveBlindState(schedule, now);
  let total = remainingMs;
  for (let i = effectiveIndex + 1; i < endLevelIndex; i++) {
    total += schedule.levels[i].durationMinutes * 60000;
  }
  return total;
}
