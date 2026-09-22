import "dotenv/config";
import { openDatabase, migrate } from "./database.js";
const db = await openDatabase(process.env.DATABASE_URL);
try {
  await migrate(db);
  console.log("Fitkin schema is up to date.");
} finally {
  await db.close();
}
