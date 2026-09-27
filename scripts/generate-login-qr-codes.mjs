// Generates a printable HTML page with one QR code per account (admin +
// tisch1..tisch8). Each QR code links to /auth/login?login_hint=<username>,
// which Auth0's Universal Login reads to pre-fill the username field - the
// password still has to be typed (see chat: pre-filling passwords in a
// scannable QR code would be a real security anti-pattern, Auth0 doesn't
// support it either). Run with `npm run qr:login` (optionally pass a base URL:
// `npm run qr:login -- https://your-deployed-app.example`).
import QRCode from "qrcode";
import { writeFile } from "fs/promises";

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const usernames = ["admin", "tisch1", "tisch2", "tisch3", "tisch4", "tisch5", "tisch6", "tisch7", "tisch8"];

const cards = await Promise.all(
  usernames.map(async (username) => {
    const url = `${baseUrl}/auth/login?login_hint=${encodeURIComponent(username)}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    return { username, url, qrDataUrl };
  })
);

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Poker-Turnier Login-QR-Codes</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #fff; color: #111; margin: 0; padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .card { border: 1px solid #ccc; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
  .card img { width: 100%; height: auto; }
  .card h2 { margin: 0 0 12px; font-size: 1.1rem; }
  .card p { margin: 8px 0 0; font-size: 0.75rem; color: #555; word-break: break-all; }
  @media print {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
  <h1>Poker-Turnier – Login-QR-Codes</h1>
  <p>Scannen füllt den Benutzernamen automatisch aus, Passwort muss weiterhin eingegeben werden.</p>
  <div class="grid">
    ${cards
      .map(
        (c) => `
    <div class="card">
      <h2>${c.username}</h2>
      <img src="${c.qrDataUrl}" alt="Login-QR für ${c.username}" />
      <p>${c.url}</p>
    </div>`
      )
      .join("")}
  </div>
</body>
</html>
`;

await writeFile("private/login-qr-codes.html", html, "utf8");
console.log(`private/login-qr-codes.html erstellt (${cards.length} Accounts, Basis-URL: ${baseUrl})`);
