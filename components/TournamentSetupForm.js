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
// docs/table-size-kickoff-prompt.md, §1: individuelle Tischgröße (6/7/8) pro
// Tisch statt eines einzigen globalen tableCount/tableSize-Paars - z.B. 50
// Spieler = 2×7 + 6×6.
const VORRUNDE_TABLE_SIZES = [6, 7, 8];

export default function TournamentSetupForm() {
  const [name, setName] = useState("Freundes-Pokerturnier");
  const [tables, setTables] = useState(() => Array.from({ length: 8 }, () => ({ size: 6 })));
  const [names, setNames] = useState(() => Array.from({ length: 6 }, () => ""));
  const [rebuyPhaseActive, setRebuyPhaseActive] = useState(true);
  const [sequentialSeating, setSequentialSeating] = useState(false);
  // "Einfacher Modus" (Chat-Wunsch: "since this is the first time we are
  // using the app in the tournament we want to reduce complexity ... this
  // can be selected when creating the tournament by admin") - nur hier bei
  // der Erstellung wählbar, siehe resolvePendingAction in tournamentEngine.js
  // für die eigentliche Verhaltensänderung.
  const [simpleMode, setSimpleMode] = useState(false);
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
  const tableSizes = tables.map((t) => Number(t.size));
  const capacity = tableSizes.reduce((sum, size) => sum + size, 0);

  function updateName(index, value) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function addPlayerRow() {
    setNames((prev) => [...prev, ""]);
  }

  function removePlayerRow(index) {
    setNames((prev) => prev.filter((_, i) => i !== index));
  }

  function addTable() {
    setTables((prev) => [...prev, { size: 6 }]);
  }

  function removeTable(index) {
    setTables((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTableSize(index, size) {
    setTables((prev) => prev.map((t, i) => (i === index ? { size } : t)));
  }

  // Sitznummer "Tisch.Platz" für Listenposition i, wenn Spieler der Reihe nach
  // auf die Tische verteilt werden (Tisch 1 Plätze 1..n, dann Tisch 2, ...) -
  // läuft die kumulierten, INDIVIDUELLEN Tischgrößen ab statt eine einzige
  // globale Größe zu multiplizieren (docs/table-size-kickoff-prompt.md, §1).
  function seatLabel(i) {
    let remaining = i;
    for (let t = 0; t < tableSizes.length; t++) {
      if (remaining < tableSizes[t]) return `${t + 1}.${remaining + 1}`;
      remaining -= tableSizes[t];
    }
    return `${tableSizes.length || 1}.${remaining + 1}`;
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
      setError(`${playerNames.length} Spieler passen nicht auf ${capacity} Plätze (${tableSizes.join(" + ")}).`);
      return;
    }

    setBusy(true);
    try {
      await createTournament({
        name,
        tableSizes,
        playerNames,
        rebuyPhaseActive,
        sequentialSeating,
        simpleMode,
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

      {/* Individuelle Tischgröße pro Tisch statt eines globalen Paars
          (docs/table-size-kickoff-prompt.md, §1) - Pillen statt <select>
          (gleicher Grund wie überall sonst in der App: ein natives Dropdown
          lässt sich nicht ins dunkle Glas-Design einpassen). */}
      <div className={styles.field}>
        <span>Tische</span>
        <div className={styles.tableRows}>
          {tables.map((t, i) => (
            <div key={i} className={styles.tableRow}>
              <span className={styles.tableIndex}>Tisch {i + 1}</span>
              <div className={styles.sizePills}>
                {VORRUNDE_TABLE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`${styles.sizePill} ${t.size === size ? styles.sizePillActive : ""}`}
                    onClick={() => updateTableSize(i, size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.removeRow}
                onClick={() => removeTable(i)}
                disabled={tables.length <= 1}
                aria-label="Tisch entfernen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className={styles.addRow} onClick={addTable}>
          + Tisch hinzufügen
        </button>
      </div>
      <p className={styles.hint}>
        Kapazität: {capacity} Plätze ({tables.length} Tische)
      </p>

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

      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={simpleMode} onChange={(e) => setSimpleMode(e.target.checked)} />
        Einfacher Modus
      </label>
      {simpleMode && (
        <p className={styles.hint}>
          Reduzierte Komplexität fürs erste Turnier: kein Ausgleichen zwischen Tischen, nur Auflösen bei ≤3
          Spielern (und nur wenn auf den übrigen Tischen genug Plätze frei sind - sonst spielt der Tisch mit
          weiter). Operatoren bestätigen die Umsetzung weiter mit einem Tap, können sie aber nicht neu
          auslosen. Im Halbfinale gibt es kein automatisches Umsetzen mehr - „nächste Phase“ verteilt alle
          noch aktiven Spieler frisch auf den Finaltisch, sobald admin das auslöst.
        </p>
      )}

      <button type="button" className={styles.advancedToggle} onClick={() => setShowAdvanced((s) => !s)}>
        {showAdvanced ? "Balancing-Regeln ausblenden ▲" : "Balancing-Regeln anpassen ▼"}
      </button>

      {showAdvanced && (
        <div className={styles.advanced}>
          {/* baseline/dissolveThreshold/balanceDiffThreshold nur im
              Normalmodus - im Einfachen Modus gibt es kein Ausgleichen und
              dissolveThreshold wird nicht gelesen (siehe
              resolvePendingAction in tournamentEngine.js), sie anzuzeigen
              würde admin nur fälschlich suggerieren, sie hätten hier noch
              eine Wirkung. */}
          {!simpleMode && (
            <>
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
            </>
          )}
          {/* Chat-Wunsch: "add it to the tournament form so we can decide on
              the conditions" - für die "mehrere kleine Tische gleichzeitig"
              Situation, die weder Auflösen noch Ausgleichen abdeckt. Im
              Einfachen Modus ist "Tisch gilt als klein bei ≤ X Spielern"
              GLEICHZEITIG der Auflösungs-Schwellwert selbst (siehe
              findSimpleModeDissolve) statt nur einer Alarm-Schwelle. */}
          <p className={styles.hint}>
            {simpleMode
              ? "Ab dieser Größe wird ein Tisch aufgelöst (wenn auf den übrigen Tischen genug Plätze frei sind)."
              : "Admin-Benachrichtigung, wenn mehrere Tische unabhängig voneinander klein geworden sind (weder Auflösen noch Ausgleichen greift dann automatisch)."}
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
            {!simpleMode && (
              <label className={styles.field}>
                Alarm ab X kleinen Tischen
                <input
                  type="number"
                  min="1"
                  value={smallTableAlertCount}
                  onChange={(e) => setSmallTableAlertCount(e.target.value)}
                />
              </label>
            )}
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
