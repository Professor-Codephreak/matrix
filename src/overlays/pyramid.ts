// matrix-fx — winners/losers pyramid
//
// Brick steps from a single apex (the #1 daily gainer) down to a wide base.
// Right side descends through gainers, left side through losers. Triangle edge
// lines sit behind the rows; icons stream along the diagonals; the stablecoin
// ship and the TOP-10 fleet column anchor the scene.

import { el } from '../lib/dom';
import type { CoinPrice } from '../types';
import type { OverlayCtx } from './context';
import { renderEdgeStreams } from './streams';
import { renderShip } from './ship';
import { renderFleet } from './fleet';

const PYRAMID_EXCLUDE = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'PYUSD', 'USDP', 'GUSD', 'FRAX', 'LUSD', 'USDS', 'USDE',
  'PAXG', 'XAUT', 'WBTC', 'WETH', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'WEETH',
  'LEO', 'OKB', 'CRO', 'KCS', 'HT', 'GT', 'FTT', 'FIGR_HELOC',
]);

export function renderPyramid(ctx: OverlayCtx) {
  const { pyramidLayer } = ctx;
  const prices = ctx.getPrices();

  pyramidLayer.innerHTML = '';
  if (prices.length < 10) return;

  const pyramidPrices = prices.filter(c => !PYRAMID_EXCLUDE.has(c.symbol) && c.marketCap > 100_000_000);
  const sorted = [...pyramidPrices].sort((a, b) => b.change24h - a.change24h);
  if (sorted.length === 0) return;
  const topWinner = sorted[0];

  const winners = sorted.filter(c => c.change24h > 0);
  const losers = sorted.filter(c => c.change24h <= 0).reverse();

  const pyramid = el('div', { cls: 'parsec-pyramid__body' });

  const top4Gainers = winners.slice(0, 4);
  const top4Losers = losers.slice(0, 4);
  const remainWinners = winners.slice(4);
  const remainLosers = losers.slice(4);

  // Row 0: APEX — single brick, #1 daily gainer
  const apexRow = el('div', { cls: 'parsec-pyramid__row parsec-pyramid__row--apex' });
  apexRow.appendChild(pyramidCoinCard(ctx, topWinner, true));
  pyramid.appendChild(apexRow);

  // Rows 1-7: each row adds one more brick, expanding from apex to base
  let lIdx = 0;  // index into top4Losers
  let rgIdx = 0; // remaining gainers
  let rlIdx = 0; // remaining losers

  const gainersForRows = top4Gainers.slice(1); // skip the apex gainer
  let giIdx = 0;

  const totalRows = 7;
  for (let r = 1; r <= totalRows; r++) {
    const bricksInRow = r + 1; // row 1 = 2 bricks, ... row 7 = 8
    const row = el('div', { cls: 'parsec-pyramid__row' });

    const widthPct = 14 + r * 11.5; // narrow (top) → wide (base)
    row.style.width = `${widthPct}%`;
    row.style.maxWidth = `${widthPct}%`;

    const leftCount = Math.floor(bricksInRow / 2);
    const rightCount = bricksInRow - leftCount;

    // Fill left side with losers
    for (let i = 0; i < leftCount; i++) {
      let coin: CoinPrice | undefined;
      if (lIdx < top4Losers.length) {
        coin = top4Losers[lIdx++];
      } else if (rlIdx < remainLosers.length) {
        coin = remainLosers[rlIdx++];
      }
      if (coin) row.appendChild(pyramidCoinCard(ctx, coin, false));
    }

    // Fill right side with gainers
    for (let i = 0; i < rightCount; i++) {
      let coin: CoinPrice | undefined;
      if (giIdx < gainersForRows.length) {
        coin = gainersForRows[giIdx++];
      } else if (rgIdx < remainWinners.length) {
        coin = remainWinners[rgIdx++];
      }
      if (coin) row.appendChild(pyramidCoinCard(ctx, coin, false));
    }

    pyramid.appendChild(row);
  }

  // Base row — any remaining coins that didn't fit
  const baseCoins: CoinPrice[] = [];
  while (rgIdx < remainWinners.length) baseCoins.push(remainWinners[rgIdx++]);
  while (rlIdx < remainLosers.length) baseCoins.push(remainLosers[rlIdx++]);

  if (baseCoins.length > 0) {
    const baseRow = el('div', { cls: 'parsec-pyramid__row parsec-pyramid__row--base' });
    baseRow.style.width = '96%';
    baseRow.style.maxWidth = '96%';
    baseCoins.forEach(coin => baseRow.appendChild(pyramidCoinCard(ctx, coin, false)));
    pyramid.appendChild(baseRow);
  }

  pyramidLayer.appendChild(pyramid);

  // Triangle edge lines behind the rows
  pyramidLayer.appendChild(pyramidLine(50, 0, 96, 58, 'rgba(16,185,129,0.1)'));
  pyramidLayer.appendChild(pyramidLine(50, 0, 4, 58, 'rgba(239,68,68,0.1)'));

  // Icons streaming along the pyramid diagonals
  renderEdgeStreams(ctx, pyramid, winners, losers);

  // Stablecoin ship + TOP 10 fleet column
  renderShip(ctx, prices);
  renderFleet(ctx, prices);
}

function pyramidCoinCard(ctx: OverlayCtx, coin: CoinPrice, isApex: boolean): HTMLElement {
  const { market, panel } = ctx;
  const isUp = coin.change24h >= 0;
  const color = isUp ? '#10b981' : '#ef4444';
  const sign = isUp ? '+' : '';
  const cls = isApex ? 'parsec-pyramid__card parsec-pyramid__card--apex' : 'parsec-pyramid__card';

  let iconEl: HTMLElement;
  if (coin.image) {
    const img = document.createElement('img');
    img.className = 'parsec-pyramid__card-icon';
    img.src = coin.image;
    img.alt = coin.symbol;
    img.width = isApex ? 24 : 16;
    img.height = isApex ? 24 : 16;
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; };
    iconEl = img;
  } else {
    iconEl = el('div', {
      cls: 'parsec-pyramid__card-icon parsec-pyramid__card-icon--fallback',
      text: coin.symbol.charAt(0),
      attrs: { style: `background:${color}33;color:${color};width:${isApex ? 24 : 16}px;height:${isApex ? 24 : 16}px` },
    });
  }

  const cardEl = el('div', {
    cls,
    children: [
      iconEl,
      el('div', { cls: 'parsec-pyramid__card-symbol', text: coin.symbol }),
      el('div', { cls: 'parsec-pyramid__card-price', text: market.formatPrice(coin.usd) }),
      el('div', { cls: 'parsec-pyramid__card-change', text: `${sign}${coin.change24h.toFixed(1)}%`, attrs: { style: `color:${color}` } }),
    ],
  });

  cardEl.addEventListener('mouseenter', () => {
    panel.showCoinPanel(coin, cardEl);
    cardEl.style.transform = 'scale(1.3)';
    cardEl.style.zIndex = '50';
    cardEl.style.boxShadow = `0 0 20px ${color}40`;
    cardEl.style.borderColor = `${color}60`;
  });
  cardEl.addEventListener('mouseleave', () => {
    panel.hideCoinPanel();
    cardEl.style.transform = '';
    cardEl.style.zIndex = '';
    cardEl.style.boxShadow = '';
    cardEl.style.borderColor = '';
  });

  cardEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    panel.showCoinPanel(coin, cardEl);
    cardEl.style.transform = 'scale(1.3)';
    cardEl.style.boxShadow = `0 0 20px ${color}40`;
  }, { passive: false });
  cardEl.addEventListener('touchend', () => {
    panel.hideCoinPanel();
    cardEl.style.transform = '';
    cardEl.style.boxShadow = '';
  });

  return cardEl;
}

function pyramidLine(x1: number, y1: number, x2: number, y2: number, color: string): HTMLElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'parsec-pyramid__line');
  svg.setAttribute('viewBox', '0 0 100 50');
  svg.setAttribute('preserveAspectRatio', 'none');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '0.15');
  line.setAttribute('stroke-opacity', '0.3');
  svg.appendChild(line);
  return svg as unknown as HTMLElement;
}
