// matrix-fx demo — mock market source
//
// A self-contained, deterministic-ish market feed so the entry runs with zero
// network and zero wallet. Sliders in the demo drive the sentiment/activity
// overrides and re-emit, so the shader and overlays respond live.

import type { CoinPrice, MarketDataSource, MarketBreadth } from '../src/index';

interface Seed { id: string; symbol: string; usd: number; marketCap: number; }

// A spread of majors, stablecoins, gold-backed, and long-tail names so every
// overlay (pyramid winners/losers, ship cargo, TOP-10 fleet) has something.
const SEEDS: Seed[] = [
  { id: 'bitcoin', symbol: 'BTC', usd: 68000, marketCap: 1_340_000_000_000 },
  { id: 'ethereum', symbol: 'ETH', usd: 3500, marketCap: 421_000_000_000 },
  { id: 'tether', symbol: 'USDT', usd: 1, marketCap: 112_000_000_000 },
  { id: 'solana', symbol: 'SOL', usd: 168, marketCap: 78_000_000_000 },
  { id: 'usd-coin', symbol: 'USDC', usd: 1, marketCap: 34_000_000_000 },
  { id: 'ripple', symbol: 'XRP', usd: 0.52, marketCap: 29_000_000_000 },
  { id: 'cardano', symbol: 'ADA', usd: 0.45, marketCap: 16_000_000_000 },
  { id: 'avalanche-2', symbol: 'AVAX', usd: 36, marketCap: 14_000_000_000 },
  { id: 'polkadot', symbol: 'DOT', usd: 7.2, marketCap: 10_000_000_000 },
  { id: 'chainlink', symbol: 'LINK', usd: 14.5, marketCap: 9_000_000_000 },
  { id: 'matic-network', symbol: 'POL', usd: 0.58, marketCap: 5_600_000_000 },
  { id: 'algorand', symbol: 'ALGO', usd: 0.18, marketCap: 1_450_000_000 },
  { id: 'dai', symbol: 'DAI', usd: 1, marketCap: 5_300_000_000 },
  { id: 'paxos-gold', symbol: 'PAXG', usd: 2350, marketCap: 520_000_000 },
  { id: 'uniswap', symbol: 'UNI', usd: 9.8, marketCap: 5_900_000_000 },
  { id: 'litecoin', symbol: 'LTC', usd: 84, marketCap: 6_300_000_000 },
  { id: 'cosmos', symbol: 'ATOM', usd: 8.4, marketCap: 3_200_000_000 },
  { id: 'aptos', symbol: 'APT', usd: 9.1, marketCap: 4_100_000_000 },
  { id: 'near', symbol: 'NEAR', usd: 5.6, marketCap: 6_100_000_000 },
  { id: 'injective-protocol', symbol: 'INJ', usd: 24, marketCap: 2_300_000_000 },
];

// Favourites pool (resolved by fetchByIds) — some outside the main list.
const FAV_SEEDS: Seed[] = [
  { id: 'moonbeam', symbol: 'GLMR', usd: 0.21, marketCap: 200_000_000 },
  { id: 'aave', symbol: 'AAVE', usd: 96, marketCap: 1_400_000_000 },
  { id: 'pyth-network', symbol: 'PYTH', usd: 0.38, marketCap: 1_300_000_000 },
  { id: 'arweave', symbol: 'AR', usd: 28, marketCap: 1_800_000_000 },
  { id: 'blast', symbol: 'BLAST', usd: 0.008, marketCap: 120_000_000 },
];

// 24h change in [-12, +12], stable per session.
function makeChange(): number {
  return Math.round((Math.random() * 24 - 12) * 10) / 10;
}

function buildRows(seeds: Seed[], stableFlat: boolean): CoinPrice[] {
  return seeds.map((s) => ({
    ...s,
    // Stablecoins/gold hover near flat; everything else swings.
    change24h: stableFlat && (s.usd > 0.98 && s.usd < 1.02) ? Math.round((Math.random() * 0.2 - 0.1) * 100) / 100 : makeChange(),
    image: '', // fallback letter badges — no network in the demo
  }));
}

export function formatPrice(usd: number): string {
  if (usd >= 1000) return '$' + usd.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (usd >= 1) return '$' + usd.toFixed(2);
  if (usd >= 0.01) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(6);
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(1) + 'M';
  if (cap >= 1e3) return '$' + (cap / 1e3).toFixed(1) + 'K';
  return '$' + cap.toFixed(0);
}

export interface MockMarket {
  source: MarketDataSource;
  setSentiment(v: number): void;
  setActivity(v: number): void;
}

export function createMockMarket(): MockMarket {
  let rows = buildRows(SEEDS, true);
  const favRows = buildRows(FAV_SEEDS, false);
  let onUpdate: ((p: CoinPrice[]) => void) | null = null;

  // Slider overrides (null = derive from data).
  let sentimentOverride: number | null = null;
  let activityOverride: number | null = null;

  function breadth(prices: CoinPrice[]): MarketBreadth {
    let g = 0, r = 0, f = 0;
    for (const c of prices) {
      if (c.change24h > 0.3) g++; else if (c.change24h < -0.3) r++; else f++;
    }
    const t = prices.length || 1;
    return { greenPct: Math.round(g / t * 100), redPct: Math.round(r / t * 100), flatPct: Math.round(f / t * 100) };
  }

  const source: MarketDataSource = {
    subscribe(cb) {
      onUpdate = cb;
      cb(rows);
      // Gentle drift every 8s so glyphs rotate and prices breathe.
      const timer = setInterval(() => {
        rows = buildRows(SEEDS, true);
        onUpdate?.(rows);
      }, 8000);
      return () => { clearInterval(timer); onUpdate = null; };
    },
    fetchByIds(ids) {
      return Promise.resolve(favRows.filter((c) => ids.includes(c.id)));
    },
    activity(prices) {
      if (activityOverride !== null) return activityOverride;
      const avg = prices.reduce((s, c) => s + Math.abs(c.change24h), 0) / (prices.length || 1);
      return Math.min(1, avg / 12);
    },
    sentiment(prices) {
      if (sentimentOverride !== null) return sentimentOverride;
      const avg = prices.reduce((s, c) => s + c.change24h, 0) / (prices.length || 1);
      return Math.max(-1, Math.min(1, avg / 8));
    },
    breadth,
    formatPrice,
    formatMarketCap,
  };

  return {
    source,
    setSentiment(v) { sentimentOverride = v; onUpdate?.(rows); },
    setActivity(v) { activityOverride = v; onUpdate?.(rows); },
  };
}
