"use client";

import { useState } from "react";
import { updateTournament } from "@/lib/client/api";
import styles from "./TournamentSetupForm.module.css";

// Turnier-Einstellungen nachträglich ändern (Chat-Wunsch: "edit turnier
// possibilities"). Nur, was ohne Umbau der bestehenden Tische geht - siehe
// updateTournamentSettings in lib/db/tournamentEngine.js.
export default function TournamentEditForm({ tournamentId, settings, onSaved }) {
  const [values, setValues] = useState(() => ({ ...settings }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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
      <input type="number" min={min} max={max} value={values[key]} onChange={set(key)} required />
    </label>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Turniername
        <input value={values.name} onChange={set("name")} required />
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={values.rebuyPhaseActive}
          onChange={(e) => setValues((v) => ({ ...v, rebuyPhaseActive: e.target.checked }))}
        />
        Rebuy-Phase aktiv (Operatoren dürfen Spieler hinzufügen)
      </label>

      <div className={styles.advanced}>
        {number("baseline", "Mindestgröße, bevor Ausgleich greift")}
        {number("dissolveThreshold", "Tisch auflösen bei ≤ X Spielern", 0)}
        {number("balanceDiffThreshold", "Ausgleichen, wenn Unterschied größer als X")}
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
