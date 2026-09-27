"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/lib/client/useMounted";
import styles from "./Toast.module.css";

// Kleines, unaufdringliches Feedback-Popup (Chat-Wunsch: "subtle popup" beim
// Umschalten der Benachrichtigungen) - bewusst kein FullScreenAlert-Wiederverwendung,
// das ist absichtlich groß/rot fürs Umsetzungs-Signal (spec) und würde hier
// overpowered wirken. Blendet sich selbst per CSS-Animation aus, kein
// State/Timer-Handling nötig auf Aufrufer-Seite außer dem Entfernen aus dem DOM.
//
// Portal nach document.body statt normaler Kind-Position (Chat-Bugreport:
// "notifications toggle popup not there anymore") - Toast wird über PushToggle
// innerhalb von BottomNav gerendert, und BottomNav .nav hat seit der
// Desktop-Zentrierung ein eigenes transform (translateX/translateZ). Ein
// transform auf einem Vorfahren wird zum containing block für ALLE
// position:fixed-Nachfahren (siehe "dark glass dashboard"-Doku §10) - der
// Toast positionierte sich dadurch relativ zur winzigen Nav-Pille statt zum
// Viewport und landete effektiv unsichtbar. Der Portal umgeht das dauerhaft,
// unabhängig davon, wo Toast künftig im Baum verschachtelt wird.
export default function Toast({ text }) {
  const mounted = useMounted();

  if (!text || !mounted) return null;

  return createPortal(
    <div className={styles.toast} role="status">
      {text}
    </div>,
    document.body
  );
}
