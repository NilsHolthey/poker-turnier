"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./HamburgerMenu.module.css";

// Ersetzt "Neues Turnier"-Button + Username + Abmelden im Header
// (Chat-Redesign: "create a hamburger menu which sits in the top left").
// "Übersicht" (alle Rollen) und "Admin-Bereich" (nur admin) sind jetzt echte
// Seiten (/overview, /admin) statt Modals über dem Board (Chat: "this can be
// reached via hamburger menu and also the new admin site") - Abmelden bleibt
// hier für ALLE Rollen (operator braucht ebenfalls einen Weg, sich
// abzumelden, nicht exklusiv fürs Admin-Bereich).
export default function HamburgerMenu({ user, onLogout }) {
  // "closing": Menü bleibt gemountet, bis seine Ausblend-Animation fertig ist
  // (onAnimationEnd), erst dann "closed".
  const [menuState, setMenuState] = useState("closed");
  const open = menuState === "open";
  const setOpen = (value) => setMenuState(value ? "open" : (s) => (s === "closed" ? s : "closing"));
  const wrapperRef = useRef(null);

  // Jeder Tap außerhalb schließt das Menü - auch auf BottomNav & Co. (Chat:
  // Menü blieb beim Wechsel Tische/Liste offen). Ersetzt den früheren
  // unsichtbaren Backdrop, der in derselben z-index-Ebene wie die BottomNav
  // lag und deren Taps deshalb nicht abfing. pointerdown statt click, damit
  // das Menü schon beim Antippen zugeht und der Tap trotzdem sein Ziel erreicht.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} glassChrome`}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
      >
        {/* Drei Linien, die per CSS zum X morphen statt das Icon hart zu tauschen. */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line className={styles.lineTop} x1="4" y1="6" x2="20" y2="6" />
          <line className={styles.lineMiddle} x1="4" y1="12" x2="20" y2="12" />
          <line className={styles.lineBottom} x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {menuState !== "closed" && (
        <div
          className={`${styles.menu} ${open ? "" : styles.menuClosing} glassChrome`}
          role="menu"
          onAnimationEnd={(e) => e.target === e.currentTarget && menuState === "closing" && setMenuState("closed")}
        >
          <Link href="/overview" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Übersicht
          </Link>
          <Link href="/regeln" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Spielregeln
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
              Admin-Bereich
            </Link>
          )}
          <span className={styles.divider} />
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
