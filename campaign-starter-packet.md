# Dry-run campaign starter packet — assembly spec

The closing deliverable of every run. Mode B emits it as stage B5; Mode A wraps the
chosen variant in the same format when the user asks for a launch-ready next step.
It is a **draft**, never an execution: this skill reads schemas, it never calls
create tools.

## Hard rules (restated from SKILL.md — one-strike)

- NEVER call `campaign_create`, `adgroup_create`, or any `*_create` / `*_update` /
  `*_delete` / `*_upload` / `*_bind` / `*_transfer` / `*_confirm` tool. Reading
  their declared input schemas is the only permitted contact.
- The preview carries the `[DRY_RUN_PREVIEW]` marker. There is no `[WRITE_ACTION:]`
  marker anywhere in this skill — it never writes.
- Never claim a campaign was created. The packet MUST contain the literal sentence:
  "No campaign has been created. This is a dry-run draft."
- Every concrete number is tool-returned, or labeled `projection` / `ILLUSTRATIVE`.

## Fixed assembly procedure

```
P1 collect fields    from B1–B4 outputs (Mode B) or the chosen A4 variant (Mode A)
P2 tag sources       every field gets exactly one source tag (table below)
P3 read schemas      declared input schemas of campaign_create + adgroup_create
                     (flat tool definitions carry schemas — readable, NOT callable)
P4 validate          per-field check against the declared schema → ✓/✗ column
P5 project           cost + reach formulas (below); label every result `projection`
P6 render            [DRY_RUN_PREVIEW] block per the template below
P7 close             launch-blocked annotations (if any) + hand-off line
                     + the four disclosure lines
```

Run P1–P7 in order. A failure in P3 degrades P4 (see Degraded path); it never
blocks P5–P7.

## Packet structure — four blocks

### Block 1 · Campaign draft (defaults = the pixel-free chain)

| Field | Default / origin | Source tag |
|---|---|---|
| `objective_type` | `TRAFFIC` — needs no pixel, no signed conversion events; safest cold-start chain | default |
| `campaign_name` | `{product}-{market}-{YYYYMMDD}-traffic` | derived |
| `budget_mode` | `BUDGET_MODE_INFINITE` (budget governed at adgroup level) | default |
| `advertiser_id` | from S0 discovery | tool returned |

User states a conversion goal + has a working pixel → switch objective and say so.
Otherwise do not silently upgrade past TRAFFIC.

### Block 2 · Adgroup draft

| Field | Default / origin | Source tag |
|---|---|---|
| `campaign_id` | does not exist yet — assigned by `campaign_create` at launch time | unavailable |
| `adgroup_name` | `{campaign_name}-ag1` | derived |
| `promotion_type` | `WEBSITE` | default |
| `optimization_goal` | `CLICK` | default |
| `billing_event` | `CPC` | default |
| `bid_type` / `bid_price` | `BID_TYPE_CUSTOM`; anchor = B1 CPC range midpoint (`tool_bid_recommend` is disabled — never use it) | derived |
| `budget_mode` / `budget` | `BUDGET_MODE_DAY`; amount from the user | user provided |
| `schedule_type` | `SCHEDULE_FROM_NOW` | default |
| `schedule_start_time` | now (account timezone) | derived |
| `location_ids` | resolved from the user's target market during B2 reach estimation | derived |
| `pacing` | `PACING_MODE_SMOOTH` | default |

### Block 3 · Creative draft

| Field | Origin | Source tag |
|---|---|---|
| hook | top-ranked row of the B4 hook matrix (search volume × growth × competition) | derived |
| ad copy | LLM-written from user product info; every claim marked merchant-asserted | derived |
| CTA | `creative_cta_recommend_get` | tool returned |
| cover candidate | `file_video_suggestcover_get` (degradable: no video asset yet → unavailable) | tool returned / unavailable |
| identity | S0 `identity_get` result; none usable → unavailable + launch-blocked annotation | tool returned / unavailable |

### Block 4 · Targeting block

| Field | Origin | Source tag |
|---|---|---|
| `interest_keyword_ids` | B3 `tool_interest_keyword_recommend_search` IDs | tool returned |
| hashtag keyword IDs | B3 `tool_hashtag_recommend_search` IDs (exact payload placement per the declared adgroup_create schema) | tool returned |
| audience size | B2 `ad_audience_size_estimate` | tool returned |

## Source tags (fixed vocabulary — every field carries exactly one)

| Tag | Meaning |
|---|---|
| tool returned | Value came verbatim from a tool response in this run |
| user provided | User stated it (budget, market, product info) |
| derived | Computed from tool-returned or user inputs (state the formula/inputs) |
| default | Documented default from this spec, no data consulted |
| unavailable | Could not be obtained; reason stated; never invented |

## Schema validation (P3–P4 — read, never call)

1. Read the **declared input schema** of `campaign_create` (for Block 1) and
   `adgroup_create` (for Blocks 2 + 4) from the flat tool definitions. On
   `tt-ads-mcp-flat` each tool definition carries its schema — visible to the
   agent without invoking the tool.
2. Per field, check: field name exists in schema · type matches · enum value is
   in the declared enum set · all schema-required fields are present in the draft.
3. Emit a `schema-validated` column: ✓ pass; ✗ fail with a one-line reason
   (`unknown field` / `type mismatch` / `enum invalid` / `missing required: X`).
   ✗ rows stay in the packet — flagged, not hidden.
4. **The create tools are NEVER called.** Schema reading is metadata access only.
   If any step would require invoking a create tool to "test" the payload, stop —
   that is a one-strike violation.

**Degraded path:** runtime does not expose tool input schemas → drop the
`schema-validated` column, keep source tags, and disclose: "schema-validated
column unavailable — this runtime does not expose declared tool schemas; fields
carry source tags only."

## Projections (P5 — label every output `projection`)

| Projection | Formula | Inputs |
|---|---|---|
| Daily clicks range | daily budget ÷ CPC_high … daily budget ÷ CPC_low | budget (user provided) · B1 CPC range (tool returned) |
| Reach ceiling | audience size from B2 | `ad_audience_size_estimate` (tool returned) |

Projections are arithmetic on real inputs — never guarantees, never "expected
performance". Say "projection" inline next to each number.

## [DRY_RUN_PREVIEW] output template (literal)

```
[DRY_RUN_PREVIEW] Campaign starter packet — ILLUSTRATIVE TEMPLATE, not real account data

Advertiser: ACME-DEMO-001 · Mode B · 2026-06-15 (ILLUSTRATIVE)

| # | Field                 | Value                                   | Source        | Schema-validated |
|---|-----------------------|-----------------------------------------|---------------|------------------|
| C1| objective_type        | TRAFFIC                                 | default       | ✓ |
| C2| campaign_name         | acme-charger-US-20260615-traffic        | derived       | ✓ |
| C3| budget_mode           | BUDGET_MODE_INFINITE                    | default       | ✓ |
| G1| campaign_id           | — (assigned by campaign_create at launch)| unavailable  | ✗ missing required: campaign_id |
| G2| promotion_type        | WEBSITE                                 | default       | ✓ |
| G3| optimization_goal     | CLICK                                   | default       | ✓ |
| G4| billing_event         | CPC                                     | default       | ✓ |
| G5| bid_price             | USD 0.65 (B1 CPC midpoint, ILLUSTRATIVE)   | derived       | ✓ |
| G6| budget (daily)        | USD 20.00 (ILLUSTRATIVE)                   | user provided | ✓ |
| G7| schedule              | SCHEDULE_FROM_NOW, 2026-06-15 00:00     | default/derived | ✓ |
| G8| location_ids          | [60000001] (ILLUSTRATIVE)               | derived       | ✓ |
| T1| interest_keyword_ids  | [1001001, 1001002] (ILLUSTRATIVE)       | tool returned | ✓ |
| T2| hashtag keyword IDs   | [2002001] (ILLUSTRATIVE)                | tool returned | ✓ |
| K1| hook                  | "Still untangling cables in 2026?"      | derived       | n/a (creative) |
| K2| CTA                   | SHOP_NOW                                | tool returned | n/a (creative) |
| K3| identity              | ACME-DEMO-IDENTITY (ILLUSTRATIVE)       | tool returned | n/a (creative) |

Projections (arithmetic on real inputs — not guarantees):
  Daily clicks: USD 20 ÷ USD 0.87 ≈ 23 … USD 20 ÷ USD 0.42 ≈ 48 → 23–48 clicks/day
                (projection; CPC range ILLUSTRATIVE)
  Reach ceiling: 18,400,000 reachable users (projection; ILLUSTRATIVE)

No campaign has been created. This is a dry-run draft.

Ready to launch? Hand this payload to `tt4b-launch-traffic-campaign`
(or the matching launch skill).
```

The two closing sentences are mandatory and literal in every packet. The ✗ on
`campaign_id` is expected and honest — a dry-run draft cannot have an ID that only
launch-time creation assigns.

## Launch-blocked annotations (from S0 findings)

When S0 detected any of these, append the matching annotation between the packet
table and the hand-off line. The packet itself is still produced in full —
only the future hand-off is marked blocked.

| S0 finding | Annotation (verbatim shape) |
|---|---|
| E107 (status ≠ STATUS_ENABLE) | `LAUNCH BLOCKED — account restricted ({raw status}). Appeal path: {platform guidance}. This dry-run packet remains valid; launch requires a healthy account.` |
| No usable identity | `LAUNCH BLOCKED — no usable identity found (TT_USER, then CUSTOMIZED_USER both empty). The launch skill will need an identity before creating ads.` |
| Required terms unsigned | `LAUNCH BLOCKED — required terms unsigned ({term name}). Sign in Ads Manager before launch.` |

## Route-out rule (eager-agent redline)

User says "just create it" / "launch it for me" / "run this now" — in any wording,
at any point:

1. REFUSE to execute. Do not call `campaign_create` or any write tool. An explicit
   user instruction does not override the read-only contract.
2. Keep the packet — deliver or re-show it in full.
3. Route out, fixed response shape:

```
This skill never creates campaigns — it is the decision layer. Your packet above
is launch-ready. To execute it, use `tt4b-launch-traffic-campaign` (or the
matching launch skill) and hand it this payload.
```

## Section close (mandatory, every packet)

End the packet section with the four fixed disclosure lines:

```
Data source:      {tools actually called this run + user inputs}
Confidence:       {high/medium/low + why}
Known limits:     {e.g. CPC range is market-level, not account-level; claims merchant-asserted}
If degraded, why: {e.g. schema column dropped — schemas not exposed; or "none"}
```
