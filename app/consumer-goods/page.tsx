import type { Metadata } from "next";
import { SectorPage } from "../_components/SectorPage";

export const metadata: Metadata = {
  title: "Consumer Goods — Streetbeat concept",
  description: "Exploring applied AI for fast-moving consumer organizations.",
};

export default function ConsumerGoodsPage() {
  return (
    <SectorPage
      eyebrow="Application 03 · Consumer Goods"
      title="Better intelligence for markets that never stand still."
      intro="We are selecting consumer goods organizations where fragmented signals, fast operating cycles and resource-intensive decisions create the opportunity for a practical AI system."
      question="Where could a faster, better-connected view of the market change what your team does next?"
      workflows={[
        "Market and consumer intelligence",
        "Portfolio and category decision support",
        "Commercial planning and execution",
        "Cross-functional knowledge workflows",
      ]}
      outcomes={[
        "Faster movement from signals to decisions",
        "Less duplicated research and manual synthesis",
        "Better allocation of time and resources",
        "Stronger visibility into decision rationale",
      ]}
    />
  );
}
