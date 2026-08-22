# Upstream Template Taxonomy Scan — 2026-08-22

**Remote:** `upstream` = KingLeoJr/awesome-vibe-coding-prompt-templates (`upstream/main`)
**Scope:** read-only intelligence harvest. No upstream assets merged, checked out, or imported into the warehouse.

---

## 1. Blueprint Inventory

`git ls-tree -r upstream/main --name-only | grep blueprint.json.template` yields **33 blueprint files** (not the 46 entries claimed in our brief — the upstream count may include non-blueprint template sets or the claim is stale):

| | | | |
|---|---|---|---|
| ai-finance-platform | ai-healthcare-platform | ar-education-platform | blockchain-supply-chain |
| cooking-class-platform | coupon-aggregator | defi-platform | directory-website |
| disaster-preparedness | elder-care-platform | ethical-consumerism | event-management |
| fitness-tracking | handmade-marketplace | home-energy-management | home-gardening |
| home-maintenance | iot-smart-home | language-learning | local-services-directory |
| mental-health-platform | mental-wellness | online-fitness-coaching | personal-development |
| pet-care-platform | portfolio-website | seo-utility | sustainability-platform |
| travel-planning | video-streaming | virtual-interior-design | vr-fitness |
| vr-travel | | | |

## 2. Blueprint Schema (representative reads)

Read in full: `ai-finance-platform` (AIEnhanced), `handmade-marketplace` (Marketplace), `directory-website` (DirectoryListing). Partial reads (mustache placeholders break strict JSON parse): `seo-utility`, `vr-travel`.

All blueprints share a uniform **18-key schema**:

| Field | Shape | Notes |
|---|---|---|
| `blueprint_id` | UUID (or slug-derived id, e.g. `seo-utility-0001`) | |
| `slug` | kebab-case, matches directory | |
| `name`, `tagline` | strings | marketing face |
| `category` | `Platform` / `Template` / `Utility` | |
| `archetype` | single taxonomy value | see §3 |
| `builder_prompt_source` | path to `prompts/<slug>.md` | the vibe-coding prompt |
| `tech_stack[]` | `{layer, technology, version_hint, purpose}` | frontend/backend/db/auth/state/ui/animation/ai_ml/payments/realtime/devops layers |
| `features[]` | `{description, priority: core\|enhanced\|advanced, order_index}` | 20–30 per blueprint |
| `sections[]` | `{name, component_path, layout_type, is_visible, order_index}` | page/section composition |
| `components[]` | `{name, path, props, mixins}` | typed prop signatures; shared `_shared/` mixins (Footer, ThemeToggle) |
| `data_models[]` | `{name, fields: [{name, type, required}]}` | typed enums (`enum(income|expense)`) |
| `integrations[]` | `{service, purpose, config_params}` | Stripe, Plaid, OAuth, OpenAI… |
| `nfrs[]` | `{type, requirement}` | Security, Performance, Responsive, Accessibility, i18n, SEO, Testing, Offline |
| `design_tokens[]` | `{token_type: color\|font\|radius\|mode, token_name, token_value}` | dark-mode variants included |
| `deployment[]` | `{platform, config}` | Vercel/Railway etc. |
| `template_files[]` | `{path, source, syntax: mustache, mixins}` | file manifest for scaffold generation |
| `extra_config` | free-form app/theme/SEO/contact/social dict | mustache-context values |

## 3. Archetype Taxonomy (all 33 blueprints)

| Archetype | Count | Example slugs |
|---|---|---|
| `PersonalizedVertical` | 13 | fitness-tracking, home-gardening, mental-wellness, travel-planning, pet-care-platform |
| `ImmersiveXR` | 4 | vr-travel, vr-fitness, ar-education-platform, virtual-interior-design |
| `Dashboard` | 4 | home-energy-management, iot-smart-home, blockchain-supply-chain, defi-platform |
| `Marketplace` | 3 | handmade-marketplace, online-fitness-cooking, cooking-class-platform |
| `AIEnhanced` | 2 | ai-finance-platform, ai-healthcare-platform |
| `ContentPlatform` | 2 | video-streaming, mental-health-platform |
| `DirectoryListing` | 2 | directory-website, local-services-directory |
| `ResponsiveWebApp` | 2 | event-management, disaster-preparedness |
| `UtilityChecklist` | 1 | seo-utility |

**9 distinct archetypes total.**

## 4. Gap vs. Our Product-Face Registry

Our `product_faces` (TOOL_REGISTRY.yaml) — current faces:

1. **grantminds** — grant pipeline SaaS, agentic research + template auto-fill (AI-forward)
2. **unified_data_hub** — spreadsheet-killer data consolidation (B2B dashboard-ish backend)
3. **tendly** — gov contract matching, search + alerts (feed/matching)

| Upstream archetype | Our equivalent? | Assessment |
|---|---|---|
| `AIEnhanced` | ~Yes — GrantMinds (agentic AI autofill) | Covered conceptually |
| `Dashboard` | ~Partial — Unified Data Hub (consolidation, not analytics-dashboard UX) | Weak overlap |
| `DirectoryListing` | ~Partial — Tendly is matching/search, not a browsable directory face | No true directory face |
| `PersonalizedVertical` | **No** | Nothing vertical/consumer-personal in our registry |
| `Marketplace` | **No** | No two-sided/multi-vendor face |
| `ContentPlatform` | **No** | No media/content streaming face |
| `ImmersiveXR` | **No** | No AR/VR/3D face |
| `ResponsiveWebApp` | **No** | No generic web-app scaffold face |
| `UtilityChecklist` | **No** | No lightweight single-purpose utility face |

**Upstream archetypes with no equivalent in our registry (7 clear):** `PersonalizedVertical`, `Marketplace`, `ContentPlatform`, `ImmersiveXR`, `ResponsiveWebApp`, `UtilityChecklist`, plus effectively `DirectoryListing` (Tendly lacks a directory/browse face). `Dashboard` is only weakly covered by UDH's consolidation angle.

## 5. Recommendation (no action this run)

Per instructions, **no assets were extracted into the warehouse**. If we later adopt the taxonomy, highest-leverage gaps to evaluate: `DirectoryListing` (natural extension of Tendly's data) and `PersonalizedVertical` (13 of 33 upstream sets — their dominant pattern). `ImmersiveXR` and `Marketplace` are heavy builds with no current substrate pull.

---
*Generated read-only from `upstream/main`; no upstream content was merged or copied into this repo.*
