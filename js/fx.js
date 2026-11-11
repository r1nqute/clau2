'use strict';
// 눈에 보이는 군더더기: 먼지, 불똥, 칼자국, 잔상, 칼 그림, 날씨. 그리고 맞는 순간의 멈춤.
(function () {
  const G = window.G;
  const INK = '#1b1a1f', LIGHT = '#f6f1e3';

  const fx = G.fx = {
    parts: [], arcs: [], ghosts: [], texts: [], rings: [], lines: [],
    stop: 0, slowT: 0, slowK: 1, flash: 0, dark: 0,

    reset() {
      this.parts.length = this.arcs.length = this.ghosts.length = this.texts.length = this.rings.length = this.lines.length = 0;
      this.stop = this.slowT = this.flash = this.dark = 0; this.slowK = 1;
    },
    puff(x, y, col, n, spd) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = (spd || 40) * (0.3 + Math.random() * 0.7);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.25 + Math.random() * 0.3, col, s: Math.random() < 0.4 ? 2 : 1 });
      }
    },
    // 쇠가 부딪칠 때 튀는 불똥
    spark(x, y, n, col) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = 60 + Math.random() * 130;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.12 + Math.random() * 0.2, col: col || (Math.random() < 0.5 ? '#f6f1e3' : '#e6cc78'), s: 1, drag: 0.86 });
      }
    },
    dust(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 24, vy: -6 - Math.random() * 10, life: 0.25 + Math.random() * 0.2, col: '#c4a676', s: Math.random() < 0.5 ? 2 : 1 }); },
    // 칼이 지나간 자리. ang 가운데, sweep 벌린 폭, dir +1 시계 방향
    arc(x, y, ang, r, sweep, dir, col, life) {
      this.arcs.push({ x, y, a: ang - dir * sweep / 2, b: ang + dir * sweep / 2, r, life: life || 0.16, max: life || 0.16, col: col || LIGHT });
    },
    line(x0, y0, x1, y1, col, life) { this.lines.push({ x0, y0, x1, y1, col: col || LIGHT, life: life || 0.22, max: life || 0.22 }); },
    ring(x, y, r, col, life) { this.rings.push({ x, y, r, col: col || LIGHT, life: life || 0.3, max: life || 0.3 }); },
    after(img, x, y, col, life) { this.ghosts.push({ img, x, y, col: col || LIGHT, life: life || 0.22, max: life || 0.22 }); },
    text(x, y, str, col) { this.texts.push({ x, y, str, col: col || LIGHT, life: 0.9 }); },
    hitstop(t) { this.stop = Math.max(this.stop, t); },
    slow(t, k) { this.slowT = Math.max(this.slowT, t); this.slowK = k || 0.3; },

    update(dt) {
      if (this.flash > 0) this.flash -= dt;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const q = this.parts[i];
        q.life -= dt;
        if (q.life <= 0) { this.parts.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        const d = q.drag || 0.92; q.vx *= d; q.vy *= d;
        if (q.g) q.vy += q.g * dt;
      }
      const age = arr => { for (let i = arr.length - 1; i >= 0; i--) if ((arr[i].life -= dt) <= 0) arr.splice(i, 1); };
      age(this.arcs); age(this.ghosts); age(this.rings); age(this.lines);
      for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y -= dt * 14; if (t.life <= 0) this.texts.splice(i, 1); }
    },

    // 발밑에 깔리는 것(잔상)
    drawUnder(ctx, cx, cy) {
      for (const g of this.ghosts) {
        ctx.globalAlpha = 0.55 * g.life / g.max;
        ctx.drawImage(G.art.tint(g.img, g.col), Math.round(g.x - cx), Math.round(g.y - cy));
      }
      ctx.globalAlpha = 1;
    },
    draw(ctx, cx, cy) {
      for (const q of this.parts) {
        ctx.fillStyle = q.col;
        ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.s, q.s);
      }
      for (const a of this.arcs) {
        const k = a.life / a.max, x0 = a.x - cx, y0 = a.y - cy;
        const st = a.a + (a.b - a.a) * (1 - k) * 0.75, n = Math.max(6, Math.round(Math.abs(a.b - st) * a.r));
        for (let i = 0; i <= n; i++) {
          const t = i / n, aa = st + (a.b - st) * t, th = Math.round(Math.sin(t * 3.1416) * 3 * k + 0.6);
          for (let j = 0; j <= th; j++) {
            ctx.fillStyle = j === 0 ? a.col : j < 2 ? '#e8e2d0' : '#b9d2cc';
            ctx.fillRect(Math.round(x0 + Math.cos(aa) * (a.r - j)), Math.round(y0 + Math.sin(aa) * (a.r - j)), 1, 1);
          }
        }
      }
      for (const l of this.lines) {
        const k = l.life / l.max, n = Math.round(Math.hypot(l.x1 - l.x0, l.y1 - l.y0));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          if (t < (1 - k) * 0.8) continue;
          const th = Math.sin(t * 3.1416) * 2 * k;
          ctx.fillStyle = l.col;
          ctx.fillRect(Math.round(l.x0 + (l.x1 - l.x0) * t - cx), Math.round(l.y0 + (l.y1 - l.y0) * t - cy - th / 2), 1, Math.max(1, Math.round(th)));
        }
      }
      for (const r of this.rings) {
        const k = 1 - r.life / r.max, rr = r.r * (0.3 + 0.7 * k), n = Math.max(12, Math.round(rr * 2.2));
        ctx.fillStyle = r.col;
        for (let i = 0; i < n; i++) {
          if (k > 0.5 && i % 2) continue;
          const a = i / n * 6.283;
          ctx.fillRect(Math.round(r.x - cx + Math.cos(a) * rr), Math.round(r.y - cy + Math.sin(a) * rr * 0.6), 1, 1);
        }
      }
      for (const t of this.texts) {
        if (t.life < 0.25 && Math.floor(t.life * 30) % 2) continue;
        G.text.drawS(ctx, t.str, t.x - cx, t.y - cy, t.col, 'small', 1);
      }
    },

    // ---------- 칼과 연장 ----------
    // (ox,oy) 손목에서 ang 쪽으로. kind에 따라 길이와 생김새가 다르다.
    blade(ctx, ox, oy, ang, kind, ext) {
      const W = WPN[kind] || WPN.kal, ca = Math.cos(ang), sa = Math.sin(ang);
      const len = W.len + (ext || 0), px = -sa, py = ca;
      const pts = [];
      for (let i = -W.back; i <= len; i++) {
        const t = Math.max(0, i) / len, cv = W.curve ? W.curve * t * t : 0;
        pts.push([Math.round(ox + ca * i + px * cv), Math.round(oy + sa * i + py * cv), i]);
      }
      ctx.fillStyle = INK;
      for (const [x, y, i] of pts) {
        const w = W.wide && i > len - W.wide ? 2 : 1;
        ctx.fillRect(x - 1, y - 1, 2 + w, 2 + w);
      }
      for (const [x, y, i] of pts) {
        let col;
        if (i < W.hilt) col = W.grip;
        else if (i === W.hilt && W.guard) col = W.guard;
        else if (W.shaft && i < len - W.head) col = (i % 7 === 3) ? W.grip2 || W.grip : W.grip;
        else col = (i + (W.shaft ? 0 : 1)) % 5 === 0 ? W.edge : W.steel;
        const w = W.wide && i > len - W.wide ? 2 : 1;
        ctx.fillStyle = col; ctx.fillRect(x, y, w, w);
      }
      if (W.guard) {
        const gx = Math.round(ox + ca * W.hilt), gy = Math.round(oy + sa * W.hilt);
        ctx.fillStyle = INK; ctx.fillRect(gx + Math.round(px * 2) - 1, gy + Math.round(py * 2) - 1, 3, 3); ctx.fillRect(gx - Math.round(px * 2) - 1, gy - Math.round(py * 2) - 1, 3, 3);
        ctx.fillStyle = W.guard; ctx.fillRect(gx + Math.round(px * 2), gy + Math.round(py * 2), 1, 1); ctx.fillRect(gx - Math.round(px * 2), gy - Math.round(py * 2), 1, 1); ctx.fillRect(gx, gy, 1, 1);
      }
      if (W.headKind === 'mallet') {
        const hx = Math.round(ox + ca * len), hy = Math.round(oy + sa * len);
        ctx.fillStyle = INK; ctx.fillRect(hx - 4, hy - 4, 9, 9); ctx.fillStyle = '#8f6f48'; ctx.fillRect(hx - 3, hy - 3, 7, 7); ctx.fillStyle = '#b99a6b'; ctx.fillRect(hx - 3, hy - 3, 7, 2);
      } else if (W.headKind === 'fan') {
        const hx = Math.round(ox + ca * len), hy = Math.round(oy + sa * len);
        ctx.fillStyle = INK; ctx.fillRect(hx - 5, hy - 4, 11, 9); ctx.fillRect(hx - 4, hy - 5, 9, 11);
        ctx.fillStyle = '#33303a'; ctx.fillRect(hx - 4, hy - 3, 9, 7); ctx.fillRect(hx - 3, hy - 4, 7, 9);
        ctx.fillStyle = '#e6cc78'; ctx.fillRect(hx - 1, hy - 1, 3, 3);
      }
      return [ox + ca * len, oy + sa * len];
    },
    wlen(kind) { return (WPN[kind] || WPN.kal).len; },
    // 활. 시위를 당긴 만큼 pull
    bow(ctx, ox, oy, ang, pull) {
      const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
      const pts = [];
      for (let i = -9; i <= 9; i++) {
        const k = 4 - (i * i) / 20;
        pts.push([Math.round(ox + ca * k + px * i), Math.round(oy + sa * k + py * i)]);
      }
      ctx.fillStyle = INK; for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = '#93714a'; for (const [x, y] of pts) ctx.fillRect(x, y, 1, 1);
      const a = pts[0], b = pts[pts.length - 1], mx = Math.round(ox - ca * (pull || 0) * 6), my = Math.round(oy - sa * (pull || 0) * 6);
      ctx.fillStyle = '#e8e2d0';
      for (let t = 0; t <= 1; t += 0.12) { ctx.fillRect(Math.round(a[0] + (mx - a[0]) * t), Math.round(a[1] + (my - a[1]) * t), 1, 1); ctx.fillRect(Math.round(b[0] + (mx - b[0]) * t), Math.round(b[1] + (my - b[1]) * t), 1, 1); }
      if (pull) this.arrow(ctx, mx + ca * 6, my + sa * 6, ang);
    },
    arrow(ctx, x, y, ang) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      ctx.fillStyle = INK;
      for (let i = -6; i <= 6; i++) ctx.fillRect(Math.round(x + ca * i) - 1, Math.round(y + sa * i) - 1, 3, 3);
      for (let i = -6; i <= 6; i++) { ctx.fillStyle = i > 4 ? '#dfe6e8' : i < -3 ? '#e8e2d0' : '#b99a6b'; ctx.fillRect(Math.round(x + ca * i), Math.round(y + sa * i), 1, 1); }
    },
    // 노리는 자리 표시: 붉은 것은 막을 수 없다
    glint(ctx, x, y, red, time) {
      const c = red ? '#e2714a' : '#f6f1e3', k = Math.floor(time * 20) % 2;
      ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 4, 3, 9); ctx.fillRect(x - 4, y - 1, 9, 3);
      ctx.fillStyle = c; ctx.fillRect(x, y - 3 - k, 1, 7 + k * 2); ctx.fillRect(x - 3 - k, y, 7 + k * 2, 1);
      if (red) { ctx.fillStyle = '#f6f1e3'; ctx.fillRect(x, y, 1, 1); }
    },
    // 바닥의 붉은 자리: 여기는 피해야 한다
    danger(ctx, x, y, r, k) {
      ctx.fillStyle = 'rgba(200,69,47,' + (0.18 + 0.22 * k).toFixed(2) + ')';
      const ry = r * 0.62;
      for (let j = -Math.round(ry); j <= ry; j++) {
        const w = Math.round(r * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
        if (w > 0) ctx.fillRect(Math.round(x - w), Math.round(y + j), w * 2, 1);
      }
    }
  };

  const WPN = {
    kal: { len: 13, back: 0, hilt: 3, grip: '#6b4a32', guard: '#cfa64a', steel: '#dfe6e8', edge: '#9aa3a8', curve: 1 },
    tachi: { len: 14, back: 0, hilt: 3, grip: '#33303a', guard: '#cfa64a', steel: '#dfe6e8', edge: '#9aa3a8', curve: 2.5 },
    nodachi: { len: 21, back: 0, hilt: 4, grip: '#5b3d5c', guard: '#cfa64a', steel: '#f6f1e3', edge: '#9aa3a8', curve: 3.5 },
    bokken: { len: 13, back: 0, hilt: 3, grip: '#93714a', steel: '#b99a6b', edge: '#93714a', curve: 1.5 },
    oar: { len: 18, back: 1, hilt: 4, grip: '#6b4a32', steel: '#b99a6b', edge: '#8f6f48', wide: 9 },
    short: { len: 8, back: 0, hilt: 2, grip: '#93714a', steel: '#b99a6b', edge: '#93714a' },
    nagi: { len: 30, back: 8, hilt: 0, shaft: 1, head: 9, grip: '#6b4a32', grip2: '#33303a', steel: '#dfe6e8', edge: '#9aa3a8', curve: 3, wide: 5 },
    yari: { len: 28, back: 8, hilt: 0, shaft: 1, head: 5, grip: '#8f6f48', grip2: '#33303a', steel: '#dfe6e8', edge: '#9aa3a8' },
    mallet: { len: 14, back: 2, hilt: 0, shaft: 1, head: 0, grip: '#6b4a32', steel: '#6b4a32', edge: '#6b4a32', headKind: 'mallet' },
    fan: { len: 8, back: 0, hilt: 0, shaft: 1, head: 0, grip: '#33303a', steel: '#33303a', edge: '#33303a', headKind: 'fan' },
    gun: { len: 16, back: 4, hilt: 5, grip: '#6b4a32', steel: '#5a5c63', edge: '#33303a' },
    stick: { len: 12, back: 0, hilt: 0, shaft: 1, head: 0, grip: '#b99a6b', steel: '#b99a6b', edge: '#93714a' }
  };
  fx.WPN = WPN;

  // ---------- 날씨 ----------
  // 화면에 붙어 다니되, 걷는 만큼 밀려서 땅에 내리는 것처럼 보인다.
  const wx = { kind: null, p: [], lx: 0, ly: 0, fogCv: null };
  const KIND = {
    petal: { n: 34, cols: ['#f4d3da', '#e9b4c0', '#f6f1e3'], vx: 14, vy: 16, sway: 10, s: [1, 2] },
    leaf: { n: 28, cols: ['#b8402e', '#d99a45', '#8c2b22', '#d8643c'], vx: 22, vy: 20, sway: 14, s: [2, 2] },
    snow: { n: 70, cols: ['#f6f6f2', '#dfe6e2'], vx: 6, vy: 22, sway: 8, s: [1, 2] },
    rain: { n: 90, cols: ['#b9d2cc', '#7fa9b0'], vx: -60, vy: 330, sway: 0, s: [1, 1], streak: 5 },
    mist: { n: 0 }, fog: { n: 0 },
    firefly: { n: 16, cols: ['#e6cc78', '#b8b56a'], vx: 0, vy: 0, sway: 18, s: [1, 1], blink: 1 }
  };
  fx.weather = {
    get kind() { return wx.kind; },
    set(kind, camx, camy) {
      wx.kind = kind; wx.p.length = 0; wx.lx = camx || 0; wx.ly = camy || 0;
      const K = KIND[kind];
      if (!K) return;
      for (let i = 0; i < K.n; i++) wx.p.push({ x: Math.random() * G.W, y: Math.random() * G.H, ph: Math.random() * 6.28, c: G.pick(K.cols), s: K.s[Math.random() < 0.3 ? 1 : 0], v: 0.6 + Math.random() * 0.8 });
    },
    update(dt, camx, camy) {
      const K = KIND[wx.kind];
      const dx = camx - wx.lx, dy = camy - wx.ly; wx.lx = camx; wx.ly = camy;
      if (!K) return;
      for (const q of wx.p) {
        q.ph += dt * 2;
        q.x += (K.vx * q.v + Math.sin(q.ph) * K.sway) * dt - dx;
        q.y += (K.vy * q.v + Math.cos(q.ph * 0.7) * K.sway * 0.3) * dt - dy;
        if (q.x < -4) q.x += G.W + 8; else if (q.x > G.W + 4) q.x -= G.W + 8;
        if (q.y < -4) q.y += G.H + 8; else if (q.y > G.H + 4) q.y -= G.H + 8;
      }
    },
    draw(ctx, time, night) {
      const K = KIND[wx.kind];
      if (!K) return;
      if (wx.kind === 'firefly' && !night) return;
      for (const q of wx.p) {
        if (K.blink && Math.sin(q.ph * 1.3) < 0.1) continue;
        ctx.fillStyle = q.c;
        if (K.streak) ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, K.streak);
        else ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s === 2 && Math.sin(q.ph) > 0 ? 1 : q.s);
      }
    },
    // 안개: 화면을 덮고 주인공 둘레만 걷는다. a 짙기, r 보이는 반지름
    drawFog(ctx, px, py, a, r, time) {
      if (!wx.fogCv) wx.fogCv = G.art.cv(G.W, G.H);
      const f = wx.fogCv.getContext('2d');
      f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
      f.clearRect(0, 0, G.W, G.H);
      f.fillStyle = 'rgba(214,220,224,' + a + ')'; f.fillRect(0, 0, G.W, G.H);
      // 흘러가는 결
      f.fillStyle = 'rgba(240,243,244,0.22)';
      for (let i = 0; i < 9; i++) {
        const y = (i * 27 + Math.sin(time * 0.2 + i) * 9) % G.H, x = ((time * (6 + i % 3 * 3) + i * 97) % (G.W + 160)) - 160;
        f.fillRect(Math.round(x), Math.round(y), 150, 5); f.fillRect(Math.round(x) + 20, Math.round(y) + 5, 100, 3);
      }
      f.globalCompositeOperation = 'destination-out'; f.fillStyle = '#fff';
      f.globalAlpha = 0.35; f.beginPath(); f.arc(px, py, r, 0, 6.2832); f.fill();
      f.globalAlpha = 0.5; f.beginPath(); f.arc(px, py, r * 0.72, 0, 6.2832); f.fill();
      f.globalAlpha = 0.8; f.beginPath(); f.arc(px, py, r * 0.45, 0, 6.2832); f.fill();
      ctx.drawImage(wx.fogCv, 0, 0);
    }
  };
})();
