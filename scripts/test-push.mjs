// Debug-Tool: schickt eine Testbenachrichtigung an alle gespeicherten
// Subscriptions eines Nicknames, unabhängig vom eigentlichen Spielablauf -
// isoliert die VAPID-Konfiguration/den Versandweg vom Umsetzungs-Flow.
// Usage: npm run push:test -- tisch1
import webpush from "web-push";
import { getDb } from "../lib/db/mongodb.js";

const nickname = process.argv[2];
if (!nickname) {
  console.error("Usage: npm run push:test -- <nickname>  (z.B. tisch1, admin)");
  process.exit(1);
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const db = await getDb();
const subs = await db.collection("pushSubscriptions").find({ nickname }).toArray();
console.log(`${subs.length} Subscription(s) für "${nickname}" gefunden.`);

for (const sub of subs) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({ title: "Testbenachrichtigung", body: `Push-Test an ${nickname}`, url: "/" })
    );
    console.log("✓ gesendet an", sub.endpoint.slice(0, 70) + "...");
  } catch (err) {
    console.error("✗ fehlgeschlagen:", err.statusCode, err.message);
    if (err.statusCode === 404 || err.statusCode === 410) {
      await db.collection("pushSubscriptions").deleteOne({ endpoint: sub.endpoint });
      console.log("  (abgelaufene Subscription entfernt)");
    }
  }
}

process.exit(0);
