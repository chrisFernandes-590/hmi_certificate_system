import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import * as relations from "./relations.js";
// ---------------------------------------------------------------------------
// Database connection
// Uses a pg connection pool for efficient connection reuse in the Node.js
// server process. The DATABASE_URL is loaded from the .env file via dotenv.
// ---------------------------------------------------------------------------
import fs from "node:fs";
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}
// Support verified TLS with Amazon RDS CA bundle when present
const caPath = process.env.AWS_RDS_CA_PATH || "/etc/pki/tls/certs/global-bundle.pem";
const hasRdsCa = fs.existsSync(caPath);
const cleanConnectionString = hasRdsCa
    ? process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]+(&|$)/, "$1").replace(/[?&]$/, "")
    : process.env.DATABASE_URL;
const sslConfig = hasRdsCa
    ? { rejectUnauthorized: true, ca: fs.readFileSync(caPath, "utf8") }
    : { rejectUnauthorized: false };
const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: sslConfig,
});
// Merge schema tables and relations into the Drizzle instance so the
// `db.query.*` relational API is fully available throughout the application.
export const db = drizzle(pool, {
    schema: { ...schema, ...relations },
});
