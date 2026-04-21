import JourneysPageClient from "./JourneysPageClient";
import { getJourneyStaticData } from "./journeyStaticData";

export const dynamic = "force-static";

export default async function JourneysPage() {
  const staticData = await getJourneyStaticData();

  return <JourneysPageClient staticData={staticData} />;
}
