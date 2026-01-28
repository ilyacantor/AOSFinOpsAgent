import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// Prefer Replit's DATABASE_URL, fall back to SUPABASE_DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect connection type based on URL
const isSupabase = databaseUrl.includes('supabase') || databaseUrl.includes('pooler.supabase');
const isNeon = databaseUrl.includes('neon.tech');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;

if (isNeon) {
  // Use Neon serverless driver with WebSocket for Neon connections
  console.log('[DB] Using Neon serverless driver with WebSocket');
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzleNeon({ client: pool as NeonPool, schema });
} else {
  // Use standard pg driver for other PostgreSQL connections (Replit, Supabase, etc.)
  console.log('[DB] Using standard PostgreSQL driver');
  
  try {
    const parsedUrl = new URL(databaseUrl);
    console.log(`[DB] Connecting to host: ${parsedUrl.hostname}, database: ${parsedUrl.pathname.slice(1)}`);
  } catch (e) {
    console.error('[DB] Failed to parse database URL');
  }
  
  pool = new PgPool({ 
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
  
  // Add error handler for pool
  (pool as PgPool).on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });
  
  db = drizzlePg({ client: pool as PgPool, schema });
}

export { pool, db };
