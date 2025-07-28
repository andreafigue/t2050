// app/api/county-data/route.ts (for App Router)
import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT),
  });

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM county_data ORDER BY "county", "year"');
    await client.end();
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('PostgreSQL error:', err);
    return new NextResponse(null, { status: 500 });
  }
}
