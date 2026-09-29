"use client";

import { useState } from "react";
import { updateTournament } from "@/lib/client/api";
import styles from "./TournamentSetupForm.module.css";

// Turnier-Einstellungen nachträglich ändern (Chat-Wunsch: "edit turnier
// possibilities"). Nur, was ohne Umbau der bestehenden Tische geht - siehe
// updateTournamentSettings in lib/db/tournamentEngine.js.
//
// "Einfacher Modus" (Chat-Wunsch: "if the new modus was selected, I should
// not be able to edit anything except the title") - alle anderen Felder
// werden disabled statt versteckt (admin sieht die laufenden Werte weiter,
// kann sie aber nicht ändern) - simpleMode selbst ist ohnehin nur bei der
// Erstellung wählbar, updateTournamentSettings() nimmt es gar nicht entgegen.
export default function TournamentEditForm({ tournamentId, settings, onSaved }) {
  const [values, setValues] = useState(() => ({ ...settings }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const locked = !!settings.simpleMode;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updateTournament(tournamentId, { ...values, rebuyPhaseActive: values.rebuyPhaseActive });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const number = (key, label, min = 1, max) => (
    <label className={styles.field}>
      {label}
      <input type="number" min={min} max={max} value={values[key]} onChange={set(key)} disabled={locked} required />
    </label>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Turniername
        <input value={values.name} onChange={set("name")} required />
      </label>

      {locked && (
        <p className={styles.hint}>
          Einfacher Modus: nachträglich ist nur der Turniername änderbar.
        </p>
      )}

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={values.rebuyPhaseActive}
          onChange={(e) => setValues((v) => ({ ...v, rebuyPhaseActive: e.target.checked }))}
          disabled={locked}
        />
        Rebuy-Phase aktiv (Operatoren dürfen Spieler hinzufügen)
      </label>

      <div className={styles.advanced}>
        {number("baseline", "Mindestgröße, bevor Ausgleich greift")}
        {number("dissolveThreshold", "Tisch auflösen bei ≤ X Spielern", 0)}
        {number("balanceDiffThreshold", "Ausgleichen, wenn Unterschied größer als X")}
        {/* Chat-Wunsch: "add it to the tournament form so we can decide on
            the conditions" - Alarm für "mehrere Tische gleichzeitig klein",
            siehe countSmallTables in lib/core/dissolve.js. */}
        <div className={styles.row}>
          {number("smallTableThreshold", "Tisch gilt als klein bei ≤ X Spielern", 0)}
          {number("smallTableAlertCount", "Alarm ab X kleinen Tischen")}
        </div>
      </div>

      <div className={styles.advanced}>
        <div className={styles.row}>
          {number("halbfinaleTableCount", "Halbfinale Tische")}
          {number("halbfinaleTableSize", "Halbfinale Plätze/Tisch", 2, 10)}
        </div>
        {number("finaleTableSize", "Finale Plätze (immer 1 Tisch)", 2, 10)}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "Speichere…" : "Änderungen speichern"}
      </button>
    </form>
  );
}
