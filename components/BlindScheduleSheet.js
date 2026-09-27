"use client";

import { useState } from "react";
import { setBlindSchedule } from "@/lib/client/api";
import styles from "./BlindScheduleSheet.module.css";

function initialLevels(schedule) {
  if (schedule?.levels?.length) {
    return schedule.levels.map((l) => ({ ...l }));
  }
  return [{ smallBlind: "", bigBlind: "", durationMinutes: 60, isBreak: false }];
}

// Admin-Sheet zum (Neu-)Anlegen der Blindstruktur: ein Formularfeld-Set pro
// Level statt eines Bulk-Textfelds (spec-Wunsch: "nicht ein riesiges
// Textfeld"). Hängt oben (Tastatur-Problem, siehe ManageTableSheet).
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Blindstruktur bearbeiten</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Startzeit
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>

          <div className={styles.field}>
            <span>Level</span>
            <div className={styles.levelRows}>
              {levels.map((level, i) => (
                <div key={i} className={styles.levelRow}>
                  <span className={styles.levelIndex}>{i + 1}</span>
                  {level.isBreak ? (
                    <span className={styles.pauseTag}>Pause</span>
                  ) : (
                    <div className={styles.blindInputs}>
                      <input
                        type="number"
                        min="0"
                        value={level.smallBlind}
                        onChange={(e) => updateLevel(i, { smallBlind: e.target.value })}
                        placeholder="Klein"
                      />
                      <span className={styles.slash}>/</span>
                      <input
                        type="number"
                        min="0"
                        value={level.bigBlind}
                        onChange={(e) => updateLevel(i, { bigBlind: e.target.value })}
                        placeholder="Groß"
                      />
                    </div>
                  )}
                  <input
                    type="number"
                    min="1"
                    className={styles.durationInput}
                    value={level.durationMinutes}
                    onChange={(e) => updateLevel(i, { durationMinutes: e.target.value })}
                    placeholder="Min"
                  />
                  <button
                    type="button"
                    className={styles.pauseToggle}
                    onClick={() => toggleBreak(i)}
                    aria-label={level.isBreak ? "Als Level festlegen" : "Als Pause festlegen"}
                  >
                    {level.isBreak ? "↺" : "⏸"}
                  </button>
                  <button
                    type="button"
                    className={styles.removeRow}
                    onClick={() => removeLevel(i)}
                    disabled={levels.length <= 1}
                    aria-label="Level entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className={styles.addRow} onClick={addLevel}>
              + Level
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? "Speichere…" : "Speichern"}
          </button>
        </form>
      </div>
    </div>
  );
}
