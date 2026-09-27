"use client";

import { useState } from "react";
import styles from "./ManageTableSheet.module.css";

// "Tisch verwalten"-Sheet (spec): Hinzufügen mit Namen (Name optional, Default =
// "Spieler X.Y") + eigener "Namen bearbeiten"-Bereich mit allen Spielern des
// Tisches, jederzeit editierbar. Namensfelder sind bewusst unkontrolliert
// (defaultValue + onBlur), damit neu hinzugefügte Spieler sofort in der Liste
// auftauchen, ohne die restlichen Eingaben zurückzusetzen.
export default function ManageTableSheet({ table, players, onAdd, onRename, onClose, busy }) {
  const [newName, setNewName] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    onAdd(newName.trim() || undefined);
    setNewName("");
  }

  function handleRenameBlur(playerId, e) {
    const value = e.target.value.trim();
    if (value) onRename(playerId, value);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{table.label} verwalten</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <form className={styles.addForm} onSubmit={handleAdd}>
          <label htmlFor="new-player-name">Spieler hinzufügen</label>
          <div className={styles.addRow}>
            <input
              id="new-player-name"
              type="text"
              placeholder="Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy || players.length >= table.maxSeats}
            />
            <button type="submit" disabled={busy || players.length >= table.maxSeats}>
              +
            </button>
          </div>
          {players.length >= table.maxSeats && <p className={styles.hint}>Tisch ist voll</p>}
        </form>

        <div className={styles.renameSection}>
          <h4>Namen bearbeiten</h4>
          {players.map((player) => (
            <div key={player._id} className={styles.renameRow}>
              <span className={styles.seatNum}>{player.num}</span>
              <input
                type="text"
                defaultValue={player.name}
                onBlur={(e) => handleRenameBlur(player._id, e)}
                disabled={busy}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
