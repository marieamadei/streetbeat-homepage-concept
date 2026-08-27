import { SiteFooter, SiteHeader } from "./SiteChrome";

type SectorPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  question: string;
  workflows: string[];
  outcomes: string[];
};

export function SectorPage({
  eyebrow,
  title,
  intro,
  question,
  workflows,
  outcomes,
}: SectorPageProps) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="sector-hero">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="sector-intro">{intro}</p>
          <div className="hero-actions">
            <a className="button" href="/apply/">Apply to build with us</a>
            <a className="text-link" href="/#applications">Back to applications <span>↗</span></a>
          </div>
          <div className="sector-signal" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <section className="sector-question section-pad">
          <div className="section-kicker">The opportunity</div>
          <h2>{question}</h2>
        </section>

        <section className="sector-detail section-pad dark-section">
          <div className="section-heading">
            <div>
              <div className="section-kicker light">Start with the work</div>
              <h2>One workflow.<br />One measurable outcome.</h2>
            </div>
            <p>
              We are not presenting a finished sector product. We are selecting
              organizations with a meaningful operational challenge and the
              domain expertise required to build the right system together.
            </p>
          </div>
          <div className="sector-columns">
            <div>
              <span className="mini-label">Workflows to explore</span>
              <ul>{workflows.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              <span className="mini-label">Outcomes to measure</span>
              <ul>{outcomes.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="method-compact section-pad">
          <div className="section-kicker">How Streetbeat builds</div>
          <h2>A model is only the beginning.</h2>
          <div className="method-grid compact">
            {["Define the outcome", "Connect the right data", "Work with domain experts", "Keep humans in control", "Measure and improve"].map((step, index) => (
              <article key={step}><span>0{index + 1}</span><h3>{step}</h3></article>
            ))}
          </div>
        </section>

        <section className="closing-cta">
          <span className="section-kicker light">A selective starting point</span>
          <h2>What could AI change<br />inside your organization?</h2>
          <p>Tell us about one workflow where speed, resources or risk truly matter.</p>
          <a className="button button-light" href="/apply/">Apply to build with us</a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
