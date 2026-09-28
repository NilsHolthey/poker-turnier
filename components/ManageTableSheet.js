"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import styles from "./ManageTableSheet.module.css";

// "Tisch verwalten"-Sheet (spec): Hinzufügen mit Namen (Name optional, Default =
// "Spieler X.Y") + eigener "Namen bearbeiten"-Bereich mit allen Spielern des
// Tisches, jederzeit editierbar. Namensfelder sind bewusst unkontrolliert
// (defaultValue + onBlur), damit neu hinzugefügte Spieler sofort in der Liste
// auftauchen, ohne die restlichen Eingaben zurückzusetzen.
export default function ManageTableSheet({ table, players, onAdd, onRename, onClose, busy }) {
  const [newName, setNewName] = useState("");
  const isFull = players.length >= table.maxSeats;

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
    <Sheet
      title={table.label}
      subtitle={`${players.length}/${table.maxSeats} Spieler · verwalten`}
      accentColor={table.color}
      onClose={onClose}
    >
      <form className={styles.section} onSubmit={handleAdd}>
        <label htmlFor="new-player-name" className={styles.sectionLabel}>
          Spieler hinzufügen
        </label>
        <div className={styles.addRow}>
          <input
            id="new-player-name"
            type="text"
            className={styles.addInput}
            placeholder={isFull ? "Tisch ist voll" : "Name (optional)"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            enterKeyHint="done"
            disabled={busy || isFull}
          />
          <button type="submit" className={styles.addButton} disabled={busy || isFull} aria-label="Spieler hinzufügen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </form>

      {players.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Namen bearbeiten</h4>
          {players.map((player) => (
            <label key={player._id} className={styles.renameRow}>
              <span className={styles.seatNum}>{player.num}</span>
              <input
                type="text"
                className={styles.renameInput}
                defaultValue={player.name}
                onBlur={(e) => handleRenameBlur(player._id, e)}
                // Enter übernimmt den Namen (onBlur speichert) statt nichts zu tun.
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                enterKeyHint="done"
                disabled={busy}
              />
              {player.isBank && <span className={styles.bank}>Bank $</span>}
            </label>
          ))}
        </div>
      )}
    </Sheet>
  );
}
