// matrix-fx — WebGL rain renderer
//
// The reusable heart of the effect: a full-screen WebGL Matrix rain with
// market-driven speed/color, bullet-time drag rotation, zoom, glitch-spin,
// and mouse glow. It knows nothing about pills, prices, or overlays — it
// exposes setters for the few market scalars it renders and per-frame /
// pointer hooks so higher layers can ride on top.

import { VERT, FRAG } from './shaders';

export interface RainRendererOptions {
  /** Elements matching this selector under the container won't start a
   *  bullet-time drag (e.g. interactive panels). Default: '.parsec-matrix__panel'. */
  ignoreDragSelector?: string;
}

export interface RainRenderer {
  /** Compile, upload textures, size to the viewport, and start the loop. */
  init(): void;
  /** Current zoom factor (0.3–3.0). */
  getZoom(): number;
  /** Market activity 0..1 — rain speed. */
  setActivity(v: number): void;
  /** Sentiment -1..+1 — rain color. */
  setSentiment(v: number): void;
  /** Green fraction 0..1 — breadth uniform. */
  setBreadthGreen(v: number): void;
  /** Pill tint: 0 = landing/green, 1 = red, 2 = blue. */
  setPillTint(v: number): void;
  /** Blue-pill contemplative mode — slow, meditative drift. */
  setContemplative(on: boolean): void;
  /** Full 360° spin then glitch-flash snap-back. */
  triggerGlitchSpin(duration?: number): void;
  /** Register a per-frame callback; receives elapsed seconds. */
  onFrame(cb: (t: number) => void): void;
  /** Pointer move over the canvas (client coords). */
  onPointerMove(cb: (clientX: number, clientY: number) => void): void;
  /** Pointer left the canvas. */
  onPointerLeave(cb: () => void): void;
  /** Zoom changed (new factor). */
  onZoom(cb: (zoom: number) => void): void;
  /** Stop the loop and detach window listeners. Idempotent. */
  destroy(): void;
}

export function createRainRenderer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  opts: RainRendererOptions = {},
): RainRenderer {
  const ignoreDragSelector = opts.ignoreDragSelector ?? '.parsec-matrix__panel';

  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let startTime = performance.now();
  let raf = 0;
  let destroyed = false;

  // ── Market scalars (driven by setters) ──
  let zoom = 1.0;
  let pillUniform = 0;
  let activityUniform = 0.15; // calm default — mesmerizing slow
  let sentimentUniform = 0.0; // -1 bear/red to +1 bull/green
  let breadthGreen = 0.5;     // green fraction 0..1
  let contemplative = false;  // blue-pill slow mode
  let glitchUniform = 0.0;    // 0 = normal, >0 = glitch intensity
  let spinAngle = 0.0;        // 0..2π spin

  // ── Mouse + bullet-time drag ──
  let mouseX = 0.5, mouseY = 0.5;
  let isDragging = false;
  let dragRotX = 0, dragRotY = 0;
  let dragVelX = 0, dragVelY = 0;
  let lastDragMX = 0, lastDragMY = 0;

  // ── Hooks ──
  const frameCbs: Array<(t: number) => void> = [];
  const moveCbs: Array<(x: number, y: number) => void> = [];
  const leaveCbs: Array<() => void> = [];
  const zoomCbs: Array<(z: number) => void> = [];

  function setUniform(name: string, ...values: number[]) {
    if (!gl || !program) return;
    const loc = gl.getUniformLocation(program, name);
    if (!loc) return;
    if (values.length === 1) gl.uniform1f(loc, values[0]);
    else if (values.length === 2) gl.uniform2f(loc, values[0], values[1]);
  }

  function loadTexture(glCtx: WebGLRenderingContext, url: string, unit: number): WebGLTexture | null {
    const tex = glCtx.createTexture();
    if (!tex) return null;
    glCtx.activeTexture(glCtx.TEXTURE0 + unit);
    glCtx.bindTexture(glCtx.TEXTURE_2D, tex);
    glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, 1, 1, 0, glCtx.RGBA, glCtx.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      glCtx.activeTexture(glCtx.TEXTURE0 + unit);
      glCtx.bindTexture(glCtx.TEXTURE_2D, tex);
      glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, img);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_S, glCtx.REPEAT);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_T, glCtx.REPEAT);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.LINEAR);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.LINEAR);
    };
    img.src = url;
    return tex;
  }

  function resize() {
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    setUniform('u_resolution', canvas.width, canvas.height);
  }

  function frame() {
    if (!gl || !program || destroyed) return;
    const t = (performance.now() - startTime) * 0.001;

    // Momentum decay when not dragging — bullet-time spin continues then slows
    if (!isDragging) {
      dragRotX += dragVelX;
      dragRotY += dragVelY;
      dragVelX *= 0.96; // friction
      dragVelY *= 0.96;
      if (Math.abs(dragVelX) < 0.0001) dragVelX = 0;
      if (Math.abs(dragVelY) < 0.0001) dragVelY = 0;
    }

    setUniform('u_time', t);
    setUniform('u_pill', pillUniform);
    setUniform('u_zoom', zoom);
    setUniform('u_mouse', mouseX, mouseY);
    // Blue pill: slow contemplative drift — barely responds to market noise.
    const effectiveActivity = contemplative ? 0.04 + activityUniform * 0.06 : activityUniform;
    setUniform('u_activity', effectiveActivity);
    setUniform('u_sentiment', sentimentUniform);
    setUniform('u_dragX', dragRotX);
    setUniform('u_dragY', dragRotY);
    setUniform('u_breadth', breadthGreen);
    setUniform('u_glitch', glitchUniform);
    setUniform('u_spin', spinAngle);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    for (const cb of frameCbs) cb(t);
    raf = requestAnimationFrame(frame);
  }

  function triggerGlitchSpin(duration = 1.2) {
    const spinStart = performance.now();
    const spinDuration = duration * 1000;
    const glitchStart = spinDuration * 0.85;
    const glitchDuration = spinDuration * 0.15;

    function animateSpin() {
      if (destroyed) return;
      const elapsed = performance.now() - spinStart;
      const progress = Math.min(elapsed / spinDuration, 1.0);

      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      spinAngle = eased * Math.PI * 2;

      if (elapsed >= glitchStart) {
        const glitchProgress = (elapsed - glitchStart) / glitchDuration;
        glitchUniform = glitchProgress < 0.5
          ? glitchProgress * 2.0
          : (1.0 - glitchProgress) * 2.0;
      } else {
        glitchUniform = 0.0;
      }

      if (progress < 1.0) {
        requestAnimationFrame(animateSpin);
      } else {
        spinAngle = 0.0;
        glitchUniform = 0.0;
      }
    }
    requestAnimationFrame(animateSpin);
  }

  function initGL() {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('Fragment shader error:', gl.getShaderInfoLog(fs));
      return;
    }
    program = gl.createProgram()!;
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program); gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    // Load glyph atlas (iChannel0) and noise texture (iChannel1)
    const glyphsUrl = new URL('../assets/matrix/glyphs.png', import.meta.url).href;
    const noiseUrl = new URL('../assets/matrix/noise.png', import.meta.url).href;
    loadTexture(gl, glyphsUrl, 0);
    loadTexture(gl, noiseUrl, 1);
    const glyphLoc = gl.getUniformLocation(program, 'u_glyphs');
    const noiseLoc = gl.getUniformLocation(program, 'u_noise');
    if (glyphLoc) gl.uniform1i(glyphLoc, 0);
    if (noiseLoc) gl.uniform1i(noiseLoc, 1);

    resize(); window.addEventListener('resize', resize);
    startTime = performance.now(); frame();
    triggerGlitchSpin(1.5); // intro
  }

  // ── Pointer + zoom + drag wiring ──
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.3, Math.min(3.0, zoom + e.deltaY * -0.003));
    setUniform('u_zoom', zoom);
    for (const cb of zoomCbs) cb(zoom);
  }, { passive: false });

  container.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = 1.0 - e.clientY / window.innerHeight;
    setUniform('u_mouse', mouseX, mouseY);
    for (const cb of moveCbs) cb(e.clientX, e.clientY);

    if (isDragging) {
      const dx = (e.clientX - lastDragMX) / window.innerWidth;
      const dy = (e.clientY - lastDragMY) / window.innerHeight;
      dragRotX += dx * 4.0;
      dragRotY += dy * 3.0;
      dragVelX = dx * 4.0;
      dragVelY = dy * 3.0;
      lastDragMX = e.clientX;
      lastDragMY = e.clientY;
    }
  });
  container.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest(ignoreDragSelector)) return; // don't drag on UI
    isDragging = true;
    lastDragMX = e.clientX;
    lastDragMY = e.clientY;
    container.style.cursor = 'grabbing';
  });
  container.addEventListener('mouseup', () => { isDragging = false; container.style.cursor = ''; });
  container.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouseX = t.clientX / window.innerWidth;
    mouseY = 1.0 - t.clientY / window.innerHeight;
    setUniform('u_mouse', mouseX, mouseY);
  }, { passive: true });
  container.addEventListener('mouseleave', () => { isDragging = false; for (const cb of leaveCbs) cb(); });

  return {
    init: initGL,
    getZoom: () => zoom,
    setActivity: (v) => { activityUniform = v; },
    setSentiment: (v) => { sentimentUniform = v; },
    setBreadthGreen: (v) => { breadthGreen = v; },
    setPillTint: (v) => { pillUniform = v; },
    setContemplative: (on) => { contemplative = on; },
    triggerGlitchSpin,
    onFrame: (cb) => { frameCbs.push(cb); },
    onPointerMove: (cb) => { moveCbs.push(cb); },
    onPointerLeave: (cb) => { leaveCbs.push(cb); },
    onZoom: (cb) => { zoomCbs.push(cb); },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}
