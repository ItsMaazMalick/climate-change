import { PointTrajectory } from "@/components/point-trajectory";
import { PLACES } from "@/lib/climate/places";

export const metadata = {
  title: "Point projection",
  description:
    "Click anywhere in Pakistan to see how a place's climate could change to 2100 under each emissions pathway.",
};

export default function TrajectoryPage() {
  return <PointTrajectory places={PLACES} />;
}
