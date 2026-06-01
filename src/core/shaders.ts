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
