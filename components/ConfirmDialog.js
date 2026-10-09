"use client";

import styles from "./ConfirmDialog.module.css";

// Ersetzt window.confirm() (Chat-Wunsch: "inside the app a popup not per
// browser" - die native Browser-Dialogbox passte optisch nicht zum Rest der
// App). Gleiches Overlay/Card-Muster wie DrawDialog/ManageTableSheet.
//
// hideCancel (Chat-Wunsch: "pops up only with confirm" - reine
// Kenntnisnahme-Meldungen wie "Neuer Spieler an deinem Tisch" sind keine
// Ja/Nein-Entscheidung, ein Abbrechen-Button würde nur suggerieren, es gäbe
// etwas abzulehnen). Backdrop-Tap schließt in dem Fall bewusst NICHT
// (onClick auf dem Overlay bleibt aus) - die Meldung muss aktiv mit
// confirmLabel bestätigt werden, kein versehentliches Wegtippen.
export default function ConfirmDialog({
  message,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  danger,
  hideCancel = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className={styles.overlay} onClick={hideCancel ? undefined : onCancel}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {!hideCancel && (
            <button type="button" className={styles.cancelButton} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`${styles.confirmButton} ${danger ? styles.dangerButton : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
