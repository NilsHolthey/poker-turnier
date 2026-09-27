"use client";

import styles from "./Seat.module.css";
import { shortName } from "@/lib/client/formatName";

// Sitzplatz-Farbe ist bewusst neutral (nicht table.color) - Spieler sollen sich
// farblich vom Tisch abheben, nicht mit ihm verschmelzen.
export default function Seat({
  seatIndex,
  seatNum,
  position,
  player,
  disabled,
  removeDisabled = disabled,
  onRemove,
  onQuickAdd,
  onDragPointerDown,
  isDropTarget,
}) {
  const style = { top: position.top, left: position.left };

  if (!player) {
    return (
      <div className={styles.seat} style={style} data-seat-index={seatIndex}>
        <button
          type="button"
          className={`${styles.empty} ${isDropTarget ? styles.dropTarget : ""}`}
          onClick={onQuickAdd}
          disabled={disabled}
          aria-label="Spieler hinzufügen"
        >
          +
        </button>
        <span className={styles.emptyNum}>{seatNum}</span>
      </div>
    );
  }

  return (
    <div className={styles.seat} style={style} data-seat-index={seatIndex}>
      <div
        className={`${styles.circle} ${isDropTarget ? styles.dropTarget : ""}`}
        onPointerDown={onDragPointerDown}
      >
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={removeDisabled}
          aria-label={`${player.name} entfernen`}
        >
          ×
        </button>
        <span className={styles.num}>{player.num}</span>
      </div>
      <span className={styles.name}>
        <span title={player.name}>{shortName(player.name)}</span>
      </span>
      {player.isBank && (
        <span className={styles.bankBadge} aria-label="Bank">
          <span className={styles.bankWord}>Bank</span> $
        </span>
      )}
    </div>
  );
}
