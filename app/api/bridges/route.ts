// app/api/bridges/route.ts
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
      SELECT
        longitude AS "Longitude",
        latitude AS "Latitude",
        bridge_number AS "BridgeNumber",
        bridge_name AS "BridgeName",
        county_name as "CountyName", 
        year_built AS "YearBuilt",
        year_rebuilt AS "YearRebuilt",
        scour_condition AS "ScourCondition",
        culvert_condition AS "CulvertCondition",
        bridge_overall_condition_state AS "BridgeOverallConditionState",
        detour AS "Detour",
        prpsed_imprv_type_of_work AS "PrpsedImprvTypeOfWork",
        prpsed_imprv_work_method AS "PrpsedImprvWorkMethod",
        prpsed_imprv_structure_lgth_by_ft AS "PrpsedImprvStructureLgthByFT",
        prpsed_imprv_roadway_wdth_by_ft AS "PrpsedImprvRoadwayWdthByFT",
        prpsed_imprv_cost_per_sf_deck AS "PrpsedImprvCostPerSFDeck",
        prpsed_imprv_structure_cost AS "PrpsedImprvStructureCost",
        prpsed_imprv_roadway_cost AS "PrpsedImprvRoadwayCost",
        prpsed_imprv_eng_misc_cost AS "PrpsedImprvEngMiscCost",
        prpsed_imprv_total_cost AS "PrpsedImprvTotalCost",
        prpsed_imprv_estimate_year AS "PrpsedImprvEstimateYear"
      FROM bridges
    `);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("PostgreSQL error:", err);
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
