# x402 purchase endpoint — warehouse path to first revenue

## Goal

Add `GET /warehouse/buy/:id` (HTTP 402 + `X-PAYMENT-REQUIRED` for ready+priced x402 items) and `POST /warehouse/buy/:id` (facilitator-verified settlement → full asset delivery, sales ledger append, Interbeing event) to the REST API on :8003.

## Scope

- New module `src/commerce/purchase.ts`:
  - Offer resolution: 404 (unknown id / no x402 config), 409 (not ready), 402 (valid offer: `X-PAYMENT-REQUIRED` header via `buildX402PaymentRequiredHeader`, `buildStorefrontCard`, payment instructions).
  - Settlement: read `X-PAYMENT` header, verify against an x402 facilitator `/verify` endpoint (v1 contract: `POST {base}/verify` `{paymentPayload, paymentRequirements}` → `{isValid, invalidReason, invalidMessage, payer}` — per x402.org facilitator docs and CDP REST API).
  - Fetch guard: facilitator base URL resolved once at boot from a constant allowlist (`https://x402.org`, `https://api.cdp.coinbase.com/platform/v1/x402`); env override allowed only if host+protocol is in the allowlist; http/https only; never a user-supplied URL.
  - On verified: append `warehouse/sales.jsonl` `{ts, itemId, title, amount, asset, txHash, network}`, POST Interbeing event (127.0.0.1:3710/api/events, type `warehouse.sale`, source `bizbuilderprompts`) fire-and-forget, return full asset markdown.
- Wire routes in `src/api-server.ts` before the generic `/warehouse/:id` match, following existing patterns.
- Unit tests `src/__tests__/commerce.purchase.test.ts`: 402 shape (`decodeX402Header` round-trip), 404/409, ledger append, guarded fetch (mocked fetch), verified-settlement happy path.
- README: Commerce section documenting both endpoints.

## Non-goals

- Creem/Polar fiat flows, facilitator `/settle` call (verification-only gating per brief; settlement happens facilitator-side), refunds, subscription handling, warehouse index schema changes.

## Research notes

- x402 protocol flow: server 402 → client pays → client retries with `X-PAYMENT` header (base64 signed payload) → server verifies via facilitator → serves resource (docs.x402.org core-concepts/facilitator).
- CDP facilitator REST: `POST /v2/x402/verify` `{x402Version, paymentPayload, paymentRequirements}` → `{isValid, invalidReason, invalidMessage, payer}` (api auth); v1 endpoint at `api.cdp.coinbase.com/platform/v1/x402/verify` is the unauthenticated v1 contract matching our v1 header shape (`version: "1.0"`).
- x402.org public facilitator is testnet-only; our items are USDC on Base mainnet → default to the CDP v1 facilitator base, allowlist both.

## Risks

- Facilitator contract drift (v1→v2): mitigated by allowlisted constant + tests mocking fetch; endpoint body shaped per current docs.
- `sales.jsonl` concurrent appends: Bun single-process server, synchronous `appendFileSync` keeps appends atomic per line.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: commerce core

- [x] 1.1 Create src/commerce/purchase.ts — 437c878 (offer resolution 402/404/409, allowlisted facilitator verify with guarded fetch, sales ledger append, Interbeing fire-and-forget event)
- [x] 1.2 Unit tests for purchase module — 437c878 (402 round-trip, 404/409, ledger, guarded fetch, verified settlement)

### Phase 2: REST endpoints

- [x] 2.1 Wire GET/POST /warehouse/buy/:id routes in src/api-server.ts ahead of the generic warehouse/:id matcher; update root endpoint listing

### Phase 3: docs & verification

- [ ] 3.1 README Commerce section
- [ ] 3.2 Full validation gate + live verification (restart service, curl 402 on real ready item, header decode)
