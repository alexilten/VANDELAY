# @vandelay/web

The Vandelay front door: one question, four categories, then a single-screen
workspace where the site, the brief and three options sit together as
collapsible widgets. Built with Vite, React and TypeScript. Category ids come
from `@vandelay/kernel`.

```sh
pnpm install                       # from the repo root
pnpm dev                           # runs @vandelay/web
pnpm test                          # all workspaces, including the web tests
pnpm --filter @vandelay/web build  # CI sets BASE_PATH for GitHub Pages
```

## Design system

Apple-style: white, frosted glass, soft colour light, the system font with
Inter as fallback, very little text and a full dark mode.

- `src/design/tokens.css` holds every colour, radius, space, type and motion
  value as a `--v-*` CSS variable. Components never hard-code a colour.
- Dark mode follows the OS by default. The theme button cycles
  system → light → dark and stores the choice (`src/lib/theme.ts`), which sets
  `<html data-theme>`.
- `src/design/components/` holds the building blocks: `Glass`, `PromptField`,
  `CategoryTile`, `AppIcon`, `Widget` (collapsible panel), `Segmented`,
  `Pill`, `Button`, `ExampleTag`, `ThemeToggle`, `AmbientLight`, `Logo`.

## Layout

- **Desktop:** the workspace fills the window. Site and brief sit on the left,
  the three options on the right and the selected option in a bar at the
  bottom, so nothing scrolls the page.
- **Vertical mobile:** one column. Site and brief start collapsed to a one-line
  summary, the options swipe sideways, and the action bar stays at the bottom.

## 3D viewer

`src/viewer/` draws the chosen option live with React Three Fiber, lazy-loaded
so three.js stays out of the first page load. It shows a 2D sketch while it
loads, and wherever WebGL is missing.

- `geometry.ts` is the contract: a site (boundary, terrain) and oriented boxes
  in mm, site frame +X east, +Y north, Z up. The Home engine emits this shape.
- `source.ts` is the one place the app asks for geometry. It returns example
  geometry from `mock.ts` today; Home switches to `@vandelay/engine-home` when
  that lands.
- Buildings follow the project's architecture standard: timber volumes on
  blackened steel piers, deep steel roof plates, glass toward the view,
  weathered-steel accents and concrete where they meet the slope. Moving parts
  (sliding shutters) animate. The UI around them stays Apple-neutral.

## Example data

Every figure on screen comes from `src/data/examples.ts` and is labelled as an
example in the UI. None of it is real site, code, cost or vendor data. Replace
it with engine output.
