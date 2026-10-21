# 01 — Mode A happy path (rich account, healthy data, no degradation)

> ILLUSTRATIVE EXAMPLE — all data synthetic (ACME-DEMO tokens). Not real account data.

**User:** Our top ad is wearing out. What should we shoot next, and how do we test it?

**Skill:** *(S0 preflight — declarative, no confirmation wait)*
- `bc_get` → 1 BC (`ACME-DEMO-BC-01`); advertiser `ACME-DEMO-002` selected via assets
- `advertiser_info_get` (advertiser_id=ACME-DEMO-002) → `status: STATUS_ENABLE`
- `identity_get` (identity_type=TT_USER) → 1 usable identity `ACME-DEMO-IDT-01` (never called unfiltered)
- `campaign_get` → 12 campaigns · `report_integrated_get` (campaign level, LIFETIME) → 12 rows, spend > 0 · `catalog_get` → `ACME-DEMO-CAT-01` present

> Entering **Mode A (winner replication)**. Basis: 12 campaigns, 12 lifetime report rows, catalog connected. Say so to force Mode B. *(proceeds immediately — no approval wait)*

*(A1 — two report passes, AD level)*
- `report_integrated_get` (data_level=AUCTION_AD, dimensions=[ad_id], metrics incl. purchase_roas, cost_per_conversion, video_watched_2s…p100; LIFETIME) → 9 ad rows
- `report_integrated_get` (same params, last 30 days) → lifetime #1 still delivering → no fatigue flag

*(A2 — structure signals for the #1 winner)*
- `report_video_performance_get` (report_type=VIDEO, material_ids=[ACME-DEMO-VID-101]) → per-second retention curve
- `file_video_ad_info_get` (video_ids=[ACME-DEMO-VID-101]) → ad copy + cover URL; ONE multimodal cover read

*(A3 — claim verification; ad type from A1 context = regular, so regular branch)*
- `catalog_product_get` (catalog_id=ACME-DEMO-CAT-01, product_ids=[ACME-DEMO-SKU-001]) → price 24.99, availability IN_STOCK
- `ad_review_info_get` (ad_ids = winner set + recent ads) → 1 historical rejection found

**Skill reply (executive card first, then per-stage detail):**

---
**EXECUTIVE CARD** [ILLUSTRATIVE]
- **Conclusion:** Replicate the *structure* of `ACME-DEMO-AD-101` (ROAS 3.4, hook-rate 41.2% derived) — not the video itself. Strongest lever: the problem-first opening hook (confidence high).
- **Evidence:** 9 ads ranked from real lifetime reports → 3 confidence-tagged structure hypotheses → claim ledger 4 rows (1 **blocked** by this account's own rejection history).
- **Next step:** Shoot the 3 variants below; run the 14-day A/B plan; hand the arms to `tt4b-launch-traffic-campaign`.
---

## A1 — Winner ranking (LIFETIME pass, ranked by purchase_roas) [ILLUSTRATIVE]

| # | Ad | Imps | CTR | CVR | ROAS | CPA | Hook-rate (derived) |
|---|---|---|---|---|---|---|---|
| 1 | ACME-DEMO-AD-101 | 48,200 | 2.1% | 3.8% | 3.4 | USD 8.20 | 41.2% |
| 2 | ACME-DEMO-AD-102 | 31,500 | 1.6% | 2.9% | 2.1 | USD 11.70 | 33.0% |
| 3 | ACME-DEMO-AD-103 | 12,900 | 1.1% | 1.5% | 1.2 | USD 19.40 | 27.6% |

hook-rate = `video_watched_2s / impressions` (derived; #1: 19,858 / 48,200 = 41.2%). Top winner has
48,200 lifetime impressions (≥ 1,000) — the low-data warning does NOT apply. ROAS/CPA returned
non-null — no RYZE degradation; ranking keys are ROAS → CPA → CVR → CTR as specified.

Data source:       report_integrated_get (AUCTION_AD level; LIFETIME + last-30-days passes)
Confidence:        high — ranking keys all tool-returned at healthy volume
Known limits:      spend is exposure context only, never a ranking key
If degraded, why:  not degraded

## A2 — Structure hypotheses · ACME-DEMO-AD-101 [ILLUSTRATIVE]

"the API exposes no transcript/captions/on-screen text — inference uses retention + copy + cover"

| # | Hypothesis (structure element) | Signal evidence | Confidence | Testable variable |
|---|---|---|---|---|
| H1 | Problem-first hook lands in first 2s | hook-rate 41.2% (derived) + copy opens with pain point ("Tangled cables again?") — 2 signals | high | opening hook framing |
| H2 | Price reveal at ~8s causes mid-video drop | per-second curve: −18 pt retention drop at 8s — 1 strong signal | medium | price-reveal timing |
| H3 | Cover promise matches first frame | cover read only — single weak signal | low | cover-to-opening match |

Data source:       report_video_performance_get + file_video_ad_info_get + one cover read
Confidence:        per-row (H1 two independent signals; H2 one strong; H3 one weak)
Known limits:      no transcript/captions exposed by the API — hypotheses are inferred, not decoded
If degraded, why:  not degraded (cover URL reachable on first fetch)

## A3 — Claim ledger + rejection-history cross-check [ILLUSTRATIVE]

| # | Claim | Status | Confidence | Evidence |
|---|---|---|---|---|
| 1 | "Only USD 24.99" | safe | High | catalog_product_get → price = 24.99 USD |
| 2 | "In stock now" | safe | High | catalog_product_get → availability = IN_STOCK |
| 3 | "Charges 2x faster" | verify | Low | merchant-asserted (no structured catalog field) |
| 4 | "#1 charger on TikTok" | blocked | Medium | semantic match to past rejection_reason: "Superlative claim without substantiation" — ad ACME-DEMO-AD-097 (regular ad → `ad_review_info_get` branch) |

Row 4 passes every catalog check — only the rejection-history cross-check catches it. History wins.

DO-NOT-SAY (derived from: account rejection history + platform policy)

| Claim pattern | Why | Safer rewording |
|---|---|---|
| "Best / #1 / world's …" | Rejected on this account: "Superlative claim without substantiation" | "rated 4.8 by 2,300+ buyers [ILLUSTRATIVE]" — only if a source exists |
| Outcome guarantees | policy-derived: outcome guarantees are restricted | "Designed to keep your desk cable-free" |

Data source:       catalog_product_get (ACME-DEMO-CAT-01) + ad_review_info_get (regular-ad branch)
Confidence:        per-row, see ledger Confidence column
Known limits:      spec/cert/compatibility claims not catalog-verifiable; rejection matching is semantic, not exhaustive
If degraded, why:  not degraded

## A4 — Variants + A/B test plan (control = unmodified winner structure) [ILLUSTRATIVE]

| Arm | Validates | Isolated variable (one change only) | Baseline (real, A1) | Expected impact | Success criteria (pre-registered) |
|---|---|---|---|---|---|
| V1 | H1 (high) | problem-first hook → social-proof hook | CTR 2.1% | MDE ≈ +1.1pp at n=2,800 impressions/arm (derived; α=0.05, power 0.8) | CTR ≥ 3.2% AND ≥ control |
| V2 | H2 (medium) | price reveal moved 8s → 3s | CVR 3.8% | MDE ≈ +2.4pp at n=1,000 clicks/arm (derived; CVR denominator = clicks) | CVR ≥ 6.2% AND ≥ control |
| V3 | H3 (low) | cover re-shot to match first frame | hook-rate 41.2% (derived) | MDE ≈ +3.9pp at n=1,250 impressions/arm (derived) | hook-rate ≥ 45.1% AND ≥ control |

High-confidence hypotheses got arms first (H1 → H2 → H3). All else held to winner structure per arm.
Expected impact uses the MDE discipline — every threshold is derived from the real baseline and the
planned n via MDE ≈ 2.8 × √(2·p·(1−p)/n); no uplift number is assumed. Run V1 FIRST (highest
confidence × largest detectable effect at feasible n). Duration: 14 days.
Every variant passed the A3 ledger: claim 4 wording excluded everywhere; claim 3 carries its
merchant-asserted label inline. To run this test, hand the arms to `tt4b-launch-traffic-campaign`
(or the matching launch skill).

Data source:       agent reasoning only (A4 design) over A1/A2/A3 outputs
Confidence:        per-arm, inherits its hypothesis confidence
Known limits:      expected impacts are projections from the winner's own baseline — never guarantees
If degraded, why:  not degraded

**User:** Great — just create the test campaign for me.

**Skill:** *(no tool calls — write tools are never invoked, even on explicit instruction)*

This skill never creates campaigns — it is the decision layer. Your packet below is launch-ready.
To execute it, use `tt4b-launch-traffic-campaign` (or the matching launch skill) and hand it this payload.

[DRY_RUN_PREVIEW] Campaign starter packet — V1 arm (condensed) [ILLUSTRATIVE]

| # | Field | Value | Source | Schema-validated |
|---|---|---|---|---|
| C1 | objective_type | TRAFFIC | default | ✓ |
| C2 | campaign_name | acme-charger-US-20260615-traffic | derived | ✓ |
| G1 | campaign_id | — (assigned by campaign_create at launch) | unavailable | ✗ missing required: campaign_id |
| K1 | hook | social-proof opening (V1, validates H1) | derived | n/a (creative) |
| K2 | identity | ACME-DEMO-IDT-01 | tool returned | n/a (creative) |

No campaign has been created. This is a dry-run draft.

Ready to launch? Hand this payload to `tt4b-launch-traffic-campaign` (or the matching launch skill).

Data source:       S0/A1–A4 tool calls above + user-provided test intent
Confidence:        high — fields trace to this run's tool returns or documented defaults
Known limits:      campaign_id only exists after launch-time creation; ✗ row is expected and honest
If degraded, why:  not degraded (declared create-tool schemas readable in this runtime)
