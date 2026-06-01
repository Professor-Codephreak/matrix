// matrix-fx demo — mounts the entry with mock data and no wallet.
//
// Proves the module is project-agnostic: a mock market source, a no-op auth
// bridge, console navigation, and a placeholder diagnostics body are all that's
// needed to run the full rain + overlays + pill experience.

import '../src/styles/matrix.scss';
import './demo.css';
import { createMatrixEntry, createCmcMarketSource } from '../src/index';

const app = document.getElementById('app')!;
// Real data from CoinMarketCap's keyless public feed, refreshed every 15 min.
// The dev server proxies '/cmc' → the keyless base (see vite.config.ts) so the
// browser's CORS check is satisfied.
const market = createCmcMarketSource({ baseUrl: '/cmc', refreshMs: 15 * 60 * 1000 });

const { element } = createMatrixEntry({
  market: market.source,
  branding: { name: 'MATRIX-FX' },
  favourites: ['moonbeam', 'aave', 'pyth-network', 'arweave', 'blast'],
  auth: {
    hasVault: () => true,            // show the unlock field so the red pill is complete
    isTauri: () => false,
    unlock: async (pass) => {
      // Demo: accept any passphrase ≥ 8 chars.
      console.log('[demo] unlock attempt, length', pass.length);
      return pass.length >= 8;
    },
  },
  onNavigate: (route) => {
    console.log('[demo] navigate →', route);
    alert(`Host would navigate to: ${route}`);
  },
  renderDiagnostics: (host) => {
    host.innerHTML =
      '<div class="parsec-matrix__diag parsec-matrix__diag--defi">' +
      '<div class="parsec-matrix__diag-section-title">DEMO DIAGNOSTICS</div>' +
      '<div class="parsec-matrix__diag-row"><span class="parsec-matrix__diag-row-label">Source</span>' +
      '<span class="parsec-matrix__diag-row-value">mock market</span></div>' +
      '<div class="parsec-matrix__diag-row"><span class="parsec-matrix__diag-row-label">Network</span>' +
      '<span class="parsec-matrix__diag-row-value">none (standalone)</span></div>' +
      '<p class="parsec-matrix__lead">In the wallet, the host injects a live on-chain dashboard here.</p>' +
      '</div>';
    // No timers to clean up in the demo.
    return undefined;
  },
});

app.appendChild(element);

// ── Demo controls: sentiment / activity sliders ──
const controls = document.createElement('div');
controls.className = 'demo-controls';
controls.innerHTML = `
  <label>Sentiment <b id="s-val">0.0</b>
    <input id="s" type="range" min="-1" max="1" step="0.05" value="0" />
  </label>
  <label>Activity <b id="a-val">auto</b>
    <input id="a" type="range" min="0" max="1" step="0.02" value="0.15" />
  </label>
  <div class="demo-hint">Click <b>MATRIX-FX</b> to open the pill choice. <b>Drag</b> the rain &mdash; the swirl coils into a <b>blockchain chain</b>. Scroll to zoom.</div>
`;
document.body.appendChild(controls);

const s = controls.querySelector<HTMLInputElement>('#s')!;
const a = controls.querySelector<HTMLInputElement>('#a')!;
const sVal = controls.querySelector<HTMLElement>('#s-val')!;
const aVal = controls.querySelector<HTMLElement>('#a-val')!;
s.addEventListener('input', () => { const v = Number(s.value); sVal.textContent = v.toFixed(2); market.setSentiment(v); });
a.addEventListener('input', () => { const v = Number(a.value); aVal.textContent = v.toFixed(2); market.setActivity(v); });
