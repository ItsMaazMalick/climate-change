import { Explorer } from "@/components/explorer";
import { PLACES } from "@/lib/climate/places";

export const metadata = {
  title: "Explore",
  description:
    "Pick a location and an emissions pathway to see how a place's climate could change against the 1995–2014 baseline.",
};

export default function ExplorePage() {
  return <Explorer places={PLACES} />;
}
