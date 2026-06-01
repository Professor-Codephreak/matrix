// matrix-fx — public types
//
// The module owns its own `CoinPrice` shape (a structural mirror of any
// market-data row). Everything project-specific — where prices come from,
// how auth works, where navigation goes, what the diagnostics panel shows —
// is injected through `MatrixEntryConfig`. The module imports nothing from
// any host application.

/** A single market row. Structural shape only — any source that can produce
 *  these fields (CoinGecko, a mock, an internal feed) can drive the visuals. */
export interface CoinPrice {
  id: string;
  symbol: string;
  usd: number;
  marketCap: number;
  change24h: number;
  image: string;
}

export interface MarketBreadth {
  greenPct: number;
  redPct: number;
  flatPct: number;
}

/**
 * Everything the visuals need to read the market. The host adapts its own
 * price feed to this interface (the wallet wraps `src/lib/prices.ts`; the
 * demo supplies a mock). All methods are pure reads — the module never
 * mutates the source.
 */
export interface MarketDataSource {
  /** Subscribe to price updates. Returns an unsubscribe fn. */
  subscribe(onUpdate: (prices: CoinPrice[]) => void): () => void;
  /** Fetch a specific set of rows by id (used by the favourites strip). */
  fetchByIds(ids: string[]): Promise<CoinPrice[]>;
  /** Market activity 0..1 — drives rain speed. */
  activity(prices: CoinPrice[]): number;
  /** Sentiment -1..+1 — colors the rain bear/bull. */
  sentiment(prices: CoinPrice[]): number;
  /** Green/red/flat breakdown — feeds the shader's breadth uniform. */
  breadth(prices: CoinPrice[]): MarketBreadth;
  /** Format a USD price for display. */
  formatPrice(usd: number): string;
  /** Format a market cap / large USD figure for display. */
  formatMarketCap(cap: number): string;
}

/**
 * Authentication bridge for the red pill. The module never touches a keystore
 * or crypto — it only asks these yes/no/unlock questions and reacts to the
 * boolean answers.
 */
export interface AuthBridge {
  /** Does a returning-user vault exist on this device? */
  hasVault(): boolean | Promise<boolean>;
  /** Running inside a native (Tauri) shell with OS key storage? */
  isTauri(): boolean;
  /** Attempt to unlock with a passphrase. Resolve true on success. The host
   *  is responsible for persisting the unlocked session; the module zeroes
   *  its own copy of the passphrase regardless of the result. */
  unlock(passphrase: string): Promise<boolean>;
}

/** Featured-symbol selection for the floating glyphs. */
export interface FeaturedConfig {
  /** Majors the algorithm picks top movers from. */
  majors?: string[];
  /** Personal picks always surfaced, regardless of movement. */
  justBecause?: string[];
}

/** Routes the shell can ask the host to navigate to. */
export type MatrixRoute = 'dashboard' | 'onboarding' | 'import-wallet';

export interface MatrixEntryConfig {
  /** Where market data comes from. Required. */
  market: MarketDataSource;
  /** Red-pill auth bridge. Required. */
  auth: AuthBridge;
  /** Host navigation. Called after a successful unlock ('dashboard') or when
   *  the user chooses create/import. */
  onNavigate(route: MatrixRoute): void;
  /** Brand label shown on the matrix and pill-choice screen. Default 'PARSEC'. */
  branding?: { name?: string };
  /** CoinGecko ids for the favourites strip under the TOP-10 column. */
  favourites?: string[];
  /** Featured-glyph selection. Sensible defaults applied when omitted. */
  featured?: FeaturedConfig;
  /** Render the blue-pill diagnostics body. Host-specific (e.g. on-chain
   *  account data). If omitted, a generic placeholder is shown. The returned
   *  cleanup fn (if any) runs when the diagnostics view is torn down. */
  renderDiagnostics?(host: HTMLElement): void | (() => void);
  /** Toast hook. Defaults to the vendored toast. */
  toast?(message: string, intent?: 'success' | 'danger' | 'warning' | 'primary'): void;
}

/** Handle returned by `createMatrixEntry`. */
export interface MatrixEntry {
  /** The root element — mount this wherever the entry gate should appear. */
  element: HTMLElement;
  /** Stop all animation, timers, and listeners. Idempotent. */
  destroy(): void;
}
