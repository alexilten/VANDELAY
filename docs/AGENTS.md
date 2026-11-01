# Vandelay: Agent-first

> **Decision (Alex, 2026-11-01):** Vandelay is **agent-first**. Its main customers are software agents that act for people, vendors, engineers, lenders and cities. The human app becomes the **approval viewer**, the screen where a person sees a design and signs off.
> Long-form version with the scenario, diagrams and sources: [Vandelay for agents](https://claude.ai/artifact/LfL4ozwU9hyq8pwRPc7X9Q).

Claims are labelled **built** (on `main` today), **exists** (a live standard or network) or **speculative** (our reading of where the market goes).

## The thesis

People will send agents to do their errands, and those agents will negotiate with vendor, builder and lender agents. Agents are good at talking and bad at being right, and no agent has a reason to trust another's numbers. Vandelay is the **neutral design compiler and trust layer** they all call. Intent goes in. Out come verified geometry, cited code checks, a cost and a signed receipt. Each call is paid as it happens. *(Speculative on timing; the parts below are buildable now.)*

## Three jobs, and only three

- **Compile.** Intent in; geometry, quantities, cost index, checks and scores out. The same input always gives the same output. Agents propose, engines decide. *(Built: kernel, Home engine.)*
- **Certify.** Every result carries a receipt. It holds the intent's hash, the engine and rules versions, and every check with its citation and verification status. Any agent can run it again and get the same hash. *(The hash is built in `packages/kernel/src/hash.ts`; signing is new.)*
- **Translate.** The intent schema is the shared language. A vendor maps it to a catalog, an engineer to a calc package, a lender to a loan file and a city to an intake form. *(The schema is built; the adapters are new.)*

**What Vandelay is not:**
- a wallet, an escrow or a marketplace that holds funds;
- the licensed designer of record;
- the agent that negotiates for anyone.

The first two need a licence and the last one breaks neutrality. Vendor fees can buy a listing but never a ranking. How options are scored is published.

## The stack we build on

| Layer | Standard | Status | Our use |
| --- | --- | --- | --- |
| Tools | [MCP](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/) | **Exists.** In the Linux Foundation's Agentic AI Foundation since 2025-12-09 | The main door: engine tools served as an MCP server |
| Agent to agent | [A2A](https://linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) | **Exists.** A Linux Foundation project since 2025-06-23 | Vendor, engineer and lender agents find each other and pass packages |
| Per-call payment | [L402 over Lightning](https://www.theblock.co/post/389584/lightning-labs-releases-ai-agent-tools-for-native-bitcoin-lightning-payments) | **Exists.** Lightning Labs agent tools (lnget, Aperture, scoped credentials), 2026-02-11 | The Aperture proxy in front of the MCP server; no accounts or API keys |
| Mandated payment | [AP2 + x402](https://www.coinbase.com/developer-platform/discover/launches/google_x402) | **Exists**, early. Announced 2025-09-16 | A second rail, plus human-approved build purchases |
| Trust | none | **Gap** | Vandelay's receipts |

Prices are set in **dollars** and converted at call time, so bitcoin's price never changes what a customer pays. We are rail-agnostic.

## Tools agents call

| Tool | State | Role |
| --- | --- | --- |
| `intent.validate` | built | Free, so it is cheap to speak our schema |
| `home.proposeOptions` | built | The flagship paid call: three options, best first |
| `home.evaluate` | built | Solves one intent again, for example a vendor checking its own counter-offer |
| `intent.patch` | built | How agents negotiate: every counter-offer is an RFC 6902 patch that is validated and solved again |
| `explain` | built | Answers "why?" for any number in a result |
| `rules.check` | built inside the engine; to expose | Cited checks alone: is this lot allowed this ADU, and under which statute? |
| `receipt.verify` | built | Free re-check of any package; this is the trust layer |
| `site.fetch` | new | Parcel, terrain and zoning for an address |
| `catalog.map` | new | Vendors publish catalogs in our format so engines can solve against real modules |
| `package.export` | new | Drawings, bill of materials and IFC for an engineer or a factory; priced in dollars |

The first five are in `packages/agent/src/tools.ts`, with JSON Schemas ready for MCP.

## Business model

| Line | Who pays | Settles in |
| --- | --- | --- |
| Per-call compute | Any agent, with no account | Sats (L402) or stablecoin (x402) |
| Build package | The homeowner, after approving it in the viewer | Dollars |
| Verification at volume | Lenders, insurers, cities | Dollars |
| Catalog listing | Modular vendors | Dollars, subscription |
| Rules data | Other design tools and agents | Dollars or per call |

Calls measure reach; packages are the revenue. At an illustrative 1 sat ≈ $0.001, ten million calls at 500 sats is about $5M a year, which is about what a few thousand packages would bring in. The north star stays **verified build packages delivered per month**, and it now counts packages bought through agents.

## Go to market

We charge for our own work and never take a cut of payments moving between other agents. Doing that would mean holding other people's money.

**Revenue, biggest first:**
1. **Build package fee** in dollars, paid when a person approves a design in the viewer.
2. **Vendor success fee**, invoiced to the vendor when a contract is signed through a Vandelay package. This replaces what vendors already spend on leads.
3. **Verification plans** for lenders and insurers who check receipts at volume.
4. **Per-call sats** over L402. This brings in less money but buys reach.

**Getting customers:**
- **Supply first.** Give 3 to 5 modular vendors a free `catalog.map`, so every agent can solve against their modules.
- **Be the tool assistants already call.** List the MCP server in the Claude and ChatGPT connector directories and the public MCP registries, so an "Can I build an ADU?" question to any assistant ends in a Vandelay call.
- **Be our own first agent.** Few homeowners have agents today, so the front door runs a Vandelay agent for them.
- **Free hook.** `intent.validate`, `rules.check` and `receipt.verify` stay free.

## Risks

- **Timing.** Few people have an agent they would trust with a six-figure decision yet. We will watch our own agent traffic and keep the approval viewer good enough for a person to use directly.
- **Licensed stamps.** California B&P Code § 5537 lets unlicensed people prepare plans for woodframe single-family homes of two stories or fewer. Any part that departs from conventional woodframe framing needs a licensed architect or engineer ([text, secondary](https://law.justia.com/codes/california/code-bpc/division-3/chapter-3/article-3/section-5537)), and stepped or benched foundations likely count. Vandelay prepares and checks; a human licensee signs. Whether this applies to ADUs is a question for counsel.
- **Money transmission.** FinCEN's May 2019 guidance treats someone paying from their own unhosted wallet for their own purchases as not a money transmitter ([summary](https://www.jonesday.com/en/insights/2019/06/fincen-consolidates-guidance)). Vandelay only receives payment for its own services. It never escrows and never routes a homeowner's money to a vendor. State law needs counsel.
- **Volatility and node operations.** We price in dollars and sweep revenue on a schedule. We start with a hosted provider or a remote signer with pay-only and invoice-only credentials.
- **Agent manipulation.** Strict schema validation (built), rate limits paid for over L402, and signed outputs.
- **Standards churn.** Every protocol here is under two years old. The engines stay protocol-free, and the adapters are thin.

## Open decisions

- **First payment rail.** Recommended: L402 first and x402 second.
- **New Phase 0 gate** (proposed in [ROADMAP.md](./ROADMAP.md)).
- **Counsel review** of § 5537 and money transmission before any paid call goes live.
