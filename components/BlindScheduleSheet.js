"use client";

import { useState } from "react";
import { setBlindSchedule } from "@/lib/client/api";
import Sheet from "./Sheet";
import styles from "./BlindScheduleSheet.module.css";

function initialLevels(schedule) {
  if (schedule?.levels?.length) {
    return schedule.levels.map((l) => ({ ...l }));
  }
  return [{ smallBlind: "", bigBlind: "", durationMinutes: 60, isBreak: false }];
}

// Admin-Sheet zum (Neu-)Anlegen der Blindstruktur: ein Formularfeld-Set pro
// Level statt eines Bulk-Textfelds (spec-Wunsch: "nicht ein riesiges
// Textfeld"). Hülle/Animation über Sheet (oben hängend, Tastatur-Problem).
export default function BlindScheduleSheet({ tournamentId, schedule, onClose, onSaved }) {
  const [startTime, setStartTime] = useState(schedule?.startTime ?? "15:00");
  const [levels, setLevels] = useState(() => initialLevels(schedule));
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

    setBusy(true);
    try {
      await setBlindSchedule(tournamentId, { startTime, levels: payload });
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

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Speichere…" : "Speichern"}
        </button>
      </form>
    </Sheet>
  );
}
