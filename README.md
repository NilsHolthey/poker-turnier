# Poker-Turnier

Next.js PWA for live table management at a friends' poker tournament (max. 48 players): table balancing, random seat moves, table dissolving, blind schedule and push notifications.

Stack: Next.js (App Router, JavaScript), MongoDB, Auth0, Web Push.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in MongoDB, Auth0 and VAPID values
npm run db:init              # create collections + validators
npm run db:seed              # optional: sample tournament
npm run dev
```

## Scripts

| Script              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:3000            |
| `npm test`          | Unit tests for `lib/core`                      |
| `npm run lint`      | ESLint                                         |
| `npm run qr:login`  | Generate login QR codes → `private/`           |
| `npm run push:test` | Send a test push notification                  |

## Structure

```
app/          routes, API handlers, manifest
components/   UI components (CSS Modules)
lib/          core logic, DB, auth, server/client helpers
scripts/      DB init/seed, QR codes, push test
public/       icons, images, service worker
docs/         spec, design notes, mockups
private/      local secrets (gitignored)
```

Full spec: [docs/poker-turnier-mvp-spec.md](docs/poker-turnier-mvp-spec.md)
