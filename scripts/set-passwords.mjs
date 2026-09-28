// Passwörter für alle Accounts aus private/auth0-seed-users.json.
// Schema: <username>-<4 Zeichen>, z.B. "tisch3-K7a#" - kurz genug zum Abtippen
// am Handy, die 4 Zeichen enthalten immer je einen Groß-, Kleinbuchstaben,
// eine Ziffer und ein Sonderzeichen (erfüllt damit auch Auth0-Policies bis
// "Good", auch für "admin" ohne Ziffer im Namen). Verwechselbare Zeichen
// (I/l/1, O/0) sind ausgeschlossen.
//
//   npm run passwords:generate   neue Passwörter erzeugen und in
//                                private/auth0-seed-users.json speichern
//   npm run passwords:apply      gespeicherte Passwörter per Management API
//                                in Auth0 setzen
//
// apply braucht eine Machine-to-Machine-App in Auth0 (Applications ->
// Create Application -> Machine to Machine, API "Auth0 Management API",
// Scopes read:users + update:users) und deren Werte in .env.local als
// AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET.
import { randomInt } from "crypto";
import { readFile, writeFile } from "fs/promises";

const SEED_FILE = "private/auth0-seed-users.json";
const CHARSETS = ["ABCDEFGHJKMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!?#$%&*+@"];

function randomSuffix() {
  const chars = CHARSETS.map((set) => set[randomInt(set.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const seed = JSON.parse(await readFile(SEED_FILE, "utf8"));

if (process.argv.includes("--apply")) {
  const domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) {
    throw new Error("AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID und AUTH0_MGMT_CLIENT_SECRET müssen in .env.local stehen");
  }

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token-Abruf fehlgeschlagen: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();
  const api = (path, init = {}) =>
    fetch(`https://${domain}/api/v2${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    });

  for (const user of seed.users) {
    const q = encodeURIComponent(`username:"${user.username}"`);
    const found = await (await api(`/users?q=${q}&search_engine=v3`)).json();
    const match = Array.isArray(found) ? found.find((u) => u.username === user.username) : null;
    if (!match) {
      console.error(`✗ ${user.username}: nicht in Auth0 gefunden`);
      continue;
    }
    const res = await api(`/users/${encodeURIComponent(match.user_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ password: user.password, connection: seed.connection }),
    });
    console.log(res.ok ? `✓ ${user.username}` : `✗ ${user.username}: ${res.status} ${await res.text()}`);
  }
} else {
  for (const user of seed.users) {
    user.password = `${user.username}-${randomSuffix()}`;
  }
  await writeFile(SEED_FILE, JSON.stringify(seed, null, 2) + "\n", "utf8");
  console.log(`Neue Passwörter in ${SEED_FILE} gespeichert (${seed.users.length} Accounts).`);
  console.log("Jetzt in Auth0 setzen: npm run passwords:apply");
}
