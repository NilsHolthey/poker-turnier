import webpush from "web-push";
import { getDb } from "../db/mongodb.js";
import { tableOrdinalFromLabel } from "../core/index.js";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Tisch-Label -> Operator-Nickname: spiegelt exakt das "Mein Tisch"-Mapping aus
// app/page.js (Nickname "tischN" <-> letzte Ziffer im aktuellen Tisch-Label).
// Labels wechseln pro Phase ("Tisch 3" -> "Halbfinale 2" -> ...), aber der
// Ziffernabgleich bleibt derselbe - Subscriptions werden deshalb nach Nickname
// statt nach tableId gespeichert (siehe lib/db/schema.js, pushSubscriptionSchema).
function nicknameForLabel(label) {
  const ordinal = tableOrdinalFromLabel(label);
  return ordinal ? `tisch${ordinal}` : null;
}

async function sendToNickname(db, nickname, payload) {
  const subs = await db.collection("pushSubscriptions").find({ nickname }).toArray();
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
      } catch (err) {
        // 404/410 = Subscription ist auf dem Gerät nicht mehr gültig (Browserdaten
        // gelöscht, Berechtigung entzogen, ...) - aufräumen statt bei jedem
        // künftigen Move erneut denselben Fehler zu produzieren.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.collection("pushSubscriptions").deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Push-Versand fehlgeschlagen:", err.message);
        }
      }
    })
  );
}

// Gezielter Versand an das Gerät eines einzelnen Tisches (spec: "gezielt nur an
// Quell- und Zieltisch-Gerät gehen, nicht als Broadcast an alle 8 Geräte").
// Best-effort: fehlender/kaputter VAPID-Key oder Push-Fehler dürfen den
// eigentlichen Spielzug niemals blockieren, deshalb kein throw nach außen.
export async function notifyTable(label, payload) {
  try {
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    const nickname = nicknameForLabel(label);
    if (!nickname) return;
    ensureConfigured();
    const db = await getDb();
    await sendToNickname(db, nickname, payload);
  } catch (err) {
    console.error("notifyTable fehlgeschlagen:", err.message);
  }
}

// Admin hat keinen eigenen Tisch, will als Überblick aber JEDEN Zug an JEDEM
// Tisch mitbekommen (Chat-Wunsch: "notify admin on every table's move") -
// eigener Versand statt nicknameForLabel-Zuordnung, immer an nickname "admin".
export async function notifyAdmin(payload) {
  try {
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    ensureConfigured();
    const db = await getDb();
    await sendToNickname(db, "admin", payload);
  } catch (err) {
    console.error("notifyAdmin fehlgeschlagen:", err.message);
  }
}
