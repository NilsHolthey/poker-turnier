import { getDb } from "../lib/db/mongodb.js";
import { ensureSchema } from "../lib/db/schema.js";

const db = await getDb();
await ensureSchema(db);
console.log("Collections + validators + indexes ready.");
process.exit(0);
