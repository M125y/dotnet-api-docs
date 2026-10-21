---
name: tt4b-creative-engine
version: 0.3.1
description: >
  Read-only creative decision engine for TikTok advertisers: turns "what should we run
  next" from guesswork into an evidence chain. Mode A (accounts WITH delivery history —
  Experienced & Scaling): ranks winning ads from real performance reports, infers the
  winning structure from retention curves and ad copy (confidence-tagged hypotheses),
  verifies every product claim against the advertiser's own catalog and past ad-rejection
  records, and delivers a claim-safe replication brief plus an A/B test plan. It
  replicates the winning ad's STRUCTURE and strategy — not the video itself (no cloning,
  no generation). Mode B (brand-new accounts — New to TikTok Ads / Emerging Market):
  builds a cold-start brief from live market data (search volume, CPC ranges, audience
  size, interest insights) and delivers a schema-validated, dry-run campaign starter
  packet. Triggers: creative brief, winning ad analysis, replicate winning creative, why
  did this ad work, creative fatigue what next, cold start, new account first campaign,
  hook matrix, A/B test plan, claim check, ad rejection risk. ❌ Do NOT use for: video
  generation or editing (not a generation tool); executing campaigns — this skill does
  NOT create/modify campaigns, for execution use tt4b-launch-* skills; pause/budget
  changes or raw report pulls (→ tt4b-manage-campaign / tt4b-optimize-budget /
  tt4b-get-performance-report).
---

# tt4b-creative-engine — Creative Decision Engine (read-only)

Turn the advertiser's next creative decision into an evidence chain: **diagnose what
wins → verify what's safe to claim → deliver what to shoot and how to test it.**
This skill never creates, updates, or deletes anything. Execution belongs to the
official `tt4b-launch-*` skills; this skill is the decision layer in front of them.

## Hard invariants (one-strike — violating any of these is a critical failure)

1. **Never call any write/spend tool.** No `*_create` / `*_update` / `*_delete` /
   `*_upload` / `*_bind` / `*_transfer` / `*_confirm` anywhere in any flow. There is
   no `[WRITE_ACTION:]` marker anywhere in this skill — because it never writes.
   If the user asks to execute ("just create it for me"), deliver the read-only
   output, then route out: "to launch this, use `tt4b-launch-traffic-campaign`
   (or the matching launch skill) with the packet below." Never execute it yourself.
2. **Never fabricate.** Every concrete number in the output comes from a tool
   response, or is explicitly labeled `projection` (derived arithmetic) or
   `ILLUSTRATIVE` (made-up example). A data source that returned an empty array
   must never be cited as having returned items.
3. **Honest emptiness.** Empty results are reported as empty ("no rejection history
   found"), never papered over.

## MCP backend (tt-ads-mcp-flat)

This skill targets the `tt-ads-mcp-flat` server: tools are called directly by their
flat names (e.g. `report_integrated_get`). Complete tool map for this skill
(single source of truth — every stage below points back here):

| Purpose | Tool |
|---|---|
| S0 advertiser discovery | `bc_get` → `auth_advertiser_get` (fallback) |
| S0 account health | `advertiser_info_get`, `identity_get` (ALWAYS with `identity_type` filter) |
| S0 data-ladder probe | `campaign_get`, `report_integrated_get` (campaign-level LIFETIME) |
| A1 winner ranking | `report_integrated_get` (AD level, retention metrics), async report task trio for long ranges |
| A2 structure inference | `file_video_ad_info_get` / `file_video_ad_search` (copy + cover), `report_video_performance_get` |
| A3 claim verification | `catalog_get`, `catalog_product_get`, `ad_review_info_get` (regular ads) / `smart_plus_ad_review_info_get` (Smart+ ads — branch by ad type first) |
| B1 market demand | `tool_search_keyword_idea_get`, `tool_search_keyword_recommend` |
| B2 audience + reach | `audience_insight_info_get`, `ad_audience_size_estimate` |
| B3 targeting package | `tool_interest_keyword_recommend_search`, `tool_hashtag_recommend_search` |
| B4 creative inputs | `creative_cta_recommend_get`, `file_video_suggestcover_get` |
| B5 packet schema check | the declared input schema of `campaign_create` / `adgroup_create` (read schema only — NEVER call them) |

**Disabled tools (verified dead/misleading on cold accounts — do not call):**
`tool_bid_recommend` (returns a constant USD 1 — use B1 CPC ranges as the bid anchor
instead) · `report_ad_benchmark_get` (requires own ads ≥1,000 impressions) ·
`tool_targeting_category_recommend_get` (returns irrelevant categories without app
context) · `spark_ad_recommend_get` (requires TCM authorization).

## S0 — Preflight & declarative routing (always first)

```
S0.1 discover advertiser
     user already specified/pinned an advertiser? ──yes→ use it, skip discovery
     bc_get → has BC? ──yes→ pick BC + advertiser via assets
        │ no
        └→ auth_advertiser_get → has advertiser? ──yes→ continue (BC absence is NOT a stop)
              │ no
              └→ E101_NO_ACCESSIBLE_ADVERTISER → clean stop + authorization guidance
S0.2 account health   advertiser_info_get
     status ≠ STATUS_ENABLE → E107_ACCOUNT_RESTRICTED:
       disclose reason + appeal path; READ-ONLY FLOW CONTINUES (only the future
       launch hand-off is marked blocked)
     identity_get with identity_type=TT_USER (fallback: identity_type=CUSTOMIZED_USER if
       empty) — NEVER call identity_get unfiltered: on large accounts the unfiltered
       call returns tens of thousands of identities and ignores page_size
     no usable identity → note "launch hand-off will require an identity"
S0.3 data ladder      campaign_get count + campaign-level LIFETIME report rows + catalog presence
S0.4 declare route (NO confirmation wait):
     history present → "Entering Mode A (winner replication). Basis: N campaigns,
       M report rows. Say so to force Mode B." → proceed immediately
     zero history    → "Entering Mode B (cold start). Basis: campaign=0, report
       rows=0, no catalog. Say so to force Mode A." → proceed immediately
```

## Error codes

| Code | Scenario | Behavior |
|---|---|---|
| E101_NO_ACCESSIBLE_ADVERTISER | Neither BC nor authorized advertiser reachable | Clean stop + authorization guidance. Must NOT fire when BC=0 but an advertiser is enumerable |
| E103_NO_AD_DATA | Mode A prerequisites missing | Not a failure — declare switch to Mode B + data milestones to unlock Mode A |
| E104_PARTIAL_API_FAIL | One data API fails | Mark that item "unavailable" + surface the raw platform code/message; continue; still deliver |
| E107_ACCOUNT_RESTRICTED | status ≠ STATUS_ENABLE | Read-only continues; launch hand-off marked blocked; appeal path shown |
| E201_EMPTY_RESULT | code 0 + empty array (common) | Retry at most ONCE per tool with the fixed strategy: keyword → swap seed term; hashtag → split multi-word seeds + force OR; audience insight → drop filters; all other tools → no retry, disclose and degrade |

## Mode A — Winner Replication (delivery history present)

A1 rank winners → A2 infer winning structure (confidence-tagged; disclose "the API
exposes no transcript/captions — inference uses retention curve + ad copy + cover,
cover degradable") → A3 claim ledger (safe/verify/blocked + confidence) with
**rejection-history cross-check** + Do-Not-Say list → A4 variants + A/B test plan
(each arm validates one A2 hypothesis; expected impact projected from the winner's
own real baseline using the **MDE discipline** — thresholds derived from the real
baseline and the planned sample size (MDE ≈ 2.8 × √(2·p·(1−p)/n)), never an
assumed uplift number; **variants ordered by hypothesis confidence × detectable
effect — the output names which arm to run FIRST and why**). RYZE-gated metrics (ROAS/CPA) unavailable →
degrade ranking to CTR / conversion_rate / hook-rate (= video_watched_2s /
impressions) and disclose. (Metric-name trap: the valid report metric is
`conversion_rate`, not `cvr` — see references/mode-a-replication.md.)

**A2 signal attribution (mandatory):** when the per-second curve's `material_id`
cannot be confirmed as the A1 winner's own video, demote the curve to a
SUPPORTING signal (never the primary basis), cap any hypothesis that relies on
it at `medium` confidence, and state the attribution gap in `Known limits`
("per-second curve material not confirmed as the winner's video"). The gap is
managed, not merely admitted.

**A1 two-pass window policy (mandatory):** rank on the LIFETIME pass, then check
the last-30-day pass: if the lifetime winner shows near-zero recent impressions,
flag it "likely fatigued" and surface the top 30-day ad alongside — disclose
both, never silently pick either as "the winner".

**A1 low-volume disclosure (mandatory):** if the top-ranked winner has fewer than
1,000 lifetime impressions, the ranking output MUST carry an explicit low-data
confidence warning, and anomalous metrics (e.g. CTR > 100%, common in test
environments) MUST be flagged as diagnostic noise — never presented as wins.
A2-A4 may proceed with confidence downgraded accordingly — and the output MUST
include the concrete unblock action: recommend a short data-accumulation run
(e.g. a small traffic campaign via `tt4b-launch-traffic-campaign`) until the top
ad clears ~1,000 impressions, then re-rank.

**A3 review-info branching (mandatory):** determine the ad type before requesting
review info — partition by the campaign's `campaign_automation_type` (an ad
appearing in `ad_get` does NOT guarantee the regular endpoint accepts it: ads
under Smart+ campaigns are still rejected). Regular ads → `ad_review_info_get`;
Upgraded Smart+ ads → `smart_plus_ad_review_info_get`; never mix types in one
batch. A `40002 "This API does not support Upgraded Smart Plus ads"` response
means the wrong branch/batch: re-partition and continue. If BOTH branches reject
the sampled ads, disclose "rejection history not retrievable for the sampled ads"
and degrade the cross-check to account-level `rejection_reason`
(advertiser_info_get) + catalog product-level `audit.suggestion` + policy
knowledge — never abort A3, never fabricate.

Details: [references/mode-a-replication.md](references/mode-a-replication.md) ·
[references/claim-safety.md](references/claim-safety.md)

## Mode B — Cold-Start Engine (zero history)

B1 market demand (keyword volume/competition/CPC ranges/trends) → B2 audience
profile + reach estimate → B3 targeting package (interest/hashtag keyword IDs,
ready to paste into an adgroup draft) → B4 creative brief (hook matrix ranked by
search volume × growth × competition; claims all marked merchant-asserted +
policy Do-Not-Say) → B5 campaign starter packet.

**B4 copy quality floor (mandatory):** where `creative_smart_text_get` is locked
(no adgroup yet), LLM-drafted copy must meet the floor — at least 3 hooks per
chosen angle, language matched to the target market, every line passed through
the claim ledger filter before output, and each labeled "LLM-drafted (smart_text
unlocks after the first ad group exists)".

Details: [references/mode-b-coldstart.md](references/mode-b-coldstart.md)

## Dry-run campaign starter packet (the closing deliverable)

- Drafts campaign + adgroup + creative payloads field by field; every field is
  tagged `source: tool returned / user provided / derived / default / unavailable`
  and validated against the declared input schema of the matching create tool
  (`schema-validated ✓/✗` column). The create tools are never called.
- The packet preview carries the `[DRY_RUN_PREVIEW]` marker and never claims a
  campaign was created.
- Closing line: "Ready to launch? Hand this payload to
  `tt4b-launch-traffic-campaign` (or the matching launch skill)."
- Cost/reach projection: daily budget ÷ real CPC range → daily clicks range;
  audience size → reach ceiling. Labeled projection, never a guarantee.

Details: [references/campaign-starter-packet.md](references/campaign-starter-packet.md)

## Output discipline (every section, every mode)

Executive card first (conclusion → evidence → next step), then per-stage detail.
Each section ends with four fixed disclosure lines: `Data source` / `Confidence` /
`Known limits` / `If degraded, why`.

**Compactness rule:** the executive card is at most 12 lines; per-stage detail
sits under clear headers AFTER the card, never interleaved; tables carry only
decision-relevant columns (move raw extras to an appendix section). The reader
should be able to act from the card alone.

## Worked examples

[references/examples/01-mode-a-happy-path.md](references/examples/01-mode-a-happy-path.md) ·
[references/examples/02-mode-b-coldstart.md](references/examples/02-mode-b-coldstart.md) ·
[references/examples/03-degraded-and-recovery.md](references/examples/03-degraded-and-recovery.md)

## Eval suite (development artifact)

Regression evals for this skill live in [evals/README.md](evals/README.md)
(correctness contract) and [evals/cases.jsonl](evals/cases.jsonl). All eval data
uses ILLUSTRATIVE `ACME-DEMO` tokens — no real account data.
