"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.trigger} glassChrome`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <>
          {/* Unsichtbarer Backdrop statt eines Klick-außerhalb-Listeners auf
              document - schließt das Menü bei jedem Tap daneben, ohne einen
              globalen Event-Listener verwalten zu müssen. */}
          <button type="button" className={styles.backdrop} aria-label="Menü schließen" onClick={() => setOpen(false)} />
          <div className={`${styles.menu} glassChrome`} role="menu">
            <Link href="/overview" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
              Übersicht
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
        </>
      )}
    </div>
  );
}
