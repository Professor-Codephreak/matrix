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

## The `MarketDataSource` contract

The one interface a host must implement — seven required members, two optional:

| member | | |
|---|---|---|
| `subscribe(onUpdate)` | required | price updates; returns an unsubscribe fn |
| `fetchByIds(ids)` | required | specific rows, for the favourites strip |
| `activity(prices)` | required | 0..1 — drives rain speed |
| `sentiment(prices)` | required | -1..+1 — colours the rain bear/bull |
| `breadth(prices)` | required | green/red/flat — feeds the shader's breadth uniform |
| `formatPrice(usd)` | required | a price as the host would print it |
| `formatMarketCap(cap)` | required | a large USD figure as the host would print it |
| `links?(coin)` | optional | external links for a coin's hover card |
| `stablecoinLiquidity?()` | optional | a market-wide stablecoin total for the ship's flag |

The two optional members exist because the overlays otherwise guess, and guessed
wrong for any feed that is not CoinGecko:

**`links?(coin)`** — the hover card used to build CoinGecko URLs from `coin.id`
unconditionally. Under a CoinMarketCap feed that id is a CMC slug, so every link
pointed at a page that does not exist. Return your provider's own destinations, or
omit it and keep the CoinGecko fallback.

**`stablecoinLiquidity?()`** — the ship's flag reads `STABLECOIN LIQUIDITY`, but
without this it can only sum the stablecoins in the current listing window, which
understates the market by everything below the cut. Return a real aggregate (the
bundled CMC source uses DeFiLlama's `peggedUSD` across all pegged assets) and the
flag upgrades to it asynchronously; return `null`, or omit it, and the visible sum
stands.

Cargo widths on the deck keep using the visible total either way — they are shares
of what is on deck, and dividing them by a market-wide figure would shrink every
crate to nothing.

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

## Where this lives

This repository is the module's home. It has no host dependencies
(`grep -r store\|keystore\|algorand src/` returns nothing) and no runtime npm
dependencies, so it can be consumed by path alias, workspace, or a plain copy.

Parsec Wallet consumes it as a **git submodule** at `matrix-fx/`. Clone the
superproject with `--recurse-submodules`, or run `git submodule update --init` in
an existing checkout. A host pins a commit deliberately: new work here does not
reach a consumer until that consumer bumps its pin.

## License

MIT.
