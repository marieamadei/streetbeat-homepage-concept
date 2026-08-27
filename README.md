# Streetbeat homepage concept

Independent working concept for a broader Streetbeat website direction.

This is **not an official Streetbeat website** and is not connected to the live
website, its repository, infrastructure or forms. It exists to make the
proposed information architecture, narrative and user journeys visible and
reviewable.

## Strategic structure

The concept positions Streetbeat as an applied AI company serving
organizations, while using finance as proof of its ability to operate in a
complex and regulated environment.

Homepage sequence:

1. Organizational outcomes and applied AI position
2. Finance as proof: B2B and B2C
3. Streetbeat's five-step building method
4. Three future application areas
5. Trust and accountable human control
6. Company proof, investors, team and locations
7. Two clear routes: existing finance solutions or an application to build

The prototype also includes individual pages for:

- Nonprofits & NGOs
- Biotech & Life Sciences
- Consumer Goods
- Apply to build with us

The application flow is intentionally non-operational and does not transmit or
store information.

## Local preview

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm run dev
```

## Validation and GitHub Pages export

```bash
pnpm run build
node --test tests/rendered-html.test.mjs
pnpm run export:pages
```

The generated public preview is written to `docs/`, which is the folder served
by GitHub Pages. Source changes belong in `app/`; `docs/` should be regenerated
after each approved update.
