// ---------------------------------------------------------------------------
// Tiny deterministic SVG motion-graphics toolkit.
// Every scene is a pure function draw(t) -> SVG markup, t = seconds in scene.
// ---------------------------------------------------------------------------
const W = 1920, H = 1080, FPS = 30;

const C = {
  bg: '#FFFFFF',
  text: '#2B3140',
  blue: '#2F54AE',
  green: '#13AA52',
  grey: '#B3B9C4',
  orange: '#C2410C',
  soft: '#F4F6FA',
  muted: '#7A8191',
  line: '#DDE1E8',
};
const SANS = "Carlito, 'DejaVu Sans', 'Noto Color Emoji', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', 'Noto Color Emoji', monospace";

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const easeIO = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIn = p => p * p * p;
const linear = p => p;
const backOut = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
// tween: 0..1 eased progress of t between t0 and t1
function tw(t, t0, t1, ease = easeIO) {
  if (t1 <= t0) return t >= t0 ? 1 : 0;
  return ease(clamp((t - t0) / (t1 - t0)));
}
// in/out envelope: fades in over [a,a+d], out over [b-d,b]
function env(t, a, b, d = 0.4) { return Math.min(tw(t, a, a + d), 1 - tw(t, b - d, b)); }

function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function mix(a, b, p) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(p)).toString(16).padStart(2, '0')).join('');
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---------- text ----------
function text(x, y, s, o = {}) {
  const {
    size = 32, weight = 400, color = C.text, anchor = 'middle', font = SANS,
    opacity = 1, ls = 0, baseline = 'central', italic = false,
  } = o;
  if (opacity <= 0.001) return '';
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}"` +
    ` fill="${color}" text-anchor="${anchor}" dominant-baseline="${baseline}" opacity="${opacity}"` +
    ` letter-spacing="${ls}" ${italic ? 'font-style="italic"' : ''} style="white-space:pre">${esc(s)}</text>`;
}
// mono line where "quoted strings" are tinted
function mono(x, y, s, o = {}) {
  const { size = 20, color = C.text, str = C.blue, anchor = 'start', opacity = 1, weight = 500 } = o;
  if (opacity <= 0.001) return '';
  const parts = String(s).split(/("[^"]*")/).filter(p => p.length);
  const spans = parts.map(p => (p[0] === '"' ? `<tspan fill="${str}">${esc(p)}</tspan>` : `<tspan>${esc(p)}</tspan>`)).join('');
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${color}"` +
    ` text-anchor="${anchor}" dominant-baseline="central" opacity="${opacity}" style="white-space:pre">${spans}</text>`;
}
const monoW = (s, size) => s.length * size * 0.6;

// ---------- geometry ----------
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function plen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
function cutAt(pts, len) {
  // returns points of the path up to arc-length len
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (acc + d >= len) {
      const f = d === 0 ? 0 : (len - acc) / d;
      out.push({ x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f) });
      return out;
    }
    acc += d; out.push(pts[i]);
  }
  return out;
}
function pointAt(pts, p) {
  const L = plen(pts); const seg = cutAt(pts, clamp(p) * L);
  const e = seg[seg.length - 1];
  const before = cutAt(pts, Math.max(0, clamp(p) * L - 2));
  const b = before[before.length - 1];
  let ang = Math.atan2(e.y - b.y, e.x - b.x);
  if (seg.length < 2 || (e.x === b.x && e.y === b.y)) ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  return { x: e.x, y: e.y, ang };
}
function qbez(a, c, b, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return pts;
}
const P = (x, y) => ({ x, y });
const line = (a, b) => [a, b];
const ptsStr = pts => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// ---------- arrows & lines ----------
function arrow(pts, o = {}) {
  const { p = 1, color = C.blue, width = 5, head = 18, opacity = 1, dash = null, dashOffset = 0, noHead = false } = o;
  if (p <= 0.001 || opacity <= 0.001) return '';
  const L = plen(pts); const len = clamp(p) * L;
  const full = cutAt(pts, len);
  const tip = full[full.length - 1];
  const pa = pointAt(pts, clamp(p));
  const hl = noHead ? 0 : Math.min(head, len);
  const body = cutAt(pts, Math.max(0, len - hl * 0.8));
  let s = `<g opacity="${opacity}">`;
  s += `<polyline points="${ptsStr(body)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"` +
    (dash ? ` stroke-dasharray="${dash}" stroke-dashoffset="${dashOffset}"` : '') + '/>';
  if (!noHead && hl > 2) {
    const a = pa.ang, hw = hl * 0.62;
    const bx = tip.x - Math.cos(a) * hl, by = tip.y - Math.sin(a) * hl;
    const p1 = P(bx + Math.cos(a + Math.PI / 2) * hw, by + Math.sin(a + Math.PI / 2) * hw);
    const p2 = P(bx - Math.cos(a + Math.PI / 2) * hw, by - Math.sin(a + Math.PI / 2) * hw);
    s += `<polygon points="${ptsStr([tip, p1, p2])}" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return s + '</g>';
}

// ---------- primitives ----------
// Database node: flat rounded cylinder centred on (x,y)
function cyl(x, y, o = {}) {
  const { w = 300, h = 220, color = C.grey, opacity = 1, scale = 1, glow = 0, glowColor = null, shakeX = 0, stroke = null } = o;
  if (opacity <= 0.001 || scale <= 0.001) return '';
  const ry = w * 0.14, hw = w / 2, hh = h / 2;
  const top = mix(color, '#FFFFFF', 0.38);
  let s = `<g transform="translate(${x + shakeX},${y}) scale(${scale})" opacity="${opacity}">`;
  if (glow > 0.001) {
    const gc = glowColor || color;
    s += `<rect x="${-hw - 22}" y="${-hh - ry - 22}" width="${w + 44}" height="${h + 2 * ry + 44}" rx="${hw * 0.5}" fill="${gc}" opacity="${0.16 * glow}"/>`;
  }
  s += `<path d="M${-hw},${-hh} L${-hw},${hh} A${hw},${ry} 0 0 0 ${hw},${hh} L${hw},${-hh} Z" fill="${color}"` +
    (stroke ? ` stroke="${stroke}" stroke-width="3"` : '') + '/>';
  s += `<ellipse cx="0" cy="${-hh}" rx="${hw}" ry="${ry}" fill="${top}"/>`;
  return s + '</g>';
}
function cylLabelY(y, o = {}) { const { w = 300, h = 220, scale = 1 } = o; return y + (h / 2 + w * 0.14) * scale + 30 * Math.max(0.6, scale); }

// Document card
function card(x, y, lines, o = {}) {
  const { size = 17, opacity = 1, scale = 1, accent = C.blue, hl = 0, hlLine = -1, hlColor = C.green, shadow = true } = o;
  if (opacity <= 0.001 || scale <= 0.001) return '';
  const maxc = Math.max(...lines.map(l => l.length));
  const w = maxc * size * 0.6 + 30, lh = size * 1.38, h = lines.length * lh + 16;
  let s = `<g transform="translate(${x},${y}) scale(${scale})" opacity="${opacity}">`;
  if (shadow) s += `<rect x="${-w / 2 + 3}" y="${-h / 2 + 4}" width="${w}" height="${h}" rx="8" fill="#2B3140" opacity="0.10"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="8" fill="#FFFFFF" stroke="#2B3140" stroke-opacity="0.18" stroke-width="1.5"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="6" height="${h}" rx="3" fill="${accent}"/>`;
  lines.forEach((l, i) => {
    const ly = -h / 2 + 8 + lh * (i + 0.5);
    if (i === hlLine && hl > 0.001) s += `<rect x="${-w / 2 + 10}" y="${ly - lh / 2}" width="${w - 16}" height="${lh}" rx="4" fill="${hlColor}" opacity="${0.22 * hl}"/>`;
    s += mono(-w / 2 + 17, ly, l, { size });
  });
  return s + '</g>';
}
function cardSize(lines, size = 17) {
  const maxc = Math.max(...lines.map(l => l.length));
  return { w: maxc * size * 0.6 + 30, h: lines.length * size * 1.38 + 16 };
}

// pill chip (oplog entry / query in flight)
function chip(x, y, s, o = {}) {
  const { size = 19, fill = C.blue, color = '#FFFFFF', opacity = 1, scale = 1, strColor = null } = o;
  if (opacity <= 0.001 || scale <= 0.001) return '';
  const w = monoW(s, size) + 30, h = size * 1.75;
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="${opacity}">` +
    `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>` +
    mono(0, 1, s, { size, color, str: strColor || color, anchor: 'middle', weight: 600 }) + '</g>';
}

function appIcon(x, y, o = {}) {
  const { opacity = 1, scale = 1, label = 'App' } = o;
  if (opacity <= 0.001) return '';
  const w = 170, h = 120;
  let s = `<g transform="translate(${x},${y}) scale(${scale})" opacity="${opacity}">`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="14" fill="#FFFFFF" stroke="${C.blue}" stroke-width="5"/>`;
  s += `<path d="M${-w / 2 + 2},${-h / 2 + 30} L${w / 2 - 2},${-h / 2 + 30}" stroke="${C.blue}" stroke-width="4"/>`;
  s += `<path d="M${-w / 2 + 2.5},${-h / 2 + 30} L${-w / 2 + 2.5},${-h / 2 + 14} Q${-w / 2 + 2.5},${-h / 2 + 2.5} ${-w / 2 + 14},${-h / 2 + 2.5} L${w / 2 - 14},${-h / 2 + 2.5} Q${w / 2 - 2.5},${-h / 2 + 2.5} ${w / 2 - 2.5},${-h / 2 + 14} L${w / 2 - 2.5},${-h / 2 + 30} Z" fill="${C.blue}"/>`;
  [0, 1, 2].forEach(i => { s += `<circle cx="${-w / 2 + 18 + i * 16}" cy="${-h / 2 + 16}" r="4.5" fill="#FFFFFF"/>`; });
  s += `<rect x="-55" y="-14" width="110" height="10" rx="5" fill="${C.grey}"/>`;
  s += `<rect x="-55" y="6" width="80" height="10" rx="5" fill="${C.grey}"/>`;
  s += `<rect x="-55" y="26" width="95" height="10" rx="5" fill="${C.grey}"/>`;
  s += '</g>';
  s += text(x, y + (h / 2) * scale + 32, label, { size: 32, weight: 700, opacity });
  return s;
}

// orange X, progressively drawn
function xMark(x, y, size, p, o = {}) {
  const { color = C.orange, width = 16, opacity = 1 } = o;
  if (p <= 0.001) return '';
  const a = clamp(p * 2), b = clamp(p * 2 - 1), r = size / 2;
  let s = `<g opacity="${opacity}">`;
  s += `<line x1="${x - r}" y1="${y - r}" x2="${x - r + size * a}" y2="${y - r + size * a}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  if (b > 0) s += `<line x1="${x + r}" y1="${y - r}" x2="${x + r - size * b}" y2="${y - r + size * b}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  return s + '</g>';
}
function checkMark(x, y, size, p, o = {}) {
  const { color = C.green, width = 12, opacity = 1 } = o;
  if (p <= 0.001) return '';
  const pts = [P(x - size * 0.45, y), P(x - size * 0.12, y + size * 0.33), P(x + size * 0.5, y - size * 0.35)];
  return arrow(pts, { p, color, width, noHead: true, opacity });
}

function ballot(x, y, o = {}) {
  const { opacity = 1, scale = 1, paper = 0, paperFrom = null } = o;
  if (opacity <= 0.001) return '';
  let s = `<g transform="translate(${x},${y}) scale(${scale})" opacity="${opacity}">`;
  s += `<rect x="-40" y="-8" width="80" height="56" rx="8" fill="#FFFFFF" stroke="${C.text}" stroke-width="4"/>`;
  s += `<rect x="-24" y="-11" width="48" height="8" rx="4" fill="${C.text}"/>`;
  s += '</g>';
  return s;
}
function ballotPaper(x, y, o = {}) {
  const { opacity = 1, scale = 1, rot = 0 } = o;
  if (opacity <= 0.001) return '';
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${scale})" opacity="${opacity}">` +
    `<rect x="-20" y="-26" width="40" height="52" rx="4" fill="#FFFFFF" stroke="${C.blue}" stroke-width="3"/>` +
    `<polyline points="-10,0 -3,9 11,-10" fill="none" stroke="${C.blue}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

// rounded panel
function panel(x, y, w, h, o = {}) {
  const { fill = C.soft, stroke = C.line, sw = 2, rx = 16, opacity = 1, dash = null } = o;
  if (opacity <= 0.001) return '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"` +
    (dash ? ` stroke-dasharray="${dash}"` : '') + '/>';
}

// small "oplog" ribbon panel; lines: [{text, p, hl}]
function oplog(x, y, w, lines, o = {}) {
  const { opacity = 1, size = 21, title = 'oplog', glow = 0, lh = 40, rows = 4, accent = C.blue, older = true } = o;
  if (opacity <= 0.001) return '';
  const h = 54 + rows * lh + 10;
  let s = `<g opacity="${opacity}">`;
  if (glow > 0.001) s += `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="22" fill="${accent}" opacity="${0.14 * glow}"/>`;
  s += panel(x, y, w, h, { fill: '#FFFFFF', stroke: accent, sw: 3 });
  s += `<rect x="${x}" y="${y}" width="${w}" height="46" rx="16" fill="${accent}"/>`;
  s += `<rect x="${x}" y="${y + 30}" width="${w}" height="16" fill="${accent}"/>`;
  s += text(x + 20, y + 24, title, { size: 26, weight: 700, color: '#FFFFFF', anchor: 'start', font: MONO });
  // clip area for scrolling lines
  const cid = 'clip' + Math.round(x) + '_' + Math.round(y);
  s += `<clipPath id="${cid}"><rect x="${x}" y="${y + 48}" width="${w}" height="${h - 50}"/></clipPath><g clip-path="url(#${cid})">`;
  const vis = lines.filter(l => (l.p ?? 1) > 0);
  // total "scroll" = sum of progress; lines stack from top, keep last `rows`
  let total = 0; vis.forEach(l => total += (l.p ?? 1));
  const scroll = Math.max(0, total + (older ? 1 : 0) - rows);
  let idx = 0;
  if (older) {
    const oy = y + 54 + lh * (0.5) - scroll * lh;
    s += text(x + 20, oy, '… older ops', { size: size - 2, color: C.muted, anchor: 'start', font: MONO });
    idx = 1;
  }
  let acc = older ? 1 : 0;
  vis.forEach(l => {
    const pp = l.p ?? 1;
    const ly = y + 54 + lh * (acc + 0.5) - scroll * lh + (1 - pp) * lh * 0.6;
    if ((l.hl || 0) > 0.001) s += `<rect x="${x + 8}" y="${ly - lh / 2 + 3}" width="${w - 16}" height="${lh - 6}" rx="6" fill="${l.hlColor || C.blue}" opacity="${0.16 * l.hl}"/>`;
    s += mono(x + 20, ly, l.text, { size, opacity: pp * (l.op ?? 1), str: C.blue });
    acc += pp;
  });
  s += '</g></g>';
  return s;
}
function oplogH(rows = 4, lh = 40) { return 54 + rows * lh + 10; }

// caption band at the bottom of every scene (>= 48 px; wraps to two lines)
function caption(s, opacity = 1) {
  if (!s) return '';
  const fits = (str, size) => str.length * size * 0.47 <= 1780;
  let body;
  if (fits(s, 52)) {
    body = text(W / 2, 1016, s, { size: 52 });
  } else {
    // split at the sentence / separator break closest to the middle, else at a space
    const mid = s.length / 2;
    const cands = [];
    for (const re of [/\. /g, / · /g, /\.\.\./g, /, /g, / /g]) {
      let m; while ((m = re.exec(s))) cands.push({ i: m.index + m[0].length, pri: [/\. /g, / · /g, /\.\.\./g, /, /g, / /g].findIndex(r => r.source === re.source) });
      if (cands.length) break;
    }
    const parts = i => [s.slice(0, i).trim().replace(/\s*·$/, ''), s.slice(i).trim()];
    cands.sort((x, y) => Math.max(...parts(x.i).map(l => l.length)) - Math.max(...parts(y.i).map(l => l.length)));
    const [l1, l2] = parts(cands[0].i);
    body = text(W / 2, 986, l1, { size: 48 }) + text(W / 2, 1044, l2, { size: 48 });
  }
  return `<g opacity="${opacity}"><rect x="0" y="952" width="${W}" height="128" fill="${C.soft}"/>` +
    `<rect x="0" y="952" width="${W}" height="3" fill="${C.line}"/>` + body + '</g>';
}

// tiny tag/badge
function tag(x, y, s, o = {}) {
  const { size = 26, fill = C.blue, color = '#FFFFFF', opacity = 1, scale = 1, weight = 700, font = SANS, anchor = 'middle' } = o;
  if (opacity <= 0.001) return '';
  const w = s.length * size * (font === MONO ? 0.6 : 0.5) + 34, h = size * 1.6;
  const cx = anchor === 'start' ? x + w / 2 : x;
  return `<g transform="translate(${cx},${y}) scale(${scale})" opacity="${opacity}">` +
    `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>` +
    text(0, 1, s, { size, weight, color, font }) + '</g>';
}
