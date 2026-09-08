import { ComparePanel } from "@/components/compare-panel";
import { PLACES } from "@/lib/climate/places";

export const metadata = {
  title: "Compare",
  description:
    "Compare climate projections across pathways, horizons, models and places.",
};

export default function ComparePage() {
  return <ComparePanel places={PLACES} />;
}
