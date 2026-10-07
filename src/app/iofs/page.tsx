import { IofsDashboard } from "@/components/iofs/iofs-dashboard";

export const metadata = {
  title: "IOFS Climate & El Niño Outlook",
  description:
    "Live ENSO status, Super El Niño comparison and each IOFS member state's CMIP6 climate trajectory from 1950 to 2099.",
};

export default function IofsPage() {
  return <IofsDashboard />;
}
