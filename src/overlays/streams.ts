// matrix-fx — pyramid edge streaming
//
// Icons glide along the pyramid diagonals: winners climb the right edge toward
// the apex, losers slide down the left edge to the base. Speed scales with the
// magnitude of each coin's 24h move; starts are staggered along the edge.

import { el } from '../lib/dom';
import type { CoinPrice } from '../types';
import type { OverlayCtx } from './context';

export function renderEdgeStreams(ctx: OverlayCtx, pyramidBody: HTMLElement, winners: CoinPrice[], losers: CoinPrice[]) {
  const { pyramidLayer } = ctx;
  requestAnimationFrame(() => {
    const apexCard = pyramidBody.querySelector('.parsec-pyramid__row--apex .parsec-pyramid__card') as HTMLElement | null;
    const rows = pyramidBody.querySelectorAll('.parsec-pyramid__row');
    const lastRow = rows[rows.length - 1] as HTMLElement | undefined;
    if (!apexCard || !lastRow) return;

    const layerRect = pyramidLayer.getBoundingClientRect();
    const apexRect = apexCard.getBoundingClientRect();
    const baseRect = lastRow.getBoundingClientRect();
    const apexX = apexRect.left + apexRect.width / 2 - layerRect.left;
    const apexY = apexRect.top + apexRect.height / 2 - layerRect.top;
    const baseLeftX = baseRect.left - layerRect.left;
    const baseRightX = baseRect.right - layerRect.left;
    const baseY = baseRect.bottom - layerRect.top;

    pyramidLayer.appendChild(buildEdgeStream(winners.slice(0, 8), apexX, apexY, baseRightX, baseY, 'up'));
    pyramidLayer.appendChild(buildEdgeStream(losers.slice(0, 8), apexX, apexY, baseLeftX, baseY, 'down'));
  });
}

function buildEdgeStream(coins: CoinPrice[], apexX: number, apexY: number, baseX: number, baseY: number, direction: 'up' | 'down'): HTMLElement {
  const stream = el('div', { cls: `parsec-pyramid__stream parsec-pyramid__stream--${direction}` });
  if (coins.length === 0) return stream;

  const baseDuration = 14; // full traversal seconds at normal pace
  coins.forEach((coin, i) => {
    const speed = Math.max(0.6, Math.min(2.2, Math.abs(coin.change24h) / 8));
    const duration = baseDuration / speed;
    const stagger = (i / coins.length) * baseDuration;

    const item = el('div', { cls: 'parsec-pyramid__stream-item' });

    if (coin.image) {
      const img = document.createElement('img');
      img.src = coin.image;
      img.alt = coin.symbol;
      img.width = 14;
      img.height = 14;
      img.loading = 'lazy';
      img.onerror = () => { img.style.display = 'none'; };
      item.appendChild(img);
    } else {
      const color = coin.change24h >= 0 ? '#10b981' : '#ef4444';
      item.appendChild(el('div', {
        cls: 'parsec-pyramid__stream-fallback',
        text: coin.symbol.charAt(0),
        attrs: { style: `background:${color}33;color:${color}` },
      }));
    }

    // 'up' = climbing toward apex (base → apex); 'down' = falling to base (apex → base)
    const fromX = direction === 'up' ? baseX : apexX;
    const fromY = direction === 'up' ? baseY : apexY;
    const toX = direction === 'up' ? apexX : baseX;
    const toY = direction === 'up' ? apexY : baseY;

    item.style.setProperty('--from-x', `${fromX}px`);
    item.style.setProperty('--from-y', `${fromY}px`);
    item.style.setProperty('--to-x', `${toX}px`);
    item.style.setProperty('--to-y', `${toY}px`);
    item.style.animationDuration = `${duration}s`;
    item.style.animationDelay = `-${stagger}s`;

    stream.appendChild(item);
  });
  return stream;
}
