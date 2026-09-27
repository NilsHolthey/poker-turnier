"use client";

import styles from "./ConfirmDialog.module.css";

// Ersetzt window.confirm() (Chat-Wunsch: "inside the app a popup not per
// browser" - die native Browser-Dialogbox passte optisch nicht zum Rest der
// App). Gleiches Overlay/Card-Muster wie DrawDialog/ManageTableSheet.
export default function ConfirmDialog({
  message,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            {cancelLabel}
          </button>
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
