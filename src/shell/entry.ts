// matrix-fx — entry orchestrator
//
// Assembles the scene (rain renderer + data overlays + pill shell) and wires
// the injected config to it. This is the only place that knows about all the
// pieces; everything below stays decoupled through the renderer hooks and the
// OverlayCtx.

import { el } from '../lib/dom';
import { toast as defaultToast } from '../lib/dom';
import { makeDraggable } from '../core/interaction';
import { createRainRenderer } from '../core/renderer';
import { createCoinPanel } from '../overlays/coinpanel';
import { createGlyphOverlay } from '../overlays/glyphs';
import { renderPyramid } from '../overlays/pyramid';
import type { OverlayCtx, PillChoice } from '../overlays/context';
import { renderPanel, type ShellCtx } from './pills';
import type { CoinPrice, MatrixEntry, MatrixEntryConfig } from '../types';

// Featured-glyph defaults (overridable via config.featured).
const DEFAULT_MAJORS = ['BTC', 'ETH', 'AVAX', 'ADA', 'ALGO', 'POL', 'XRP', 'SOL', 'DOT'];
const DEFAULT_JUST_BECAUSE = ['POL', 'ALGO', 'ETH', 'BEAM', 'ZIL'];

export function createMatrixEntry(config: MatrixEntryConfig): MatrixEntry {
  const market = config.market;
  const branding = config.branding?.name ?? 'PARSEC';
  const toast = config.toast ?? defaultToast;

  let prices: CoinPrice[] = [];
  let choice: PillChoice = 'none';
  let diagnosticsCleanup: (() => void) | null = null;
  let torn = false;

  // ── Scene graph ──
  const container = el('div', { cls: 'parsec-matrix' });
  const canvas = document.createElement('canvas');
  canvas.className = 'parsec-matrix__canvas';
  container.appendChild(canvas);
  container.appendChild(el('div', { cls: 'parsec-matrix__overlay' }));

  const pyramidLayer = el('div', { cls: 'parsec-matrix__pyramid' });
  container.appendChild(pyramidLayer);
  const glyphLayer = el('div', { cls: 'parsec-matrix__glyph-layer' });
  container.appendChild(glyphLayer);
  const tooltip = el('div', { cls: 'parsec-matrix__tooltip' });
  container.appendChild(tooltip);

  // Brand — click opens pill choice, draggable
  const brandEl = el('div', { cls: 'parsec-matrix__brand parsec-matrix__brand--floating', children: [
    el('span', { text: branding }),
  ]});
  brandEl.addEventListener('click', () => setPill('choose'));
  brandEl.style.cursor = 'pointer';
  makeDraggable(brandEl);
  container.appendChild(brandEl);

  // Panel — pill choice / diagnostics / login. Hidden on landing.
  const panel = el('div', { cls: 'parsec-matrix__panel' });
  panel.style.display = 'none';
  container.appendChild(panel);

  // ── Renderer + overlays ──
  const renderer = createRainRenderer(canvas, container);
  const coinPanel = createCoinPanel(tooltip, market);

  const ctx: OverlayCtx = {
    glyphLayer,
    pyramidLayer,
    market,
    getPrices: () => prices,
    getChoice: () => choice,
    getZoom: () => renderer.getZoom(),
    favourites: config.favourites ?? [],
    majors: new Set(config.featured?.majors ?? DEFAULT_MAJORS),
    justBecause: new Set(config.featured?.justBecause ?? DEFAULT_JUST_BECAUSE),
    makeDraggable,
    panel: coinPanel,
  };

  const glyph = createGlyphOverlay(ctx);

  // Renderer hooks: ride the rain.
  renderer.onFrame((t) => glyph.driftGlyphs(t));
  renderer.onPointerMove((x, y) => glyph.checkGlyphHover(x, y));
  renderer.onPointerLeave(() => coinPanel.hideTooltip());
  renderer.onZoom(() => glyph.updateGlyphSizes());

  // ── Market subscription ──
  const stopPrices = market.subscribe((p) => {
    prices = p;
    renderer.setActivity(market.activity(p));
    renderer.setSentiment(market.sentiment(p));
    renderer.setBreadthGreen(market.breadth(p).greenPct / 100);
    glyph.createGlyphs();
    renderPyramid(ctx);
  });

  // ── Pill state machine ──
  function setPill(p: PillChoice) {
    // Leaving blue pill — tear down host diagnostics.
    if (choice === 'blue' && p !== 'blue' && diagnosticsCleanup) {
      diagnosticsCleanup();
      diagnosticsCleanup = null;
    }

    choice = p;
    renderer.setPillTint(p === 'red' ? 1.0 : p === 'blue' ? 2.0 : 0.0);
    renderer.setContemplative(p === 'blue');
    renderer.triggerGlitchSpin(0.8);
    glyph.createGlyphs(); // recolor for pill context

    const pyramidBody = pyramidLayer.querySelector('.parsec-pyramid__body') as HTMLElement | null;
    const pyramidLines = pyramidLayer.querySelectorAll('.parsec-pyramid__line');

    if (p === 'none') {
      panel.style.display = 'none';
      panel.classList.remove('parsec-matrix__panel--fullscreen');
      brandEl.style.display = '';
      pyramidLayer.style.display = '';
      glyphLayer.style.display = '';
      if (pyramidBody) pyramidBody.style.display = '';
      pyramidLines.forEach(l => (l as HTMLElement).style.display = '');
    } else if (p === 'blue') {
      // Pure diagnostics — hide everything except the rain.
      panel.style.display = '';
      panel.classList.add('parsec-matrix__panel--fullscreen');
      brandEl.style.display = 'none';
      pyramidLayer.style.display = 'none';
      glyphLayer.style.display = 'none';
    } else {
      // Pill choice / red — hide pyramid bricks, keep top 10 + ship + glyphs.
      panel.style.display = '';
      panel.classList.add('parsec-matrix__panel--fullscreen');
      brandEl.style.display = 'none';
      if (pyramidBody) pyramidBody.style.display = 'none';
      pyramidLines.forEach(l => (l as HTMLElement).style.display = 'none');
      glyphLayer.style.display = '';
    }

    renderPanel(shell);
  }

  // ── Teardown ──
  function cancelAnimation() {
    if (torn) return;
    torn = true;
    renderer.destroy();
    stopPrices();
    glyph.stop();
    if (diagnosticsCleanup) { diagnosticsCleanup(); diagnosticsCleanup = null; }
  }

  async function partAndEnter() {
    container.classList.add('parsec-matrix--parting');
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    cancelAnimation();
    config.onNavigate('dashboard');
  }

  const shell: ShellCtx = {
    panel,
    branding,
    config,
    toast,
    passphrase: '',
    getChoice: () => choice,
    setPill,
    partAndEnter,
    stopAnimation: cancelAnimation,
    setDiagnosticsCleanup: (fn) => { diagnosticsCleanup = fn; },
  };

  // Landing state
  renderPanel(shell);
  requestAnimationFrame(() => renderer.init());

  return {
    element: container,
    destroy: cancelAnimation,
  };
}
