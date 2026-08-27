import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../_components/SiteChrome";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = {
  title: "Apply to build with Streetbeat — concept",
  description: "A prototype application flow for organizations building the next applied AI systems with Streetbeat.",
};

export default function ApplyPage() {
  return (
    <>
      <SiteHeader />
      <main className="apply-page">
        <section className="apply-intro">
          <div className="section-kicker">Apply to build with us</div>
          <h1>Start with one workflow that matters.</h1>
          <p>
            Streetbeat is selecting a small number of organizations to explore
            where applied AI can improve speed, resource use or risk. Tell us
            about the work—not the technology you think you need.
          </p>
          <div className="apply-principles">
            <span><b>01</b>A meaningful operational problem</span>
            <span><b>02</b>Access to domain expertise</span>
            <span><b>03</b>A result we can measure together</span>
          </div>
        </section>
        <section className="apply-form-wrap">
          <ApplyForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
