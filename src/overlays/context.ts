// matrix-fx — overlay context
//
// The shared surface the data-driven overlays (glyphs, pyramid, ship, fleet,
// coin panels) read from. The shell builds one of these and hands it to each
// overlay so they stay decoupled from the entry closure and from each other.

import type { CoinPrice, MarketDataSource } from '../types';

export type PillChoice = 'none' | 'choose' | 'red' | 'blue';

/** Detailed hover card + cursor-following tooltip. */
export interface CoinPanelApi {
  showCoinPanel(coin: CoinPrice, anchor: HTMLElement): void;
  hideCoinPanel(delay?: number): void;
  showTooltip(coin: CoinPrice, x: number, y: number): void;
  hideTooltip(): void;
}

export interface OverlayCtx {
  glyphLayer: HTMLElement;
  pyramidLayer: HTMLElement;
  market: MarketDataSource;
  getPrices(): CoinPrice[];
  getChoice(): PillChoice;
  getZoom(): number;
  favourites: string[];
  majors: Set<string>;
  justBecause: Set<string>;
  makeDraggable(el: HTMLElement): void;
  panel: CoinPanelApi;
}
