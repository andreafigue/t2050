import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { point, booleanPointInPolygon } from '@turf/turf'
import type { Feature, Polygon } from 'geojson';
import { Client } from 'pg';

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const oLat = parseFloat(url.searchParams.get('originLat') || '')
  const oLng = parseFloat(url.searchParams.get('originLng') || '')
  const dLat = parseFloat(url.searchParams.get('destinationLat') || '')
  const dLng = parseFloat(url.searchParams.get('destinationLng') || '')

  const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT),
  });

  if ([oLat, oLng, dLat, dLng].some(isNaN)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const originPoint = point([oLng, oLat])
  const destPoint = point([dLng, dLat])

  try {
    // Load TAZ GeoJSON
    const tazPath = path.join(process.cwd(), 'public', 'data/trpc/trpc_taz.geojson')
    const tazRaw = fs.readFileSync(tazPath, 'utf8')
    const tazData = JSON.parse(tazRaw)

    let originTaz: number | null = null
    let destTaz: number | null = null

    for (const feature of tazData.features) {
      const polygon = feature as Feature<Polygon>
      if (!originTaz && booleanPointInPolygon(originPoint, polygon)) {
        originTaz = feature.properties.TAZ22 // replace with actual property name
        //return NextResponse.json({ originTaz: originTaz }, { status: 400 })
        console.log("originTaz:", originTaz)
      }
      if (!destTaz && booleanPointInPolygon(destPoint, polygon)) {
        destTaz = feature.properties.TAZ22
        //return NextResponse.json({ destinationTaz: destTaz }, { status: 400 })
        console.log("destTaz:", destTaz)
      }
      if (originTaz && destTaz) break
    }

    if (originTaz === null || destTaz === null) {
      return NextResponse.json({ error: 'One or both TAZs not found' }, { status: 404 })
    }

    try {
      await client.connect();

      const result_multiplier = await client.query(
        "SELECT multiplier FROM trpc_multiplier WHERE origin_taz = $1 AND destination_taz = $2",
        [originTaz, destTaz]
      );

      const result_source = await client.query(
        "SELECT src_label FROM trpc_source WHERE origin_taz = $1 AND destination_taz = $2",
        [originTaz, destTaz]
      );

      await client.end();

      const multiplier = result_multiplier.rows[0]["multiplier"]
      const sourceMultiplier = result_source.rows[0]["src_label"]

      return NextResponse.json({
        originTaz,
        destinationTaz: destTaz,
        multiplier,
        sourceMultiplier
      })
    } catch (err) {
      console.error('PostgreSQL error:', err);
      //return new NextResponse(null, { status: 500 });

      const batchSize = 100;
      const batchIndex = Math.floor(originTaz / batchSize);
      const batchFile = `batch_${batchIndex.toString().padStart(3, "0")}.json`;
      const batchPath = path.join(
        process.cwd(),
        "public",
        "data",
        "trpc",
        "batches",
        batchFile
      );

      if (!fs.existsSync(batchPath)) {
        console.log ("Batch", batchPath)
        return NextResponse.json({ error: "Batch file not found" }, { status: 404 });
      }

      const batchRaw = fs.readFileSync(batchPath, "utf8");
      const batchData = JSON.parse(batchRaw);

      // TAZ keys are strings in the JSON
      const originRow = batchData[originTaz.toString()];
      if (!originRow) {
        return NextResponse.json({ error: `Origin TAZ ${originTaz} not found in batch` }, { status: 404 });
      }

      const multiplier = originRow[destTaz.toString()];
      if (multiplier === undefined) {
        return NextResponse.json({ error: `Destination TAZ ${destTaz} not found` }, { status: 404 });
      }

      console.log("OTAZ: ", originTaz, "DTAZ: ", destinationTaz, "multiplier: ", multiplier)
      return NextResponse.json({
        originTaz,
        destinationTaz: destTaz,
        multiplier,
      })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
