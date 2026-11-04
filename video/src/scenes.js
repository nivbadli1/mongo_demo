// ---------------------------------------------------------------------------
// MongoDB architecture explainer — 14 scenes.
// Each scene: { id, part, dur, caption, fadeIn, fadeOut, draw(t) }
// ---------------------------------------------------------------------------

// ======================= shared replica-set layout ==========================
const APP = P(200, 300);
const NP = P(960, 280);   // original PRIMARY (top)
const NS1 = P(520, 680);  // bottom-left SECONDARY (becomes PRIMARY)
const NS2 = P(1400, 680); // bottom-right SECONDARY
const NW = 300, NH = 220;

const CARD1_NEW = ['{order_id: "ORD-10001",', ' status: "new"}'];
const CARD1_PAID = ['{order_id: "ORD-10001",', ' status: "paid"}'];
const CARD2 = ['{order_id: "ORD-10002"}'];
const CARD3 = ['{order_id: "ORD-10003"}'];

// centre of the i-th card slot inside a node (cards stack from the top)
function slot(n, cards, i) {
  let y = n.y - NH / 2 + NW * 0.14 + 16;
  for (let k = 0; k < i; k++) y += cardSize(cards[k]).h + 8;
  return P(n.x, y + cardSize(cards[i]).h / 2);
}

// draws one replica-set node with its cards / failure decorations / label
function rsNode(n, o = {}) {
  const {
    color = C.grey, opacity = 1, scale = 1, glow = 0, shakeX = 0,
    cards = [], label = '', labelColor = C.muted, label2 = null, label2Color = C.green, labelMix = 0,
    crack = 0, x = 0,
  } = o;
  if (opacity <= 0.001 || scale <= 0.001) return '';
  let s = cyl(n.x, n.y, { w: NW, h: NH, color, opacity, scale, glow, shakeX });
  const layout = cards.map(c => c.lines);
  cards.forEach((c, i) => {
    const sp = slot(n, layout, i);
    s += card(sp.x + shakeX, sp.y, c.lines, { opacity: opacity * (c.opacity ?? 1), scale: scale * (c.scale ?? 1), hl: c.hl || 0, hlLine: c.hlLine ?? -1 });
  });
  if (crack > 0.001) {
    const pts = [P(n.x - 30, n.y - 150), P(n.x + 10, n.y - 85), P(n.x - 25, n.y - 30), P(n.x + 30, n.y + 25), P(n.x + 5, n.y + 80)];
    s += arrow(pts.map(p => P(p.x + shakeX, p.y)), { p: crack, color: '#FFFFFF', width: 9, noHead: true });
    s += arrow(pts.map(p => P(p.x + shakeX, p.y)), { p: crack, color: C.text, width: 3, noHead: true, opacity: 0.5 });
  }
  if (x > 0.001) s += xMark(n.x, n.y + 5, 130, x, { width: 20 });
  const ly = cylLabelY(n.y, { w: NW, h: NH, scale });
  if (label) s += text(n.x, ly, label, { size: 32, weight: 700, color: labelColor, opacity: opacity * (1 - labelMix), ls: 1 });
  if (label2) s += text(n.x, ly, label2, { size: 32, weight: 700, color: label2Color, opacity: opacity * labelMix, ls: 1 });
  return s;
}

// paths
const PATH_APP_P = line(P(300, 300), P(790, 285));
const PATH_APP_S1 = qbez(P(295, 345), P(390, 390), P(415, 548));
const REPL_S1 = line(P(830, 425), P(640, 548));
const REPL_S2 = line(P(1090, 425), P(1280, 548));
const HB_P_S1 = line(P(815, 410), P(625, 540));
const HB_P_S2 = line(P(1105, 410), P(1295, 540));
const HB_S1_S2 = line(P(690, 700), P(1230, 700));
const RIBBON = { x: 1150, y: 130, w: 520 };

function ribbonConnector(op) {
  if (op <= 0.001) return '';
  return `<g opacity="${op}"><path d="M1112,230 L1150,215 L1150,245 Z" fill="${C.blue}"/></g>`;
}

// heartbeat dotted line + travelling hearts
function heartbeat(pts, t, o = {}) {
  const { opacity = 1, pulses = [], dash = '3 16', color = C.blue, width = 6 } = o;
  if (opacity <= 0.001) return '';
  let s = arrow(pts, { p: o.p ?? 1, color, width, noHead: true, dash, dashOffset: -t * 30, opacity: 0.55 * opacity });
  pulses.forEach(t0 => {
    const k = (t - t0) / 0.9;
    if (k > 0 && k < 1) {
      const e = easeIO(k);
      const a = pointAt(pts, e), b = pointAt(pts, 1 - e);
      const op = opacity * Math.min(1, Math.min(k, 1 - k) * 6);
      s += text(a.x, a.y, '♥', { size: 34, color: C.blue, opacity: op, font: "'DejaVu Sans', sans-serif" });
      s += text(b.x, b.y, '♥', { size: 34, color: C.blue, opacity: op, font: "'DejaVu Sans', sans-serif" });
    }
  });
  return s;
}
function ring(c, t, t0, o = {}) {
  const { color = C.blue, r0 = 170, r1 = 230 } = o;
  const k = (t - t0) / 0.7;
  if (k <= 0 || k >= 1) return '';
  return `<ellipse cx="${c.x}" cy="${c.y}" rx="${lerp(r0, r1, k)}" ry="${lerp(r0, r1, k) * 0.95}" fill="none" stroke="${color}" stroke-width="4" opacity="${0.5 * (1 - k)}"/>`;
}

function stopwatch(x, y, p, o = {}) {
  const { opacity = 1, done = 0 } = o;
  if (opacity <= 0.001) return '';
  const r = 34, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * clamp(p) * 0.9999;
  const large = p > 0.5 ? 1 : 0;
  let s = `<g opacity="${opacity}">`;
  s += panel(x - 60, y - 52, 410, 104, { fill: '#FFFFFF', stroke: C.line, rx: 52 });
  s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.line}" stroke-width="8"/>`;
  if (p > 0.001) s += `<path d="M${x + r * Math.cos(a0)},${y + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${x + r * Math.cos(a1)},${y + r * Math.sin(a1)}" fill="none" stroke="${mix(C.blue, C.green, done)}" stroke-width="8" stroke-linecap="round"/>`;
  s += `<rect x="${x - 6}" y="${y - r - 18}" width="12" height="10" rx="3" fill="${C.text}"/>`;
  s += text(x + 56, y + 1, '~ a few seconds', { size: 36, weight: 700, anchor: 'start' });
  return s + '</g>';
}

// ---------------------------- sharding helpers ------------------------------
function shardBox(x, y, o = {}) {
  const {
    name = 'Shard A', range = '', w = 360, h = 250, opacity = 1, dim = 0, hot = 0, glow = 0,
    labels = 0, ribbon = 0, ribbonGlow = 0, shakeX = 0, scale = 1, rangeSize = 22, inner = 1,
  } = o;
  if (opacity <= 0.001) return '';
  const op = opacity * (1 - 0.75 * dim);
  let s = `<g transform="translate(${x + shakeX},${y}) scale(${scale})" opacity="${op}">`;
  if (glow > 0.001) s += `<rect x="${-w / 2 - 16}" y="${-h / 2 - 16}" width="${w + 32}" height="${h + 32}" rx="30" fill="${hot > 0.5 ? C.orange : C.blue}" opacity="${0.16 * glow}"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="20" fill="${mix('#FFFFFF', C.orange, 0.10 * hot)}" stroke="${mix(C.grey, C.orange, hot)}" stroke-width="${3 + 2 * hot}"/>`;
  s += text(-w / 2 + 22, -h / 2 + 34, name, { size: 30, weight: 700, anchor: 'start', color: mix(C.text, C.orange, hot) });
  if (range) s += mono(w / 2 - 22, -h / 2 + 34, range, { size: rangeSize, anchor: 'end', color: mix(C.blue, C.orange, hot), weight: 700 });
  if (inner > 0.001) {
    s += `<g opacity="${inner}">`;
    s += cyl(0, -2, { w: 90, h: 62, color: C.green });
    s += cyl(-105, 55, { w: 90, h: 62, color: C.grey });
    s += cyl(105, 55, { w: 90, h: 62, color: C.grey });
    if (labels > 0.001) {
      s += text(0, 56, 'PRIMARY', { size: 14, weight: 700, color: C.green, opacity: labels });
      s += text(-105, 112, 'SECONDARY', { size: 14, weight: 700, color: C.muted, opacity: labels });
      s += text(105, 112, 'SECONDARY', { size: 14, weight: 700, color: C.muted, opacity: labels });
    }
    if (ribbon > 0.001) {
      if (ribbonGlow > 0.001) s += `<rect x="44" y="-38" width="106" height="42" rx="12" fill="${C.blue}" opacity="${0.28 * ribbonGlow}"/>`;
      s += `<rect x="52" y="-30" width="90" height="26" rx="6" fill="${C.blue}" opacity="${ribbon}"/>`;
      s += text(97, -16, 'oplog', { size: 16, weight: 700, color: '#FFFFFF', font: MONO, opacity: ribbon });
    }
    s += '</g>';
  }
  return s + '</g>';
}

function mongosBox(x, y, o = {}) {
  const { opacity = 1, w = 280, h = 140, glow = 0, scale = 1, sub = '(router)' } = o;
  if (opacity <= 0.001) return '';
  let s = `<g transform="translate(${x},${y}) scale(${scale})" opacity="${opacity}">`;
  if (glow > 0.001) s += `<rect x="${-w / 2 - 14}" y="${-h / 2 - 14}" width="${w + 28}" height="${h + 28}" rx="28" fill="${C.blue}" opacity="${0.18 * glow}"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="20" fill="${C.blue}"/>`;
  s += text(0, sub ? -14 : 0, 'mongos', { size: 44, weight: 700, color: '#FFFFFF', font: MONO });
  if (sub) s += text(0, 34, sub, { size: 28, color: '#FFFFFF' });
  return s + '</g>';
}

// config servers box with the chunk map table; hl = [rowHighlight...]
function configBox(x, y, o = {}) {
  const { opacity = 1, w = 400, rows = [['A–H', 'Shard A'], ['I–P', 'Shard B'], ['Q–Z', 'Shard C']], hl = [0, 0, 0], hlColor = C.blue, flash = 0 } = o;
  if (opacity <= 0.001) return '';
  const rh = 44, h = 64 + rows.length * rh + 14;
  let s = `<g opacity="${opacity}">`;
  s += panel(x - w / 2, y - h / 2, w, h, { fill: '#FFFFFF', stroke: C.blue, sw: 3, rx: 16 });
  s += text(x, y - h / 2 + 32, 'config servers', { size: 30, weight: 700, color: C.blue });
  s += `<line x1="${x - w / 2 + 16}" y1="${y - h / 2 + 56}" x2="${x + w / 2 - 16}" y2="${y - h / 2 + 56}" stroke="${C.line}" stroke-width="2"/>`;
  rows.forEach((r, i) => {
    const ry = y - h / 2 + 64 + rh * (i + 0.5);
    const hv = Math.max(hl[i] || 0, flash);
    if (hv > 0.001) s += `<rect x="${x - w / 2 + 12}" y="${ry - rh / 2 + 3}" width="${w - 24}" height="${rh - 6}" rx="8" fill="${flash > (hl[i] || 0) ? C.orange : hlColor}" opacity="${0.18 * hv}"/>`;
    s += mono(x - 30, ry, r[0], { size: 26, anchor: 'end', weight: 700, color: C.blue });
    s += mono(x - 10, ry, '→', { size: 26, anchor: 'start', color: C.muted });
    s += text(x + 30, ry, r[1], { size: 28, anchor: 'start', weight: 700 });
  });
  return s + '</g>';
}

function meter(x, y, w, p, o = {}) {
  const { color = C.blue, opacity = 1 } = o;
  if (opacity <= 0.001) return '';
  return `<g opacity="${opacity}"><rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="22" rx="11" fill="${C.line}"/>` +
    `<rect x="${x - w / 2}" y="${y - 11}" width="${Math.max(22, w * clamp(p))}" height="22" rx="11" fill="${color}"/></g>`;
}

// ================================ SCENES =====================================
const SCENES = [];

// ---------------------------------------------------------------- Scene 1
SCENES.push({
  id: 1, part: 1, dur: 8, fadeIn: true, fadeOut: true,
  caption: 'A replica set is a group of servers holding the same data.',
  draw(t) {
    let s = '';
    s += tag(960, 190, 'PART 1', { size: 30, opacity: tw(t, 0.2, 0.8), fill: C.blue });
    const ti = tw(t, 0.4, 1.3, easeOut);
    s += `<g transform="translate(0,${(1 - ti) * 24})">` + text(960, 300, 'Replica Set — 3 copies of the same data', { size: 76, weight: 700, opacity: ti }) + '</g>';
    const xs = [560, 960, 1360];
    const colors = [C.grey, C.green, C.grey];
    const pops = [2.5, 1.7, 2.7];
    const c1 = ['{order_id: "ORD-10001"}'];
    xs.forEach((x, i) => {
      const sc = tw(t, pops[i], pops[i] + 0.6, backOut);
      s += cyl(x, 650, { w: 340, h: 220, color: colors[i], scale: sc, opacity: clamp(sc * 2) });
    });
    // card in middle, then copies fly to the sides
    s += card(960, 640, c1, { size: 20, scale: tw(t, 2.1, 2.6, backOut), opacity: tw(t, 2.1, 2.3) });
    [560, 1360].forEach((x, i) => {
      const k = tw(t, 3.3 + i * 0.25, 4.5 + i * 0.25);
      if (k > 0) {
        const path = qbez(P(960, 640), P((960 + x) / 2, 470), P(x, 640));
        const pt = pointAt(path, k);
        s += card(pt.x, pt.y, c1, { size: 20, opacity: clamp(k * 5) });
      }
    });
    const lab = tw(t, 4.8, 5.4);
    s += text(960, 900, '= same data, 3 times', { size: 38, weight: 700, color: C.blue, opacity: lab });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 2
SCENES.push({
  id: 2, part: 1, dur: 12, fadeIn: true, fadeOut: false,
  caption: 'The app writes only to the PRIMARY.',
  draw(t) {
    let s = '';
    const ai = tw(t, 0.2, 0.9, easeOut);
    s += `<g transform="translate(${(1 - ai) * -60},0)">` + appIcon(APP.x, APP.y, { opacity: ai }) + '</g>';
    // write arrow App -> PRIMARY
    s += arrow(PATH_APP_P, { p: tw(t, 2.3, 3.0), width: 6 });
    s += text(545, 262, 'writes', { size: 28, weight: 700, color: C.blue, opacity: tw(t, 2.8, 3.3) });
    // ghost arrow to a secondary with an X
    const g = tw(t, 6.0, 6.8);
    s += arrow(line(P(250, 375), P(392, 560)), { p: g, color: C.grey, width: 5, dash: '10 10', opacity: 1 - tw(t, 10.5, 11.5) });
    s += xMark(321, 467, 46, tw(t, 6.7, 7.3), { width: 11, opacity: 1 - tw(t, 10.5, 11.5) });

    const land = tw(t, 4.6, 4.61);
    const pc = [{ lines: CARD1_NEW, opacity: land }];
    const absorb = env(t, 4.5, 5.6, 0.4);
    s += rsNode(NP, { color: C.green, scale: tw(t, 0.5, 1.1, backOut), opacity: tw(t, 0.5, 0.8), label: 'PRIMARY', labelColor: C.green, cards: pc, glow: absorb });
    s += rsNode(NS1, { color: C.grey, scale: tw(t, 0.8, 1.4, backOut), opacity: tw(t, 0.8, 1.1), label: 'SECONDARY' });
    s += rsNode(NS2, { color: C.grey, scale: tw(t, 1.1, 1.7, backOut), opacity: tw(t, 1.1, 1.4), label: 'SECONDARY' });

    // flying card
    if (t >= 1.9 && t < 4.6) {
      const k = tw(t, 3.1, 4.6);
      const start = P(APP.x, 170), end = slot(NP, [CARD1_NEW], 0);
      const pt = pointAt(qbez(start, P(560, 130), end), k);
      s += card(pt.x, pt.y, CARD1_NEW, { scale: tw(t, 1.9, 2.5, backOut) });
    }
    return s;
  },
});

// state used by scenes 3-6 ---------------------------------------------------
function rsArrowApp(t, o = {}) { return arrow(PATH_APP_P, { width: 6, ...o }); }

// ---------------------------------------------------------------- Scene 3
SCENES.push({
  id: 3, part: 1, dur: 15, fadeIn: false, fadeOut: false,
  caption: 'Every write is recorded in the oplog. Secondaries copy from it.',
  draw(t) {
    let s = '';
    s += appIcon(APP.x, APP.y);
    s += rsArrowApp(t);
    s += text(545, 262, 'writes', { size: 28, weight: 700, color: C.blue, opacity: 1 - tw(t, 0, 0.5) });
    // replication arrows
    const ra = tw(t, 1.8, 2.4);
    s += arrow(REPL_S1, { p: ra, width: 5 });
    s += arrow(REPL_S2, { p: ra, width: 5 });

    // PRIMARY card: status new -> paid at 7.2
    const paid = t >= 7.2;
    const pcard = { lines: paid ? CARD1_PAID : CARD1_NEW, hl: env(t, 7.2, 9.0, 0.3), hlLine: 1 };
    s += rsNode(NP, { color: C.green, label: 'PRIMARY', labelColor: C.green, cards: [pcard], glow: env(t, 7.1, 8.0, 0.3) });

    // secondaries receive
    const s1 = [], s2 = [];
    const arrive1 = 4.0, arrive2 = 9.9;
    [s1, s2].forEach(arr => {
      if (t >= arrive1) {
        arr.push({ lines: t >= arrive2 ? CARD1_PAID : CARD1_NEW, scale: tw(t, arrive1, arrive1 + 0.5, backOut), hl: env(t, arrive2, arrive2 + 1.6, 0.3), hlLine: 1 });
      }
    });
    s += rsNode(NS1, { color: C.grey, label: 'SECONDARY', cards: s1, glow: env(t, 3.9, 4.8, 0.3) + env(t, 9.8, 10.7, 0.3) });
    s += rsNode(NS2, { color: C.grey, label: 'SECONDARY', cards: s2, glow: env(t, 3.9, 4.8, 0.3) + env(t, 9.8, 10.7, 0.3) });

    // oplog ribbon
    const ro = tw(t, 0.3, 1.2);
    s += ribbonConnector(ro);
    const lines = [
      { text: 'insert {order_id: "ORD-10001"}', p: tw(t, 1.4, 2.0), hl: env(t, 1.4, 4.4, 0.3) },
      { text: 'update ORD-10001 {status: "paid"}', p: tw(t, 7.6, 8.1), hl: env(t, 7.6, 10.4, 0.3) },
    ];
    s += `<g transform="translate(${(1 - ro) * 40},0)">` + oplog(RIBBON.x, RIBBON.y, RIBBON.w, lines, { opacity: ro, rows: 3 }) + '</g>';

    // chips travelling to secondaries
    const travel = (path, t0, t1, label) => {
      const k = tw(t, t0, t1);
      if (t < t0 || t > t1 + 0.4) return '';
      const pt = pointAt(path, k);
      return chip(pt.x, pt.y, label, { opacity: 1 - tw(t, t1, t1 + 0.4), scale: 1 - 0.3 * tw(t, t1, t1 + 0.4) });
    };
    const pathS1 = [P(900, 380), P(640, 548), slot(NS1, [CARD1_NEW], 0)];
    const pathS2 = [P(1020, 380), P(1280, 548), slot(NS2, [CARD1_NEW], 0)];
    s += travel(pathS1, 2.5, 4.0, 'insert ORD-10001');
    s += travel(pathS2, 2.5, 4.0, 'insert ORD-10001');
    s += travel(pathS1, 8.4, 9.9, 'update ORD-10001');
    s += travel(pathS2, 8.4, 9.9, 'update ORD-10001');

    // update request from the app
    if (t >= 5.8 && t < 7.5) {
      const k = tw(t, 6.0, 7.2);
      const pt = pointAt(line(P(APP.x + 20, APP.y - 10), P(860, 280)), k);
      s += chip(pt.x, pt.y - 40, '{$set: {status: "paid"}}', { size: 18, scale: tw(t, 5.8, 6.2, backOut), opacity: 1 - tw(t, 7.2, 7.5) });
    }
    return s;
  },
});

// ---------------------------------------------------------------- Scene 4
const PAID3 = () => [{ lines: CARD1_PAID }];
const RIB_LINES_2 = [
  { text: 'insert {order_id: "ORD-10001"}' },
  { text: 'update ORD-10001 {status: "paid"}' },
];
SCENES.push({
  id: 4, part: 1, dur: 8, fadeIn: false, fadeOut: false,
  caption: 'Members constantly check that everyone is alive.',
  draw(t) {
    let s = '';
    s += appIcon(APP.x, APP.y);
    s += rsArrowApp(t);
    const ra = 1 - tw(t, 0, 0.6);
    s += arrow(REPL_S1, { width: 5, opacity: ra });
    s += arrow(REPL_S2, { width: 5, opacity: ra });
    const hp = tw(t, 0.4, 1.4);
    const pulses = [1.5, 3.5, 5.5];
    [HB_P_S1, HB_P_S2, HB_S1_S2].forEach(pth => { s += heartbeat(pth, t, { p: hp, pulses }); });
    // node pulse rings when hearts arrive
    pulses.forEach(t0 => {
      [NP, NS1, NS2].forEach(n => { s += ring(n, t, t0 + 0.85, { r0: 175, r1: 225 }); });
    });
    s += rsNode(NP, { color: C.green, label: 'PRIMARY', labelColor: C.green, cards: PAID3() });
    s += rsNode(NS1, { color: C.grey, label: 'SECONDARY', cards: PAID3() });
    s += rsNode(NS2, { color: C.grey, label: 'SECONDARY', cards: PAID3() });
    s += ribbonConnector(1);
    s += oplog(RIBBON.x, RIBBON.y, RIBBON.w, RIB_LINES_2, { rows: 3 });
    s += text(960, 590, 'heartbeat ♥ every 2 s', { size: 40, weight: 700, color: C.blue, opacity: tw(t, 1.0, 1.6) });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 5
const S1_OPLOG = ['insert ORD-10001', 'update ORD-10001', 'insert ORD-10002', 'insert ORD-10003'];
const PANEL_S1 = { x: 60, y: 580, w: 290 };
const PANEL_S2 = { x: 1570, y: 580, w: 290 };
function memberOplog(pn, lines, o) { return oplog(pn.x, pn.y, pn.w, lines, { size: 19, rows: 3, older: false, lh: 38, ...o }); }

SCENES.push({
  id: 5, part: 1, dur: 15, fadeIn: false, fadeOut: false,
  caption: 'The primary is down. The rest vote, and the most up-to-date member becomes PRIMARY.',
  draw(t) {
    let s = '';
    const CRASH = 3.0;
    const down = tw(t, CRASH, CRASH + 0.3);
    // app + its arrow (greys out after crash)
    s += appIcon(APP.x, APP.y);
    s += arrow(PATH_APP_P, { width: 6, color: mix(C.blue, C.grey, tw(t, 3.6, 4.2)), dash: t > 3.6 ? '12 12' : null, opacity: 1 - 0.4 * tw(t, 3.6, 4.2) });

    // heartbeats: P lines break after the crash
    const pulsesAll = [1.5, 3.5, 5.5, 7.5, 9.5, 11.5, 13.5].map(x => x - 2); // continue the 2s rhythm
    const pulsesP = pulsesAll.filter(x => x + 0.9 < CRASH);
    const pf = 1 - tw(t, 4.0, 5.2);
    s += heartbeat(HB_P_S1, t, { pulses: pulsesP, opacity: pf, dash: t > 4.0 ? '3 30' : '3 16', color: mix(C.blue, C.orange, tw(t, 3.8, 4.4)) });
    s += heartbeat(HB_P_S2, t, { pulses: pulsesP, opacity: pf, dash: t > 4.0 ? '3 30' : '3 16', color: mix(C.blue, C.orange, tw(t, 3.8, 4.4)) });
    s += heartbeat(HB_S1_S2, t, { pulses: pulsesAll });

    // PRIMARY gets the in-flight write, then dies
    const land2 = t >= 1.3;
    const pCards = [{ lines: CARD1_PAID }];
    if (land2) pCards.push({ lines: CARD2 });
    const shake = t > CRASH && t < CRASH + 0.8 ? Math.sin((t - CRASH) * 70) * 9 * (1 - (t - CRASH) / 0.8) : 0;
    s += rsNode(NP, {
      color: mix(C.green, C.orange, down), label: 'PRIMARY', labelColor: C.green, label2: 'DOWN', label2Color: C.orange,
      labelMix: tw(t, 3.4, 4.0), cards: pCards, crack: tw(t, 3.3, 3.8), x: tw(t, 3.6, 4.3), shakeX: shake,
      opacity: 1 - 0.35 * tw(t, 5, 6),
    });
    // ribbon
    s += `<g opacity="${1 - 0.65 * tw(t, 3.3, 4.0)}">` + ribbonConnector(1) +
      oplog(RIBBON.x, RIBBON.y, RIBBON.w, [...RIB_LINES_2, { text: 'insert {order_id: "ORD-10002"}', p: tw(t, 1.4, 1.8), hl: env(t, 1.4, 3.0, 0.3) }], { rows: 3, accent: mix(C.blue, C.grey, tw(t, 3.3, 4.0)) }) + '</g>';

    // secondary S1 receives ORD-10002 just in time, S2 does not
    const s1Cards = [{ lines: CARD1_PAID }];
    if (t >= 2.9) s1Cards.push({ lines: CARD2, scale: tw(t, 2.9, 3.4, backOut) });
    const elect = tw(t, 9.8, 10.8);
    s += rsNode(NS1, { color: mix(C.grey, C.green, elect), label: 'SECONDARY', label2: 'PRIMARY', label2Color: C.green, labelMix: elect, cards: s1Cards, glow: env(t, 9.8, 12.5, 0.5) });
    s += rsNode(NS2, { color: C.grey, label: 'SECONDARY', cards: [{ lines: CARD1_PAID }] });

    // replication chips
    if (t > 1.8 && t < 3.3) {
      const k = tw(t, 1.9, 2.9);
      const pt = pointAt([P(900, 380), P(640, 548), slot(NS1, [CARD1_PAID, CARD2], 1)], k);
      s += chip(pt.x, pt.y, 'insert ORD-10002', { opacity: 1 - tw(t, 2.9, 3.3) });
    }
    if (t > 1.8 && t < 3.6) {
      const k = Math.min(tw(t, 1.9, 4.2, linear), 0.42); // slower — still on its way when PRIMARY dies
      const pt = pointAt([P(1020, 380), P(1280, 548), slot(NS2, [CARD1_PAID, CARD2], 1)], k);
      s += chip(pt.x, pt.y, 'insert ORD-10002', { fill: mix(C.blue, C.orange, tw(t, 3.0, 3.2)), opacity: 1 - tw(t, 3.1, 3.6) });
    }
    // in-flight card from the app
    if (t > 0.1 && t < 1.35) {
      const k = tw(t, 0.3, 1.3);
      const pt = pointAt(qbez(P(APP.x, 170), P(560, 130), slot(NP, [CARD1_PAID, CARD2], 1)), k);
      s += card(pt.x, pt.y, CARD2, { scale: tw(t, 0.1, 0.4, backOut) });
    }

    // heartbeat label -> vote counter
    s += text(960, 590, 'heartbeat ♥ every 2 s', { size: 40, weight: 700, color: C.blue, opacity: 1 - tw(t, 4.5, 5.0) });

    // members' own oplogs
    const po = tw(t, 5.2, 6.0);
    const newest = env(t, 6.3, 15.5, 0.4);
    s += memberOplog(PANEL_S1, [{ text: S1_OPLOG[0] }, { text: S1_OPLOG[1] }, { text: S1_OPLOG[2], hl: newest, hlColor: C.green }], { opacity: po });
    s += memberOplog(PANEL_S2, [{ text: S1_OPLOG[0] }, { text: S1_OPLOG[1] }], { opacity: po });
    s += tag(PANEL_S1.x + PANEL_S1.w / 2, PANEL_S1.y - 30, 'newest ✓', { size: 26, fill: C.green, opacity: tw(t, 6.4, 6.9), scale: tw(t, 6.4, 6.9, backOut) });

    // ballots
    const bo = env(t, 7.0, 10.8, 0.4);
    const box = P(520, 452);
    s += ballot(box.x, box.y, { opacity: bo, scale: tw(t, 7.0, 7.4, backOut) });
    // S1 votes for itself
    const v1 = tw(t, 7.8, 8.4);
    if (t > 7.1 && t < 8.45) s += ballotPaper(box.x, lerp(392, 438, v1), { opacity: tw(t, 7.1, 7.4) * (1 - tw(t, 8.3, 8.45)), scale: tw(t, 7.1, 7.5, backOut) });
    // S2 vote flies over
    const v2 = tw(t, 7.9, 9.0);
    if (t > 7.3 && t < 9.05) {
      const pt = pointAt(qbez(P(1400, 440), P(960, 560), P(box.x, 420)), v2);
      s += ballotPaper(pt.x, pt.y, { opacity: tw(t, 7.3, 7.6) * (1 - tw(t, 8.9, 9.05)), rot: Math.sin(v2 * Math.PI) * -18, scale: tw(t, 7.3, 7.7, backOut) });
    }
    // counter
    const votes = t >= 9.0 ? 2 : t >= 8.4 ? 1 : 0;
    const co = env(t, 7.6, 15.5, 0.4);
    s += text(960, 548, 'votes', { size: 28, weight: 700, color: C.muted, opacity: co });
    const maj = tw(t, 9.0, 9.4);
    const cstr = votes === 2 ? '2 / 3 = majority ✓' : `${votes} / 3`;
    s += text(960, 604, cstr, { size: 50, weight: 700, color: votes === 2 ? C.green : C.text, opacity: co, font: SANS });
    if (votes === 2) s += `<g opacity="${(1 - maj) * co}">` + ring(P(960, 604), t, 9.0, { color: C.green, r0: 120, r1: 220 }) + '</g>';

    // timer in the corner
    s += stopwatch(1500, 72, tw(t, 3.2, 10.8, linear), { opacity: tw(t, 3.2, 3.7), done: tw(t, 10.6, 11.0) });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 6
SCENES.push({
  id: 6, part: 1, dur: 7, fadeIn: false, fadeOut: true,
  caption: 'The driver reconnects automatically. The app keeps working.',
  draw(t) {
    let s = '';
    s += appIcon(APP.x, APP.y);
    // old arrow fades, new arrow to the new PRIMARY
    s += arrow(PATH_APP_P, { width: 6, color: C.grey, dash: '12 12', opacity: 0.6 * (1 - tw(t, 0.3, 0.8)) });
    s += arrow(PATH_APP_S1, { width: 6, p: tw(t, 0.6, 1.4) });
    s += tag(430, 445, '↻ reconnected', { size: 26, anchor: 'start', opacity: tw(t, 1.3, 1.8), scale: tw(t, 1.3, 1.8, backOut) });
    s += heartbeat(HB_S1_S2, t, { pulses: [1.5, 3.5, 5.5].map(x => x - 0.5) });

    s += rsNode(NP, { color: C.orange, label: 'DOWN', labelColor: C.orange, cards: [{ lines: CARD1_PAID }, { lines: CARD2 }], crack: 1, x: 1, opacity: 0.65 });
    s += `<g opacity="0.35">` + ribbonConnector(1) + oplog(RIBBON.x, RIBBON.y, RIBBON.w, [...RIB_LINES_2, { text: 'insert {order_id: "ORD-10002"}' }], { rows: 3, accent: C.grey }) + '</g>';

    const newCards = [{ lines: CARD1_PAID }, { lines: CARD2 }];
    if (t >= 3.2) newCards.push({ lines: CARD3, scale: tw(t, 3.2, 3.6, backOut) });
    s += rsNode(NS1, { color: C.green, label: 'PRIMARY', labelColor: C.green, cards: newCards, glow: env(t, 3.1, 4.0, 0.3) });
    const s2Cards = [{ lines: CARD1_PAID }];
    if (t >= 4.8) s2Cards.push({ lines: CARD2, scale: tw(t, 4.8, 5.2, backOut) });
    if (t >= 5.3) s2Cards.push({ lines: CARD3, scale: tw(t, 5.3, 5.7, backOut) });
    s += rsNode(NS2, { color: C.grey, label: 'SECONDARY', cards: s2Cards });

    // fading election leftovers
    const lo = 1 - tw(t, 0, 0.5);
    s += text(960, 548, 'votes', { size: 28, weight: 700, color: C.muted, opacity: lo });
    s += text(960, 604, '2 / 3 = majority ✓', { size: 50, weight: 700, color: C.green, opacity: lo });
    s += stopwatch(1500, 72, 1, { opacity: lo, done: 1 });

    // oplogs
    s += memberOplog(PANEL_S1, [{ text: S1_OPLOG[0] }, { text: S1_OPLOG[1] }, { text: S1_OPLOG[2] }, { text: S1_OPLOG[3], p: tw(t, 3.3, 3.7), hl: env(t, 3.3, 5.0, 0.3) }], {});
    s += memberOplog(PANEL_S2, [{ text: S1_OPLOG[0] }, { text: S1_OPLOG[1] }, { text: S1_OPLOG[2], p: tw(t, 4.8, 5.1) }, { text: S1_OPLOG[3], p: tw(t, 5.3, 5.6) }], {});

    // write from the app to the new PRIMARY
    if (t > 1.8 && t < 3.25) {
      const k = tw(t, 2.0, 3.2);
      const pth = [...PATH_APP_S1.map(p => P(p.x, p.y - 10)), slot(NS1, [CARD1_PAID, CARD2, CARD3], 2)];
      const pt = pointAt(pth, k);
      s += card(pt.x, pt.y, CARD3, { scale: tw(t, 1.8, 2.1, backOut) });
    }
    // catch-up replication to S2
    const rep = (t0, t1, lbl, idx) => {
      if (t < t0 || t > t1 + 0.3) return '';
      const pt = pointAt([P(690, 640), P(1230, 640), slot(NS2, [CARD1_PAID, CARD2, CARD3], idx)], tw(t, t0, t1));
      return chip(pt.x, pt.y, lbl, { opacity: 1 - tw(t, t1, t1 + 0.3) });
    };
    s += rep(3.8, 4.8, 'insert ORD-10002', 1);
    s += rep(4.3, 5.3, 'insert ORD-10003', 2);
    return s;
  },
});

// ---------------------------------------------------------------- Scene 7
SCENES.push({
  id: 7, part: 1, dur: 10, fadeIn: true, fadeOut: true,
  caption: "That's why we use an odd number: 3, not 2.",
  draw(t) {
    let s = '';
    s += `<line x1="960" y1="110" x2="960" y2="900" stroke="${C.line}" stroke-width="4" opacity="${tw(t, 0.2, 0.8)}"/>`;
    s += text(480, 140, '3 members', { size: 48, weight: 700, opacity: tw(t, 0.3, 0.9) });
    s += text(1440, 140, '2 members', { size: 48, weight: 700, opacity: tw(t, 0.3, 0.9) });
    const o = { w: 180, h: 120 };
    const fail = tw(t, 2.0, 2.6);
    const nodeL = (n, x, y, col, lab, labCol, i) => {
      const sc = tw(t, 0.5 + i * 0.15, 1.1 + i * 0.15, backOut);
      return cyl(x, y, { ...o, color: col, scale: sc, opacity: clamp(sc * 2) }) +
        text(x, cylLabelY(y, o) - 4, lab, { size: 26, weight: 700, color: labCol, opacity: clamp(sc * 2) });
    };
    // left
    const promote = tw(t, 4.8, 5.6);
    s += nodeL(0, 480, 320, mix(C.green, C.orange, fail), fail > 0.5 ? 'DOWN' : 'PRIMARY', fail > 0.5 ? C.orange : C.green, 0);
    s += xMark(480, 322, 80, tw(t, 2.3, 2.9), { width: 14 });
    s += cyl(310, 600, { ...o, color: mix(C.grey, C.green, promote), scale: tw(t, 0.65, 1.25, backOut), opacity: tw(t, 0.65, 0.9) });
    s += text(310, cylLabelY(600, o) - 4, 'SECONDARY', { size: 26, weight: 700, color: C.muted, opacity: tw(t, 0.65, 0.9) * (1 - promote) });
    s += text(310, cylLabelY(600, o) - 4, 'PRIMARY', { size: 26, weight: 700, color: C.green, opacity: promote });
    s += nodeL(0, 650, 600, C.grey, 'SECONDARY', C.muted, 2);
    // right
    s += nodeL(0, 1270, 460, mix(C.green, C.orange, fail), fail > 0.5 ? 'DOWN' : 'PRIMARY', fail > 0.5 ? C.orange : C.green, 0);
    s += xMark(1270, 462, 80, tw(t, 2.3, 2.9), { width: 14 });
    s += nodeL(0, 1610, 460, C.grey, 'SECONDARY', C.muted, 1);
    // verdicts
    const v = tw(t, 3.4, 4.0);
    s += text(480, 820, '2 / 3 = majority ✓', { size: 54, weight: 700, color: C.green, opacity: v });
    s += text(1440, 820, '1 / 2 = no majority ✗', { size: 54, weight: 700, color: C.orange, opacity: v });
    s += tag(1440, 690, 'no PRIMARY → writes stop', { size: 30, fill: C.orange, opacity: tw(t, 5.0, 5.6), scale: tw(t, 5.0, 5.6, backOut) });
    s += tag(480, 470, 'new PRIMARY elected', { size: 28, fill: C.green, opacity: tw(t, 5.4, 6.0), scale: tw(t, 5.4, 6.0, backOut) });
    return s;
  },
});

// ======================================================= PART 2 — SHARDING
// ---------------------------------------------------------------- Scene 8
const BIG = P(960, 600);
function bigOrders(t) { // 0..1 growth
  return tw(t, 1.2, 5.2, p => p * p * (3 - 2 * p));
}
function fmtDocs(p) {
  const n = 1e6 * Math.pow(2000, p);
  return n >= 1e9 ? (n / 1e9).toFixed(1) + ' B docs' : Math.round(n / 1e6) + ' M docs';
}
SCENES.push({
  id: 8, part: 2, dur: 8, fadeIn: true, fadeOut: false,
  caption: 'When a collection is too big for one server...',
  draw(t) {
    let s = '';
    s += tag(960, 80, 'PART 2', { size: 30, opacity: tw(t, 0.2, 0.8) });
    const ti = tw(t, 0.3, 1.1, easeOut);
    s += `<g transform="translate(0,${(1 - ti) * 20})">` + text(960, 168, 'Sharding — one collection, split across servers', { size: 66, weight: 700, opacity: ti }) + '</g>';
    const g = bigOrders(t);
    const w = lerp(200, 580, g), h = lerp(140, 470, g);
    const over = tw(t, 3.9, 4.4);
    const shake = t > 4.0 && t < 6.2 ? Math.sin(t * 55) * 10 * (1 - (t - 4.0) / 2.2) : 0;
    s += `<g transform="translate(${shake},0)">`;
    s += panel(740, 370, 440, 440, { fill: mix('#FFFFFF', C.orange, 0.06 * over), stroke: mix(C.grey, C.orange, over), sw: 5, rx: 22, opacity: tw(t, 0.6, 1.1) });
    s += text(762, 400, '1 server', { size: 28, weight: 700, anchor: 'start', color: mix(C.muted, C.orange, over), opacity: tw(t, 0.6, 1.1) });
    s += cyl(BIG.x, BIG.y + 20, { w, h, color: C.blue, opacity: tw(t, 0.8, 1.2) });
    s += text(BIG.x, BIG.y + 10, 'orders', { size: lerp(32, 64, g), weight: 700, color: '#FFFFFF', font: MONO, opacity: tw(t, 0.8, 1.2) });
    s += text(BIG.x, BIG.y + 10 + lerp(40, 70, g), fmtDocs(g), { size: lerp(22, 38, g), color: '#FFFFFF', opacity: tw(t, 0.8, 1.2) });
    s += '</g>';
    s += tag(1530, 560, '⚠ too big for one server', { size: 32, fill: C.orange, opacity: tw(t, 4.4, 4.9), scale: tw(t, 4.4, 4.9, backOut) });
    s += text(1530, 625, 'disk · RAM · write load', { size: 30, color: C.orange, opacity: tw(t, 4.8, 5.3) });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 9
const SH_X = [480, 960, 1440];
const SH_NAMES = ['Shard A', 'Shard B', 'Shard C'];
const SH_RANGES = ['A–H', 'I–P', 'Q–Z'];
SCENES.push({
  id: 9, part: 2, dur: 12, fadeIn: false, fadeOut: true,
  caption: '...we split it by a shard key. Each shard is its own replica set.',
  draw(t) {
    let s = '';
    const fadeTitle = 1 - tw(t, 0, 0.5);
    s += tag(960, 80, 'PART 2', { size: 30, opacity: fadeTitle });
    s += text(960, 168, 'Sharding — one collection, split across servers', { size: 66, weight: 700, opacity: fadeTitle });
    s += tag(1530, 560, '⚠ too big for one server', { size: 32, fill: C.orange, opacity: fadeTitle });
    s += text(1530, 625, 'disk · RAM · write load', { size: 30, color: C.orange, opacity: fadeTitle });
    s += panel(740, 370, 440, 440, { fill: mix('#FFFFFF', C.orange, 0.06), stroke: C.orange, sw: 5, rx: 22, opacity: 1 - tw(t, 0, 0.6) });

    // camera (zoom to Shard A)
    const zin = tw(t, 4.8, 6.4), zout = tw(t, 9.0, 10.4);
    const z = zin * (1 - zout);
    const sc = lerp(1, 2.25, z);
    const fx = lerp(960, SH_X[0], z), fy = lerp(520, 500, z);
    s += `<g transform="translate(960,${lerp(520, 500, z)}) scale(${sc}) translate(${-fx},${-fy})">`;

    // big cylinder shrinks, then splits
    const shrink = tw(t, 0.4, 1.2);
    const bigO = 1 - tw(t, 1.4, 1.8);
    const bw = lerp(580, 420, shrink), bh = lerp(470, 330, shrink), by = lerp(620, 520, shrink);
    s += cyl(960, by, { w: bw, h: bh, color: C.blue, opacity: bigO });
    s += text(960, by - 10, 'orders', { size: 64, weight: 700, color: '#FFFFFF', font: MONO, opacity: bigO });
    const split = tw(t, 1.4, 2.8);
    const morph = tw(t, 3.4, 4.4);
    SH_X.forEach((x, i) => {
      const cx = lerp(960, x, split);
      const op = tw(t, 1.4, 1.6) * (1 - morph);
      s += cyl(cx, 520, { w: lerp(300, 240, split), h: lerp(250, 190, split), color: C.blue, opacity: op });
      s += text(cx, 515, 'orders', { size: 34, weight: 700, color: '#FFFFFF', font: MONO, opacity: op });
      const lo = tw(t, 2.4, 3.0) * (1 - morph);
      s += text(x, 690, SH_NAMES[i], { size: 38, weight: 700, opacity: lo });
      s += mono(x, 738, 'customer_id ' + SH_RANGES[i], { size: 26, anchor: 'middle', opacity: lo, weight: 700 });
      // shard component
      const others = i === 0 ? 1 : 1 - z;
      s += shardBox(x, 520, { name: SH_NAMES[i], range: SH_RANGES[i], opacity: morph * others, labels: i === 0 ? z : 0, w: 360, h: 250 });
    });
    s += '</g>';
    // headers
    const hk = tw(t, 2.4, 3.0) * (1 - tw(t, 4.6, 5.0)) + tw(t, 10.4, 10.9);
    s += text(960, 120, 'shard key: customer_id', { size: 46, weight: 700, color: C.blue, font: MONO, opacity: clamp(hk) });
    s += text(960, 110, 'Shard A = its own replica set', { size: 52, weight: 700, opacity: env(t, 5.6, 9.2, 0.5) });
    s += text(960, 850, '3 shards × 3 members', { size: 36, weight: 700, color: C.muted, opacity: tw(t, 10.6, 11.2) });
    return s;
  },
});

// --------------------------------------------- Scene 10/11 shared layout
const APP2 = P(170, 520);
const MONGOS = P(610, 520);
const CONFIG = P(610, 205);
const SHV = [P(1460, 195), P(1460, 500), P(1460, 805)];
const PATH_APP_M = line(P(265, 520), P(462, 520));
const pathMtoS = i => line(P(752, 520), P(1270, SHV[i].y));
const CARD_REST = P(610, 650);

function routerLayout(t, o = {}) {
  const { appear = 1, dims = [0, 0, 0], glows = [0, 0, 0], arrowHl = [0, 0, 0], cfg = {}, linkP = 0, linkOp = 0, mgGlow = 0 } = o;
  let s = '';
  const ap = k => (typeof appear === 'function' ? appear(k) : appear);
  s += appIcon(APP2.x, APP2.y, { opacity: ap(0) });
  s += arrow(PATH_APP_M, { width: 6, opacity: ap(1) });
  [0, 1, 2].forEach(i => {
    s += arrow(pathMtoS(i), { width: lerp(3, 7, arrowHl[i]), color: mix(C.grey, C.blue, arrowHl[i]), opacity: ap(2) * (1 - 0.6 * dims[i]) });
  });
  // config link
  s += `<line x1="${MONGOS.x}" y1="450" x2="${MONGOS.x}" y2="330" stroke="${C.blue}" stroke-width="4" stroke-dasharray="4 10" stroke-linecap="round" opacity="${ap(1) * 0.5}"/>`;
  if (linkOp > 0.001) {
    const k = linkP;
    s += `<circle cx="${MONGOS.x}" cy="${lerp(450, 330, k)}" r="10" fill="${C.blue}" opacity="${linkOp}"/>`;
  }
  s += configBox(CONFIG.x, CONFIG.y, { opacity: ap(1), ...cfg });
  s += mongosBox(MONGOS.x, MONGOS.y, { opacity: ap(1), glow: mgGlow });
  SHV.forEach((p, i) => {
    s += shardBox(p.x, p.y, { name: SH_NAMES[i], range: SH_RANGES[i], opacity: ap(3 + i), dim: dims[i], glow: glows[i], w: 360, h: 250 });
  });
  return s;
}

// ---------------------------------------------------------------- Scene 10
SCENES.push({
  id: 10, part: 2, dur: 12, fadeIn: true, fadeOut: false,
  caption: 'The router uses the shard key to find the right shard.',
  draw(t) {
    let s = '';
    const appear = k => tw(t, 0.2 + k * 0.12, 0.7 + k * 0.12);
    const dim = tw(t, 5.0, 5.6);
    s += routerLayout(t, {
      appear,
      dims: [0, dim, dim],
      glows: [env(t, 6.3, 7.6, 0.3), 0, 0],
      arrowHl: [tw(t, 5.0, 5.4), 0, 0],
      cfg: { hl: [tw(t, 3.6, 4.0), 0, 0] },
      linkP: tw(t, 3.0, 3.6), linkOp: env(t, 3.0, 3.9, 0.15),
      mgGlow: env(t, 2.6, 4.2, 0.3),
    });
    const q = ['{customer_id: "C-Dana"}'];
    // card: app -> mongos -> shard A
    if (t > 1.3 && t < 6.5) {
      let pt;
      if (t < 4.9) pt = pointAt(qbez(P(APP2.x, 395), P(400, 720), CARD_REST), tw(t, 1.8, 2.9));
      else pt = pointAt([CARD_REST, P(760, 520), P(1268, SHV[0].y + 40)], tw(t, 5.0, 6.4));
      s += card(pt.x, pt.y, q, { size: 20, scale: tw(t, 1.3, 1.7, backOut) * (1 - 0.4 * tw(t, 6.1, 6.5)), opacity: 1 - tw(t, 6.2, 6.5) });
    }
    s += tag(895, 690, 'customer_id → A–H → Shard A', { size: 26, font: MONO, fill: C.blue, opacity: env(t, 3.9, 6.2, 0.3) * 1, anchor: 'start' });
    s += tag(1035, 300, 'only 1 shard ✓', { size: 30, fill: C.green, opacity: tw(t, 6.6, 7.0), scale: tw(t, 6.6, 7.0, backOut) });
    // result travels back
    if (t > 7.3 && t < 9.3) {
      const pt = t < 8.3 ? pointAt(line(P(1268, SHV[0].y + 40), P(760, 520)), tw(t, 7.4, 8.3))
        : pointAt(line(P(462, 520), P(265, 520)), tw(t, 8.3, 9.1));
      s += chip(pt.x, pt.y - (t < 8.3 ? 0 : 40), 'result: 1 doc', { fill: C.green, opacity: 1 - tw(t, 9.0, 9.3) });
    }
    return s;
  },
});

// ---------------------------------------------------------------- Scene 11
SCENES.push({
  id: 11, part: 2, dur: 10, fadeIn: false, fadeOut: true,
  caption: 'A query without the shard key hits every shard.',
  draw(t) {
    let s = '';
    const und = 1 - tw(t, 0, 0.5);
    const scat = tw(t, 3.4, 3.8);
    const hit = env(t, 4.5, 5.8, 0.3);
    s += routerLayout(t, {
      dims: [0, und, und],
      glows: [hit, hit, hit],
      arrowHl: [Math.max(scat, und), scat, scat].map((v, i) => (i === 0 ? Math.max(scat, 1 - tw(t, 0, 0.5)) : v)),
      cfg: { hl: [1 - tw(t, 0, 0.4), 0, 0], flash: env(t, 2.6, 3.6, 0.25) },
      linkP: tw(t, 2.2, 2.7), linkOp: env(t, 2.2, 2.9, 0.15),
      mgGlow: env(t, 2.2, 3.4, 0.3) + env(t, 6.0, 6.8, 0.3),
    });
    s += tag(1035, 300, 'only 1 shard ✓', { size: 30, fill: C.green, opacity: 1 - tw(t, 0, 0.4) });
    const q = ['{status: "paid"}'];
    if (t > 0.6 && t < 3.5) {
      const pt = pointAt(qbez(P(APP2.x, 395), P(400, 720), CARD_REST), tw(t, 1.1, 2.2));
      s += card(pt.x, pt.y, q, { size: 20, scale: tw(t, 0.6, 1.0, backOut), opacity: 1 - tw(t, 3.3, 3.5) });
    }
    s += tag(MONGOS.x, 735, 'no shard key → ?', { size: 28, fill: C.orange, opacity: tw(t, 2.7, 3.1) });
    // scatter
    [0, 1, 2].forEach(i => {
      if (t > 3.3 && t < 4.9) {
        const pt = pointAt([CARD_REST, P(760, 520), P(1268, SHV[i].y + (i === 0 ? 40 : i === 2 ? -40 : 0))], tw(t, 3.4, 4.6));
        s += card(pt.x, pt.y, q, { size: 18, opacity: tw(t, 3.3, 3.5) * (1 - tw(t, 4.6, 4.9)) });
      }
      // gather
      if (t > 5.0 && t < 6.3) {
        const pt = pointAt(line(P(1268, SHV[i].y + (i === 0 ? 40 : i === 2 ? -40 : 0)), P(770, 520)), tw(t, 5.1, 6.1));
        s += chip(pt.x, pt.y, ['3 docs', '5 docs', '2 docs'][i], { fill: C.green, opacity: tw(t, 5.0, 5.2) * (1 - tw(t, 6.1, 6.3)) });
      }
    });
    if (t > 6.1 && t < 7.9) {
      const pt = pointAt(line(P(470, 520), P(265, 520)), tw(t, 6.7, 7.6));
      s += chip(pt.x, pt.y - 40, 'merged: 10 docs', { fill: C.green, scale: tw(t, 6.1, 6.5, backOut), opacity: 1 - tw(t, 7.6, 7.9) });
    }
    s += text(1050, 945 - 120, '', {});
    s += tag(MONGOS.x, 820, 'scatter-gather = slow', { size: 34, fill: C.orange, opacity: tw(t, 4.4, 4.9), scale: tw(t, 4.4, 4.9, backOut) });
    s += text(1000, 75, 'scatter', { size: 30, weight: 700, color: C.orange, opacity: env(t, 3.4, 5.0, 0.3) });
    s += text(1000, 75, 'gather', { size: 30, weight: 700, color: C.green, opacity: env(t, 5.0, 6.6, 0.3) });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 12
SCENES.push({
  id: 12, part: 2, dur: 10, fadeIn: true, fadeOut: true,
  caption: 'Bad shard key = one hot shard, the others sit idle.',
  draw(t) {
    let s = '';
    s += text(960, 95, 'shard key: created_at', { size: 50, weight: 700, color: C.blue, font: MONO, opacity: tw(t, 0.2, 0.8) });
    s += tag(960, 165, 'always increasing ↗  new docs → last range', { size: 28, fill: C.orange, opacity: tw(t, 1.8, 2.3) });
    const xs = [420, 960, 1500], y = 590;
    const ranges = ['…–2024', '2025', '2026–…'];
    const hot = tw(t, 3.4, 4.6);
    const nCards = 12, t0 = 1.0, gap = 0.36;
    const arrived = k => t > t0 + k * gap + 0.9;
    let count = 0; for (let k = 0; k < nCards; k++) if (arrived(k)) count++;
    xs.forEach((x, i) => {
      const isC = i === 2;
      const sh = isC && t > 4.4 ? Math.sin(t * 50) * 3.5 : 0;
      s += shardBox(x, y, { name: SH_NAMES[i], range: ranges[i], hot: isC ? hot : 0, shakeX: sh, opacity: tw(t, 0.3 + i * 0.12, 0.8 + i * 0.12), glow: isC ? hot : 0 });
      const load = isC ? 0.08 + 0.92 * (count / nCards) : 0.06;
      s += meter(x, 760, 320, load, { color: isC ? mix(C.blue, C.orange, hot) : C.grey, opacity: tw(t, 0.6, 1.0) });
      s += text(x - 160, 800, 'load', { size: 24, color: C.muted, anchor: 'start', opacity: tw(t, 0.6, 1.0) });
      if (!isC) s += text(x, 860, 'idle', { size: 40, weight: 700, color: C.muted, opacity: tw(t, 4.6, 5.2) });
    });
    s += text(1500, 860, 'hot 🔥', { size: 48, weight: 700, color: C.orange, opacity: tw(t, 4.4, 4.9) });
    // new orders pile into C
    const src = P(960, 290);
    s += text(src.x - 400, src.y, 'new orders (today)', { size: 30, weight: 700, color: C.muted, anchor: 'end', opacity: tw(t, 0.8, 1.2) * (1 - tw(t, 6.0, 6.5)) });
    for (let k = 0; k < nCards; k++) {
      const st = t0 + k * gap;
      if (t > st && t < st + 1.1) {
        const pp = tw(t, st + 0.15, st + 0.9);
        const pt = pointAt(qbez(src, P(1400, 300), P(1500, 560)), pp);
        s += card(pt.x, pt.y, ['{created_at: "2026-11-04"}'], { size: 18, scale: tw(t, st, st + 0.25, backOut) * (1 - 0.5 * pp), opacity: 1 - tw(t, st + 0.85, st + 1.05) });
      }
    }
    return s;
  },
});

// ---------------------------------------------------------------- Scene 13
SCENES.push({
  id: 13, part: 2, dur: 8, fadeIn: true, fadeOut: true,
  caption: 'Same idea as Kafka partitions.',
  draw(t) {
    let s = '';
    const a = tw(t, 0.2, 0.8);
    s += text(480, 120, 'Kafka topic', { size: 48, weight: 700, opacity: a });
    s += text(1440, 120, 'MongoDB collection', { size: 48, weight: 700, opacity: a });
    // partitions
    const py = [370, 480, 590];
    const fill = [4, 3, 5];
    py.forEach((y, i) => {
      const o = tw(t, 0.4 + i * 0.12, 0.9 + i * 0.12);
      s += mono(205, y, 'P' + i, { size: 32, anchor: 'end', weight: 700, opacity: o });
      s += panel(230, y - 38, 520, 76, { fill: C.soft, stroke: i === 1 ? mix(C.line, C.blue, tw(t, 3.0, 3.5)) : C.line, sw: 3, rx: 12, opacity: o });
      for (let k = 0; k < fill[i]; k++) s += `<rect x="${244 + k * 62}" y="${y - 24}" width="52" height="48" rx="8" fill="${C.grey}" opacity="${o}"/>`;
    });
    // new message -> P1
    const km = tw(t, 1.8, 3.2);
    const slotP1 = P(244 + 3 * 62 + 26, 480);
    if (t > 1.2) {
      if (km < 1) {
        const pt = pointAt(qbez(P(480, 230), P(820, 330), slotP1), km);
        s += chip(pt.x, pt.y, 'key: "C-Dana"', { size: 22, scale: tw(t, 1.2, 1.6, backOut) * lerp(1, 0.5, km) });
      } else {
        s += `<rect x="${slotP1.x - 26}" y="${480 - 24}" width="52" height="48" rx="8" fill="${C.blue}"/>`;
      }
    }
    s += text(480, 690, 'hash(key) → P1', { size: 30, font: MONO, weight: 700, color: C.blue, opacity: tw(t, 3.0, 3.5) });
    s += text(480, 780, 'message key → partition', { size: 40, weight: 700, opacity: tw(t, 3.6, 4.2) });

    // shards
    const sx = [1230, 1440, 1650];
    const ow = { w: 160, h: 150 };
    sx.forEach((x, i) => {
      const o = tw(t, 0.4 + i * 0.12, 0.9 + i * 0.12);
      const hitA = i === 0 ? env(t, 3.0, 5.5, 0.3) : 0;
      s += cyl(x, 470, { ...ow, color: C.blue, opacity: o, glow: hitA });
      s += text(x, 600, SH_NAMES[i], { size: 30, weight: 700, opacity: o });
      s += mono(x, 640, SH_RANGES[i], { size: 24, anchor: 'middle', weight: 700, opacity: o });
    });
    const kd = tw(t, 1.8, 3.2);
    if (t > 1.2 && kd < 1) {
      const pt = pointAt(qbez(P(1440, 230), P(1240, 250), P(1230, 450)), kd);
      s += chip(pt.x, pt.y, 'customer_id: "C-Dana"', { size: 22, scale: tw(t, 1.2, 1.6, backOut) * lerp(1, 0.5, kd) });
    }
    if (kd >= 1) s += card(1230, 470, ['C-Dana'], { size: 20, scale: tw(t, 3.2, 3.6, backOut) });
    s += text(1440, 690, 'C → A–H → Shard A', { size: 30, font: MONO, weight: 700, color: C.blue, opacity: tw(t, 3.0, 3.5) });
    s += text(1440, 780, 'shard key → shard', { size: 40, weight: 700, opacity: tw(t, 3.6, 4.2) });
    // equals
    const e = tw(t, 4.4, 5.0, backOut);
    s += `<g transform="translate(960,470) scale(${e})">` + text(0, 0, '=', { size: 130, weight: 700, color: C.blue }) + '</g>';
    s += text(960, 560, 'same idea', { size: 30, weight: 700, color: C.blue, opacity: tw(t, 4.8, 5.3) });
    return s;
  },
});

// ---------------------------------------------------------------- Scene 14
SCENES.push({
  id: 14, part: 2, dur: 10, fadeIn: true, fadeOut: true,
  caption: 'Replica set = availability · Sharding = scale · oplog = the way out to Kafka.',
  draw(t) {
    let s = '';
    const ap = (k, d = 0.5) => tw(t, 0.2 + k * 0.15, 0.2 + k * 0.15 + d);
    const app = P(130, 500), mg = P(460, 500), cfg = P(460, 235);
    const sh = [P(1010, 185), P(1010, 500), P(1010, 815)];
    const kf = P(1690, 500);
    s += appIcon(app.x, app.y, { opacity: ap(0), scale: 0.85 });
    s += arrow(line(P(215, 500), P(330, 500)), { width: 5, opacity: ap(1) });
    s += `<line x1="${mg.x}" y1="440" x2="${mg.x}" y2="300" stroke="${C.blue}" stroke-width="4" stroke-dasharray="4 10" stroke-linecap="round" opacity="${ap(1) * 0.5}"/>`;
    s += panel(cfg.x - 150, cfg.y - 62, 300, 124, { fill: '#FFFFFF', stroke: C.blue, sw: 3, opacity: ap(1) });
    s += text(cfg.x, cfg.y - 28, 'config servers', { size: 28, weight: 700, color: C.blue, opacity: ap(1) });
    s += mono(cfg.x, cfg.y + 16, 'A–H → A  I–P → B', { size: 18, anchor: 'middle', opacity: ap(1), color: C.muted });
    s += mono(cfg.x, cfg.y + 42, 'Q–Z → C', { size: 18, anchor: 'middle', opacity: ap(1), color: C.muted });
    s += mongosBox(mg.x, mg.y, { opacity: ap(1), w: 250, h: 120, sub: '(router)', scale: 0.95 });
    sh.forEach((p, i) => { s += arrow(line(P(590, 500), P(822, p.y)), { width: 3.5, color: C.grey, opacity: ap(2) }); });
    const rg = tw(t, 3.0, 3.8);
    const pulse = 0.65 + 0.35 * Math.sin(t * 4);
    sh.forEach((p, i) => {
      s += shardBox(p.x, p.y, { name: SH_NAMES[i], range: SH_RANGES[i], opacity: ap(3 + i), w: 360, h: 250, ribbon: tw(t, 2.6, 3.0), ribbonGlow: rg * pulse });
    });
    // Kafka box
    const ko = ap(7);
    s += panel(kf.x - 150, kf.y - 150, 300, 300, { fill: '#FFFFFF', stroke: C.text, sw: 4, rx: 22, opacity: ko });
    s += text(kf.x, kf.y - 100, 'Kafka', { size: 48, weight: 700, opacity: ko });
    [0, 1, 2].forEach(i => {
      s += panel(kf.x - 110, kf.y - 45 + i * 62, 220, 46, { fill: C.soft, stroke: C.line, sw: 2, rx: 8, opacity: ko });
      s += mono(kf.x - 96, kf.y - 22 + i * 62, 'P' + i, { size: 20, opacity: ko, weight: 700 });
      const n = 2 + i + Math.floor(clamp((t - 5) / 1.6) * 3);
      for (let k = 0; k < Math.min(n, 5); k++) s += `<rect x="${kf.x - 58 + k * 32}" y="${kf.y - 37 + i * 62}" width="24" height="30" rx="5" fill="${k >= 2 + i ? C.blue : C.grey}" opacity="${ko}"/>`;
    });
    // oplog -> Kafka streams
    const ap2 = tw(t, 3.6, 4.6);
    sh.forEach((p, i) => {
      const pth = qbez(P(p.x + 152, p.y - 17), P(1400, lerp(p.y, 500, 0.3)), P(kf.x - 158, kf.y - 60 + i * 60));
      s += arrow(pth, { p: ap2, width: 3, color: C.blue });
      if (t > 4.6) {
        for (let d = 0; d < 3; d++) {
          const k = ((t - 4.6) * 0.55 + d / 3 + i * 0.13) % 1;
          const pt = pointAt(pth, k);
          s += `<circle cx="${pt.x}" cy="${pt.y}" r="7" fill="${C.blue}" opacity="${Math.min(1, Math.min(k, 1 - k) * 8)}"/>`;
        }
      }
    });
    s += text(1395, 300, 'change streams', { size: 26, weight: 700, color: C.blue, opacity: tw(t, 4.3, 4.8), italic: true });
    // a write flows in at the start
    if (t > 1.8 && t < 3.4) {
      const pth = [P(215, 470), P(330, 470), P(590, 470), P(822, 470)];
      const pt = pointAt(pth, tw(t, 1.9, 3.2));
      s += chip(pt.x, pt.y - 10, 'write', { opacity: tw(t, 1.8, 2.0) * (1 - tw(t, 3.1, 3.4)) });
    }
    // three small legend tags
    s += tag(1010, 40, 'each shard = replica set', { size: 24, fill: C.green, opacity: tw(t, 5.6, 6.1) });
    return s;
  },
});

// ============================================================ renderer hook
function totalDur(list) { return list.reduce((a, sc) => a + sc.dur, 0); }
function sceneById(id) { return SCENES.find(s => s.id === id); }

function frameSVG(id, t) {
  const sc = sceneById(id);
  let inner = sc.draw(t);
  const capO = Math.min(tw(t, 0.1, 0.6), 1 - tw(t, sc.dur - 0.25, sc.dur));
  inner += caption(sc.caption, capO);
  let fade = 0;
  if (sc.fadeIn) fade = Math.max(fade, 1 - tw(t, 0, 0.4, linear));
  if (sc.fadeOut) fade = Math.max(fade, tw(t, sc.dur - 0.4, sc.dur, linear));
  if (fade > 0.001) inner += `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF" opacity="${fade}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg}"/>${inner}</svg>`;
}
function render(id, t) { document.getElementById('root').innerHTML = frameSVG(id, t); }
