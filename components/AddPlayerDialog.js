"use client";

import { useState } from "react";
import { findNameCollision } from "@/lib/client/formatName";
import styles from "./ConfirmDialog.module.css";
import inputStyles from "./AddPlayerDialog.module.css";

// Fragt beim Hinzufügen eines Spielers IMMER nach einem Namen, statt still
// auf "Spieler <num>" zu defaulten (Chat-Bugreport: ein Spieler wird
// umgesetzt, sein Name bleibt dabei unverändert stehen - wird später ein
// NEUER Spieler ohne Namen genau an dem jetzt freien Sitz hinzugefügt, landet
// dessen Default-Name zufällig wieder bei derselben "Spieler <num>"-Zeichenkette,
// weil Tisch/Sitz-Nummern wiederverwendet werden. Zwei verschiedene, echte
// Spieler-Dokumente (jeweils eigene ObjectId) zeigen dann denselben Namen an.
// Wiederverwendet ConfirmDialog.module.css fürs Overlay/Card/Actions-Gerüst,
// nur das Eingabefeld ist neu.
export default function AddPlayerDialog({ seatLabel, existingPlayers = [], onConfirm, onCancel, busy }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  // Nicht-blockierende Warnung (Chat-Wunsch: "4 player named Flo ... check
  // against all players") - echte Namensgleichheit unter Freunden ist
  // möglich, das Hinzufügen bleibt also weiter erlaubt.
  const collision = findNameCollision(trimmed, existingPlayers);

  function handleSubmit(e) {
    e.preventDefault();
    if (!trimmed || busy) return;
    onConfirm(trimmed);
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={styles.card} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <p className={styles.message}>Name für {seatLabel ? `Platz ${seatLabel}` : "den neuen Spieler"}</p>
        <input
          type="text"
          className={inputStyles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
          enterKeyHint="done"
          required
        />
        {collision && (
          <p className={inputStyles.warning}>
            Es gibt bereits „{collision.name}“{collision.tableLabel ? ` (${collision.tableLabel})` : ""}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className={styles.confirmButton} disabled={!trimmed || busy}>
            Hinzufügen
          </button>
        </div>
      </form>
    </div>
  );
}
