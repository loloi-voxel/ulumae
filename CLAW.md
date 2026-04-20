# CLAW.md

This file provides guidance to Claw Code (clawcode.dev) when working with code in this repository.

## Detected stack
- Languages: TypeScript.
- Frameworks/tooling markers: Next.js, React.

## Verification
- Run the JavaScript/TypeScript checks from `package.json` before shipping changes (`npm test`, `npm run lint`, `npm run build`, or the repo equivalent).

## Framework notes
- Next.js detected: preserve routing/data-fetching conventions and verify production builds after changing app structure.

## Working agreement
- Prefer small, reviewable changes and keep generated bootstrap files aligned with actual repo workflows.
- Keep shared defaults in `.claw.json`; reserve `.claw/settings.local.json` for machine-local overrides.
- Do not overwrite existing `CLAW.md` content automatically; update it intentionally when repo workflows change.
