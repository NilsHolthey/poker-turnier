"use client";

import { useEffect } from "react";

// Input-Typen, deren Inhalt beim Antippen komplett markiert wird.
const SELECT_ON_FOCUS = new Set(["text", "number", "search", "tel", "url", "email"]);

// App-weite Verhaltensanpassungen für ein natives Gefühl:
// - iOS Safari ignoriert user-scalable=no aus dem Viewport-Meta (app/layout.js)
//   für Pinch-Gesten - die proprietären gesture*-Events lassen sich aber
//   abbrechen. Doppeltipp-Zoom verhindert touch-action: manipulation in
//   app/globals.css.
// - Antippen eines Eingabefelds markiert den ganzen Inhalt, damit man direkt
//   lostippen kann statt erst ans Ende zu navigieren (Chat-Wunsch).
export default function NativeFeel() {
  useEffect(() => {
    const preventGesture = (e) => e.preventDefault();

    function selectOnFocus(e) {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !SELECT_ON_FOCUS.has(el.type) || el.readOnly) return;
      // Verzögert: der Tap setzt den Cursor sonst direkt nach dem Fokus neu
      // und hebt die Markierung wieder auf (v.a. iOS).
      setTimeout(() => {
        if (document.activeElement !== el) return;
        try {
          el.setSelectionRange(0, el.value.length);
        } catch {
          // type="number" unterstützt setSelectionRange nicht.
          el.select();
        }
      }, 0);
    }

    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("focusin", selectOnFocus);
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("focusin", selectOnFocus);
    };
  }, []);

  return null;
}
