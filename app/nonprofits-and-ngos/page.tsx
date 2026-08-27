import type { Metadata } from "next";
import { SectorPage } from "../_components/SectorPage";

export const metadata: Metadata = {
  title: "Nonprofits & NGOs — Streetbeat concept",
  description: "Exploring applied AI for mission-driven organizations.",
};

export default function NonprofitsPage() {
  return (
    <SectorPage
      eyebrow="Application 01 · Nonprofits & NGOs"
      title="More intelligence for every resource entrusted to the mission."
      intro="We are selecting mission-driven organizations to explore how applied AI can strengthen decisions, reduce operational friction and help teams direct more time and money toward impact."
      question="Where could better intelligence free your team to focus more of its resources on the mission?"
      workflows={[
        "Funding and opportunity intelligence",
        "Program knowledge and reporting",
        "Donor and supporter engagement",
        "Operational research and decision support",
      ]}
      outcomes={[
        "More time directed toward mission-critical work",
        "Faster access to relevant evidence and opportunities",
        "Stronger consistency and traceability",
        "Better use of constrained resources",
      ]}
    />
  );
}
