"use client";

import { useEffect, useState } from "react";
import { isPushSupported, urlBase64ToUint8Array } from "@/lib/client/push";
import { subscribePush, unsubscribePush } from "@/lib/client/api";
import Toast from "./Toast";
import styles from "./PushToggle.module.css";

const TOAST_DURATION_MS = 2200;

// Web Push An/Aus (spec-Erweiterung, siehe Chat: "push-Benachrichtigungen ...
// damit die anderen Tische aware sind, dass ein Spieler umgesetzt wurde").
// Jetzt Teil der BottomNav (Chat-Redesign) statt der Kopfzeile - eigenes,
// schlichtes Icon-Modul statt der alten Pillen-Button-Optik aus
// TournamentBoard.module.css. Registriert den Service Worker beim ersten
// Mount rein lesend (Sync mit dem Browser-API-Zustand, kein Datenfetch fürs
// erste Rendern) und liest den aktuellen Subscription-Status, ohne dass der
// Nutzer schon zugestimmt hat.
export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // Blendet den Toast nach TOAST_DURATION_MS wieder aus (die CSS-Animation in
  // Toast.module.css läuft synchron dazu, siehe dort).
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isPushSupported()) return;
    // setSupported/setSubscribed laufen erst nach dem await (asynchrone
    // Callback-Fortsetzung), nicht synchron im Effekt-Body - das ist der vom
    // react-hooks/set-state-in-effect-Compiler-Lint geforderte Unterschied zum
    // direkten setState()-Aufruf am Anfang eines Effekts.
    async function syncSubscriptionState() {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const sub = await registration.pushManager.getSubscription();
      setSupported(true);
      setSubscribed(!!sub);
      // Bugreport: Tisch4-Operator bekam Pushes, die eigentlich für Tisch5
      // bestimmt waren - die Browser-Subscription ist geräte-/browser-
      // gebunden, nicht an die aktuell eingeloggte Session. subscribePush()
      // lief bisher NUR beim manuellen Einschalten über den Glocken-Button
      // (siehe handleToggle unten), nie erneut beim Seitenaufruf - meldete
      // sich also jemand auf einem Gerät um, auf dem Push schon für einen
      // ANDEREN Nickname aktiviert war, blieb der alte Nickname-Eintrag in
      // pushSubscriptions stehen, ohne dass die UI das sichtbar gemacht hätte
      // (die Glocke zeigte ja weiterhin korrekt "an"). Jetzt wird bei jedem
      // Mount mit bereits bestehender Subscription der Server-Eintrag auf den
      // aktuell eingeloggten Nickname nachgezogen (subscribePush() macht ein
      // upsert auf den endpoint, also idempotent und ohne Seiteneffekt, falls
      // der Nickname ohnehin schon stimmt).
      if (sub) {
        await subscribePush(JSON.parse(JSON.stringify(sub))).catch(() => {});
      }
    }
    syncSubscriptionState().catch(() => {});
  }, []);

  async function handleToggle() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (subscribed) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        setToast("Benachrichtigungen aus");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        });
        await subscribePush(JSON.parse(JSON.stringify(sub)));
        setSubscribed(true);
        setToast("Benachrichtigungen an");
      }
    } catch {
      // Best-effort: z.B. Nutzer bricht den Berechtigungsdialog ab - kein
      // Grund, dem Nutzer einen technischen Fehler zu zeigen.
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  const label = subscribed ? "Benachrichtigungen an" : "Benachrichtigungen aktivieren";

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${subscribed ? styles.on : ""}`}
        onClick={handleToggle}
        disabled={busy}
        aria-label={label}
      >
        {subscribed ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
            <path d="M18 8a6 6 0 0 0-9.33-5" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
      <Toast text={toast} />
    </>
  );
}
