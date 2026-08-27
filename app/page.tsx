import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "./_components/SiteChrome";

export const metadata: Metadata = {
  title: "Streetbeat — Applied AI for what you're building",
  description:
    "A working concept for Streetbeat's next website: finance as proof, applied AI as the future.",
};

const method = [
  ["01", "Define the outcome", "Begin with a decision, workflow or result that needs to improve."],
  ["02", "Connect the right data", "Bring together the information, systems and context the work actually depends on."],
  ["03", "Work with domain experts", "Build with the people who understand the constraints, exceptions and consequences."],
  ["04", "Keep humans in control", "Design review, governance and accountability into the system from the start."],
  ["05", "Measure and improve", "Track what changes, learn from use and improve the system against the outcome."],
];

const applications = [
  {
    number: "01",
    title: "Nonprofits & NGOs",
    copy: "Help mission-driven organizations use limited resources more effectively, strengthen decisions and expand impact.",
    href: "/nonprofits-and-ngos/",
  },
  {
    number: "02",
    title: "Biotech & Life Sciences",
    copy: "Turn complex scientific and operational information into faster, more traceable decisions.",
    href: "/biotech-life-sciences/",
  },
  {
    number: "03",
    title: "Consumer Goods",
    copy: "Improve planning, insight and execution across fast-moving, data-rich workflows.",
    href: "/consumer-goods/",
  },
];

const team = [
  ["Damián Ariel Scavo", "CEO, CIO & Co-Founder", "Palo Alto"],
  ["Maciej Donajski", "CTO & Co-Founder", "Wrocław"],
  ["Leandro Javier Scavo", "Head of People", "Palo Alto"],
  ["Anas Asri", "Head of Communication", "Milan"],
  ["Marco Ramerio", "Lead Product Designer", "Milan"],
  ["Robert Bar", "VP Engineering", "Wrocław"],
  ["Adrian Bielewicz", "Senior Software Architect", "Wrocław"],
  ["Ajsel Žilić", "Full-Stack Developer", "Sarajevo"],
  ["Enver Kovacevic", "Software Engineer", "Sarajevo"],
  ["Dino Saciragic", "Software Engineer", "Zagreb"],
  ["Maria Laura Bigi", "Head of Operations", "Milan"],
  ["Lucia Canova", "Operations", "Milan"],
  ["Sofia Marques Leal", "CS and Investor Relations", "Madrid"],
  ["Diego Damiani", "Technical Account Manager", "Milan"],
  ["Giulia Spiriti", "Account Manager", "Florence"],
  ["Giovanni Luca Caiazzo", "Account Manager", "Lucca"],
  ["Marie Amadei", "Head of New Markets & Strategic Initiatives", "Bologna"],
  ["Andrea Padula", "Head of Partnerships & BD", "Milan"],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Applied AI for what you&apos;re building.</div>
            <h1>
              <span>Move faster.</span>
              <span>Use money and</span>
              <span>time better.</span>
              <span>Reduce risk.</span>
            </h1>
            <p className="hero-deck">
              Streetbeat turns AI into systems that improve how organizations
              work, decide and deliver.
            </p>
            <p className="hero-bridge">
              We began in finance—one of the world&apos;s most complex and
              regulated sectors, and the one we know best. Today, we are
              selecting a small number of companies and organizations to build
              the next applications with us.
            </p>
            <div className="hero-actions">
              <a className="button" href="#finance">See what we built in finance</a>
              <a className="button button-ghost" href="/apply/">Apply to build with us</a>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="system-label label-one">work</div>
            <div className="system-label label-two">decide</div>
            <div className="system-label label-three">deliver</div>
            <div className="system-core"><span>AI</span><small>applied</small></div>
          </div>
        </section>

        <section className="outcome-transition" aria-label="Streetbeat principle">
          <p>AI is useful only when it changes a measurable outcome.</p>
        </section>

        <section className="finance-section dark-section" id="finance">
          <div className="section-heading finance-heading">
            <div>
              <div className="section-kicker light">Finance as proof</div>
              <h2>We started where shortcuts are not an option.</h2>
            </div>
            <p>
              Building in finance—one of the world&apos;s most complex and regulated
              sectors—required accuracy, security, auditability and accountable
              human control from day one. That discipline enabled us to build
              purpose-built solutions for both B2B and B2C.
            </p>
          </div>

          <div className="finance-products">
            <article className="finance-card">
              <div className="product-top"><span>B2B</span><span>01</span></div>
              <h3>AI for Financial Institutions</h3>
              <p>
                Bring AI into your organization&apos;s workflows, from advisory and
                investment management to client experience and operations.
                Configurable infrastructure connects to your data and systems,
                with governance, human review and auditability built in.
              </p>
              <a className="button button-light" href="https://streetbeat.com/ai-for-banks/">
                Explore Financial Institutions <span>↗</span>
              </a>
            </article>
            <article className="finance-card finance-card-accent">
              <div className="product-top"><span>B2C</span><span>02</span></div>
              <h3>Streetbeat App</h3>
              <p>
                AI-powered investing in your pocket. Our consumer app, live on
                iOS and Android and built on the same AI foundation we offer
                institutions.
              </p>
              <a className="button button-light" href="https://streetbeat.com/streetbeat-app/">
                Discover the Streetbeat App <span>↗</span>
              </a>
            </article>
          </div>

          <div className="press-strip">
            <span>As seen in</span>
            <div><b>Forbes</b><b>VentureBeat</b><b>Business Insider</b><b>Forbes Italia</b><b>Benzinga</b><b>Nasdaq TradeTalks</b></div>
          </div>
        </section>

        <section className="method-section section-pad" id="method">
          <div className="section-heading">
            <div>
              <div className="section-kicker">How we work</div>
              <h2>
                We start with the outcome.<br />
                Then we integrate AI into the workflows that drive it.
              </h2>
            </div>
            <p>
              We identify the decisions, tasks and information flows behind the
              result you want to improve. Then we connect AI to your data and
              systems, working with domain experts and keeping people in control.
            </p>
          </div>
          <div className="method-grid">
            {method.map(([number, title, copy]) => (
              <article key={number}>
                <span>{number}</span><h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="applications-section section-pad" id="applications">
          <div className="section-kicker">Beyond finance</div>
          <div className="applications-intro">
            <h2>We are selecting the organizations we will build the next applications with.</h2>
            <p>
              We are focusing on three areas where AI can improve speed,
              resource use and risk—starting from a specific workflow and a
              measurable outcome.
            </p>
          </div>
          <div className="application-grid">
            {applications.map((item) => (
              <a className="application-card" href={item.href} key={item.title}>
                <span className="application-number">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
                <span className="card-link">Explore the opportunity <b>→</b></span>
              </a>
            ))}
          </div>
          <div className="applications-cta">
            <div>
              <span className="mini-label">A selective starting point</span>
              <h3>Tell us about one workflow where AI could make a measurable difference.</h3>
            </div>
            <a className="button" href="/apply/">Apply to build with us</a>
          </div>
        </section>

        <section className="trust-section dark-section section-pad" id="trust">
          <div className="section-heading">
            <div>
              <div className="section-kicker light">Trust</div>
              <h2>Built to be used.<br />Designed to be checked.</h2>
            </div>
            <p>
              The discipline developed in finance remains part of every system
              we build: security, evidence and accountable human control.
            </p>
          </div>
          <div className="trust-grid">
            {[
              ["01", "SOC 2", "Independent controls and audited operating standards."],
              ["02", "Data & technical security", "Protected data, controlled access and secure deployment choices."],
              ["03", "Human control", "Defined review and escalation where judgment and responsibility matter."],
              ["04", "Auditability", "Decisions, actions and system behavior designed to be examined."],
            ].map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
          <a className="text-link light-link" href="https://streetbeat.com/security-compliance/">
            Explore trust and security <span>↗</span>
          </a>
        </section>

        <section className="company-section section-pad" id="company">
          <div className="section-kicker">About us</div>
          <div className="company-stats">
            <span>Founded in Palo Alto</span>
            <span>European engineering hub</span>
            <span>30+ patent filings</span>
            <span>170+ financial datasets</span>
            <span>$25M from leading investors</span>
          </div>
          <div className="investors">
            <span>Backed by</span>
            <div><b>CDP Venture Capital</b><b>TTV Capital</b><b>3Lines</b><b>P101</b><b>Evolution VC Partners</b><b>AAF Management</b><b>Monte Carlo Capital</b><b>Azimut</b></div>
          </div>
        </section>

        <section className="team-section section-pad" id="team">
          <div className="section-heading team-heading">
            <div>
              <div className="section-kicker">Team</div>
              <h2>The people turning<br />AI into systems.</h2>
            </div>
            <p>
              A distributed team combining AI, engineering, product, operations
              and domain expertise across the United States and Europe.
            </p>
          </div>
          <div className="team-track" aria-label="Streetbeat team">
            {team.map(([name, role, location], index) => (
              <article className="team-card" key={name}>
                <span className="team-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="team-avatar" aria-hidden="true">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                <div><h3>{name}</h3><p>{role}</p><span>{location}</span></div>
              </article>
            ))}
          </div>
          <div className="locations">
            <div><span className="mini-label">Offices</span><p>Palo Alto · Milan · Wrocław</p></div>
            <div><span className="mini-label">Where our team is</span><p>Mexico City · São Paulo · Madrid · Bologna · Lucca · Florence · Zagreb · Sarajevo</p></div>
          </div>
        </section>

        <section className="closing-cta">
          <span className="section-kicker light">What are you building?</span>
          <h2>Start with the work.<br />Build for the outcome.</h2>
          <p>Explore what Streetbeat has already built—or apply to shape what comes next.</p>
          <div className="hero-actions closing-actions">
            <a className="button button-light" href="#finance">See what we built in finance</a>
            <a className="button button-outline-light" href="/apply/">Apply to build with us</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
