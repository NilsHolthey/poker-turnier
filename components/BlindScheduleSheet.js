"use client";

import { useState } from "react";
import { setBlindSchedule } from "@/lib/client/api";
import Sheet from "./Sheet";
import styles from "./BlindScheduleSheet.module.css";

// Chat-Wunsch: "grab the currently stored values for blinds and set it as
// default, it's probably not gonna change" - reale Struktur aus dem
// bisherigen Turnier übernommen statt eines leeren Platzhalter-Levels, damit
// admin sie für künftige Turniere nicht jedes Mal neu eintippen muss. Wer
// abweichende Werte braucht, kann sie hier trotzdem jederzeit überschreiben.
const DEFAULT_START_TIME = "15:00";
const DEFAULT_LEVELS = [
  { smallBlind: 25, bigBlind: 50, durationMinutes: 60, isBreak: false },
  { smallBlind: 50, bigBlind: 100, durationMinutes: 60, isBreak: false },
  { smallBlind: 100, bigBlind: 200, durationMinutes: 60, isBreak: false },
  { smallBlind: 200, bigBlind: 400, durationMinutes: 30, isBreak: false },
  { smallBlind: 0, bigBlind: 0, durationMinutes: 90, isBreak: true },
  { smallBlind: 400, bigBlind: 800, durationMinutes: 60, isBreak: false },
  { smallBlind: 800, bigBlind: 1600, durationMinutes: 60, isBreak: false },
  { smallBlind: 2000, bigBlind: 4000, durationMinutes: 60, isBreak: false },
  { smallBlind: 3000, bigBlind: 6000, durationMinutes: 60, isBreak: false },
  { smallBlind: 4000, bigBlind: 8000, durationMinutes: 60, isBreak: false },
  { smallBlind: 5000, bigBlind: 10000, durationMinutes: 60, isBreak: false },
];
const DEFAULT_REBUY_END_LEVEL_INDEX = 4;

function initialLevels(schedule) {
  if (schedule?.levels?.length) {
    return schedule.levels.map((l) => ({ ...l }));
  }
  return DEFAULT_LEVELS.map((l) => ({ ...l }));
}

// Admin-Sheet zum (Neu-)Anlegen der Blindstruktur: ein Formularfeld-Set pro
// Level statt eines Bulk-Textfelds (spec-Wunsch: "nicht ein riesiges
// Textfeld"). Hülle/Animation über Sheet (oben hängend, Tastatur-Problem).
export default function BlindScheduleSheet({ tournamentId, schedule, onClose, onSaved }) {
  const [startTime, setStartTime] = useState(schedule?.startTime ?? DEFAULT_START_TIME);
  const [levels, setLevels] = useState(() => initialLevels(schedule));
  // "Kein Ende" ist bewusst keine wählbare Option mehr (Chat: "we will always
  // have a defined rebuy phase") - ohne gespeicherten Wert defaultet die
  // Auswahl auf DEFAULT_REBUY_END_LEVEL_INDEX (die reale, bisher genutzte
  // Einstellung) statt auf das letzte Level. Der Rest der Kette (Schema,
  // isRebuyPhaseActive) unterstützt null weiterhin, für ältere Turniere, die
  // das Feld noch nie gesetzt haben.
  const [rebuyEndLevelIndex, setRebuyEndLevelIndex] = useState(() =>
    schedule?.rebuyEndLevelIndex != null ? String(schedule.rebuyEndLevelIndex) : String(DEFAULT_REBUY_END_LEVEL_INDEX)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function updateLevel(index, patch) {
    setLevels((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLevel() {
    const last = levels[levels.length - 1];
    setLevels((prev) => [
      ...prev,
      { smallBlind: "", bigBlind: "", durationMinutes: last?.durationMinutes ?? 60, isBreak: false },
    ]);
  }

  function removeLevel(index) {
    setLevels((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleBreak(index) {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, isBreak: !l.isBreak, smallBlind: 0, bigBlind: 0 } : l))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const payload = levels.map((l) => ({
      smallBlind: l.isBreak ? 0 : Number(l.smallBlind),
      bigBlind: l.isBreak ? 0 : Number(l.bigBlind),
      durationMinutes: Number(l.durationMinutes),
      isBreak: l.isBreak,
    }));

    const invalid = payload.some(
      (l) =>
        !Number.isInteger(l.durationMinutes) ||
        l.durationMinutes < 1 ||
        (!l.isBreak && (!Number.isInteger(l.smallBlind) || !Number.isInteger(l.bigBlind)))
    );
    if (invalid) {
      setError("Bitte alle Felder ausfüllen (Blinds und Dauer als ganze Zahlen).");
      return;
    }

    // Levels können nach dem Setzen entfernt worden sein - auf die neue
    // Levelanzahl begrenzen, statt ein jetzt ungültiges Level zu speichern.
    const rebuyEnd = rebuyEndLevelIndex ? Math.min(Number(rebuyEndLevelIndex), payload.length) : null;

    setBusy(true);
    try {
      await setBlindSchedule(tournamentId, { startTime, levels: payload, rebuyEndLevelIndex: rebuyEnd });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Blindstruktur" subtitle={`${levels.length} Level · bearbeiten`} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.startRow}>
          <span className={styles.sectionLabel}>Startzeit</span>
          <input
            type="time"
            className={styles.timeInput}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>

        <div className={styles.section}>
          <div className={styles.columns} aria-hidden="true">
            <span>#</span>
            <span>Small / Big</span>
            <span>Min</span>
          </div>

          {levels.map((level, i) => (
            <div key={i} className={`${styles.levelRow} ${level.isBreak ? styles.breakRow : ""}`}>
              <span className={styles.levelIndex}>{i + 1}</span>
              {level.isBreak ? (
                <span className={styles.pauseTag}>Pause</span>
              ) : (
                <div className={styles.blindInputs}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className={styles.numInput}
                    value={level.smallBlind}
                    onChange={(e) => updateLevel(i, { smallBlind: e.target.value })}
                    placeholder="SB"
                    aria-label={`Level ${i + 1} Small Blind`}
                  />
                  <span className={styles.slash}>/</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className={styles.numInput}
                    value={level.bigBlind}
                    onChange={(e) => updateLevel(i, { bigBlind: e.target.value })}
                    placeholder="BB"
                    aria-label={`Level ${i + 1} Big Blind`}
                  />
                </div>
              )}
              <input
                type="number"
                inputMode="numeric"
                min="1"
                className={`${styles.numInput} ${styles.durationInput}`}
                value={level.durationMinutes}
                onChange={(e) => updateLevel(i, { durationMinutes: e.target.value })}
                placeholder="Min"
                aria-label={`Level ${i + 1} Dauer in Minuten`}
              />
              <button
                type="button"
                className={`${styles.iconButton} ${level.isBreak ? styles.iconButtonActive : ""}`}
                onClick={() => toggleBreak(i)}
                aria-label={level.isBreak ? "Als Level festlegen" : "Als Pause festlegen"}
                aria-pressed={level.isBreak}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => removeLevel(i)}
                disabled={levels.length <= 1}
                aria-label={`Level ${i + 1} entfernen`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          <button type="button" className={styles.addRow} onClick={addLevel}>
            + Level hinzufügen
          </button>
        </div>

        {/* Chat-Wunsch: "add it to blindes setting so we can set after which
            level rebuy is over" - ergänzt den manuellen An/Aus-Schalter in
            "Turnier bearbeiten" um ein automatisches Ende an einem Level.
            Pillen-Reihe statt <select> (Chat: "opens native ui style") - ein
            natives Dropdown/der iOS-Rad-Picker sprengt die dunkle Glas-Optik
            des Sheets, eine Pillen-Reihe bleibt im selben Look wie der Rest. */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Rebuy endet nach Level</span>
          <div className={styles.rebuyRow}>
            {levels.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.rebuyPill} ${
                  rebuyEndLevelIndex === String(i + 1) ? styles.rebuyPillActive : ""
                }`}
                onClick={() => setRebuyEndLevelIndex(String(i + 1))}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Speichere…" : "Speichern"}
        </button>
      </form>
    </Sheet>
  );
}
