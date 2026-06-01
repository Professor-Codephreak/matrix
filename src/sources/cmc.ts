// matrix-fx — CoinMarketCap public-feed market source
//
// An optional MarketDataSource backed by CoinMarketCap's keyless public feed
// (https://pro-api.coinmarketcap.com/trial-pro-api). No API key, no account —
// the "keyless public" access model from the BANKON CMC integration guide.
//
// This adapter is NOT part of the matrix-fx core (the core only ever sees the
// injected MarketDataSource). It's a convenience for hosts that want real
// market data from CMC, following the guide's "agnosticism by protocol".
//
// CORS note: the keyless feed does not send Access-Control-Allow-Origin, so a
// browser cannot fetch it directly. Point `baseUrl` at a same-origin proxy
// (the matrix-fx demo proxies '/cmc' → the keyless base in vite.config.ts), or
// inject a non-browser `fetchImpl` (e.g. Tauri's HTTP plugin) that bypasses CORS.

import type { CoinPrice, MarketDataSource, MarketBreadth } from '../types';

export interface CmcSourceOptions {
  /** Base path/URL the keyless endpoints hang off. Default '/cmc' (a proxy).
   *  Set to 'https://pro-api.coinmarketcap.com/trial-pro-api' only where CORS
   *  is not enforced (e.g. behind a native fetch). */
  baseUrl?: string;
  /** Refresh cadence in ms. Default 15 minutes — gentle on the public feed. */
  refreshMs?: number;
  /** How many ranked rows to pull per refresh. Default 100. */
  limit?: number;
  /** Override fetch (e.g. Tauri's @tauri-apps/plugin-http fetch). Default global fetch. */
  fetchImpl?: typeof fetch;
}

interface CmcRow {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  quote: { USD: { price: number; market_cap: number; percent_change_24h: number } };
}

export interface CmcMarket {
  source: MarketDataSource;
  /** Force-pin sentiment (-1..1); pass null to revert to data-derived. */
  setSentiment(v: number | null): void;
  /** Force-pin activity (0..1); pass null to revert to data-derived. */
  setActivity(v: number | null): void;
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

function mapRow(row: CmcRow): CoinPrice {
  const q = row.quote?.USD ?? { price: 0, market_cap: 0, percent_change_24h: 0 };
  return {
    // Use the slug as id so the coin-panel's CoinGecko links resolve for most coins.
    id: row.slug || String(row.id),
    symbol: String(row.symbol || '').toUpperCase(),
    usd: Number(q.price || 0),
    marketCap: Number(q.market_cap || 0),
    change24h: Number(q.percent_change_24h || 0),
    // CMC's static icon CDN — served for <img> display (no CORS needed to render).
    image: `https://s2.coinmarketcap.com/static/img/coins/64x64/${row.id}.png`,
  };
}

export function createCmcMarketSource(opts: CmcSourceOptions = {}): CmcMarket {
  const baseUrl = opts.baseUrl ?? '/cmc';
  const refreshMs = opts.refreshMs ?? 15 * 60 * 1000; // 15 minutes
  const limit = opts.limit ?? 100;
  const doFetch = opts.fetchImpl ?? fetch;

  let latest: CoinPrice[] = [];
  let sentimentOverride: number | null = null;
  let activityOverride: number | null = null;

  async function fetchListings(): Promise<CoinPrice[]> {
    const url = `${baseUrl}/v1/cryptocurrency/listings/latest?start=1&limit=${limit}&convert=USD`;
    const res = await doFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`cmc http ${res.status}`);
    const body = await res.json() as { status?: { error_code?: number; error_message?: string }; data?: CmcRow[] };
    // CMC signals failure via status.error_code even on HTTP 200.
    if (body.status && body.status.error_code) {
      throw new Error(`cmc error ${body.status.error_code}: ${body.status.error_message ?? ''}`);
    }
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows.map(mapRow).filter(c => c.id && c.usd > 0);
  }

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
      let stopped = false;
      const tick = () => {
        fetchListings()
          .then((rows) => { if (stopped) return; latest = rows; cb(rows); })
          .catch((err) => { console.warn('[cmc] refresh failed, keeping last data:', err); });
      };
      tick();                                   // immediate first pull
      const timer = setInterval(tick, refreshMs); // then every refreshMs (15 min default)
      return () => { stopped = true; clearInterval(timer); };
    },
    fetchByIds(ids) {
      // The keyless listing covers the top `limit`; resolve favourites against
      // it by slug or symbol (case-insensitive). Favourites outside the window
      // simply don't appear — the fleet strip silently skips them.
      const want = new Set(ids.map(s => s.toLowerCase()));
      const hit = latest.filter(c => want.has(c.id.toLowerCase()) || want.has(c.symbol.toLowerCase()));
      return Promise.resolve(hit);
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
    setSentiment(v) { sentimentOverride = v; },
    setActivity(v) { activityOverride = v; },
  };
}
