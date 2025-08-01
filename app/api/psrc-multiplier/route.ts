import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { point, booleanPointInPolygon } from '@turf/turf'
import type { Feature, Polygon } from 'geojson';


export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const oLat = parseFloat(url.searchParams.get('originLat') || '')
  const oLng = parseFloat(url.searchParams.get('originLng') || '')
  const dLat = parseFloat(url.searchParams.get('destinationLat') || '')
  const dLng = parseFloat(url.searchParams.get('destinationLng') || '')

  if ([oLat, oLng, dLat, dLng].some(isNaN)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const originPoint = point([oLng, oLat])
  const destPoint = point([dLng, dLat])

  try {
    // Load TAZ GeoJSON
    const tazPath = path.join(process.cwd(), 'public', 'data/psrc/psrc_taz.geojson')
    const tazRaw = fs.readFileSync(tazPath, 'utf8')
    const tazData = JSON.parse(tazRaw)

    let originTaz: number | null = null
    let destTaz: number | null = null

    for (const feature of tazData.features) {
      const polygon = feature as Feature<Polygon>
      if (!originTaz && booleanPointInPolygon(originPoint, polygon)) {
        originTaz = feature.properties.taz // replace with actual property name
        //return NextResponse.json({ originTaz: originTaz }, { status: 400 })
        console.log("originTaz:", originTaz)
      }
      if (!destTaz && booleanPointInPolygon(destPoint, polygon)) {
        destTaz = feature.properties.taz
        //return NextResponse.json({ destinationTaz: destTaz }, { status: 400 })
        console.log("destTaz:", destTaz)
      }
      if (originTaz && destTaz) break
    }

    if (originTaz === null || destTaz === null) {
      return NextResponse.json({ error: 'One or both TAZs not found' }, { status: 404 })
    }

    // Load multiplier matrix
    // const matrixPath = path.join(process.cwd(), 'public', 'data/psrc/psrc_sov.json')
    // const matrixRaw = fs.readFileSync(matrixPath, 'utf8')
    // const matrix = JSON.parse(matrixRaw)

    // const rowIndex = matrix.index.indexOf(originTaz)
    // console.log("ROW INDEX: ", rowIndex)
    // const colIndex = matrix.columns.indexOf(destTaz)
    // console.log("COL INDEX: ", colIndex)

    // if (rowIndex === -1 || colIndex === -1) {
    //   return NextResponse.json({ error: 'TAZ ID not found in matrix' }, { status: 404 })
    // }

    // const multiplier = matrix.data?.[rowIndex]?.[colIndex] ?? null

    const batchSize = 100;
    const batchIndex = Math.floor(originTaz / batchSize);
    const batchFile = `batch_${batchIndex.toString().padStart(3, "0")}.json`;
    const batchPath = path.join(process.cwd(), "public", "data/psrc/batches", batchFile);

    if (!fs.existsSync(batchPath)) {
      return NextResponse.json({ error: "Batch file not found" }, { status: 404 });
    }

    const batchRaw = fs.readFileSync(batchPath, "utf8");
    const batchData = JSON.parse(batchRaw);

    const originRow = batchData[originTaz.toString()];
    if (!originRow) {
      return NextResponse.json({ error: `Origin TAZ ${originTaz} not in batch` }, { status: 404 });
    }

    const multiplier = originRow[destTaz.toString()];
    if (multiplier === undefined) {
      return NextResponse.json({ error: `Destination TAZ ${destTaz} not found` }, { status: 404 });
    }


    return NextResponse.json({
      originTaz,
      destinationTaz: destTaz,
      multiplier,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
