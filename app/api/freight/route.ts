// app/api/freight/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(`
      SELECT * FROM freight
    `);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("PostgreSQL error:", err);
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
