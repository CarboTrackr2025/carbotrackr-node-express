import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import env from "../env.ts";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

const db = drizzle({ client: pool });

console.log("Running migrations...");

await migrate(db, { migrationsFolder: "./migrations" });

console.log("Migrations complete!");

await pool.end();

