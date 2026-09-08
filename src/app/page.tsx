import { Explorer } from "@/components/explorer";
import { PLACES } from "@/lib/climate/places";

export const metadata = {
  title: "Explorer",
  description:
    "Click anywhere in Pakistan to see how its climate could change under each CMIP6 emissions pathway.",
};

export default function HomePage() {
  return <Explorer places={PLACES} />;
}
