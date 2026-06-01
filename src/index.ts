// matrix-fx — public API
//
// A standalone WebGL Matrix digital-rain entry experience: the rain shader,
// market-data overlays (glyphs, pyramid, ship, fleet), and a pill entry shell.
// Auth, navigation, market data, and the diagnostics body are injected through
// `MatrixEntryConfig` — the module depends on no host application.
//
//   import { createMatrixEntry } from 'matrix-fx';
//   import 'matrix-fx/styles';   // or @use it from your SCSS
//
//   const { element, destroy } = createMatrixEntry({ market, auth, onNavigate });
//   document.body.appendChild(element);

export { createMatrixEntry } from './shell/entry';

export type {
  CoinPrice,
  MarketBreadth,
  MarketDataSource,
  AuthBridge,
  FeaturedConfig,
  MatrixRoute,
  MatrixEntryConfig,
  MatrixEntry,
} from './types';

// Lower-level building blocks — for hosts that want just the rain, or to
// compose their own scene.
export { createRainRenderer } from './core/renderer';
export type { RainRenderer, RainRendererOptions } from './core/renderer';
export { makeDraggable } from './core/interaction';
export { VERT, FRAG } from './core/shaders';
