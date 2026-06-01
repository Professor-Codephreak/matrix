// matrix-fx — WebGL shaders
//
// Matrix rain shader, faithful to the original Shadertoy expression (ldccW4).
// iChannel0 = glyph atlas (16x16 katakana), iChannel1 = noise texture.
// Enhanced with market-driven speed, sentiment color, pill tinting, a glitch
// pass (chromatic split + scanline tear) and a full-rotation spin.

export const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAG = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_pill;
uniform float u_zoom;
uniform vec2 u_mouse;
uniform float u_activity;
uniform float u_sentiment;
uniform float u_dragX;
uniform float u_dragY;
uniform float u_breadth;
uniform sampler2D u_glyphs;
uniform sampler2D u_noise;
uniform float u_glitch;   // 0 = normal, 0-1 = glitch intensity
uniform float u_spin;     // 0-2π spin rotation angle
uniform float u_swirl;    // 0 = rain, 1 = the swirl is a blockchain chain

// ── Text: sample a random character from the 16x16 glyph atlas ──
// Faithful to Shadertoy ldccW4 text() function
float text(vec2 fragCoord) {
  vec2 uv = mod(fragCoord, 16.0) * 0.0625;        // position within 16px cell
  vec2 block = fragCoord * 0.0625 - uv;             // which cell
  uv = uv * 0.8 + 0.1;                              // scale letters up
  // Randomize letter using noise texture + time scroll
  uv += floor(texture2D(u_noise, block / 256.0 + u_time * 0.002).xy * 16.0);
  uv *= 0.0625;                                     // back to atlas UV range
  uv.x = 1.0 - uv.x;                               // flip horizontal
  return texture2D(u_glyphs, uv).r;
}

// ── Rain: per-column falling green streaks ──
// Faithful to Shadertoy ldccW4 rain() function
// Enhanced: speed driven by market activity, color by sentiment
vec3 rain(vec2 fragCoord) {
  fragCoord.x -= mod(fragCoord.x, 16.0);            // snap to column grid

  float offset = sin(fragCoord.x * 15.0);            // per-column phase offset
  float speed = cos(fragCoord.x * 3.0) * 0.3 + 0.7; // per-column speed variation

  // Market activity drives overall rain speed
  float act = 0.5 + u_activity * 1.5;
  float y = fract(fragCoord.y / u_resolution.y + u_time * speed * act + offset);

  // Base color: green matrix, shifted by sentiment
  float sent = u_sentiment;
  float bear = max(0.0, -sent);
  float bull = max(0.0, sent);
  vec3 rainColor = vec3(0.1, 1.0, 0.35);             // classic matrix green
  rainColor = mix(rainColor, vec3(1.0, 0.15, 0.1), bear * 0.5);  // red when bearish
  rainColor = mix(rainColor, vec3(0.1, 1.0, 0.5), bull * 0.2);   // brighter green when bullish

  // Pill tinting
  if (u_pill > 0.5 && u_pill < 1.5) {
    rainColor = mix(rainColor, vec3(1.0, 0.2, 0.1), 0.6);   // red pill
  } else if (u_pill > 1.5) {
    rainColor = mix(rainColor, vec3(0.1, 0.4, 1.0), 0.6);   // blue pill
  }

  return rainColor / (y * 20.0);
}

// ── Blockchain chain ──────────────────────────────────────────────
// A chain link rendered as the outline of a stadium (capsule): the metal
// ring of one link of a chain. Negative inside the metal, positive outside.
float linkOutline(vec2 q, float halfLen, float rad, float thick) {
  q.x -= clamp(q.x, -halfLen, halfLen);   // collapse to the segment core
  float d = length(q) - rad;              // filled capsule
  return abs(d) - thick;                  // hollow it into a ring
}

// Concentric rings of interlocking links, rotating by rot. As the rain's
// bullet-time drag / glitch-spin winds up, this is the swirl — a blockchain
// of connected links coiling around the screen centre. Returns glowing colour.
vec3 chainSwirl(vec2 fc, vec2 res, float rot) {
  float scl = min(res.x, res.y);
  vec2 p = (fc - res * 0.5) / scl;        // centred, ~[-0.5, 0.5]
  float r = length(p);

  float best = 1e9;
  float bestIdx = 0.0;
  const int RINGS = 4;
  for (int k = 0; k < RINGS; k++) {
    float fk = float(k);
    float R = 0.13 + fk * 0.085;          // ring radius, outward
    float N = 10.0 + fk * 4.0;            // links around this ring
    float a = atan(p.y, p.x) + rot * (1.0 + fk * 0.06); // differential spin → swirl
    float twoPi = 6.2831853;
    float cellF = (a / twoPi) * N;
    float i = floor(cellF);
    float cellArc = (twoPi / N) * R;      // arc length of one link cell
    float halfLen = cellArc * 0.62;       // >half → neighbours interlock

    // Evaluate this cell and its two neighbours so links overlap cleanly.
    for (int di = -1; di <= 1; di++) {
      float idx = i + float(di);
      float aLink = (idx + 0.5) / N * twoPi;   // link centre angle
      vec2 q = vec2((a - aLink) * R, r - R);   // along-arc, radial
      if (mod(idx, 2.0) > 0.5) q = q.yx;       // alternate 90° → interlock
      float d = linkOutline(q, halfLen, 0.024, 0.011);  // thicker metal → more visible
      if (d < best) { best = d; bestIdx = idx + fk * 100.0; }
    }
  }

  float edge = smoothstep(0.012, 0.0, best);     // crisp metal (wider, brighter)
  float glow = exp(-max(best, 0.0) * 38.0);      // softer, broader bloom
  vec3 green = vec3(0.20, 1.0, 0.55);            // brighter matrix green
  // Alternate links shimmer slightly so the chain reads as discrete blocks.
  float block = 0.88 + 0.12 * sin(bestIdx * 1.7);
  vec3 c = green * (edge * 2.0 + glow * 1.1) * block;
  c += vec3(0.55, 1.0, 0.7) * edge * 0.6;        // white-hot core on the metal

  // Carry the rain's pill tint so the chain matches the active pill.
  if (u_pill > 0.5 && u_pill < 1.5) c = mix(c, c.gbr * vec3(1.0, 0.4, 0.3), 0.5); // red
  else if (u_pill > 1.5) c = mix(c, c.brg, 0.5);                                  // blue
  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 res = u_resolution;
  float z = u_zoom;

  // ── Spin: rotate rain coordinates around screen center ──
  vec2 center = res * 0.5;
  vec2 p = fc - center;
  float cs = cos(u_spin), sn = sin(u_spin);
  vec2 rotated = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs) + center;

  // Scale coordinates by zoom
  vec2 scaled = rotated / z;

  // ── Glitch: chromatic split + scanline tear ──
  float g = u_glitch;
  vec3 col;
  if (g > 0.01) {
    // Chromatic aberration — split RGB channels
    float shift = g * 12.0;
    float r = text(scaled + vec2(shift, 0.0)) * rain(scaled + vec2(shift, 0.0)).r;
    float gn = text(scaled) * rain(scaled).g;
    float b = text(scaled - vec2(shift, 0.0)) * rain(scaled - vec2(shift, 0.0)).b;
    col = vec3(r, gn, b);

    // Scanline tear — horizontal displacement
    float tearLine = fract(u_time * 3.7 + g * 5.0);
    float tearDist = abs(fc.y / res.y - tearLine);
    if (tearDist < 0.02 * g) {
      col = col.grb; // channel swap on tear line
      scaled.x += g * 40.0; // horizontal shift
      col += text(scaled) * rain(scaled) * 0.3;
    }

    // Flash — bright pulse at peak glitch
    col += vec3(g * g * 0.4);

    // Character scramble — extra noise in glyph selection
    col *= 0.7 + 0.3 * fract(sin(dot(fc, vec2(12.9898, 78.233)) + u_time * 100.0) * 43758.5453);
  } else {
    // Normal: the classic matrix expression
    col = text(scaled) * rain(scaled);
  }

  // ── Blockchain chain ──
  // The bullet-time drag and glitch-spin no longer just rotate the rain — the
  // swirl resolves into a rotating chain of connected links. u_dragX carries
  // the drag rotation, u_spin the glitch-spin; u_swirl cross-fades rain→chain.
  if (u_swirl > 0.001) {
    vec3 chain = chainSwirl(fc, res, u_spin + u_dragX);
    // Dim the rain hard under the swirl, then add the chain on top so the
    // links stay bright even at partial swirl.
    col = col * (1.0 - 0.85 * u_swirl) + chain * clamp(u_swirl, 0.0, 1.0);
  }

  // Mouse glow — subtle cursor awareness
  vec2 mp = u_mouse * res;
  float md = length(fc - mp) / max(res.x, res.y);
  float mglow = smoothstep(0.2, 0.0, md) * 0.08;
  col += col * mglow * 3.0;

  // Vignette — darken edges
  vec2 uv = fc / res;
  col *= 1.0 - 0.5 * pow(length(uv - 0.5) * 1.5, 2.5);

  // Subtle scanlines
  col *= 0.95 + 0.05 * sin(fc.y * 3.0);

  gl_FragColor = vec4(col, 1.0);
}
`;
