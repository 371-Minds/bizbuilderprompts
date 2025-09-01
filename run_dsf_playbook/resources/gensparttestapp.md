# Governance Simulator — Mini-DAO Lab

A lightweight, client-side simulator to explore how different DAO governance choices ripple into second- and third-order effects.

## Currently Completed Features
- Rules Editor: voting model, quorum, threshold, vote duration, proposal friction, treasury, agent mix
- Client-side simulation engine (24 months by default)
- Consequence dashboard with ECharts: radar, treasury over time, pass rate, fork pressure
- Event timeline of passes/fails/rage-quits
- Save/Load rulesets via provided Tables API (rulesets table)
- Responsive, modern UI with Tailwind and Inter

## Functional Entry URIs
- `/` (index.html): main simulator UI
- Tables API (relative):
  - `GET tables/rulesets?page&limit&search&sort`
  - `POST tables/rulesets` (body: { name, rules })
  - `GET tables/rulesets/{id}`
  - `PUT/PATCH/DELETE tables/rulesets/{id}`

## Not Yet Implemented
- Scenario presets and shock/attack events library
- Monte Carlo multi-run aggregator and variance views
- Shareable permalink with encoded ruleset
- User-defined KPIs and risk thresholds
- Accessibility pass and keyboard navigation polish

## Recommended Next Steps
1. Add preset scenarios (Growth, Bear, Governance Attack) + quick load buttons
2. Implement Monte Carlo batch runs (e.g., 100 runs) with distribution charts
3. Encode rules in URL for sharable simulations
4. Deeper tooltips with “why this matters” education snippets
5. Add export: PNG charts + JSON of rules/results

## Project Name & Goals
- Name: Governance Simulator — Mini-DAO Lab
- Goal: Make governance trade-offs intuitive and testable before mainnet pain
- Main Features: Rules editor, fast sim engine, consequence visuals, save/load

## Public URLs
- App: index.html (after publish)
- API: relative `tables/*` endpoints provided by the platform

## Data Models
- `rulesets`
  - id (text), name (text), rules (rich_text JSON), tags (array), notes (rich_text)
- `sim_runs`
  - id (text), ruleset_id (text), seed (number), months (number), results (rich_text JSON)

---
To deploy your website and make it live, please go to the Publish tab where you can publish your project with one click. The Publish tab will handle all deployment processes automatically and provide you with the live website URL.
