// matrix-fx — stablecoin ship
//
// A liquidity vessel floating at the bottom of the scene. The mast flies the
// total stablecoin market cap; the deck carries each stablecoin as cargo sized
// by its share of the basket. Draggable.

import { el } from '../lib/dom';
import type { CoinPrice } from '../types';
import type { OverlayCtx } from './context';

const STABLE_NAMES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'PYUSD', 'USDP', 'GUSD', 'FRAX', 'LUSD', 'PAXG', 'XAUT']);

export function renderShip(ctx: OverlayCtx, prices: CoinPrice[]) {
  const { market } = ctx;
  const stables = prices.filter(c => STABLE_NAMES.has(c.symbol));
  if (stables.length === 0) return;

  // Visible total — the stablecoins actually on deck. Cargo widths are shares
  // of this. The flag prefers a market-wide DeFiLlama aggregate when the source
  // offers one (filled in async below), since that captures stablecoins beyond
  // the ones the feed surfaces.
  const visibleTotal = stables.reduce((s, c) => s + c.marketCap, 0);

  const ship = el('div', { cls: 'parsec-ship' });
  const hull = el('div', { cls: 'parsec-ship__hull' });

  // Mast — total liquidity display
  const flag = el('div', { cls: 'parsec-ship__flag', text: market.formatMarketCap(visibleTotal) });
  hull.appendChild(el('div', {
    cls: 'parsec-ship__mast',
    children: [
      flag,
      el('div', { cls: 'parsec-ship__flag-label', text: 'STABLECOIN LIQUIDITY' }),
    ],
  }));

  // Upgrade the flag to the source's market-wide total (e.g. DeFiLlama) when
  // available. Best-effort: keep the visible sum if it fails or returns null.
  if (market.stablecoinLiquidity) {
    market.stablecoinLiquidity()
      .then((total) => { if (total && total > 0) flag.textContent = market.formatMarketCap(total); })
      .catch(() => { /* keep the visible sum */ });
  }

  // Deck — stablecoins as cargo
  const deck = el('div', { cls: 'parsec-ship__deck' });
  stables.sort((a, b) => b.marketCap - a.marketCap);
  stables.forEach(coin => {
    const isGold = coin.symbol === 'PAXG' || coin.symbol === 'XAUT';
    const share = coin.marketCap / visibleTotal;
    const widthPct = Math.max(4, Math.round(share * 100));

    deck.appendChild(el('div', {
      cls: `parsec-ship__cargo ${isGold ? 'parsec-ship__cargo--gold' : ''}`,
      attrs: {
        style: `flex-basis:${widthPct}%`,
        title: `${coin.symbol} — ${market.formatMarketCap(coin.marketCap)} (${(share * 100).toFixed(1)}% of stablecoin liquidity)`,
      },
      children: [
        el('span', { cls: 'parsec-ship__cargo-symbol', text: coin.symbol }),
        el('span', { cls: 'parsec-ship__cargo-cap', text: market.formatMarketCap(coin.marketCap) }),
      ],
    }));
  });
  hull.appendChild(deck);

  // Water line
  hull.appendChild(el('div', { cls: 'parsec-ship__waterline' }));

  ship.appendChild(hull);
  ctx.makeDraggable(ship);
  ctx.pyramidLayer.appendChild(ship);
}
