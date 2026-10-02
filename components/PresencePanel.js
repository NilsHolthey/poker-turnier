"use client";

import { useEffect, useState } from "react";
import { fetchPresence } from "@/lib/client/api";
import styles from "./PresencePanel.module.css";

const POLL_MS = 10_000;

function accountLabel(nickname) {
  return nickname === "admin" ? "Admin" : `Tisch ${nickname.replace("tisch", "")}`;
}

function formatLastSeen(lastSeenAt, now) {
  if (!lastSeenAt) return "noch nie aktiv";
  const diffMs = now - new Date(lastSeenAt).getTime();
  if (diffMs < 10_000) return "jetzt gerade";
  if (diffMs < 60_000) return `vor ${Math.floor(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) return `vor ${Math.floor(diffMs / 60_000)} min`;
  return `vor ${Math.floor(diffMs / 3_600_000)} h`;
}

// Chat-Wunsch: "admin ... site where we see which users are currently
// logged in. I can see activity on auth0 dashboard but is there a way to
// display it on app as admin" - eigene Presence statt Auth0-Management-API
// (siehe lib/db/presence.js) - pollt .../api/admin/presence, das wiederum
// nur die "zuletzt aktiv"-Zeitstempel zeigt, die requireRole() (lib/authz.js)
// bei jedem authentifizierten Request ohnehin mitschreibt.
export default function PresencePanel() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchPresence();
        if (!cancelled) setAccounts(data.accounts);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Eigener 1s-Tick statt die "vor Xs"-Anzeige nur bei jedem 10s-Datenpoll
  // nachzuziehen - sonst bleibt der Text bis zu 10s lang sichtbar falsch.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <ul className={styles.list}>
      {accounts.map((a) => (
        <li key={a.nickname} className={styles.row}>
          <span className={`${styles.dot} ${a.online ? styles.dotOnline : ""}`} aria-hidden="true" />
          <span className={styles.label}>{accountLabel(a.nickname)}</span>
          <span className={styles.lastSeen}>{formatLastSeen(a.lastSeenAt, now)}</span>
        </li>
      ))}
    </ul>
  );
}
