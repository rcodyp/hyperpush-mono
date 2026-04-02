# M052: Public Website & Packages Surface Reset — Context Draft

**Gathered:** 2026-04-02
**Status:** Draft — needs dedicated discussion before planning

## Seed From Current Discussion

- Update the landing page to talk about Mesh's actual special features: pipe operator, built-in testing, easy distribution, failover, load balancing, and fault tolerance.
- Make clear that Mesh is a general-purpose language but is especially suited for fault-tolerant distributed systems.
- Remove animated backgrounds from landing-page sections.
- Fix navigation so the Packages link points to `packages.meshlang.dev` instead of `/packages`.
- Keep the packages site as a separate app, but make the overall public surface read like one coherent Mesh story.

## Technical Findings From Investigation

- `mesher/landing/` is still heavily Hyperpush/Solana-branded, including hero copy, feature grids, button text, docs, legal pages, and community/blog surfaces.
- `mesher/landing/components/landing/header.tsx`, `hero.tsx`, and `features.tsx` do not describe Mesh the language at all; they still describe an unrelated product.
- `packages-website/` already exists as its own deployed app and already uses the public packages domain directly.
- Public docs and the packages site are already separate surfaces, but they do not yet feel like parts of one evaluator-facing Mesh story.

## Likely Dependencies

- Depends on M050 clarifying the public docs story first.
- Likely coordinates with M053 because packages verification/deploy evidence affects how public surfaces are claimed.

## Scope Seed

### Likely In Scope
- landing-page copy and feature reset around Mesh itself
- packages navigation and cross-link cleanup
- removal of visual treatments that work against the new language story
- coherence work across landing, docs entrypoints, and packages discovery

### Likely Out of Scope
- the deeper deploy proof itself
- Mesher backend modernization
- frontend-aware load-balancing adapters

## Questions For Dedicated Discussion

- How much of the current `mesher/landing` tree should be rewritten versus replaced outright?
- Should the landing page stay minimal and language-first, or also preview Mesher/packages/docs explicitly?
- Which concrete public claims need direct verification before they can appear on the landing page?
- How should the packages site be introduced from the landing surface without making the language story feel fragmented?
