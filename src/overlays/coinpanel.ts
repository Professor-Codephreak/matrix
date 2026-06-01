// matrix-fx — coin hover panel + tooltip
//
// Two hover surfaces share this module:
//  • a small cursor-following tooltip (proximity hover over floating glyphs)
//  • a detailed card that stays reachable while the cursor is over EITHER the
//    trigger or the card (a deferred hide bridges the gap so the links work).

import { el } from '../lib/dom';
import type { CoinPrice, MarketDataSource } from '../types';
import type { CoinPanelApi } from './context';

export function createCoinPanel(tooltip: HTMLElement, market: MarketDataSource): CoinPanelApi {
  let activeCoinPanel: HTMLElement | null = null;
  let pendingHide: ReturnType<typeof setTimeout> | null = null;

  function cancelPendingHide() {
    if (pendingHide) { clearTimeout(pendingHide); pendingHide = null; }
  }

  function showCoinPanel(coin: CoinPrice, anchor: HTMLElement) {
    cancelPendingHide();
    if (activeCoinPanel) { activeCoinPanel.remove(); activeCoinPanel = null; }
    const isUp = coin.change24h >= 0;
    const sign = isUp ? '+' : '';
    const color = isUp ? '#10b981' : '#ef4444';

    const panel = el('div', {
      cls: 'parsec-coinpanel',
      children: [
        el('div', { cls: 'parsec-coinpanel__header', children: [
          el('span', { cls: 'parsec-coinpanel__symbol', text: coin.symbol }),
          el('span', { cls: 'parsec-coinpanel__name', text: coin.id.replace(/-/g, ' ') }),
        ]}),
        el('div', { cls: 'parsec-coinpanel__price', text: market.formatPrice(coin.usd) }),
        el('div', { cls: 'parsec-coinpanel__change', text: `${sign}${coin.change24h.toFixed(2)}%`, attrs: { style: `color:${color}` } }),
        el('div', { cls: 'parsec-coinpanel__cap', text: `Market Cap: ${market.formatMarketCap(coin.marketCap)}` }),
        el('div', { cls: 'parsec-coinpanel__links', children: [
          el('a', { text: 'CoinGecko', cls: 'parsec-asset-link', attrs: { href: `https://www.coingecko.com/en/coins/${coin.id}`, target: '_blank', rel: 'noopener' } }),
          el('a', { text: 'Chart', cls: 'parsec-asset-link', attrs: { href: `https://www.coingecko.com/en/coins/${coin.id}#panel`, target: '_blank', rel: 'noopener' } }),
        ]}),
      ],
    });

    const rect = anchor.getBoundingClientRect();
    document.body.appendChild(panel);
    activeCoinPanel = panel;

    const h = panel.offsetHeight || 120;
    const panelX = Math.min(rect.left, window.innerWidth - 200);
    const panelY = Math.max(rect.top - h - 8, 10);
    panel.style.left = `${panelX}px`;
    panel.style.top = `${panelY}px`;

    panel.addEventListener('mouseenter', cancelPendingHide);
    panel.addEventListener('mouseleave', () => hideCoinPanel());
  }

  function hideCoinPanel(delay = 180) {
    cancelPendingHide();
    pendingHide = setTimeout(() => {
      if (activeCoinPanel) { activeCoinPanel.remove(); activeCoinPanel = null; }
      pendingHide = null;
    }, delay);
  }

  function showTooltip(coin: CoinPrice, x: number, y: number) {
    const changeColor = coin.change24h >= 0 ? '#10b981' : '#ef4444';
    const changeSign = coin.change24h >= 0 ? '+' : '';
    tooltip.innerHTML = `
      <div class="parsec-matrix__tooltip-symbol">${coin.symbol}</div>
      <div class="parsec-matrix__tooltip-price">${market.formatPrice(coin.usd)}</div>
      <div class="parsec-matrix__tooltip-change" style="color:${changeColor}">${changeSign}${coin.change24h.toFixed(2)}%</div>
      <div class="parsec-matrix__tooltip-cap">${market.formatMarketCap(coin.marketCap)}</div>
    `;
    tooltip.style.left = `${x + 16}px`;
    tooltip.style.top = `${y - 20}px`;
    tooltip.style.opacity = '1';
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
  }

  return { showCoinPanel, hideCoinPanel, showTooltip, hideTooltip };
}
