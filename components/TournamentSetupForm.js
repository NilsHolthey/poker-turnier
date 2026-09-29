"use client";

import { useState } from "react";
import { createTournament } from "@/lib/client/api";
import {
  PHASES,
  DEFAULT_BASELINE,
  DEFAULT_DISSOLVE_THRESHOLD,
  DEFAULT_BALANCE_DIFF_THRESHOLD,
  DEFAULT_SMALL_TABLE_THRESHOLD,
  DEFAULT_SMALL_TABLE_ALERT_COUNT,
} from "@/lib/constants";
import styles from "./TournamentSetupForm.module.css";

// Admin-Setup: Turnier anlegen + alle Spieler sofort auf die gewünschte
// Tischanzahl/-größe verteilen (spec-Lücke - es gab bisher keinen Weg, ein
// Turnier überhaupt anzulegen). Nach Erfolg reicht ein Reload, da page.js
// serverseitig immer das zuletzt angelegte Turnier lädt.
export default function TournamentSetupForm() {
  const [name, setName] = useState("Freundes-Pokerturnier");
  const [tableCount, setTableCount] = useState(8);
  const [tableSize, setTableSize] = useState(6);
  const [names, setNames] = useState(() => Array.from({ length: 6 }, () => ""));
  const [rebuyPhaseActive, setRebuyPhaseActive] = useState(true);
  const [sequentialSeating, setSequentialSeating] = useState(false);
  const [baseline, setBaseline] = useState(DEFAULT_BASELINE);
  const [dissolveThreshold, setDissolveThreshold] = useState(DEFAULT_DISSOLVE_THRESHOLD);
  const [balanceDiffThreshold, setBalanceDiffThreshold] = useState(DEFAULT_BALANCE_DIFF_THRESHOLD);
  const [smallTableThreshold, setSmallTableThreshold] = useState(DEFAULT_SMALL_TABLE_THRESHOLD);
  const [smallTableAlertCount, setSmallTableAlertCount] = useState(DEFAULT_SMALL_TABLE_ALERT_COUNT);
  const [halbfinaleTableCount, setHalbfinaleTableCount] = useState(PHASES[1].targetTables);
  const [halbfinaleTableSize, setHalbfinaleTableSize] = useState(PHASES[1].tableSize);
  const [finaleTableSize, setFinaleTableSize] = useState(PHASES[2].tableSize);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPhases, setShowPhases] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const playerNames = names.map((n) => n.trim()).filter(Boolean);
  const capacity = Number(tableCount) * Number(tableSize);

  function updateName(index, value) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function addPlayerRow() {
    setNames((prev) => [...prev, ""]);
  }

  function removePlayerRow(index) {
    setNames((prev) => prev.filter((_, i) => i !== index));
  }

  // Sitznummer "Tisch.Platz" für Listenposition i, wenn Spieler der Reihe nach
  // auf die Tische verteilt werden (Tisch 1 Plätze 1..n, dann Tisch 2, ...).
  function seatLabel(i) {
    const size = Number(tableSize) || 1;
    return `${Math.floor(i / size) + 1}.${(i % size) + 1}`;
  }

  // Chat-Wunsch: "auto fill" - Spieler heißen "Spieler 1.1", "Spieler 1.2", ...
  // und sitzen fest auf genau diesem Platz (Sitze werden real ausgelost und
  // sind identisch mit den Sitznummern), daher schaltet das auch die feste
  // Sitzordnung ein. Selbst getippte Namen bleiben erhalten, alte
  // Platzhalter-Namen werden passend zur aktuellen Tischgröße neu vergeben.
  function autoFillNames() {
    setNames((prev) => {
      const next = [...prev];
      while (next.length < capacity) next.push("");
      return next.map((n, i) => (n.trim() && !/^Spieler \d+\.\d+$/.test(n.trim()) ? n : `Spieler ${seatLabel(i)}`));
    });
    setSequentialSeating(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (playerNames.length === 0) {
      setError("Mindestens ein Spielername nötig (der erste wird die Bank).");
      return;
    }
    if (playerNames.length > capacity) {
      setError(`${playerNames.length} Spieler passen nicht auf ${capacity} Plätze (${tableCount} × ${tableSize}).`);
      return;
    }

    setBusy(true);
    try {
      await createTournament({
        name,
        tableCount: Number(tableCount),
        tableSize: Number(tableSize),
        playerNames,
        rebuyPhaseActive,
        sequentialSeating,
        baseline: Number(baseline),
        dissolveThreshold: Number(dissolveThreshold),
        balanceDiffThreshold: Number(balanceDiffThreshold),
        smallTableThreshold: Number(smallTableThreshold),
        smallTableAlertCount: Number(smallTableAlertCount),
        halbfinaleTableCount: Number(halbfinaleTableCount),
        halbfinaleTableSize: Number(halbfinaleTableSize),
        finaleTableSize: Number(finaleTableSize),
      });
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Turniername
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          Anzahl Tische
          <input
            type="number"
            min="1"
            value={tableCount}
            onChange={(e) => setTableCount(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          Plätze pro Tisch
          <input
            type="number"
            min="2"
            max="10"
            value={tableSize}
            onChange={(e) => setTableSize(e.target.value)}
            required
          />
        </label>
      </div>
      <p className={styles.hint}>Kapazität: {capacity} Plätze</p>

      <div className={styles.field}>
        <span>Spieler (der erste ist die Bank)</span>
        <div className={styles.playerRows}>
          {names.map((value, i) => (
            <div key={i} className={styles.playerRow}>
              <span className={`${styles.playerIndex} ${i === 0 ? styles.bankIndex : ""}`}>
                {i === 0 ? (
                  <>
                    <span className={styles.bankWord}>Bank</span>$
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <input
                value={value}
                onChange={(e) => updateName(i, e.target.value)}
                placeholder={`Spieler ${seatLabel(i)}`}
              />
              <button
                type="button"
                className={styles.removeRow}
                onClick={() => removePlayerRow(i)}
                disabled={names.length <= 1}
                aria-label="Spieler entfernen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.addRow}
            onClick={addPlayerRow}
            disabled={names.length >= capacity}
          >
            + Spieler
          </button>
          <button type="button" className={styles.addRow} onClick={autoFillNames}>
            Auf Kapazität auffüllen ({capacity})
          </button>
        </div>
      </div>
      <p className={styles.hint}>{playerNames.length} Spieler erfasst</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={rebuyPhaseActive}
          onChange={(e) => setRebuyPhaseActive(e.target.checked)}
        />
        Rebuy-Phase aktiv (Operatoren dürfen Spieler hinzufügen)
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={sequentialSeating}
          onChange={(e) => setSequentialSeating(e.target.checked)}
        />
        Feste Sitzplätze (Listenreihenfolge = Sitznummer, kein Zufall)
      </label>

      <button type="button" className={styles.advancedToggle} onClick={() => setShowAdvanced((s) => !s)}>
        {showAdvanced ? "Balancing-Regeln ausblenden ▲" : "Balancing-Regeln anpassen ▼"}
      </button>

      {showAdvanced && (
        <div className={styles.advanced}>
          <label className={styles.field}>
            Mindestgröße, bevor Ausgleich greift
            <input type="number" min="1" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
          </label>
          <label className={styles.field}>
            Tisch auflösen bei ≤ X Spielern
            <input
              type="number"
              min="0"
              value={dissolveThreshold}
              onChange={(e) => setDissolveThreshold(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Ausgleichen, wenn Unterschied größer als X
            <input
              type="number"
              min="1"
              value={balanceDiffThreshold}
              onChange={(e) => setBalanceDiffThreshold(e.target.value)}
            />
          </label>
          {/* Chat-Wunsch: "add it to the tournament form so we can decide on
              the conditions" - für die "mehrere kleine Tische gleichzeitig"
              Situation, die weder Auflösen noch Ausgleichen abdeckt. */}
          <p className={styles.hint}>
            Admin-Benachrichtigung, wenn mehrere Tische unabhängig voneinander klein geworden sind (weder
            Auflösen noch Ausgleichen greift dann automatisch).
          </p>
          <div className={styles.row}>
            <label className={styles.field}>
              Tisch gilt als klein bei ≤ X Spielern
              <input
                type="number"
                min="0"
                value={smallTableThreshold}
                onChange={(e) => setSmallTableThreshold(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Alarm ab X kleinen Tischen
              <input
                type="number"
                min="1"
                value={smallTableAlertCount}
                onChange={(e) => setSmallTableAlertCount(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      <button type="button" className={styles.advancedToggle} onClick={() => setShowPhases((s) => !s)}>
        {showPhases ? "Halbfinale/Finale ausblenden ▲" : "Halbfinale/Finale anpassen ▼"}
      </button>

      {showPhases && (
        <div className={styles.advanced}>
          <p className={styles.hint}>
            Wird erst gebraucht, wenn admin die Phase mit „Vorrunde beenden“ abschließt - Tischanzahl/-größe
            gelten dann statt der Standardwerte.
          </p>
          <div className={styles.row}>
            <label className={styles.field}>
              Halbfinale Tische
              <input
                type="number"
                min="1"
                value={halbfinaleTableCount}
                onChange={(e) => setHalbfinaleTableCount(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Halbfinale Plätze/Tisch
              <input
                type="number"
                min="2"
                max="10"
                value={halbfinaleTableSize}
                onChange={(e) => setHalbfinaleTableSize(e.target.value)}
              />
            </label>
          </div>
          <label className={styles.field}>
            Finale Plätze (immer 1 Tisch)
            <input
              type="number"
              min="2"
              max="10"
              value={finaleTableSize}
              onChange={(e) => setFinaleTableSize(e.target.value)}
            />
          </label>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "Erstelle Turnier…" : "Turnier erstellen & Spieler setzen"}
      </button>
    </form>
  );
}
