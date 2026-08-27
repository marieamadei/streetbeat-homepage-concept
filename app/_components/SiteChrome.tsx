const solutionLinks = [
  {
    label: "AI for Financial Institutions",
    href: "https://streetbeat.com/ai-for-banks/",
  },
  {
    label: "Streetbeat App",
    href: "https://streetbeat.com/streetbeat-app/",
  },
];

const applicationLinks = [
  { label: "Nonprofits & NGOs", href: "/nonprofits-and-ngos/" },
  { label: "Biotech & Life Sciences", href: "/biotech-life-sciences/" },
  { label: "Consumer Goods", href: "/consumer-goods/" },
];

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Streetbeat concept homepage">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>Streetbeat</span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <>
      <div className="concept-notice">
        Independent working concept · not an official Streetbeat website
      </div>
      <header className="site-header">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <details className="nav-menu">
            <summary>Solutions</summary>
            <div className="nav-panel">
              <span className="nav-panel-label">Built in finance</span>
              {solutionLinks.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}<span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </details>
          <details className="nav-menu">
            <summary>Applications</summary>
            <div className="nav-panel">
              <span className="nav-panel-label">Where we are building next</span>
              {applicationLinks.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}<span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </details>
          <a href="/#method">How we work</a>
          <a href="/#trust">Trust</a>
          <a href="/#company">Company</a>
        </nav>
        <a className="button button-small" href="/apply/">
          Apply
        </a>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Brand />
          <p>
            Applied AI built around real workflows, measurable outcomes and
            accountable people.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <h3>Solutions</h3>
            {solutionLinks.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </div>
          <div>
            <h3>Applications</h3>
            {applicationLinks.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </div>
          <div>
            <h3>Company</h3>
            <a href="/#company">About us</a>
            <a href="/#team">Team</a>
            <a href="https://streetbeat.com/careers/">Careers</a>
          </div>
          <div>
            <h3>Trust</h3>
            <a href="https://streetbeat.com/security-compliance/">Security</a>
            <a href="https://streetbeat.com/certifications/">Certifications</a>
            <a href="https://streetbeat.com/data-protection/">Data protection</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>Working concept for discussion only · August 2026</span>
        <div>
          <a href="https://streetbeat.com/privacy-notice/">Privacy</a>
          <a href="https://streetbeat.com/terms-of-use/">Terms</a>
          <a href="https://streetbeat.com/disclosure-library/">Disclosures</a>
        </div>
      </div>
    </footer>
  );
}
