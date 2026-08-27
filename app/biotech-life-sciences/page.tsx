import type { Metadata } from "next";
import { SectorPage } from "../_components/SectorPage";

export const metadata: Metadata = {
  title: "Biotech & Life Sciences — Streetbeat concept",
  description: "Exploring applied AI for complex scientific and operational work.",
};

export default function BiotechPage() {
  return (
    <SectorPage
      eyebrow="Application 02 · Biotech & Life Sciences"
      title="Complex evidence. Faster, more traceable decisions."
      intro="We are selecting biotech and life sciences organizations where fragmented knowledge, demanding workflows and high-consequence decisions create a meaningful opportunity for applied AI."
      question="Where does scientific or operational complexity slow down the decision your team needs to make next?"
      workflows={[
        "Scientific and competitive intelligence",
        "Evidence synthesis and knowledge retrieval",
        "Clinical and operational decision support",
        "Controlled documentation workflows",
      ]}
      outcomes={[
        "Shorter distance from evidence to action",
        "More consistent and inspectable reasoning",
        "Less manual knowledge work",
        "Human accountability at critical decision points",
      ]}
    />
  );
}
