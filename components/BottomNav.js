"use client";

import MyTableChips from "./MyTableChips";
import PushToggle from "./PushToggle";
import styles from "./BottomNav.module.css";

// Redesign (Chat, "we actually do not need two bottons one fore table one
// fore list it could be one and depaning on the view we show the other"):
// EIN Button statt Liste/Tische als zwei Pillen - zeigt das Icon der ANDEREN
// Ansicht (wohin ein Tap wechselt), nicht der aktuellen.
// Die Blindanzeige ist wieder raus (Chat: "blines shoul live centered top
// now" statt hier unten) - lebt jetzt als eigene BlindPill oben zentriert.
// "Dein Tisch" ist NEU hier drin (Chat: "move the dein tisch part in the
// bottom nav") statt einer eigenen Zeile über der Tab-Leiste/Liste.
const VIEW_ICONS = {
  tische: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  liste: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
};

const VIEW_LABELS = { tische: "Tische-Ansicht", liste: "Listen-Ansicht" };

export default function BottomNav({
  view,
  onChangeView,
  showNotifications,
  myTable,
  onSelectMyTable,
  phaseAction,
  busy,
}) {
  const nextView = view === "tische" ? "liste" : "tische";

  return (
    <nav className={`${styles.nav} glassChrome`} aria-label="Ansicht wechseln">
      <button
        type="button"
        className={styles.navButton}
        onClick={() => onChangeView(nextView)}
        aria-label={`Zu ${VIEW_LABELS[nextView]} wechseln`}
      >
        {VIEW_ICONS[nextView]}
      </button>
      {myTable && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <MyTableChips table={myTable} onSelect={onSelectMyTable} />
        </>
      )}
      {/* Admin hat keinen eigenen Tisch - an dieser Stelle sitzt für ihn der
          Phasen-Wechsel (Chat: "move the HF beginnen button where the dein
          tisch part is for operators"). */}
      {phaseAction && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <button type="button" className={styles.phaseButton} onClick={phaseAction.onClick} disabled={busy}>
            {phaseAction.label}
          </button>
        </>
      )}
      {showNotifications && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <PushToggle />
        </>
      )}
    </nav>
  );
}
