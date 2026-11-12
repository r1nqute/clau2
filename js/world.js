'use strict';
// 땅. 지형은 손으로 정한 좌표 위에 씨앗 고정 잡음으로 가장자리만 흐트러뜨린다. 매번 같은 지도가 나온다.
// 지도마다 철(봄·여름·가을·겨울)이 달라서 같은 풀밭도 빛깔이 다르다.
(function () {
  const G = window.G;
  const T = {
    GRASS: 0, DIRT: 1, SAND: 2, WATER: 3, SHALLOW: 4, ROCK: 5, PAVE: 6, PADDY: 7, DECK: 8, STEP: 9, MUD: 10,
    HIGH: 11, CAVEF: 12, CAVEW: 13, VOID: 14, SNOW: 15, MOSS: 16, CLOUD: 17, FIELD: 18
  };
  const SOLID_T = []; SOLID_T[T.WATER] = SOLID_T[T.ROCK] = SOLID_T[T.CAVEW] = SOLID_T[T.VOID] = SOLID_T[T.CLOUD] = 1;
  // 뛰어넘을 수 없는 것
  const TALL_T = []; TALL_T[T.ROCK] = TALL_T[T.CAVEW] = TALL_T[T.VOID] = TALL_T[T.CLOUD] = 1;
  const HARD = []; HARD[T.PADDY] = HARD[T.DECK] = HARD[T.PAVE] = HARD[T.STEP] = HARD[T.VOID] = HARD[T.FIELD] = 1;

  const LOOKABLE = {
    jar: 1, taru: 1, well: 1, hay: 1, kakashi: 1, boat: 1, wreck: 1, stall: 1, fire: 1, goshinboku: 1, kiln: 1, stump: 1,
    toro: 1, koma: 1, hokora: 1, tate: 1, taiko: 1, bench: 1, makiwara: 1, dummy: 1, nets: 1, bale: 1, cart: 1, pots: 1,
    kaname: 1, rack: 1, hasa: 1, logpile: 1, yagura: 1, shrine: 1, shrineR: 1, rowboat: 1, arrows: 1
  };

  function makeMap(id, w, h) {
    return {
      id, w, h, t: new Uint8Array(w * h), solid: new Uint8Array(w * h), props: [], buckets: new Map(), chunks: new Map(),
      npcs: [], spawns: [], warps: [], dark: false, theme: 'spring', weather: null, music: 'sea', safe: [], regions: [], arenas: {}, fog: 0
    };
  }
  function addProp(m, s, tx, ty, o) {
    const p = Object.assign({ s, x: tx * 16 + 8, y: ty * 16 + 15, v: 0 }, o || {});
    if (!p.use && LOOKABLE[s]) p.use = 'look';
    if (p.soft) { p.x += Math.floor(G.hash2(tx, ty, 91) * 11) - 5; p.y -= Math.floor(G.hash2(tx, ty, 92) * 9); p.v = G.hash2(tx, ty, 93) < 0.5 ? 0 : 1; }
    m.props.push(p);
    const k = (Math.floor(p.y / 128) << 8) | Math.floor(p.x / 128);
    let b = m.buckets.get(k);
    if (!b) m.buckets.set(k, b = []);
    b.push(p);
    return p;
  }
  // v: 1 높은 것(넘지 못한다), 2 낮은 것(뛰어넘는다)
  function block(m, tx, ty, w, h, v) {
    for (let y = ty; y < ty + (h || 1); y++) for (let x = tx; x < tx + (w || 1); x++)
      if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.solid[y * m.w + x] = v || 1;
  }

  // ======================= 지도 짓는 연장 =======================
  function kit(id, W, H, seed) {
    const m = makeMap(id, W, H), r = G.mulberry(seed);
    const res = new Uint8Array(W * H);
    const I = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const get = (x, y) => inb(x, y) ? m.t[I(x, y)] : T.ROCK;
    const set = (x, y, t) => { if (inb(x, y)) m.t[I(x, y)] = t; };
    const K = {
      m, r, res, I, inb, get, set, W, H,
      fill(fn) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, fn(x, y)); },
      // keep: 물·다리는 건드리지 않고, 칠한 자리는 나무가 안 난다
      blob(cx, cy, rx, ry, t, keep, ns) {
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          if (!inb(x, y)) continue;
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy + (G.vnoise(x / 2.5, y / 2.5, seed + 19) - 0.5) * (ns === undefined ? 0.5 : ns) < 1) {
            const cur = get(x, y);
            if (keep && (cur === T.WATER || cur === T.DECK || cur === T.STEP || cur === T.PAVE)) continue;
            set(x, y, t);
            if (keep) res[I(x, y)] = 1;
          }
        }
      },
      rect(x0, y0, w, h, t, keep) {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { set(x, y, t); if (keep !== false && inb(x, y)) res[I(x, y)] = 1; }
      },
      // 길·내. 흙길이 물을 만나면 다리가 된다.
      path(pts, wd, t, wig, nores) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          const len = Math.hypot(bx - ax, by - ay) || 1;
          for (let s = 0; s <= len; s += 0.35) {
            const k = s / len;
            let px = ax + (bx - ax) * k, py = ay + (by - ay) * k;
            if (wig) {
              const o = (G.vnoise(px / 6, py / 6, seed + 17) - 0.5) * wig;
              px += -(by - ay) / len * o; py += (bx - ax) / len * o;
            }
            const x0 = Math.round(px - wd / 2), y0 = Math.round(py - wd / 2);
            for (let b = 0; b < wd; b++) for (let a = 0; a < wd; a++) {
              const x = x0 + a, y = y0 + b;
              if (!inb(x, y)) continue;
              const cur = get(x, y);
              if (t === T.DIRT && (cur === T.WATER || cur === T.DECK)) set(x, y, T.DECK);
              else if (t === T.DIRT && (cur === T.PAVE || cur === T.STEP)) { /* 돌길은 그대로 */ }
              else set(x, y, t);
              if (!nores) res[I(x, y)] = 1;
            }
          }
        }
      },
      reserve(x0, y0, w, h) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) res[I(x, y)] = 1; },
      prop(s, tx, ty, o) { return addProp(m, s, tx, ty, o); },
      // 놓고 막는다
      put(s, tx, ty, o, low) { const p = addProp(m, s, tx, ty, o); block(m, tx, ty, 1, 1, low ? 2 : 1); if (inb(tx, ty)) res[I(tx, ty)] = 1; return p; },
      block(tx, ty, w, h, v) { block(m, tx, ty, w, h, v); },
      // 집 한 채: 네 칸 너비, 두 칸 깊이. 문 앞 두 칸은 흙.
      house(kind, tx, ty, o) {
        o = o || {};
        for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 4; x++) {
          const c = get(x, y);
          if (c === T.ROCK || c === T.WATER) set(x, y, o.ground === undefined ? T.GRASS : o.ground);
        }
        const p = addProp(m, kind, tx + 2, ty + 1, Object.assign({ x: (tx + 2) * 16, y: (ty + 2) * 16 - 1, light: o.light === false ? 0 : 30, ldy: -12 }, o.p || {}));
        block(m, tx, ty, 4, 2); K.reserve(tx - 1, ty - 2, 6, 5);
        if (o.door !== false) { set(tx + 1, ty + 2, o.doorT || T.DIRT); set(tx + 2, ty + 2, o.doorT || T.DIRT); }
        return p;
      },
      // 큰 건물(신사): 다섯 칸 너비, 세 칸 깊이
      hall(kind, tx, ty, o) {
        const p = addProp(m, kind, tx + 2, ty + 2, Object.assign({ x: (tx + 2) * 16 + 8, y: (ty + 3) * 16 - 1 }, o || {}));
        block(m, tx, ty, 5, 3); K.reserve(tx - 1, ty - 2, 7, 7);
        return p;
      },
      // 도리이: tx는 가운데 두 칸 중 왼쪽. 기둥 두 칸만 막힌다.
      torii(tx, ty, o) {
        const p = addProp(m, (o && o.s) || 'torii', tx, ty, Object.assign({ x: (tx + 1) * 16, y: ty * 16 + 15 }, o || {}));
        block(m, tx - 1, ty); block(m, tx + 2, ty);
        K.reserve(tx - 2, ty - 2, 6, 5);
        return p;
      },
      npc(id, tx, ty, o) { const n = Object.assign({ id, tx, ty }, o || {}); m.npcs.push(n); if (inb(tx, ty)) res[I(tx, ty)] = 1; return n; },
      spawn(type, tx, ty, o) { m.spawns.push(Object.assign({ x: tx * 16 + 8, y: ty * 16 + 12, type, night: 0 }, o || {})); },
      // 구역 안 빈 땅에 n마리
      zone(x0, y0, x1, y1, type, n, ok, o) {
        let made = 0, tries = 0;
        while (made < n && tries++ < 4000) {
          const x = x0 + Math.floor(r() * (x1 - x0)), y = y0 + Math.floor(r() * (y1 - y0));
          if (!inb(x, y) || m.solid[I(x, y)] || SOLID_T[get(x, y)] || (ok && ok.indexOf(get(x, y)) < 0)) continue;
          if (m.safe.some(v => Math.hypot(v[0] - x, v[1] - y) < v[2] + 2)) continue;
          if (m.spawns.some(s => Math.hypot(s.x / 16 - x, s.y / 16 - y) < 4)) continue;
          K.spawn(type, x, y, o);
          made++;
        }
      },
      warp(tx, ty, to, x, y, dir, o) { m.warps.push(Object.assign({ tx, ty, to, x, y, dir: dir || 'down' }, o || {})); },
      // 빈 땅마다 불러서 나무며 풀을 심게 한다
      veg(fn) {
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          if (res[I(x, y)] || m.solid[I(x, y)]) continue;
          fn(x, y, get(x, y), r(), r(), G.vnoise(x / 8, y / 8, seed + 41));
        }
      },
      // 심고 막는다 / 심기만 한다
      tree(s, x, y, v, low) { addProp(m, s, x, y, { v }); block(m, x, y, 1, 1, low ? 2 : 1); },
      soft(s, x, y) { addProp(m, s, x, y, { soft: true }); },
      nearT(x, y, t) { return get(x + 1, y) === t || get(x - 1, y) === t || get(x, y + 1) === t || get(x, y - 1) === t; }
    };
    return K;
  }

  // ======================= 철마다 다른 빛깔 =======================
  const THEMES = {
    spring: {
      grass: ['#718c45', '#62803f', '#9c9a56', '#5f7a3c', '#88a04e'], high: ['#7f8a56', '#6c7b4d', '#94905f', '#667446', '#98a068'],
      tuft: ['#557238', '#93a856'], fl: ['#f6f1e3', '#e9b4c0'], paddy: 'water', leaf: null
    },
    summer: {
      grass: ['#5f8a3f', '#527c39', '#7a9a48', '#4a7034', '#7aa04a'], high: ['#6a8a4a', '#5c7b44', '#839450', '#55723e', '#8aa25a'],
      tuft: ['#42682f', '#86ac50'], fl: ['#e6cc78', '#f6f1e3'], paddy: 'green', leaf: null
    },
    autumn: {
      grass: ['#9a9450', '#878446', '#b3a65a', '#7c783f', '#bfb062'], high: ['#93895a', '#827a50', '#a89c64', '#756e48', '#b3a66c'],
      tuft: ['#6f6c3a', '#c4b866'], fl: ['#c8452f', '#f6f1e3'], paddy: 'gold', leaf: ['#b8402e', '#d99a45', '#8c2b22']
    },
    winter: {
      grass: ['#8f9478', '#80866c', '#a2a586', '#747a62', '#b0b294'], high: ['#9a9e8a', '#8b907c', '#aaae98', '#7e8370', '#b8bba6'],
      tuft: ['#6a6f58', '#b9bca4'], fl: null, paddy: 'stubble', leaf: null, snowy: 1
    },
    hub: {
      grass: ['#7f9a6a', '#6f8a5e', '#96aa78', '#64805a', '#a2b684'], high: ['#7f9a6a', '#6f8a5e', '#96aa78', '#64805a', '#a2b684'],
      tuft: ['#5a7a4e', '#a8c088'], fl: ['#f6f1e3', '#c9b8d8'], paddy: 'water', leaf: null
    }
  };

  // ======================= 바닥 그리기 =======================
  const cols = new Map();
  function C(s) {
    let c = cols.get(s);
    if (c === undefined) { const n = parseInt(s.slice(1), 16); c = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; cols.set(s, c); }
    return c;
  }

  function terrainAt(m, wx, wy) {
    const w = m.w, h = m.h;
    let tx = wx >> 4, ty = wy >> 4;
    tx = tx < 0 ? 0 : tx >= w ? w - 1 : tx; ty = ty < 0 ? 0 : ty >= h ? h - 1 : ty;
    const t = m.t[ty * w + tx];
    if (HARD[t]) return t;
    const ox = (G.vnoise(wx / 6, wy / 6, 101) - 0.5) * 9, oy = (G.vnoise(wx / 6, wy / 6, 202) - 0.5) * 9;
    let ux = (wx + ox) >> 4, uy = (wy + oy) >> 4;
    ux = ux < 0 ? 0 : ux >= w ? w - 1 : ux; uy = uy < 0 ? 0 : uy >= h ? h - 1 : uy;
    const t2 = m.t[uy * w + ux];
    return HARD[t2] ? t : t2;
  }

  const CH = 256, MG = 12, SZ = CH + MG * 2;
  function paintChunk(m, cx, cy) {
    const TH = THEMES[m.theme] || THEMES.spring;
    const terr = new Uint8Array(SZ * SZ);
    const bx = cx * CH - MG, by = cy * CH - MG;
    for (let py = 0; py < SZ; py++) for (let px = 0; px < SZ; px++) terr[py * SZ + px] = terrainAt(m, bx + px, by + py);
    const cvs = G.art.cv(CH, CH), ctx = cvs.getContext('2d');
    const img = ctx.createImageData(CH, CH), out = new Uint32Array(img.data.buffer);
    const tileAt = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? -1 : m.t[y * m.w + x];
    const wet = t => t === T.WATER || t === T.SHALLOW || t === T.DECK;
    const grassy = t => t === T.GRASS || t === T.HIGH || t === T.MOSS;
    const stone = t => t === T.ROCK;
    const deep = m.theme === 'autumn' || m.theme === 'winter';
    for (let py = 0; py < CH; py++) for (let px = 0; px < CH; px++) {
      const i = (py + MG) * SZ + px + MG, t = terr[i];
      const wx = bx + MG + px, wy = by + MG + py;
      const h = G.hash2(wx, wy, 1);
      let c;
      switch (t) {
        case T.GRASS: case T.HIGH: {
          const g = t === T.GRASS ? TH.grass : TH.high;
          const n = G.vnoise(wx / 38, wy / 38, t === T.GRASS ? 7 : 8);
          c = n > 0.63 ? C(g[2]) : n < 0.32 ? C(g[1]) : C(g[0]);
          if (h < 0.045) c = C(g[3]); else if (h > 0.965) c = C(g[4]);
          if (TH.snowy && G.vnoise(wx / 26, wy / 18, 61) > 0.58) c = h < 0.12 ? C('#dfe6e2') : C('#f2f2ea');
          break;
        }
        case T.MOSS: {
          const n = G.vnoise(wx / 26, wy / 26, 12);
          if (TH.snowy) {
            c = n > 0.62 ? C('#7c866c') : n < 0.34 ? C('#626d58') : C('#6f7a62');
            if (h < 0.06) c = C('#566050'); else if (h > 0.95) c = C('#6b5a3a');
            if (G.vnoise(wx / 22, wy / 15, 61) > 0.5) c = h < 0.12 ? C('#dfe6e2') : C('#f2f2ea');
            break;
          }
          c = n > 0.62 ? C('#5a7440') : n < 0.34 ? C('#44603a') : C('#4f6a3c');
          if (h < 0.06) c = C('#3c5632'); else if (h > 0.96) c = C('#6a8448'); else if (h > 0.93) c = C('#6b5a3a');
          break;
        }
        case T.DIRT:
          c = h < 0.06 ? C('#9a7a50') : h > 0.95 ? C('#c4a676') : C('#b08f62');
          if (grassy(terr[i - SZ]) || stone(terr[i - SZ])) c = C('#8f7049');
          if (TH.snowy && G.vnoise(wx / 16, wy / 10, 63) > 0.74) c = C('#e4e6dc');
          break;
        case T.SAND:
          c = h < 0.06 ? C('#c6b27a') : h > 0.95 ? C('#e6d8a8') : C('#d6c48e');
          if (grassy(terr[i - SZ])) c = C('#bda972');
          break;
        case T.MUD:
          c = h < 0.08 ? C('#6a5f51') : h > 0.95 ? C('#958a78') : C('#7a6e5e');
          if ((wy + Math.floor(G.vnoise(wx / 9, wy / 4, 4) * 5)) % 7 === 0) c = C('#6a5f51');
          break;
        case T.WATER:
          c = G.vnoise(wx / 22, wy / 12, 6) > 0.6 ? C(deep ? '#33586e' : '#396780') : C(deep ? '#386078' : '#3f6f86');
          if (!wet(terr[i - SZ])) c = C('#d7e6da');
          else if (!wet(terr[i - SZ * 2]) || !wet(terr[i - 1]) || !wet(terr[i + 1])) c = C('#6b9aa6');
          else if (!wet(terr[i + SZ])) c = C('#2f566e');
          break;
        case T.SHALLOW:
          c = h < 0.07 ? C('#4e7a80') : h > 0.955 ? C('#86b0ac') : C('#5b8a8f');
          if (!wet(terr[i - SZ])) c = C('#4e7a80');
          break;
        case T.ROCK: {
          const below = terr[i + SZ * 10];
          if (below !== T.ROCK) {
            c = G.hash2(wx >> 1, wy >> 3, 2) < 0.3 ? C('#4e4843') : C('#5c554f');
            if (terr[i + SZ * 2] !== T.ROCK) c = C('#3b3632');
          } else if (terr[i - SZ] !== T.ROCK || terr[i - SZ * 2] !== T.ROCK) c = C(TH.snowy ? '#f2f2ea' : '#9a9488');
          else {
            const b0 = Math.floor(G.vnoise(wx / 30, wy / 20, 55) * 8), b1 = Math.floor(G.vnoise(wx / 30, (wy + 2) / 20, 55) * 8);
            if (b0 !== b1) c = C('#5f5a54');
            else c = b0 & 1 ? C('#7d7870') : C('#746f68');
            if (h < 0.03) c = C('#666159'); else if (h > 0.975) c = C('#918b80');
            if (TH.snowy && G.fbm(wx / 44, wy / 30, 62) > 0.47) c = h < 0.08 ? C('#c9d3cf') : G.vnoise(wx / 12, wy / 8, 66) > 0.72 ? C('#dfe6e2') : C('#eef0ec');
          }
          break;
        }
        case T.SNOW:
          c = h < 0.05 ? C('#c9d3cf') : h > 0.95 ? C('#ffffff') : G.vnoise(wx / 14, wy / 9, 64) > 0.6 ? C('#e4e9e6') : C('#f0f1ec');
          if (terr[i - SZ] !== T.SNOW && terr[i - SZ] !== T.ROCK) c = C('#ffffff');
          else if (terr[i + SZ] !== T.SNOW) c = C('#c9d3cf');
          break;
        case T.PADDY: case T.FIELD: {
          const tx = wx >> 4, ty = wy >> 4, lx = wx & 15, ly = wy & 15;
          const edge = (lx === 0 && tileAt(tx - 1, ty) !== t) || (lx === 15 && tileAt(tx + 1, ty) !== t) || (ly === 0 && tileAt(tx, ty - 1) !== t) || (ly === 15 && tileAt(tx, ty + 1) !== t);
          if (t === T.FIELD) c = edge ? C('#7d6444') : (ly % 4 === 0 ? C('#7d6444') : (ly % 4 === 2 && (lx + (wy >> 2)) % 4 === 1 ? C(TH.snowy ? '#b0b294' : '#6f9c4c') : C('#9a7a50')));
          else if (TH.paddy === 'water') c = edge ? C('#8a7a55') : ((ly & 3) === 2 && ((lx + (wy >> 2)) & 3) === 0 ? C('#8fb86a') : h > 0.97 ? C('#a9cfc8') : C('#5f8f94'));
          else if (TH.paddy === 'green') c = edge ? C('#6f6a45') : ((ly & 3) === 2 ? C('#3f6f34') : ((lx + (wy >> 2)) % 3 === 0 ? C('#86b356') : C('#5f9440')));
          else if (TH.paddy === 'gold') c = edge ? C('#8a7a55') : (ly & 3) === 2 ? (((lx + (wy >> 2)) % 3 === 0) ? C('#d7bd6c') : C('#8f7a4a')) : C('#a08a55');
          else c = edge ? C('#7a6e5e') : ((ly & 3) === 2 && ((lx + (wy >> 2)) & 3) === 0 ? C('#b9a877') : h > 0.8 ? C('#e4e6dc') : C('#8f8468'));
          break;
        }
        case T.DECK: {
          const tx = wx >> 4, ty = wy >> 4, lx = wx & 15, ly = wy & 15;
          const W1 = T.WATER, S1 = T.SHALLOW, w0 = v => v === W1 || v === S1;
          const wl = w0(tileAt(tx - 1, ty)), wr = w0(tileAt(tx + 1, ty)), wu = w0(tileAt(tx, ty - 1)), wd = w0(tileAt(tx, ty + 1));
          c = (wl || wr) && !(wu || wd) ? (ly % 5 === 0 ? C('#6b4a32') : C('#8f6f48')) : (lx % 5 === 0 ? C('#6b4a32') : C('#8f6f48'));
          if (h > 0.97) c = C('#a8875c');
          if ((wl && lx < 2) || (wr && lx > 13) || (wu && ly < 2) || (wd && ly > 13)) c = C('#46301f');
          if (wd && ly > 14) c = C('#2a211e');
          break;
        }
        case T.PAVE: {
          const row = wy >> 3;
          c = ((wy & 7) === 0 || ((wx + (row & 1) * 8) & 15) === 0) ? C('#77746c') : h < 0.06 ? C('#8b877d') : h > 0.955 ? C('#7d8a5a') : C('#9d998e');
          if (TH.snowy && h > 0.86) c = C('#e9ecea');
          break;
        }
        case T.STEP: {
          const ly = wy & 7;
          c = ly === 0 ? C('#c2bfb2') : ly === 1 ? C('#a9a69a') : ly >= 6 ? C('#5f5a54') : (h < 0.06 ? C('#7d7870') : C('#8e8b80'));
          if (((wx + ((wy >> 3) & 1) * 9) % 18) === 0 && ly > 1 && ly < 6) c = C('#77746c');
          if (TH.snowy && ly < 2 && h > 0.4) c = C('#f2f2ea');
          break;
        }
        case T.CAVEF:
          c = h < 0.07 ? C('#403b46') : h > 0.95 ? C('#5a5560') : C('#4b4651');
          if (terr[i - SZ] === T.CAVEW) c = C('#403b46');
          break;
        case T.CAVEW:
          if (terr[i + SZ * 12] === T.CAVEF) {
            c = G.hash2(wx >> 1, wy >> 3, 3) < 0.3 ? C('#272230') : C('#2f2a36');
            if (terr[i + SZ] === T.CAVEF) c = C('#1d1922');
          } else c = h > 0.975 ? C('#221e28') : C('#17141c');
          break;
        case T.CLOUD: {
          const n = G.fbm(wx / 30, wy / 16, 9);
          c = n > 0.62 ? C('#f4f6f8') : n > 0.5 ? C('#e3e8ee') : n > 0.38 ? C('#cfd7e0') : C('#bcc6d2');
          if (terr[i - SZ] !== T.CLOUD) c = C('#8f9bb0');
          else if (terr[i - SZ * 3] !== T.CLOUD) c = C('#aab4c4');
          break;
        }
        default: c = C('#0c0b0f');
      }
      out[py * CH + px] = c;
    }
    ctx.putImageData(img, 0, 0);
    // 풀포기, 들꽃, 자갈, 낙엽
    const dot = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w || 1, h || 1); };
    for (let ty = cy * 16; ty < cy * 16 + 16; ty++) for (let tx = cx * 16; tx < cx * 16 + 16; tx++) {
      const t = tileAt(tx, ty);
      if (t < 0) continue;
      const hh = G.hash2(tx, ty, 77);
      const ox = 2 + Math.floor(G.hash2(tx, ty, 78) * 9), oy = 2 + Math.floor(G.hash2(tx, ty, 79) * 9);
      const X = tx * 16 + ox - cx * CH, Y = ty * 16 + oy - cy * CH;
      if (terr[(Y + MG) * SZ + X + MG] !== t || terr[(Y + MG + 3) * SZ + X + MG + 4] !== t) continue;
      if (t === T.GRASS || t === T.HIGH) {
        const dk = TH.tuft[0], lt = TH.tuft[1];
        if (hh < 0.24) {
          dot(dk, X, Y + 1, 1, 2); dot(dk, X + 2, Y, 1, 3); dot(dk, X + 4, Y + 1, 1, 2);
          if (hh < 0.1) dot(lt, X + 2, Y, 1, 1);
        } else if (TH.fl && hh < 0.275) {
          const f = TH.fl[0];
          if (m.theme === 'autumn') { dot(f, X, Y); dot(f, X + 2, Y); dot(f, X + 1, Y - 1); dot(f, X + 1, Y + 1); dot(f, X - 1, Y + 1); dot(f, X + 3, Y + 1); dot('#557238', X + 1, Y + 2, 1, 3); }
          else { dot(f, X + 1, Y); dot(f, X, Y + 1); dot(f, X + 2, Y + 1); dot(f, X + 1, Y + 2); dot('#e6cc78', X + 1, Y + 1); }
        } else if (TH.fl && hh < 0.3) {
          const f = TH.fl[1];
          dot(f, X + 1, Y); dot(f, X, Y + 1); dot(f, X + 2, Y + 1); dot(f, X + 1, Y + 2); dot('#e6cc78', X + 1, Y + 1);
          dot(dk, X + 1, Y + 3, 1, 2);
        } else if (TH.leaf && hh < 0.5) {
          dot(TH.leaf[Math.floor(hh * 40) % 3], X, Y, 2, 1); dot(TH.leaf[Math.floor(hh * 70) % 3], X + 4, Y + 3, 1, 1);
        } else if (m.theme === 'spring' && hh > 0.9) { dot('#f4d3da', X, Y); dot('#e9b4c0', X + 3, Y + 2); }
      } else if (t === T.MOSS) {
        if (hh < 0.14) { dot('#6b5a3a', X, Y + 1, 3, 1); dot('#8f7a4a', X + 1, Y, 1, 1); }
        else if (hh < 0.24) { dot('#3c5632', X, Y + 1, 1, 2); dot('#7a9a4a', X + 2, Y, 1, 3); dot('#3c5632', X + 4, Y + 1, 1, 2); }
      } else if (t === T.DIRT) {
        if (hh < 0.12) { dot('#7d6444', X, Y + 1, 3, 1); dot('#a7a59c', X, Y, 2, 1); }
        else if (TH.leaf && hh < 0.3) dot(TH.leaf[Math.floor(hh * 40) % 3], X, Y, 2, 1);
      } else if (t === T.SAND) {
        if (hh < 0.07) { dot('#f6f1e3', X, Y, 2, 1); dot('#cf9a8a', X, Y + 1, 2, 1); }
      } else if (t === T.CAVEF) {
        if (hh < 0.1) { dot('#35303b', X, Y + 1, 3, 1); dot('#6a6570', X, Y, 2, 1); }
      } else if (t === T.SNOW) {
        if (hh < 0.12) { dot('#c9d3cf', X, Y + 1, 3, 1); dot('#b9c3c8', X + 1, Y + 2, 2, 1); }
      }
    }
    return cvs;
  }

  // ======================= 바깥에서 쓰는 것 =======================
  const MINI = [];
  MINI[T.GRASS] = '#718c45'; MINI[T.DIRT] = '#c4a676'; MINI[T.SAND] = '#d6c48e'; MINI[T.WATER] = '#3f6f86'; MINI[T.SHALLOW] = '#5b8a8f';
  MINI[T.ROCK] = '#6a655f'; MINI[T.PAVE] = '#9d998e'; MINI[T.PADDY] = '#a89358'; MINI[T.DECK] = '#8f6f48'; MINI[T.STEP] = '#b3b0a4';
  MINI[T.MUD] = '#7a6e5e'; MINI[T.HIGH] = '#7f8a56'; MINI[T.SNOW] = '#eef0ec'; MINI[T.MOSS] = '#4f6a3c'; MINI[T.CLOUD] = '#cfd7e0';
  MINI[T.FIELD] = '#9a7a50'; MINI[T.CAVEF] = '#4b4651'; MINI[T.CAVEW] = '#221e28';

  const builders = {};
  const world = G.world = {
    T, maps: {}, cur: null, kit, THEMES,
    // 지도 짓는 함수는 maps*.js에서 여기에 올린다
    define(id, fn) { builders[id] = fn; },
    init() { this.maps = {}; this.cur = null; },
    // 처음 들어설 때 짓는다
    get(id) {
      let m = this.maps[id];
      if (!m) { m = this.maps[id] = builders[id](); m.id = id; }
      return m;
    },
    has(id) { return !!builders[id]; },
    ids() { return Object.keys(builders); },
    use(id) { this.cur = this.get(id); return this.cur; },
    tile(tx, ty) {
      const m = this.cur;
      return (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) ? T.VOID : m.t[ty * m.w + tx];
    },
    solidTile(tx, ty) {
      const m = this.cur;
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
      const i = ty * m.w + tx;
      return !!(SOLID_T[m.t[i]] || m.solid[i]);
    },
    // 뛰어서도 못 넘는 칸인가
    tallTile(tx, ty) {
      const m = this.cur;
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
      const i = ty * m.w + tx;
      return !!(TALL_T[m.t[i]] || m.solid[i] === 1);
    },
    // 발밑 상자(가운데 x, 아래 y, 너비 w, 높이 h)가 막히는가
    boxBlocked(x, y, w, h) {
      const x0 = Math.floor((x - w / 2) / 16), x1 = Math.floor((x + w / 2 - 0.01) / 16);
      const y0 = Math.floor((y - h) / 16), y1 = Math.floor((y - 0.01) / 16);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
      return false;
    },
    // 문이 열리거나 다리가 놓일 때
    setSolid(tx, ty, v) { const m = this.cur; if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) m.solid[ty * m.w + tx] = v; },
    chunk(cx, cy) {
      const m = this.cur, k = cy * 64 + cx;
      let c = m.chunks.get(k);
      if (!c) { c = paintChunk(m, cx, cy); m.chunks.set(k, c); }
      return c;
    },
    drawGround(ctx, camx, camy, time) {
      const m = this.cur;
      const cx0 = Math.floor(camx / CH), cx1 = Math.floor((camx + G.W - 1) / CH);
      const cy0 = Math.floor(camy / CH), cy1 = Math.floor((camy + G.H - 1) / CH);
      const mcx = Math.ceil(m.w / 16), mcy = Math.ceil(m.h / 16);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx >= mcx || cy >= mcy) continue;
        ctx.drawImage(this.chunk(cx, cy), cx * CH - camx, cy * CH - camy);
      }
      // 화면 밖 한 칸은 한 프레임에 하나씩 미리 칠해 둔다
      let warmed = false;
      for (let cy = cy0 - 1; cy <= cy1 + 1 && !warmed; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        if (cx < 0 || cy < 0 || cx >= mcx || cy >= mcy) continue;
        if (!m.chunks.has(cy * 64 + cx)) { this.chunk(cx, cy); warmed = true; break; }
      }
      // 물결, 구름결
      const tx0 = Math.floor(camx / 16), ty0 = Math.floor(camy / 16);
      for (let ty = ty0; ty <= ty0 + 14; ty++) for (let tx = tx0; tx <= tx0 + 24; tx++) {
        const t = this.tile(tx, ty);
        if (t !== T.WATER && t !== T.CLOUD) continue;
        const hh = G.hash2(tx, ty, 5);
        if (hh > (t === T.CLOUD ? 0.2 : 0.34)) continue;
        if (this.tile(tx - 1, ty) !== t || this.tile(tx + 1, ty) !== t || this.tile(tx, ty - 1) !== t || this.tile(tx, ty + 1) !== t) continue;
        const sp = t === T.CLOUD ? 0.16 : 0.5;
        const ph = (time * sp + hh * 31) % 3;
        if (ph > 1.4) continue;
        const X = tx * 16 + Math.floor(hh * 290) % 9 + Math.floor(ph * 3) - camx, Y = ty * 16 + Math.floor(hh * 570) % 12 - camy;
        ctx.fillStyle = t === T.CLOUD ? '#ffffff' : '#6fa0ad';
        ctx.fillRect(X, Y, ph < 0.3 || ph > 1.1 ? 3 : (t === T.CLOUD ? 8 : 5), 1);
      }
    },
    // 화면에 걸치는 소품
    visibleProps(camx, camy, out) {
      const m = this.cur;
      const bx0 = Math.floor((camx - 48) / 128), bx1 = Math.floor((camx + G.W + 48) / 128);
      const by0 = Math.floor((camy - 8) / 128), by1 = Math.floor((camy + G.H + 104) / 128);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        const b = m.buckets.get((by << 8) | bx);
        if (!b) continue;
        for (const p of b) if (!p.gone && p.x > camx - 48 && p.x < camx + G.W + 48 && p.y > camy - 4 && p.y < camy + G.H + 104) out.push(p);
      }
      return out;
    },
    findUse(px, py, rad) {
      let best = null, bd = rad;
      for (const p of this.cur.props) {
        if (!p.use || p.gone) continue;
        const d = Math.hypot(p.x - px, p.y - 6 - py) - (p.reach || 0);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    findProp(id) { for (const p of this.cur.props) if (p.id === id) return p; return null; },
    region(px, py) {
      const m = this.cur, x = px / 16, y = py / 16;
      for (const rg of m.regions) {
        if (rg.length === 4 ? Math.hypot(rg[1] - x, rg[2] - y) < rg[3] : (x >= rg[1] && y >= rg[2] && x < rg[3] && y < rg[4])) return rg[0];
      }
      return m.region || '';
    },
    miniColor(t) { return MINI[t] || '#17141c'; }
  };
})();
