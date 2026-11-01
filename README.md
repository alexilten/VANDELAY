# Vandelay

> Working title. The name must be replaced or cleared before any public launch.

The AI design-and-build platform for the built world. Intent is the source of truth; deterministic engines derive geometry, quantities and cost from it.

## Layout

| Path | What it is |
| --- | --- |
| `packages/kernel` | Intent schema, geometry, rules and studies. Pure, deterministic TypeScript. No three.js, no DOM. |
| `packages/engines/home` | Home typology engine (first engine; Venue, Business and Mixed-use follow). |
| `packages/agent` | Exposes engines as typed tools and runs the brief → intent → engine → checks loop. |
| `apps/web` | The homepage, the flow and the design system (Vite, React, React Three Fiber). |

## Conventions

- **Millimetres** internally (`Mm` in the kernel). Convert to metres only at the three.js boundary (`apps/web/src/units.ts`).
- **Z up** everywhere. The web app sets `Object3D.DEFAULT_UP` to `(0, 0, 1)` at startup.
- **Versioned intent JSON**: every intent carries `schema`, `version`, `units` and `up` (see `packages/kernel/src/intent.ts`). The Home body (site, brief, design, sources) is in `packages/kernel/src/home-intent.ts`; agents change intent only through validated JSON Patches (`patch.ts`).
- **Site frame**: +X east, +Y north, +Z up; Z is elevation above the site datum.
- **Example data is labelled**: example sites live in `packages/kernel/src/examples.ts` and are tagged `by: 'example'` in the intent's `sources`.
- The kernel has no runtime dependencies and no clocks or randomness; a test enforces this.

## Develop

Requires Node 22 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev        # web app at http://localhost:5173
pnpm check      # typecheck, test and build everything
```

## CI and deploys

- `CI` runs typecheck, tests and build on every pull request and on `main`.
- `Deploy web to GitHub Pages` publishes `apps/web` on every push to `main`. In the repo's **Settings → Pages**, the source must be **GitHub Actions**.
