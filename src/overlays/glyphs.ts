// matrix-fx — floating crypto glyphs
//
// Icons riding the rain: featured majors + "just because" picks always shown,
// the rest entropy-selected from the feed. Position drifts with 24h change,
// size with volatility. Hover surfaces the detailed coin card; proximity to
// the cursor raises the small tooltip.

import { el } from '../lib/dom';
import type { CoinPrice } from '../types';
import type { OverlayCtx } from './context';

interface CryptoGlyph {
  coin: CoinPrice;
  x: number; y: number; // normalized 0-1
  size: number;
}

const GLYPH_SLOTS = 10;

export interface GlyphOverlay {
  createGlyphs(): void;
  driftGlyphs(t: number): void;
  updateGlyphSizes(): void;
  checkGlyphHover(mx: number, my: number): void;
  stop(): void;
}

export function createGlyphOverlay(ctx: OverlayCtx): GlyphOverlay {
  const { glyphLayer, market, panel } = ctx;
  let cryptoGlyphs: CryptoGlyph[] = [];
  let glyphRotationTimer: ReturnType<typeof setInterval> | null = null;
  const FEATURED_SYMBOLS = new Set<string>();

  function createGlyphs() {
    const prices = ctx.getPrices();
    const zoom = ctx.getZoom();
    const choice = ctx.getChoice();

    glyphLayer.innerHTML = '';
    cryptoGlyphs = [];
    if (prices.length === 0) return;

    const pool = [...prices];
    const selected: CoinPrice[] = [];

    // "Just because" — always featured, separate from algorithm
    FEATURED_SYMBOLS.clear();
    const justBecauseCoins = pool.filter(c => ctx.justBecause.has(c.symbol));
    for (const c of justBecauseCoins) FEATURED_SYMBOLS.add(c.symbol);

    // Algorithm: top movers from majors (excluding "just because" to avoid duplicates)
    const otherMajors = pool.filter(c => ctx.majors.has(c.symbol) && !ctx.justBecause.has(c.symbol))
      .sort((a, b) => b.change24h - a.change24h).slice(0, 3);
    for (const m of otherMajors) FEATURED_SYMBOLS.add(m.symbol);
    const majors = [...justBecauseCoins, ...otherMajors];

    // Always include all featured
    for (const coin of majors) {
      if (!selected.includes(coin)) selected.push(coin);
    }

    // Fill remaining slots randomly — exclude junk tokens
    const glyphExclude = new Set([
      'USDS', 'USDE', 'FIGR_HELOC', 'WBTC', 'WETH', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'WEETH',
      'LEO', 'OKB', 'CRO', 'KCS', 'HT', 'GT', 'FTT',
    ]);
    const remaining = pool.filter(c => !selected.includes(c) && !glyphExclude.has(c.symbol) && c.marketCap > 50_000_000);
    while (selected.length < GLYPH_SLOTS && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(idx, 1)[0]);
    }

    // Grid-based placement — track occupied zones to prevent overlap
    const occupied: { x: number; y: number }[] = [];
    const minGap = 0.14; // 14% of screen between icons — generous spacing

    function findOpenSpot(preferred?: { x: number; y: number }): { x: number; y: number } {
      if (preferred) {
        const tooClose = occupied.some(o => Math.abs(o.x - preferred.x) < minGap && Math.abs(o.y - preferred.y) < minGap);
        if (!tooClose) { occupied.push(preferred); return preferred; }
      }
      for (let attempt = 0; attempt < 50; attempt++) {
        // Right side only (65%-97%) — left side reserved for top 10 + stablecoin basket
        const tx = 0.65 + Math.random() * 0.32;
        const ty = 0.06 + Math.random() * 0.64; // 6%-70%
        const collision = occupied.some(o => Math.abs(o.x - tx) < minGap && Math.abs(o.y - ty) < minGap);
        if (!collision) { occupied.push({ x: tx, y: ty }); return { x: tx, y: ty }; }
      }
      // Fallback — right column
      const fx = 0.80 + Math.random() * 0.17;
      const fy = 0.06 + Math.random() * 0.55;
      occupied.push({ x: fx, y: fy });
      return { x: fx, y: fy };
    }

    for (let i = 0; i < selected.length; i++) {
      const coin = selected[i];
      const vol = Math.abs(coin.change24h);
      const volFactor = Math.min(1.0, vol / 5.0);
      const isFeatured = FEATURED_SYMBOLS.has(coin.symbol);

      let pos: { x: number; y: number };
      if (isFeatured) {
        const fIdx = [...FEATURED_SYMBOLS].indexOf(coin.symbol);
        const fx = fIdx % 2 === 0 ? 0.73 : 0.88; // zigzag left-right within right zone
        const fy = 0.06 + fIdx * 0.11;            // 11% vertical gap between each
        pos = findOpenSpot({ x: fx, y: fy });
      } else {
        pos = findOpenSpot();
      }
      const x = pos.x;
      const y = pos.y;
      const depth = isFeatured ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.7;
      const baseSize = isFeatured
        ? (24 + volFactor * 12 + depth * 6) * zoom
        : (12 + volFactor * 10 + depth * 6) * zoom;
      const baseOpacity = isFeatured
        ? 0.25 + volFactor * 0.35 + depth * 0.15
        : 0.06 + volFactor * 0.25 + depth * 0.1;

      const glyph: CryptoGlyph = { coin, x, y, size: baseSize };
      cryptoGlyphs.push(glyph);

      // Color — blue pill = red glyphs (selling), otherwise normal market colors
      const featuredBoost = isFeatured ? 1.4 : 1.0;
      let color: string;
      let changeColor: string;
      if (choice === 'blue') {
        color = `rgba(255,80,80,${baseOpacity * featuredBoost})`;
        changeColor = '#ef4444';
      } else {
        color = coin.change24h > 0.3
          ? `rgba(16,255,90,${baseOpacity * featuredBoost})`
          : coin.change24h < -0.3
            ? `rgba(255,80,80,${baseOpacity * featuredBoost})`
            : `rgba(200,210,220,${baseOpacity * 0.5 * featuredBoost})`;
        changeColor = coin.change24h >= 0 ? '#10b981' : '#ef4444';
      }

      const changeSign = coin.change24h >= 0 ? '+' : '';

      const glyphEl = el('div', {
        cls: `parsec-matrix__crypto-glyph ${volFactor > 0.3 ? 'parsec-matrix__crypto-glyph--volatile' : ''}`,
        attrs: {
          'data-coin': coin.id,
          style: `left:${x * 100}%;top:${y * 100}%;font-size:${baseSize}px;color:${color};text-shadow:0 0 ${4 + volFactor * 16}px ${color};z-index:${Math.round(depth * 10)}`,
        },
        children: [
          el('span', { cls: 'parsec-matrix__glyph-symbol', text: coin.symbol }),
          el('span', { cls: 'parsec-matrix__glyph-price', text: market.formatPrice(coin.usd), attrs: { style: `color:${color}` } }),
          el('span', { cls: 'parsec-matrix__glyph-change', text: `${changeSign}${coin.change24h.toFixed(1)}%`, attrs: { style: `color:${changeColor}` } }),
        ],
      });

      glyphEl.addEventListener('mouseenter', () => panel.showCoinPanel(coin, glyphEl));
      glyphEl.addEventListener('mouseleave', () => panel.hideCoinPanel());

      glyphLayer.appendChild(glyphEl);
    }

    // Rotate selection every 20 seconds — new random coins surface
    if (glyphRotationTimer) clearInterval(glyphRotationTimer);
    glyphRotationTimer = setInterval(() => {
      if (ctx.getPrices().length > GLYPH_SLOTS) createGlyphs();
    }, 20000);
  }

  function updateGlyphSizes() {
    const zoom = ctx.getZoom();
    const glyphs = glyphLayer.querySelectorAll('.parsec-matrix__crypto-glyph');
    cryptoGlyphs.forEach((g, i) => {
      const glyphEl = glyphs[i] as HTMLElement;
      if (glyphEl) glyphEl.style.fontSize = `${g.size * zoom}px`;
    });
  }

  function driftGlyphs(t: number) {
    const glyphs = glyphLayer.querySelectorAll('.parsec-matrix__crypto-glyph');
    cryptoGlyphs.forEach((cg, i) => {
      const glyphEl = glyphs[i] as HTMLElement;
      if (!glyphEl) return;

      const change = cg.coin.change24h;
      const absChange = Math.abs(change);

      const changeClamped = Math.max(-15, Math.min(15, change));
      const baseY = cg.y * 100; // original slot
      const priceY = baseY - changeClamped * 1.5; // up = higher, down = lower
      const targetY = Math.max(5, Math.min(72, priceY));

      const sway = Math.sin(t * 0.15 + i * 2.3) * (3 + absChange * 0.5);

      const rotPhase = t * 0.008;
      const depthShift = Math.sin(rotPhase + cg.x * 3.14) * 0.1;
      const perspScale = 0.9 + depthShift;

      const bob = Math.sin(t * 0.2 + i * 1.7) * 2;

      glyphEl.style.top = `${targetY}%`;
      glyphEl.style.transform = `translateX(${sway}px) translateY(${bob}px) scale(${perspScale})`;
    });
  }

  function checkGlyphHover(mx: number, my: number) {
    const zoom = ctx.getZoom();
    let hit = false;
    for (const g of cryptoGlyphs) {
      const gx = g.x * window.innerWidth;
      const gy = g.y * window.innerHeight;
      const dist = Math.sqrt((mx - gx) ** 2 + (my - gy) ** 2);
      if (dist < 50 * zoom) {
        panel.showTooltip(g.coin, mx, my);
        hit = true;
        break;
      }
    }
    if (!hit) panel.hideTooltip();
  }

  function stop() {
    if (glyphRotationTimer) { clearInterval(glyphRotationTimer); glyphRotationTimer = null; }
  }

  return { createGlyphs, driftGlyphs, updateGlyphSizes, checkGlyphHover, stop };
}
