import { MongoClient } from "mongodb";

// Lazy: Next.js imports route modules at build time to collect their exported
// HTTP methods, which runs top-level module code without real env vars present.
// Connecting only on first getDb() call keeps `next build` working without a DB.
let clientPromise;

function getClientPromise() {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI environment variable");

  const client = new MongoClient(uri);

  if (process.env.NODE_ENV === "development") {
    // Reuse the client across HMR reloads in dev so we don't exhaust connections.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || "poker-turnier");
}

// Für Operationen, die eine echte Mongo-Transaktion brauchen (session.
// startTransaction/withTransaction) statt nur einer Db-Instanz - siehe
// endPhase() in tournamentEngine.js (Bugreport: partieller Phasenwechsel bei
// E11000-Fehler mitten in den Spieler-Updates).
export async function getClient() {
  return getClientPromise();
}
