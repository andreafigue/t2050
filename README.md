This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Challenge 2050 - The Future in motion

This project is a React and Next.js application built with TypeScript, using Mapbox for mapping and D3.js for data visualizations.

## Deployment Instructions

When changes are made, deploy by running the following commands:

```bash
cd /src/t2050/
sudo npm run build
pm2 restart t2050
```

If there are issues with loading the page or images are not loading, remove the Next.js build directory and rebuild:

```bash
cd /src/t2050/
rm -rf .next
sudo npm run build
pm2 restart t2050
```

## Components

Each component is a visualization that can also be accessed individually

- Population
	/app/components/Population.tsx
	https://mobilitywa2050.org/population

- Traffic
	/app/components/MapRoute2.tsx
	https://mobilitywa2050.org/traffic

- Airport
	/app/components/Airport.tsx
	https://mobilitywa2050.org/airport

- Freight
	/app/components/Freight.tsx
	https://mobilitywa2050.org/freight

- Bridges
	/app/components/BridgeMap2.tsx
	https://mobilitywa2050.org/bridges

- HSR
	/app/components/hsr2.tsx
	https://mobilitywa2050.org/hsr

## API Key

Api keys are available in ./.env Mapbox key in use is NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN