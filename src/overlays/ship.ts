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

  const totalLiquidity = stables.reduce((s, c) => s + c.marketCap, 0);

  const ship = el('div', { cls: 'parsec-ship' });
  const hull = el('div', { cls: 'parsec-ship__hull' });

  // Mast — total liquidity display
  hull.appendChild(el('div', {
    cls: 'parsec-ship__mast',
    children: [
      el('div', { cls: 'parsec-ship__flag', text: market.formatMarketCap(totalLiquidity) }),
      el('div', { cls: 'parsec-ship__flag-label', text: 'STABLECOIN LIQUIDITY' }),
    ],
  }));

  // Deck — stablecoins as cargo
  const deck = el('div', { cls: 'parsec-ship__deck' });
  stables.sort((a, b) => b.marketCap - a.marketCap);
  stables.forEach(coin => {
    const isGold = coin.symbol === 'PAXG' || coin.symbol === 'XAUT';
    const share = coin.marketCap / totalLiquidity;
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
