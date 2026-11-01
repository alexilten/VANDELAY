# Vandelay: Roadmap

The roadmap is a sequence of **gated phases**. A phase is done when its gate is met, not when its time window ends.

**Pace (Alex, 2026-11-01): days to weeks, not years.** Windows are targets in weeks from 2026-11-01. Software work is planned to that pace. Gates that need other people, such as a signed vendor, a permit, counsel's review or a city accepting our checks, move at their pace, not ours. Those are marked *external* and are worked in parallel from day one.

**Agent-first (decided 2026-11-01).** Agents are the main customer. Each phase leads with what agents can call. The human app is the **approval viewer**, where a person sees a design and signs off. See [AGENTS.md](./AGENTS.md).

See [VISION.md](./VISION.md) for the why, and [MASTER_PLAN.md](./MASTER_PLAN.md) for how the phases line up with funding stages, metrics and risks.

## Overview

| Phase | Window | Theme | Gate |
| --- | --- | --- | --- |
| 0 | Weeks 0–2 | Foundation | **Proposed:** an outside agent, with no human help, gets three verified home options with signed receipts in under five minutes, and a person can open and approve one in the viewer. *(Replaces "a stranger gets three home options from a prompt in under five minutes" once Alex accepts.)* |
| 1 | Weeks 2–8 | Home on a real site | First package bought through an agent and approved by a person, plus a signed vendor partnership *(external)*. |
| 2 | Weeks 8–16 | Network | Not yet defined. |
| 3 | Weeks 16–26 | Delivery brain | Not yet defined. |
| 4 | Week 26 on | Compiler | Not yet defined. |

## Phase 0 · Foundation (weeks 0–2)

- Repo and monorepo setup. *(Done.)*
- `packages/kernel`: intent schema, geometry, rules library, studies. *(Done; studies continue.)*
- Home engine v0 on a sloped lot. *(Done.)*
- **MCP server** for the built tools (`intent.validate`, `home.proposeOptions`, `home.evaluate`, `intent.patch`, `explain`), plus `rules.check`.
- **Signed receipts** on every result: the intent hash plus engine and rules versions, signed with a published Vandelay key, and a free `receipt.verify`.
- **Approval viewer** (`apps/web`): opens a receipt, shows the design in 3D with its checks and "why?", and lets a person approve. The existing front door stays as the demo and the way in for people without an agent.
- Venue engine behind the tool API.

**Gate (proposed):** see the overview.

## Phase 1 · Home on a real site (weeks 2–8)

- **Paid calls over L402** (the Aperture proxy in front of the MCP server), with prices set in dollars. x402 follows. No custody.
- `site.fetch`: parcel, terrain and zoning for one region (region still open).
- `catalog.map`: two or three modular vendor catalogs in our format.
- A cost estimate.
- `package.export`: a permit set stamped by partner architects or engineers *(the stamp is external)*.

**Gate:** first package bought through an agent and approved by a person, plus a signed vendor partnership.

## Phase 2 · Network (weeks 8–16)

- **Vendor agents over A2A** quote against our intent, and every counter-offer is an `intent.patch` we check. This replaces a marketplace we run.
- More regions.
- Business and Mixed-use engines.
- Pro mode.
- IFC export tested in Revit.

## Phase 3 · Delivery brain (weeks 16–26)

- Fabrication files.
- Lender, insurer and factory agents read signed receipts.
- Schedules and site changes carried back to the same intent as patches.

## Phase 4 · Compiler (week 26 on)

- Intent to permit to factory.
- Automated permit checks that city intake agents accept as signed receipts *(external: each city decides)*.
- An engine SDK for third parties, with engines sold per call through the same door.

## Open decisions that affect the roadmap

These are **still open**:

- **The new Phase 0 gate** above.
- **First payment rail** (recommended: L402 first, then x402).
- **Launch region**, which Phase 1 depends on (California is likely, not confirmed).
- **First paying customer** (homeowner, vendor or studio). Agent-first narrows the question to whose agent pays first.
- **Founding team** (someone from modular construction and a licensed architect).
- **Funding path:** pre-seed on the demo and vision, or first revenue first.
- **Final name**, which must be settled before any public launch.
- **Gates for Phases 2–4**, which have not been set.
