# Vandelay: Master Plan

> **Status:** proposal, written 2026-11-01. Nothing here settles an [open decision](#9-open-decisions-this-plan-depends-on).
> **Rule for numbers.** Every market or funding figure below links to its source in [§10](#10-sources). Every Vandelay target is marked **target** and is a goal we set, not a forecast or market data. Anything not yet checked against a primary source is marked **unverified**.

> **Agent-first (decided 2026-11-01).** Agents are the main customer; the human app is the approval viewer. See [AGENTS.md](./AGENTS.md). The stages below are updated to match; new gates are marked **proposed**.

See [VISION.md](./VISION.md) for the why and [ROADMAP.md](./ROADMAP.md) for the product phases. This plan ties those phases to the funding stages, says what has to be true at each one, and says how we'll know.

---

## 1. The bet in one paragraph

Construction is one of the largest and least productive parts of the economy. McKinsey Global Institute estimated about **$10 trillion** a year of global construction spending, with labour productivity growing about **1% a year** over two decades against **2.8%** for the whole economy, and about **$1.6 trillion** of value from closing the gap [S1]. In our likely beachhead, California permitted about **1,336 ADUs in 2016** and roughly **39,000 in 2024** after state reforms [S2, S3; the 2024 figure is from a secondary compilation and is unverified]. Design for a small building is still slow, expensive and done by hand. Vandelay's bet is that a **building compiler** (intent in; verified geometry, drawings, cost and fabrication files out) lets a normal person, or the agent working for them, go from "What would you like to build?" to a buildable, priced package, and that each package we deliver makes the engines, rules library and vendor network better. Agent-first, Vandelay is the neutral compiler and trust layer that homeowner, vendor, engineer and lender agents all call, paid per call.

**Why now (our reading, not data):** LLM agents can turn a plain-language brief into structured intent, and since 2025 they have open standards to call tools (MCP), talk to each other (A2A) and pay per call (L402, x402); deterministic engines can make that intent trustworthy; ADU and lot-split reform created a large, repeatable, small-building market; and factory-built modules give us a catalog to design against.

## 2. What a top-tier investor has to believe

A fund like a16z invests in the size of the outcome. It has written publicly that housing costs hold back growth and pointed to modular homes and ADUs as places where technology can help [S4]. So the plan has to make five beliefs credible, one stage at a time.

| # | Belief | The evidence that earns it | Earned by |
| --- | --- | --- | --- |
| B1 | **People want it.** Non-designers will start, finish and come back. | Completion rate from prompt to three options; repeat use. | Pre-seed |
| B2 | **The output is real.** Designs pass code, price within tolerance and get permitted. | Rule-check pass rate; estimate vs. real vendor quote; permits issued. | Seed |
| B3 | **People pay.** Free design converts to paid build packages. | Paid packages, conversion rate, revenue. | Seed → A |
| B4 | **It compounds.** Each region, vendor and engine is cheaper to add than the last, and data improves the product. | Cost and time to add a region or a vendor catalog; marketplace liquidity. | Series A |
| B5 | **It gets huge.** The same compiler extends from ADUs to homes, business, mixed-use and venues, and to vendors, lenders and developers via API. | Second engine live; second customer type paying; API usage. | Series B+ |

The trap to avoid is Katerra: it spent more than **$2 billion** trying to transform construction and filed for bankruptcy in **June 2021**; a widely cited post-mortem blames lack of focus, the wrong talent and vertical integration that never produced efficiencies [S5]. Our answer is in the architecture: **software-first, asset-light, one wedge at a time.** We compile designs and route them to partner vendors and architects. We do not own factories.

## 3. The pipeline

### 3.1 Product pipeline (what a user does)

One screen, collapsible widgets, nothing a non-designer has to learn (see [Built for people who aren't designers](./VISION.md#built-for-people-who-arent-designers)).

```
Ask ──▶ Where? ──▶ A few questions ──▶ Three options ──▶ Refine ──▶ Build package ──▶ Quote ──▶ Permit ──▶ Build
prompt   parcel,     brief              scorecard          one       paid: drawings,   vendor     partner    vendor /
box      terrain,                                         screen    BOM, schedule     marketplace architect  builder
         zoning                                                                                    stamp
```

### 3.2 Engine pipeline (what the system does)

```
brief ─▶ agent writes INTENT (versioned JSON) ─▶ typology engine makes geometry ─▶ rule checks gate it ─▶ studies (cost, carbon, sun, egress) ─▶ explanation ("why?")
```

The agent never writes geometry or numbers. If a check fails, the option is not shown.

### 3.3 Business funnel and the metric at each step

| Step | Metric (definition) | Why investors care |
| --- | --- | --- |
| Visit → Prompt | **Prompt rate**: visitors who type a prompt or tap a category | Is the front door clear? |
| Prompt → Options | **Time to three options** (median) and **options completion rate** | Is the core magic real? Phase 0 gate. |
| Options → Saved design | **Activation**: users who save or share a design | Do they care about the result? |
| Saved → Paid package | **Package conversion** and **revenue per package** | B3: will they pay? |
| Package → Vendor quote | **Quote rate** and **estimate accuracy** (our estimate vs. quote) | B2: is the output real? |
| Quote → Permit | **Permit success** and **days to permit** | B2, and the sharpest proof for homeowners. |
| Permit → Build | **Built units** and **GMV through vendors** | B4: marketplace. |
| Any → Return | **Repeat and referral rate** (homeowners, studios, vendors) | B1, B4. |

**North star (proposed): verified build packages delivered per month**, counting packages bought through agents. It needs demand, quality and payment at once, and it leads every later revenue line. **Reach metric:** paid agent calls per week.

## 4. The stages

Each stage has a **gate**. We move on when the gate is met, not when the calendar says so. Product phases are from [ROADMAP.md](./ROADMAP.md). Funding stages line up with them but are a choice, not a requirement (see the open decision on funding path).

### Stage 0 · Prove the magic (now → month 6) · Roadmap Phase 0 · Raise: pre-seed, optional

**Goal (proposed, agent-first):** an outside agent, with no human help, gets three verified home options with signed receipts in under five minutes, and a person can open and approve one in the viewer. *(Was: a stranger types a sentence and gets three options in under five minutes.)*

**Build:** monorepo, kernel (intent schema v0, geometry, cited rules), Home engine v0 on a sloped lot, an MCP server for the engine tools, signed receipts, the approval viewer (the front door stays as the demo), venue engine behind the tool API as the showcase.

**Milestones**
- M0.1 Intent schema v0 and Home engine v0 merged, with deterministic tests.
- M0.2 MCP server live, with signed receipts and a free `receipt.verify`.
- M0.2b Approval viewer live on a public URL: open a receipt, see the design in 3D with its checks, approve. One screen, desktop and vertical mobile.
- M0.3 Three outside agents (for example Claude, ChatGPT and an open-source one) complete the flow unaided; 20 user tests of the approval viewer with non-designers, recorded.
- M0.4 Waitlist open; venue showcase demo recorded.
- M0.5 Name cleared or replaced before any public launch.

**Metrics (targets)**
| Metric | Target |
| --- | --- |
| Median time to three options, agent call to receipts | **< 5 min** (the Phase 0 gate) |
| Options completion rate in user tests | **≥ 70%** target |
| Rule-check pass rate on shown options | **100%** (failing options are never shown) |
| Waitlist sign-ups | **1,000** target |
| Letters of intent from vendors or studios | **3** target |

**What a pre-seed investor looks for:** a founder who can build, a demo that makes them say "wait, how?", a clear wedge, and a credible path to the team. For scale, Carta reports U.S. startups on its platform raised **$10.4B across 50,316** SAFEs and notes in 2025, with median post-money caps of about **$10M** for $250K–$1M rounds and **$15M** for $1M–$2.5M rounds [S6]. These are market medians, not our valuation.

**Hire or partner:** a licensed architect (advisor or co-founder) and someone from modular construction. These are the two open founding-team seats.

**Kill or pivot signal:** non-designers can't finish the flow even after three design iterations.

### Stage 1 · Prove it's real and people pay (months 6–18) · Roadmap Phase 1 · Raise: seed

**Goal:** real homeowners on real parcels in one region buy build packages, and the packages get permitted.

**Build:** parcel, terrain and zoning data for one region; two or three modular vendor catalogs; a cost estimate in dollars; a permit set stamped by partner architects; paid agent calls over L402 (Lightning, priced in dollars, never custodial), then x402; packages paid in dollars after a person approves them in the viewer.

**Milestones**
- M1.1 Launch region chosen and its zoning rules encoded with citations.
- M1.2 First vendor partnership signed (part of the Phase 1 gate).
- M1.3 First paid build package (part of the Phase 1 gate).
- M1.4 First permit issued on a Vandelay package.
- M1.5 First unit built and photographed.

**Metrics (targets)**
| Metric | Target |
| --- | --- |
| Paid build packages, cumulative | **50** target |
| Permits issued | **10** target |
| Estimate vs. vendor quote | **within ±15%** target |
| Days from package to permit submission | **< 30** target |
| Signed vendor partners | **2–3** target |
| Monthly growth in packages (last 6 months) | **≥ 15% month on month** target |
| Revenue | the **first $100K** target |

**What a seed investor looks for:** evidence for B1–B3, a team that covers software, architecture and construction, and early signs of B4. Carta reports a median seed **pre-money of $16M** in Q1 and Q3 2025 [S7, S8]. These are market medians, not our valuation.

**Kill or pivot signal:** packages don't get permitted, or homeowners won't pay at any price we test. Fallback: sell the compiler to vendors or studios first (the open "first paying customer" decision).

### Stage 2 · Prove it compounds (years 1.5–3) · Roadmap Phase 2 · Raise: Series A

**Goal:** a repeatable engine for adding regions, vendors and building types, and a marketplace that starts to run itself.

**Build:** vendor agents quoting against our intent over A2A (a protocol we referee, not a marketplace we run), more regions, Business and Mixed-use engines, Pro mode for studios, IFC tested in Revit.

**Milestones**
- M2.1 Second and third regions live, each cheaper and faster to add than the first.
- M2.2 Vendor quotes returned in the product, without manual work.
- M2.3 Pro seats sold to studios.
- M2.4 Business or Mixed-use engine live.

**Metrics (targets)**
| Metric | Target |
| --- | --- |
| Annualised revenue (packages + marketplace + Pro) | **$1M–$1.5M+** target, growing about **3× a year** |
| Marketplace take rate on vendor GMV | to be set once vendor terms are known |
| Time to add a new region | **falls with each region** target |
| Net revenue retention (Pro seats) | **≥ 100%** target |
| Burn multiple (net burn ÷ net new ARR) | **< 2×** target |

**Why those numbers:** in a Work-Bench survey of 30 investors (Feb 2025), 68% called **$1M–$1.5M ARR** the standard Series A bar and 54% cited **3× year-on-year growth**; it suggests a burn multiple under 2.5×, ideally under 2× [S9]. That survey covers application software. Vandelay mixes transactions, marketplace and SaaS, so treat it as a reference point, not a rule. Carta reports a median Series A **pre-money of $49.3M** in Q3 2025 [S8], and a median **2.1 years** from seed to Series A in 2024 [S10]. Only a minority of seed companies raise an A, and in most cohorts fewer than 20% do so within a year [S11]. **Plan for a long seed and 24+ months of runway.**

**Kill or pivot signal:** each new region costs as much as the first, which would mean we're a services business.

### Stage 3 · Delivery brain (years 3–5) · Roadmap Phase 3 · Raise: Series B

**Goal:** the design carries through to fabrication and site, so changes flow both ways.

**Proposed gate (new):** a project goes from intent to fabrication files to installed modules, with changes on site reflected back in the intent, on at least one vendor's production line.

**Lead metrics:** units built through Vandelay, vendor GMV, share of packages that reach fabrication, change orders per project (lower is better), and API customers (lenders, developers).

### Stage 4 · Compiler (years 5–10) · Roadmap Phase 4 · Growth

**Goal:** intent to permit to factory for any building type, with automated permit checks and an engine SDK for third parties.

**Proposed gate (new):** at least one jurisdiction accepts Vandelay's automated code check as part of its review, and third parties ship engines on the SDK.

**Lead metrics:** jurisdictions with automated checks, third-party engines, API revenue share.

## 5. Proposed gates for Phases 2–4

[ROADMAP.md](./ROADMAP.md) leaves these open. These are **proposals for Alex to accept or change**:

| Phase | Proposed gate |
| --- | --- |
| 2 · Network | Three regions live, vendor quotes in-product, and annualised revenue at the Series A bar above. |
| 3 · Delivery brain | One project from intent to installed modules with on-site changes flowing back to intent. |
| 4 · Compiler | One jurisdiction accepts automated checks; one third-party engine on the SDK. |

## 6. How we track progress

Keep it to one screen, like the product.

1. **Scoreboard.** One page with the north star, the stage's gate metrics and a red/amber/green status for each. Updated weekly from real data only; empty until a metric exists. Example figures are never shown as real.
2. **Instrumentation.** The front door logs funnel events (prompt, options shown, time to options, save, checkout) with privacy-first, cookie-less analytics. Engine runs log check results so "100% pass" is measured, not claimed.
3. **Cadence.**
   - Weekly: scoreboard and one written note on what moved and why.
   - Monthly: investor-style update (highlights, metrics, asks, lowlights), even before we have investors. It builds the habit and the record.
   - Each gate: a short written gate review, then a decision to move on, hold or pivot.
4. **Data room, built as we go:** cap table, IP assignment (including a clear answer on the HOK proof of concept), trademark search, vendor and architect agreements, metrics history, product demo, security and privacy notes.
5. **Gate log.** Each gate review is saved in `docs/gates/` with the date and the evidence.

## 7. Risks

| Risk | Why it matters | Mitigation | Early warning |
| --- | --- | --- | --- |
| **Liability and licensure** | Only licensed professionals can stamp drawings; a bad design could hurt someone. | Partner architects stamp; engines verify; every number cites its rule; insurance before first paid package. | Partners refuse to stamp without heavy rework. |
| **Permitting varies by city** | Rules differ even within a region, which can make each city a services project. | One region first; cited rules library; measure cost per jurisdiction. | Cost per new jurisdiction doesn't fall. |
| **Low-frequency buyer** | Homeowners build once, so customer acquisition can be expensive. | Free design for reach; vendors and studios as repeat customers; referrals. | Paid acquisition cost above revenue per package. |
| **AI trust** | One hallucinated number ruins credibility. | Agents propose, engines verify; failed checks never shown; "why?" on every number. | Any shown option fails a later manual check. |
| **Vendor dependence** | A few vendors could control catalogs and pricing. | Several vendors per region; open catalog format. | One vendor above half of packages. |
| **Katerra-style sprawl** | Doing everything at once burned $2B+ [S5]. | Asset-light; one wedge; gates before new phases. | Starting Phase 2 work before the Phase 1 gate. |
| **Funding climate** | The time from seed to A keeps growing [S10]. | Plan 24+ months of runway; revenue early. | Runway under 12 months without a clear next gate. |
| **Name and IP** | "Vandelay" is a placeholder; HOK code is not cleared. | Trademark clearance before launch; no HOK code ported until IP confirmed. | Launch date set before clearance. |
| **Payments regulation** | Holding customer funds could make us a money transmitter. | We only receive payment for our own calls and packages; never escrow or route a homeowner's money to a vendor; hosted provider or remote signer for Lightning; counsel review before paid calls. | Any feature that holds or forwards funds. |
| **Agent adoption timing** | The agent-first bet depends on people trusting agents with big decisions. | The approval viewer is good enough for people without an agent; watch our own agent traffic. | Paid agent calls flat for two quarters. |
| **Agent manipulation** | Vendor agents may send crafted inputs or scrape the rules library. | Strict schema validation; rate limits paid via L402; signed receipts. | Unusual call patterns from one caller. |
| **Founder bandwidth** | Two of the founding seats are open. | Recruit the architect and modular-construction seats in Stage 0. | Stage 1 starts without them. |

## 8. Market size: what we know and what we don't

Investors will ask for TAM. We'll answer from sources, bottom-up, and say where the gaps are.

- **Known (sourced):** global construction spending of about $10T a year, as of 2017 [S1]; California ADU permits rising from 1,336 in 2016 [S2] to about 39,000 in 2024 [S3].
- **Gap to close (unverified until checked):** the sources disagree on 2022 (Casita Coalition says nearly 25,000 [S2]; CA YIMBY gives 83,865 cumulative for 2016–2022 [S12]; a later compilation of HCD Annual Progress Report data says 31,805 [S3]). We'll pull the series straight from HCD's data before quoting it in a deck.
- **Still to source:** typical design and permitting cost for an ADU in the launch region, the share of ADUs that are factory-built, and U.S. modular-home volume. Bottom-up TAM = units × what we charge per unit (package + take rate), and we'll fill it in once pricing is tested.

## 9. Open decisions this plan depends on

These stay open until Alex decides. Each one changes a stage above.

- **First payment rail:** L402 first (recommended) or x402 first.
- **Funding path:** raise a pre-seed on the demo (Stage 0) or wait for first revenue (Stage 1).
- **Launch region:** California is likely, not confirmed. It sets the Stage 1 data and rules work.
- **First paying customer:** homeowner, vendor or studio. It sets the Stage 1 funnel and pricing.
- **Founding team:** the architect and modular-construction seats.
- **Final name:** before any public launch.
- **The proposed gates in §5 and the targets in §4.**

## 10. Sources

All accessed 2026-11-01. Secondary sources are labelled.

- **[S1]** McKinsey Global Institute, *Reinventing construction: A route to higher productivity*, Feb 2017. https://www.mckinsey.com/mgi/our-research/reinventing-construction-through-a-productivity-revolution
- **[S2]** Casita Coalition, "California Reaches Major Housing Milestone: More than 100,000 ADUs Permitted Since 2017", Apr 9, 2024 (cites HCD). https://casitacoalition.squarespace.com/casita-coalition-blog/california-reaches-major-housing-milestonemore-than-100000-adus-permitted-since-2017
- **[S3]** BackyardADU, "California ADU Permits … Full 2013–2025 Dataset" (secondary; compiles HCD Annual Progress Report Table A2). **Unverified against HCD directly.** https://backyardadu.net/ca-adu-permits-state-of-the-market/
- **[S4]** Rex Salisbury, a16z, "The Housing Market Is Killing the American Dream", Nov 20, 2019. https://a16z.com/the-housing-market-is-killing-the-american-dream/
- **[S5]** *Architect* magazine, "Katerra's $2 Billion Legacy". https://www.architectmagazine.com/technology/katerras-2-billion-legacy_o
- **[S6]** Carta, *State of Pre-Seed: 2025 in review*. https://carta.com/data/state-of-pre-seed-2025-full-report/
- **[S7]** Carta, *State of Private Markets: Q1 2025*. https://carta.com/data/state-of-private-markets-q1-2025-full-report/
- **[S8]** Carta, *State of Private Markets: Q3 2025*. https://carta.com/data/state-of-private-markets-q3-2025/
- **[S9]** Daniel Chesley, Work-Bench, "Fundraising milestones to cross the seed to Series A chasm in application software", Feb 3, 2025. https://www.work-bench.com/post/fundraising-milestones-to-cross-the-seed-to-series-a-chasm-in-application-software
- **[S10]** Carta, "Founders Should Plan for Much Longer Between Rounds". https://carta.com/data/linkedin-time-between-rounds-lengthened-2025/
- **[S11]** Carta, "Speed From Seed to Series A Matters More Than Founders Think". https://carta.com/data/linkedin-seed-to-series-a-speed-matters-graduation/
- **[S12]** California YIMBY, "California ADU Reform: A Retrospective" (cites HCD). https://cayimby.org/reports/california-adu-reform-a-retrospective/
