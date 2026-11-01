# Vandelay: Vision

> **Working title.** "Vandelay" (after Art Vandelay, George Costanza's made-up architect identity in *Seinfeld*) is a placeholder. It must be replaced, or cleared with a trademark attorney, before any public launch. The earlier working name, ArchOS, is dropped. See [Open decisions](#open-decisions).

## What we are building

Vandelay is the AI design-and-build platform for the built world. Anyone can answer one question, **"What would you like to build?"**, and get a design that is verified, priced and ready to fabricate on their real site.

## Principles

1. **Buildings get compiled, not drawn.** Intent is the source of truth. Geometry, drawings, quantities and cost are all derived from it.
2. **Agents propose, engines verify.** The AI never writes geometry or numbers directly. Deterministic engines generate them, rule checks gate them, and every number can answer "why?"
3. **Design and delivery are one loop.** Site, code, cost, vendors and fabrication are answered together, not handed off in sequence.

## The ten-year goal

A **building compiler** that goes from intent to permit to factory, for any building type.

## The product

### Built for people who aren't designers

Vandelay is for normal people, not just designers and architects. Anyone should be able to design a building without training.

- **Super simple and intuitive**, with an Apple aesthetic: clean, minimal and beautiful.
- **One screen.** The whole experience lives on a single screen, with friendly, collapsible options and widgets instead of long pages to scroll and lots of clicking.
- **Desktop and mobile.** It is a desktop web app first, with a vertical mobile layout as well.

### Front door

The homepage is one question, "What would you like to build?", with a prompt box and four categories:

- **Home**
- **Business**
- **Mixed-use**, which covers apartments, towers and homes over shops
- **Venue**

### The flow

1. **Where?** An address resolves to a parcel, its terrain and its zoning.
2. **A few questions** to pin down the brief.
3. **Three options**, each with a scorecard.
4. **Refine** the chosen option.
5. **Get the build package.**

### Pro mode

Architects get the full parametric controls, with export to Rhino and IFC.

### Design language

It should look like Apple made it:

- White, frosted glass and soft colour light, with a full dark mode.
- The system font (SF), with Inter as the fallback.
- Very little text and generous space.
- One gradient, app-style icon per category.
- Every example figure in a prototype is labelled as an example.

## Business model

- **Beachhead:** small residential (ADUs and prefab homes) in one region. California is likely but **not yet confirmed**.
- **Design is free.** The **build package** is paid: permit drawings, schedules, bill of materials, vendor quotes and fabrication files.
- **Later revenue:** vendor and builder marketplace fees, Pro seats for studios, and an API for developers and lenders.
- **Payments:** cards by default. Bitcoin Lightning is an optional method through a payments provider. Vandelay never runs a custodial wallet, because that would make it a money transmitter.
- **The stadium (Venue) is the flagship showcase and Pro tool, not the first market.**

## Platform architecture

| Package | Role |
| --- | --- |
| `packages/kernel` | Intent schema, geometry, a cited rules library, and studies (cost, carbon, sun, egress, pro forma). Pure TypeScript and deterministic, with no three.js. |
| `packages/engines/*` | One typology engine per category. Home first, then Venue (the stadium engine proved in the HOK proof of concept), then Business and Mixed-use. |
| `packages/agent` | Exposes the engines as typed tools (MCP) and runs the loop: brief → intent → engine → checks → explanation. |
| `apps/web` | The homepage, the flow and the design system. |

- **Stack:** Vite, React, React Three Fiber, three.js, rhino3dm, vitest and zustand, in a TypeScript monorepo.
- **Conventions:** millimetres internally, Z up, and a versioned intent JSON.

The HOK repo (`alexilten/HOK`) is an earlier proof of concept. It is reference only: no code is ported from it until the IP is confirmed clear.

## Open decisions

These are **not decided yet**. Nothing in this document should be read as settling them.

- **Final name**, pending trademark clearance.
- **Launch region** (California is the likely candidate).
- **First paying customer:** homeowner, vendor or studio.
- **Founding team:** someone from modular construction and a licensed architect.
- **Funding path:** raise a pre-seed on the demo and vision, or reach first revenue first.

See [ROADMAP.md](./ROADMAP.md) for the phased plan.
