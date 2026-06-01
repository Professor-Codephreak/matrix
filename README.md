# matrix-fx

A standalone WebGL **Matrix digital-rain entry experience** — the rain shader,
market-data overlays (floating glyphs, winners/losers pyramid, stablecoin ship,
TOP-10 fleet), and a "blue pill / red pill" entry shell. Auth, navigation,
market data, and the diagnostics body are all **injected**, so the module
depends on no host application. Vanilla TypeScript, no framework.

Extracted from [Parsec Wallet](https://github.com/parsec-wallet) so the entry
visual can be lifted into any project.

## Install / use

The module is plain TypeScript — import `src/index.ts` directly (via a path
alias, workspace, or by copying the folder). No build step is required to
consume it.

```ts
import { createMatrixEntry } from 'matrix-fx';
import 'matrix-fx/styles';            // or: @use 'matrix-fx/src/styles/matrix' in your SCSS

const { element, destroy } = createMatrixEntry({
  market,        // MarketDataSource — your price feed adapted to the interface
  auth,          // AuthBridge — hasVault / isTauri / unlock
  onNavigate(route) { /* 'dashboard' | 'onboarding' | 'import-wallet' */ },
  branding: { name: 'PARSEC' },
  favourites: ['arweave', 'aave'],         // ids fetched for the favourites strip
  featured: { justBecause: ['ALGO', 'ETH'] },
  renderDiagnostics(host) { /* fill the blue-pill body; return optional cleanup */ },
});

document.body.appendChild(element);
// later: destroy();
```

See `src/types.ts` for the full config contract.

## Demo

```bash
npm install
npm run dev      # standalone demo with a mock market + sliders, no wallet
npm run build    # tsc --noEmit && vite build
```

The demo (`/demo`) mounts the full experience with a mock `MarketDataSource`,
a no-op `AuthBridge`, and a placeholder diagnostics body — proof that the
module runs with zero network and zero host.

## Layout

```
src/
  index.ts            public API (createMatrixEntry + types + low-level exports)
  types.ts            MarketDataSource, AuthBridge, MatrixEntryConfig, …
  core/               the reusable rain: shaders, WebGL renderer, drag/zoom/glitch
  overlays/           data-driven layers: glyphs, pyramid, streams, ship, fleet, coin panel
  shell/              entry orchestration + pill panels
  lib/dom.ts          tiny el/btn/input/toast helpers (no deps)
  assets/matrix/      glyph atlas + noise texture
  styles/matrix.scss  self-contained stylesheet (vendored token subset in _tokens.scss)
```

Want just the rain background? Import `createRainRenderer` from `core/renderer`
and skip the overlays and shell entirely.

## Lifting to its own repo

The module has no host dependencies (`grep -r store\|keystore\|algorand src/`
returns nothing) and no runtime npm dependencies. To publish it standalone:
move `matrix-fx/` out, `git init`, set a real package name, and update consumers
to import the package name instead of the in-repo path alias.

## License

MIT.
