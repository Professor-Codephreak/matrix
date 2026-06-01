// matrix-fx — TOP 10 + favourites column
//
// A vertical column down the left side: the top 10 assets by market cap, then
// an optional favourites strip fetched by id (rows the feed's mcap window may
// not include). Draggable; each row raises the detailed coin card on hover.

import { el } from '../lib/dom';
import type { CoinPrice } from '../types';
import type { OverlayCtx } from './context';

const EXCLUDE_FROM_FLEET = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'PYUSD', 'USDP', 'GUSD', 'FRAX', 'LUSD', 'USDS', 'USDE',
  'PAXG', 'XAUT', 'WBTC', 'WETH', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'WEETH',
  'LEO', 'OKB', 'CRO', 'KCS', 'HT', 'GT', 'FTT', 'FIGR_HELOC',
]);

function coinIcon(coin: CoinPrice): HTMLElement {
  if (coin.image) {
    const img = document.createElement('img');
    img.className = 'parsec-fleet-column__icon';
    img.src = coin.image;
    img.alt = coin.symbol;
    img.width = 18;
    img.height = 18;
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; };
    return img;
  }
  return el('div', {
    cls: 'parsec-fleet-column__icon parsec-fleet-column__icon--fallback',
    text: coin.symbol.charAt(0),
  });
}

export function renderFleet(ctx: OverlayCtx, prices: CoinPrice[]) {
  const { market, panel } = ctx;
  const fleetCoins = prices
    .filter(c => !EXCLUDE_FROM_FLEET.has(c.symbol))
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10);

  if (fleetCoins.length === 0) return;

  const fleet = el('div', { cls: 'parsec-fleet-column' });
  fleet.appendChild(el('div', { cls: 'parsec-fleet-column__header', text: 'TOP 10' }));

  fleetCoins.forEach((coin, i) => {
    const sign = coin.change24h >= 0 ? '+' : '';
    const color = coin.change24h >= 0 ? '#10b981' : '#ef4444';
    const isAlgo = coin.symbol === 'ALGO';
    const rank = i + 1;

    const row = el('div', {
      cls: `parsec-fleet-column__coin ${isAlgo ? 'parsec-fleet-column__coin--algo' : ''}`,
      children: [
        el('span', { cls: 'parsec-fleet-column__rank', text: `${rank}` }),
        coinIcon(coin),
        el('span', { cls: 'parsec-fleet-column__symbol', text: coin.symbol }),
        el('span', { cls: 'parsec-fleet-column__price', text: market.formatPrice(coin.usd) }),
        el('span', { cls: 'parsec-fleet-column__mcap', text: market.formatMarketCap(coin.marketCap) }),
        el('span', { cls: 'parsec-fleet-column__change', text: `${sign}${coin.change24h.toFixed(1)}%`, attrs: { style: `color:${color}` } }),
      ],
    });

    row.addEventListener('mouseenter', () => panel.showCoinPanel(coin, row));
    row.addEventListener('mouseleave', () => panel.hideCoinPanel());

    fleet.appendChild(row);
  });

  // ── Favourites strip — appended after the TOP 10 rows ──
  // Fire-and-forget: render rows as soon as the source responds. A slug that
  // fails to resolve is silently filtered out by fetchByIds.
  if (ctx.favourites.length > 0) {
    market.fetchByIds([...ctx.favourites]).then((favs) => {
      if (favs.length === 0) return;
      // Preserve the declared order rather than mcap-desc.
      const byId = new Map(favs.map((c) => [c.id, c] as const));
      const ordered = ctx.favourites
        .map((id) => byId.get(id))
        .filter((c): c is CoinPrice => Boolean(c));
      if (ordered.length === 0) return;

      fleet.appendChild(el('div', {
        cls: 'parsec-fleet-column__header parsec-fleet-column__header--favs',
        text: 'FAVOURITES',
      }));

      for (const coin of ordered) {
        const sign = coin.change24h >= 0 ? '+' : '';
        const color = coin.change24h >= 0 ? '#10b981' : '#ef4444';

        const row = el('div', {
          cls: 'parsec-fleet-column__coin parsec-fleet-column__coin--fav',
          children: [
            el('span', { cls: 'parsec-fleet-column__rank parsec-fleet-column__rank--blank' }),
            coinIcon(coin),
            el('span', { cls: 'parsec-fleet-column__symbol', text: coin.symbol }),
            el('span', { cls: 'parsec-fleet-column__price', text: market.formatPrice(coin.usd) }),
            el('span', { cls: 'parsec-fleet-column__mcap', text: market.formatMarketCap(coin.marketCap) }),
            el('span', { cls: 'parsec-fleet-column__change', text: `${sign}${coin.change24h.toFixed(1)}%`, attrs: { style: `color:${color}` } }),
          ],
        });

        row.addEventListener('mouseenter', () => panel.showCoinPanel(coin, row));
        row.addEventListener('mouseleave', () => panel.hideCoinPanel());

        fleet.appendChild(row);
      }
    }).catch(() => { /* favourites are best-effort; ignore */ });
  }

  ctx.makeDraggable(fleet);
  ctx.pyramidLayer.appendChild(fleet);
}
