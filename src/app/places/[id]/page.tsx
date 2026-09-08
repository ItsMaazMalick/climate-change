import { notFound } from "next/navigation";

import { ClimateStory } from "@/components/climate-story";
import { getPlace, PLACES } from "@/lib/climate/places";

export function generateStaticParams() {
  return PLACES.map((place) => ({ id: place.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = getPlace((await params).id);
  if (!place) return { title: "Place not found" };
  return {
    title: `${place.name} climate projections`,
    description: `How the climate of ${place.name}, ${place.province} could change through 2100 under each CMIP6 emissions pathway.`,
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = getPlace((await params).id);
  if (!place) notFound();
  return <ClimateStory place={place} />;
}
