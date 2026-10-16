# Old Friend Cricket Academy — Implementation Plan

## Scope

Build the complete Old Friend Cricket Academy website described in the supplied brief: a premium, responsive cricket-academy public experience with animated hero artwork, WhatsApp-led registration, privacy/cookie controls, and a secure owner dashboard at `/o` backed by persistent storage.

## Design direction

**Style options considered**
- **Cricket Atelier** — 0.06: editorial sports-art direction with ivory paper, black ink, and disciplined gold accents.
- **Floodlight Circuit** — 0.05: night-match energy with charcoal fields, warm floodlight particles, and technical UI details.
- **Bishan Khedi Field Notes** — 0.04: locally grounded, tactile field-note visuals with documentary restraint.

**Chosen direction: Cricket Atelier**

- **Design Movement:** Contemporary editorial sports identity with the precision of a cricket scorebook and the contrast of black ink on warm ivory.
- **Core Principles:** confident hierarchy; honest, useful information; black-and-white cricket as the hero; motion used to signal practice and airflow rather than decoration.
- **Color Philosophy:** charcoal and warm white create trust and clarity; a single muted golden-yellow acts like a cricket ball under sunlight, reserved for action, focus, and momentum.
- **Layout Paradigm:** asymmetric editorial composition: a wide hero split between typographic copy and circular illustrated artwork, followed by offset section markers and compact information bands rather than repetitive card grids.
- **Signature Elements:** circular batsman composition; thin score-line dividers; small uppercase label system with warm-gold highlights.
- **Interaction Philosophy:** actions feel like a coach's clear instruction: direct labels, instant feedback, calm forms, and no misleading success states.
- **Animation:** canvas particles drift horizontally and diagonally like air moving across a ground; hero artwork stays legible; CSS micro-motion is restrained; all nonessential motion honors `prefers-reduced-motion` and pauses when hidden.
- **Typography System:** `Space Grotesk` for display/headlines and `DM Sans` for body/UI, with tracked uppercase metadata labels. If remote font loading is unavailable, system fallbacks preserve the hierarchy.
- **Brand Essence:** focused cricket training for girls and boys aged 8–21 in Bhopal, made approachable through a professional but welcoming digital front door. Personality: **focused, encouraging, grounded**.
- **Brand Voice:** concise, practical, confidence-building. Example lines: “Train with passion. Play with purpose.” / “Bring your game. We’ll build the next layer.”
- **Wordmark & Logo:** a compact monogram using two offset cricket-stitch arcs around an “OF” mark, paired with a two-line wordmark.
- **Signature Brand Color:** `#E5B84B`, a muted leather-ball gold used sparingly for focus and action.

## Product architecture

- **Frontend:** React + TypeScript + Wouter + Tailwind v4; modular section components in `client/src/components` and page-level routes in `client/src/pages`.
- **Backend:** Express + tRPC for public settings and owner operations. Public routes are read-only; owner mutations are independently protected by a server-validated owner session.
- **Persistence:** Drizzle/MySQL tables for published settings, draft JSON, owner credentials/session records, and audit events. Public registration details are not persisted; the completed message is sent to WhatsApp.
- **Owner authentication:** server-side password hashing with Node `crypto.scrypt`, a random session token stored hashed in the database, an `httpOnly` `SameSite=None; Secure` cookie named `oldfriend_owner_session`, rate-limited login attempts, mandatory password change when the seeded initial account is used, and protected owner tRPC procedures.
- **Configuration model:** one JSON settings document contains academy content, fees, form controls, design controls, policy text, and summer mode. Separate `draft` and `published` records make preview/save/publish semantics explicit.
- **Hero animation:** a dedicated `ParticleField` canvas using `requestAnimationFrame`, adaptive particle counts, page-visibility pause, pointer-events disabled, and reduced-motion fallback. The batsman is an inline SVG illustration so the key cricket forms remain crisp at every size.
- **WhatsApp workflow:** one shared destination normalizer and message builder used by hero contact, floating contact, and registration form; current saved fees and form values are always reflected.
- **Privacy/cookies:** local consent state for essential/analytics/marketing; optional tracking is not installed, so the settings UI truthfully states that optional tracking is inactive.
- **SEO and route manifest:** real public anchor/section routes plus `/o`, `/privacy`, `/cookies`, and `public/manus-routes.json` kept synchronized with the router.

## Project structure

- `client/src/App.tsx` — route map and providers.
- `client/src/pages/Home.tsx` — public landing page composition and local visitor state.
- `client/src/pages/Owner.tsx` — owner login/setup/dashboard UI.
- `client/src/components/academy/*` — particle canvas, batsman artwork, registration modal, cookie consent, nav/footer and public sections.
- `client/src/lib/academy.ts` — defaults, formatting, WhatsApp message construction, local preference helpers.
- `client/src/index.css` — theme tokens, responsive layout, editorial styling and animations.
- `server/academy.ts` — persistence queries, owner session verification, password hashing and settings helpers.
- `server/routers.ts` — public settings, owner login/logout, protected draft/publish/settings procedures.
- `drizzle/schema.ts` + migration — persistent domain tables.
- `public/manus-routes.json` — complete page route manifest.
- `app.config.ts` — project metadata/logo URL when a durable asset URL is available.

## Build workflow

1. Replace starter demo UI with the public academy shell and inline artwork.
2. Add the persistent schema, seed-safe settings defaults, and owner authentication/session helpers.
3. Add tRPC procedures and connect public/admin views to saved settings.
4. Add route manifest and responsive/accessibility states.
5. Run migrations, `pnpm check`, tests, and production build; start Preview and verify the health/route-manifest endpoints.
6. Inspect the running interface and fix confirmed issues, then commit and checkpoint the working version. Publish only if the project’s configured publication state and platform flow allow it; otherwise deliver the Preview URL and state the blocker.

## Material constraints and assumptions

- The brief supplies no real logo or photos, so the primary visual is an authored inline SVG rather than a stock photograph.
- No payment collection, analytics, invented schedules, testimonials, qualifications, statistics, or affiliations are added.
- The supplied `greatcricket` password is a server-side first-setup seed only; the UI forces replacement before normal dashboard use.
- If the managed database is unavailable during local development, the public page still renders with defaults and owner mutations return a clear persistence error rather than pretending data was saved.
