'use strict';
// 그림 둘. 나무·집·도리이처럼 큰 것은 코드로 그렸다. 끝에서 전부 한데 모은다.
(function () {
  const G = window.G, A = G.art, PAL = G.PAL, cv = A.cv, mk = A.mk, flip = A.flip, g = A.grids;

  function shadePix(x, c, X, Y) { x.fillStyle = c; x.fillRect(X, Y, 1, 1); }
  function rect(x, col, X, Y, w, h) { x.fillStyle = col; x.fillRect(X, Y, w, h); }
  // 검은 테 두른 칸
  function box(x, col, X, Y, w, h) { rect(x, PAL.k, X - 1, Y - 1, w + 2, h + 2); rect(x, col, X, Y, w, h); }

  // 타원 몇 개를 겹쳐 수관을 만들고, 위는 밝게 아래는 어둡게.
  function canopy(c, ells, col, seed, sparse) {
    const w = c.width, h = c.height, x = c.getContext('2d');
    const m = new Uint8Array(w * h), sh = new Float32Array(w * h);
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      let best = 9;
      for (const e of ells) {
        const dx = (X - e[0]) / e[2], dy = (Y - e[1]) / e[3];
        const d = dx * dx + dy * dy + (G.vnoise(X / 2.2, Y / 2.2, seed) - 0.5) * 0.45;
        if (d < 1) {
          const v = dy * 0.75 + dx * 0.3 + (G.vnoise(X / 3, Y / 3, seed + 3) - 0.5) * 0.9;
          if (best === 9 || v < best) best = v;
        }
      }
      if (best !== 9) {
        if (sparse && G.hash2(X >> 1, Y >> 1, seed) < sparse) continue;
        m[Y * w + X] = 1; sh[Y * w + X] = best;
      }
    }
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      if (!m[Y * w + X]) continue;
      const edge = !X || !Y || X === w - 1 || Y === h - 1 ||
        !m[Y * w + X - 1] || !m[Y * w + X + 1] || !m[(Y - 1) * w + X] || !m[(Y + 1) * w + X];
      const v = sh[Y * w + X];
      shadePix(x, edge ? col[0] : v < -0.32 ? col[3] : v > 0.3 ? col[1] : col[2], X, Y);
    }
  }
  function trunk(c, cx, y0, y1, wd, cols, lean) {
    const x = c.getContext('2d');
    for (let Y = y0; Y <= y1; Y++) {
      const off = Math.round(Math.sin((Y - y0) / 6) * (lean || 0));
      const half = wd / 2 + (Y > y1 - 2 ? 1 : 0);
      for (let X = Math.floor(cx - half); X <= Math.ceil(cx + half - 1); X++) {
        const e = X === Math.floor(cx - half) || X === Math.ceil(cx + half - 1);
        shadePix(x, e ? cols[0] : (X < cx ? cols[2] : cols[1]), X + off, Y);
      }
    }
  }
  // 위쪽 가장자리에 눈을 얹는다
  function snowcap(src, depth) {
    const c = cv(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    for (let X = 0; X < c.width; X++) {
      let n = 0;
      for (let Y = 0; Y < c.height - 3; Y++) {
        if (d[(Y * c.width + X) * 4 + 3] < 10) { n = 0; continue; }
        if (n === 0 && (Y === 0 || d[((Y - 1) * c.width + X) * 4 + 3] < 10)) n = 1;
        if (n >= 1 && n <= (depth || 2) + (G.hash2(X, 3, 7) < 0.4 ? 1 : 0)) {
          if (n > 1) shadePix(x, n === 2 ? '#f2f2ea' : '#c9d3cf', X, Y);
          n++;
        } else if (n) n = 99;
      }
    }
    c.ax = src.ax; return c;
  }
  A.snowcap = snowcap;

  const PINE = ['#1c2c26', '#2c4a34', '#3d6240', '#587a48'];
  const CEDAR = ['#16241f', '#213a2d', '#2f5238', '#44693f'];
  const GREEN = ['#223a22', '#3a6534', '#4f8040', '#6f9c4c'];
  const OAK = ['#4a271b', '#8a4b2a', '#b86a34', '#d99a45'];
  const GINK = ['#5a4a1c', '#a8862f', '#d1ab3e', '#ead46a'];
  const MAPLE = ['#4a1a18', '#8c2b22', '#b8402e', '#d8643c'];
  const SAKURA = ['#7a4a5e', '#c9788f', '#e3a3b4', '#f4d3da'];
  const BUSH = ['#22352a', '#3f5a3a', '#557238', '#7a914a'];
  const BARK = ['#2a1c16', '#4c3524', '#6b4a32'];

  function pine(seed) {
    const c = cv(30, 42), r = G.mulberry(seed);
    trunk(c, 15, 18, 40, 3, ['#2e1c16', '#6e3f2d', '#8f5a3c'], 1.2);
    const j = () => (r() - 0.5) * 3;
    canopy(c, [[15 + j(), 9, 11, 6], [8 + j(), 15 + j(), 7, 4.5], [22 + j(), 17 + j(), 6.5, 4], [15, 21 + j(), 6, 3.2]], PINE, seed);
    c.ax = 15; return c;
  }
  function leafy(seed, col) {
    const c = cv(30, 40), r = G.mulberry(seed);
    trunk(c, 15, 24, 38, 4, BARK, 0);
    const j = () => (r() - 0.5) * 3;
    canopy(c, [[15, 13, 14, 12.5], [7 + j(), 20, 7, 6.5], [23 + j(), 19, 7, 7]], col, seed);
    c.ax = 15; return c;
  }
  // 삼나무. 좁고 높다.
  function cedar(seed) {
    const c = cv(24, 56), r = G.mulberry(seed);
    trunk(c, 12, 30, 54, 3, ['#2a1c16', '#5a3a2a', '#7a513a'], 0);
    const j = () => (r() - 0.5) * 2;
    canopy(c, [[12, 7, 5, 6], [12 + j(), 16, 7.5, 6], [12 + j(), 26, 9.5, 6.5], [12 + j(), 35, 10.5, 5.5]], CEDAR, seed);
    c.ax = 12; return c;
  }
  // 신목. 금줄을 둘렀다.
  function goshinboku() {
    const c = cv(60, 100), x = c.getContext('2d');
    trunk(c, 30, 46, 98, 11, ['#2a1c16', '#5a3a2a', '#7a513a'], 0);
    canopy(c, [[30, 12, 13, 11], [30, 27, 20, 12], [30, 42, 25, 11], [13, 50, 11, 7], [47, 51, 11, 7], [30, 55, 18, 7]], CEDAR, 131);
    rect(x, PAL.k, 23, 78, 15, 4); rect(x, '#e6cc78', 24, 79, 13, 2);
    for (const X of [26, 30, 34]) { rect(x, PAL.k, X - 1, 81, 3, 6); rect(x, '#f6f1e3', X, 81, 1, 5); }
    c.ax = 30; return c;
  }
  function bare(seed, snow, blossom) {
    const c = cv(30, 40), x = c.getContext('2d'), r = G.mulberry(seed);
    trunk(c, 15, 16, 38, 3, BARK, 0.8);
    x.fillStyle = '#2a1c16';
    for (let i = 0; i < 9; i++) { x.fillRect(15 - i, 18 - i, 2, 1); x.fillRect(15 + i, 17 - i, 2, 1); }
    for (let i = 0; i < 6; i++) { x.fillRect(11 - i, 22 - Math.round(i * 0.6), 2, 1); x.fillRect(19 + i, 23 - Math.round(i * 0.7), 2, 1); }
    for (let i = 0; i < 5; i++) { x.fillRect(9 - i, 12 - i, 1, 1); x.fillRect(21 + i, 11 - i, 1, 1); x.fillRect(15, 15 - i * 2, 1, 2); }
    if (blossom) {
      for (let i = 0; i < 30; i++) {
        const X = 3 + Math.floor(r() * 24), Y = 3 + Math.floor(r() * 20);
        x.fillStyle = r() < 0.5 ? blossom[0] : blossom[1]; x.fillRect(X, Y, r() < 0.3 ? 2 : 1, 1);
      }
    }
    c.ax = 15;
    return snow ? snowcap(c, 1) : c;
  }
  function bamboo(seed) {
    const c = cv(22, 46), x = c.getContext('2d'), r = G.mulberry(seed);
    for (let i = 0; i < 5; i++) {
      const X = 3 + i * 4 + Math.floor(r() * 2), top = 6 + Math.floor(r() * 8);
      for (let Y = top; Y < 45; Y++) {
        const lean = Math.round(Math.sin((45 - Y) / 14 + i) * 1.2);
        rect(x, PAL.k, X + lean - 1, Y, 4, 1);
      }
      for (let Y = top; Y < 45; Y++) {
        const lean = Math.round(Math.sin((45 - Y) / 14 + i) * 1.2);
        rect(x, (Y - top) % 7 === 0 ? '#3f5a3a' : '#7a9a4a', X + lean, Y, 2, 1);
        if ((Y - top) % 7 !== 0) shadePix(x, '#9db85a', X + lean, Y);
      }
    }
    canopy(c, [[6, 8, 6, 5], [15, 7, 6.5, 5.5], [11, 13, 8, 4]], ['#22352a', '#4a6a34', '#6a8a40', '#8fa84e'], seed, 0.3);
    c.ax = 11; return c;
  }
  function bush(seed, col) {
    const c = cv(16, 12);
    canopy(c, [[8, 7, 7.5, 5]], col || BUSH, seed);
    c.ax = 8; return c;
  }
  function rock(seed, big) {
    const w = big ? 22 : 14, h = big ? 16 : 11, c = cv(w, h);
    canopy(c, [[w / 2, h / 2 + 1, w / 2 - 0.5, h / 2 - 1]], ['#2b2a2e', '#5a5c63', '#7d7e7c', '#a3a39c'], seed);
    c.ax = w / 2; return c;
  }
  function boulder(seed) {
    const c = cv(40, 34);
    canopy(c, [[20, 19, 19, 14], [14, 13, 10, 9]], ['#2b2a2e', '#5a5c63', '#7d7e7c', '#a3a39c'], seed);
    c.ax = 20; return c;
  }
  function cloud(seed) {
    const c = cv(48, 22);
    canopy(c, [[24, 13, 23, 8], [15, 9, 10, 7], [32, 8, 11, 7]], ['#8f9bb0', '#b9c3d0', '#dbe1e8', '#f4f6f8'], seed);
    c.ax = 24; return c;
  }

  // ---------- 집 ----------
  // 띠지붕 농가
  function minka(snow) {
    const w = 76, c = cv(w, 62), x = c.getContext('2d');
    const wt = 36, wb = 59;
    rect(x, PAL.k, 7, wt, 62, wb - wt + 2);
    rect(x, '#cdbf9c', 8, wt, 60, wb - wt);
    for (let i = 0; i < 70; i++) rect(x, '#b9a983', 8 + Math.floor(G.hash2(i, 1, 5) * 59), wt + Math.floor(G.hash2(i, 2, 5) * (wb - wt)), 2, 1);
    rect(x, '#6f6c66', 8, wb - 3, 60, 3);
    for (let X = 9; X < 67; X += 5) rect(x, '#55524e', X + Math.floor(G.hash2(X, 0, 2) * 2), wb - 3, 1, 3);
    for (const X of [8, 27, 48, 66]) rect(x, '#46301f', X, wt, 2, wb - 3 - wt);
    rect(x, '#46301f', 8, wt + 6, 60, 1);
    // 널문
    rect(x, '#46301f', 12, wt + 8, 14, wb - 3 - wt - 8);
    for (let X = 13; X < 25; X += 3) rect(x, '#6b4a32', X, wt + 9, 2, wb - 4 - wt - 9);
    // 장지
    rect(x, '#46301f', 31, wt + 9, 15, 11);
    rect(x, '#e8e2d0', 32, wt + 10, 13, 9);
    x.fillStyle = '#93714a';
    for (let X = 35; X < 45; X += 3) x.fillRect(X, wt + 10, 1, 9);
    x.fillRect(32, wt + 14, 13, 1);
    // 들창
    rect(x, '#46301f', 52, wt + 9, 11, 8);
    for (let X = 53; X < 62; X += 2) rect(x, '#2a211e', X, wt + 10, 1, 6);
    // 지붕
    for (let X = 0; X < w; X++) {
      const t = Math.abs(X / (w - 1) - 0.5) * 2;
      const top = Math.round(3 + 30 * Math.max(0, t - 0.36) / 0.64), bot = 39 - Math.round(2 * t);
      for (let Y = top; Y <= bot; Y++) {
        const edge = Y === top || Y === bot || X === 0 || X === w - 1 || (t > 0.36 && Y < top + 1.2);
        const ly = Y - top;
        const band = Math.floor(ly + G.hash2(X >> 1, 0, 8) * 2.4) % 7;
        let col = edge ? PAL.k : ly < 2 ? '#a89868' : band === 0 ? '#5d4f35' : band === 1 ? '#6f6040' : (G.hash2(X, Y, 3) < 0.1 ? '#a08a58' : '#84734b');
        if (!edge && Y > bot - 3) col = '#4a3f2c';
        shadePix(x, col, X, Y);
      }
    }
    // 용마루 누름대
    rect(x, PAL.k, 24, 1, 28, 5); rect(x, '#4a3d32', 25, 2, 26, 3);
    for (let X = 28; X < 50; X += 6) { rect(x, PAL.k, X - 1, 0, 4, 7); rect(x, '#6b4a32', X, 1, 2, 5); }
    c.ax = 38;
    return snow ? snowcap(c, 3) : c;
  }
  // 기와 얹은 읍내 집. 문에 발을 쳤다.
  function machiya(noren, sign) {
    const w = 72, c = cv(w, 58), x = c.getContext('2d');
    const wt = 28, wb = 55;
    rect(x, PAL.k, 5, wt, 62, wb - wt + 2);
    rect(x, '#d8cfb4', 6, wt, 60, 8);
    rect(x, '#6b4a32', 6, wt + 8, 60, wb - wt - 8);
    for (let X = 7; X < 66; X += 2) rect(x, '#46301f', X, wt + 9, 1, wb - wt - 12);
    rect(x, '#6f6c66', 6, wb - 3, 60, 3);
    for (const X of [6, 24, 44, 64]) rect(x, '#2a211e', X, wt, 2, wb - 3 - wt);
    rect(x, '#2a211e', 6, wt + 7, 60, 1);
    // 문과 발
    rect(x, '#17141c', 27, wt + 9, 16, wb - 3 - wt - 9);
    const nc = noren || '#2f4a66';
    for (let i = 0; i < 3; i++) { rect(x, PAL.k, 27 + i * 5 + (i ? 1 : 0), wt + 8, 5, 10); rect(x, nc, 28 + i * 5, wt + 9, 4, 8); }
    rect(x, '#e8e2d0', 34, wt + 11, 2, 1); rect(x, '#e8e2d0', 33, wt + 12, 4, 2); rect(x, '#e8e2d0', 34, wt + 14, 2, 1);
    if (sign) {
      const tw = G.text.width(sign, 'small') + 4;
      rect(x, PAL.k, 36 - (tw >> 1) - 1, wt - 2, tw + 2, 13); rect(x, '#b99a6b', 36 - (tw >> 1), wt - 1, tw, 11);
      G.text.draw(x, sign, 36, wt - 1, '#1b1a1f', 'small', 1);
    }
    // 기와
    for (let X = 0; X < w; X++) {
      const t = Math.abs(X / (w - 1) - 0.5) * 2;
      const top = Math.round(5 + 9 * Math.pow(t, 2.2)), bot = 31 - Math.round(3 * Math.pow(t, 3));
      for (let Y = top; Y <= bot; Y++) {
        const edge = Y === top || Y === bot || X === 0 || X === w - 1;
        const ly = Y - top, row = Math.floor(ly / 4);
        let col = edge ? PAL.k : ly % 4 === 3 ? '#33303a' : ((X + row * 2) % 4 === 0 ? '#45454d' : (ly % 4 === 0 ? '#8e8f8c' : '#5a5c63'));
        if (!edge && Y > bot - 2) col = '#33303a';
        shadePix(x, col, X, Y);
      }
    }
    rect(x, PAL.k, 8, 3, 56, 4); rect(x, '#45454d', 9, 4, 54, 2); rect(x, '#8e8f8c', 9, 4, 54, 1);
    rect(x, PAL.k, 6, 1, 5, 6); rect(x, '#5a5c63', 7, 2, 3, 4); rect(x, PAL.k, 61, 1, 5, 6); rect(x, '#5a5c63', 62, 2, 3, 4);
    c.ax = 36; return c;
  }
  // 찻집. 앞이 트였다.
  function chaya() {
    const w = 64, c = cv(w, 54), x = c.getContext('2d');
    const wt = 30, wb = 51;
    rect(x, PAL.k, 5, wt, 54, wb - wt + 2);
    rect(x, '#2a211e', 6, wt, 52, wb - wt);
    rect(x, '#cdbf9c', 6, wt, 16, wb - wt - 3);
    rect(x, '#46301f', 9, wt + 6, 10, 9); rect(x, '#e8e2d0', 10, wt + 7, 8, 7); rect(x, '#93714a', 13, wt + 7, 1, 7); rect(x, '#93714a', 10, wt + 10, 8, 1);
    rect(x, '#6f6c66', 6, wb - 3, 52, 3);
    for (const X of [6, 22, 56]) rect(x, '#46301f', X, wt, 2, wb - 3 - wt);
    // 안쪽 솥과 김
    rect(x, '#5a5c63', 40, wt + 10, 8, 6); rect(x, '#8e8f8c', 41, wt + 10, 6, 1); rect(x, '#a63c2e', 42, wt + 16, 4, 2);
    // 붉은 발
    for (let i = 0; i < 4; i++) { rect(x, PAL.k, 24 + i * 8, wt, 8, 11); rect(x, '#c8452f', 25 + i * 8, wt + 1, 6, 9); }
    G.text.draw(x, '茶', 35, wt, '#f6f1e3', 'small', 0);
    for (let X = 0; X < w; X++) {
      const t = Math.abs(X / (w - 1) - 0.5) * 2;
      const top = Math.round(4 + 22 * Math.max(0, t - 0.3) / 0.7), bot = 33 - Math.round(2 * t);
      for (let Y = top; Y <= bot; Y++) {
        const edge = Y === top || Y === bot || X === 0 || X === w - 1;
        const ly = Y - top, band = Math.floor(ly + G.hash2(X >> 1, 0, 18) * 2.4) % 6;
        let col = edge ? PAL.k : ly < 2 ? '#b9a877' : band === 0 ? '#6f6040' : (G.hash2(X, Y, 13) < 0.1 ? '#b0a070' : '#94845a');
        if (!edge && Y > bot - 3) col = '#55482f';
        shadePix(x, col, X, Y);
      }
    }
    // 등롱
    rect(x, PAL.k, 58, 30, 5, 10); rect(x, '#e8e2d0', 59, 31, 3, 8); rect(x, '#c8452f', 59, 34, 3, 2);
    c.ax = 32; return c;
  }
  function hut() {
    const c = cv(44, 40), x = c.getContext('2d');
    rect(x, PAL.k, 7, 22, 30, 17); rect(x, '#7f6a52', 8, 23, 28, 15);
    rect(x, '#2a211e', 17, 26, 10, 12);
    for (let X = 0; X < 44; X++) {
      const t = Math.abs(X / 43 - 0.5) * 2;
      const tp = Math.round(2 + 20 * t), bt = 25 - Math.round(3 * t * t);
      for (let Y = tp; Y <= bt; Y++) {
        const e = Y === tp || Y === bt || X === 0 || X === 43;
        const band = Math.floor(Y - tp + G.hash2(X >> 1, 0, 6) * 2) % 5;
        shadePix(x, e ? PAL.k : band === 0 ? '#5d4f35' : (Y - tp < 2 ? '#a89868' : '#84734b'), X, Y);
      }
    }
    c.ax = 22; return c;
  }
  // 신사 배전. red면 붉은 기둥.
  function shrine(red) {
    const w = 92, c = cv(w, 74), x = c.getContext('2d');
    const wt = 36, wb = 64, pil = red ? '#c8452f' : '#6b4a32', pil2 = red ? '#a63c2e' : '#46301f';
    // 기단과 디딤돌
    rect(x, PAL.k, 9, wb - 1, 74, 10); rect(x, '#8e8b80', 10, wb, 72, 8); rect(x, '#b3b0a4', 10, wb, 72, 1);
    for (let X = 12; X < 80; X += 9) rect(x, '#6f6c66', X, wb + 1, 1, 7);
    rect(x, PAL.k, 35, wb + 2, 22, 8); rect(x, '#a9a69a', 36, wb + 3, 20, 2); rect(x, '#8e8b80', 36, wb + 6, 20, 2);
    // 벽
    rect(x, PAL.k, 13, wt, 66, wb - wt);
    rect(x, '#e8e2d0', 14, wt, 64, wb - wt - 1);
    for (const X of [14, 30, 60, 76]) { rect(x, pil2, X, wt, 3, wb - wt - 1); rect(x, pil, X, wt, 2, wb - wt - 1); }
    rect(x, pil2, 14, wt + 5, 64, 2);
    for (const X0 of [18, 64]) for (let X = X0; X < X0 + 11; X += 2) rect(x, '#46301f', X, wt + 9, 1, 14);
    // 가운데 문, 금줄, 방울 줄, 새전함
    rect(x, '#17141c', 33, wt + 7, 27, wb - wt - 8);
    rect(x, PAL.k, 32, wt + 7, 29, 4); rect(x, '#e6cc78', 33, wt + 8, 27, 2);
    for (const X of [37, 43, 49, 55]) { rect(x, '#f6f1e3', X, wt + 10, 2, 3); rect(x, '#f6f1e3', X + 1, wt + 13, 2, 2); }
    rect(x, '#a63c2e', 46, wt + 10, 1, 10); rect(x, '#e8e2d0', 46, wt + 13, 1, 2); rect(x, '#e6cc78', 45, wt + 20, 3, 2);
    rect(x, PAL.k, 39, wb - 9, 15, 8); rect(x, '#6b4a32', 40, wb - 8, 13, 6);
    for (let X = 41; X < 52; X += 2) rect(x, '#2a211e', X, wb - 8, 1, 3);
    // 지붕. 처마 끝이 들린다.
    for (let X = 0; X < w; X++) {
      const t = Math.abs(X / (w - 1) - 0.5) * 2;
      const top = Math.round(6 + 22 * Math.pow(t, 1.7)), bot = 38 - Math.round(7 * Math.pow(t, 3.2));
      for (let Y = top; Y <= bot; Y++) {
        const edge = Y === top || Y === bot || X === 0 || X === w - 1;
        const ly = Y - top;
        let col = edge ? PAL.k : ly < 2 ? '#8a7964' : (ly + (X >> 2)) % 5 === 0 ? '#3d3229' : (G.hash2(X, Y, 23) < 0.08 ? '#77675a' : '#5a4b3e');
        if (!edge && Y > bot - 3) col = red ? '#a63c2e' : '#3d3229';
        shadePix(x, col, X, Y);
      }
    }
    // 용마루, 가쓰오기, 지기
    rect(x, PAL.k, 26, 3, 40, 5); rect(x, '#4a3d32', 27, 4, 38, 3); rect(x, '#8a7964', 27, 4, 38, 1);
    for (let X = 31; X < 62; X += 7) { rect(x, PAL.k, X - 1, 1, 5, 4); rect(x, '#e6cc78', X, 2, 3, 2); }
    for (let i = 0; i < 7; i++) {
      rect(x, PAL.k, 22 + i, 7 - i, 3, 2); rect(x, PAL.k, 30 - i, 7 - i, 3, 2);
      rect(x, PAL.k, 60 + i, 7 - i, 3, 2); rect(x, PAL.k, 68 - i, 7 - i, 3, 2);
    }
    for (let i = 0; i < 7; i++) {
      shadePix(x, '#cfa64a', 23 + i, 7 - i); shadePix(x, '#cfa64a', 31 - i, 7 - i);
      shadePix(x, '#cfa64a', 61 + i, 7 - i); shadePix(x, '#cfa64a', 69 - i, 7 - i);
    }
    c.ax = 46; return c;
  }
  // 길가 작은 사당
  function hokora() {
    const c = cv(22, 26), x = c.getContext('2d');
    rect(x, PAL.k, 5, 20, 12, 6); rect(x, '#8e8b80', 6, 21, 10, 4);
    rect(x, PAL.k, 4, 9, 14, 12); rect(x, '#6b4a32', 5, 10, 12, 10);
    rect(x, '#17141c', 8, 12, 6, 8); rect(x, '#e6cc78', 8, 12, 6, 1); rect(x, '#f6f1e3', 10, 13, 1, 3);
    for (let X = 0; X < 22; X++) {
      const t = Math.abs(X / 21 - 0.5) * 2, top = Math.round(1 + 8 * t), bot = 11 - Math.round(2 * t * t);
      for (let Y = top; Y <= bot; Y++) shadePix(x, (Y === top || Y === bot || X === 0 || X === 21) ? PAL.k : Y - top < 2 ? '#8a7964' : '#5a4b3e', X, Y);
    }
    c.ax = 11; return c;
  }
  // 도리이. 기둥 사이로 지나다닌다.
  function torii(stone) {
    const c = cv(62, 58), x = c.getContext('2d');
    const col = stone ? '#9a968c' : '#c8452f', hi = stone ? '#b3b0a4' : '#e2714a', dk = stone ? '#6f6c66' : '#a63c2e';
    const cap = stone ? '#77746c' : '#2a211e';
    for (const X of [10, 48]) {
      rect(x, PAL.k, X - 1, 12, 6, 44); rect(x, col, X, 12, 4, 43); rect(x, hi, X, 12, 1, 43); rect(x, dk, X + 3, 12, 1, 43);
      rect(x, PAL.k, X - 2, 51, 8, 7); rect(x, stone ? '#6f6c66' : '#33303a', X - 1, 52, 6, 5);
    }
    // 가사기와 시마기: 끝이 들린다
    for (let X = 1; X < 61; X++) {
      const t = Math.abs(X - 31) / 30, up = Math.round(3 * Math.pow(t, 3));
      rect(x, PAL.k, X, 3 - up, 1, 9);
      rect(x, cap, X, 4 - up, 1, 3);
      rect(x, col, X, 7 - up, 1, 3); shadePix(x, hi, X, 7 - up);
      shadePix(x, PAL.k, X, 11 - up);
    }
    rect(x, PAL.k, 0, 0, 2, 9); rect(x, PAL.k, 60, 0, 2, 9); rect(x, cap, 1, 1, 1, 3); rect(x, cap, 60, 1, 1, 3); rect(x, col, 1, 4, 1, 4); rect(x, col, 60, 4, 1, 4);
    // 누키
    rect(x, PAL.k, 5, 17, 52, 6); rect(x, col, 6, 18, 50, 4); rect(x, hi, 6, 18, 50, 1); rect(x, dk, 6, 21, 50, 1);
    // 편액
    rect(x, PAL.k, 27, 10, 8, 9); rect(x, stone ? '#5a5c63' : '#2a211e', 28, 11, 6, 7); rect(x, '#e6cc78', 29, 12, 4, 5); rect(x, '#2a211e', 30, 13, 2, 3);
    c.ax = 31; return c;
  }
  // 닫힌 도리이에 걸린 금줄
  function ropeGate() {
    const c = cv(42, 16), x = c.getContext('2d');
    for (let X = 0; X < 42; X++) {
      const sag = Math.round(5 * (1 - Math.pow((X - 20.5) / 20.5, 2)));
      rect(x, PAL.k, X, sag, 1, 4); rect(x, X % 3 ? '#e6cc78' : '#cfa64a', X, sag + 1, 1, 2);
    }
    for (const X of [8, 16, 25, 33]) {
      const sag = Math.round(5 * (1 - Math.pow((X - 20.5) / 20.5, 2)));
      rect(x, PAL.k, X - 1, sag + 3, 4, 8); rect(x, '#f6f1e3', X, sag + 4, 2, 3); rect(x, '#f6f1e3', X + 1, sag + 7, 1, 3);
    }
    c.ax = 21; return c;
  }
  // 목책 한 칸
  function palisade() {
    const c = cv(16, 26), x = c.getContext('2d');
    for (let i = 0; i < 4; i++) {
      const X = i * 4, top = 2 + Math.floor(G.hash2(i, 4, 9) * 3);
      rect(x, PAL.k, X, top + 2, 4, 24 - top); rect(x, PAL.k, X + 1, top, 2, 2);
      rect(x, '#8f6f48', X + 1, top + 2, 2, 23 - top); rect(x, '#6b4a32', X + 2, top + 3, 1, 22 - top);
      shadePix(x, '#b99a6b', X + 1, top + 1);
    }
    rect(x, PAL.k, 0, 11, 16, 3); rect(x, '#cfa64a', 0, 12, 16, 1);
    c.ax = 8; return c;
  }
  // 성문. 닫혔을 때와 열렸을 때.
  function gate(open) {
    const c = cv(48, 40), x = c.getContext('2d');
    for (const X of [2, 40]) { rect(x, PAL.k, X - 1, 6, 8, 34); rect(x, '#6b4a32', X, 7, 6, 32); rect(x, '#8f6f48', X, 7, 2, 32); }
    rect(x, PAL.k, 0, 2, 48, 8); rect(x, '#46301f', 1, 3, 46, 6); rect(x, '#6b4a32', 1, 3, 46, 2);
    if (!open) {
      rect(x, PAL.k, 8, 10, 32, 30); rect(x, '#7a5a3a', 9, 11, 30, 28);
      for (let X = 12; X < 38; X += 5) rect(x, '#5a4028', X, 11, 1, 28);
      rect(x, PAL.k, 23, 11, 2, 28);
      rect(x, '#33303a', 9, 17, 30, 2); rect(x, '#33303a', 9, 31, 30, 2);
      for (let X = 11; X < 38; X += 6) { shadePix(x, '#8e8f8c', X, 17); shadePix(x, '#8e8f8c', X, 31); }
    }
    c.ax = 24; return c;
  }
  // 망루
  function yagura() {
    const c = cv(32, 60), x = c.getContext('2d');
    for (const X of [4, 25]) { rect(x, PAL.k, X - 1, 18, 5, 42); rect(x, '#6b4a32', X, 19, 3, 40); rect(x, '#8f6f48', X, 19, 1, 40); }
    for (let i = 0; i < 20; i++) { shadePix(x, '#46301f', 7 + i, 30 + Math.round(i * 1.2)); shadePix(x, '#46301f', 26 - i, 30 + Math.round(i * 1.2)); }
    rect(x, PAL.k, 0, 14, 32, 16); rect(x, '#8f6f48', 1, 15, 30, 14);
    for (let X = 3; X < 30; X += 4) rect(x, '#6b4a32', X, 15, 1, 14);
    rect(x, '#46301f', 1, 21, 30, 1);
    rect(x, '#17141c', 11, 17, 10, 7);
    for (let X = 0; X < 32; X++) {
      const t = Math.abs(X / 31 - 0.5) * 2, top = Math.round(2 + 9 * t), bot = 15;
      for (let Y = top; Y <= bot; Y++) shadePix(x, (Y === top || Y === bot || X === 0 || X === 31) ? PAL.k : (Y - top) % 3 === 0 ? '#5d4f35' : '#84734b', X, Y);
    }
    c.ax = 16; return c;
  }
  // 진막. 문장을 줄지어 찍는다.
  function jinmaku(w, mon, band) {
    const c = cv(w, 24), x = c.getContext('2d');
    rect(x, PAL.k, 0, 4, w, 17); rect(x, '#e8e2d0', 1, 5, w - 2, 15);
    rect(x, band || '#1b1a1f', 1, 5, w - 2, 3);
    for (let X = 6; X < w - 3; X += 9) rect(x, '#c9c2ae', X, 9, 1, 11);
    for (let X = 10; X < w - 8; X += 18) drawMon(x, mon, X, 10);
    for (const X of [0, w - 3]) { rect(x, PAL.k, X, 0, 3, 24); rect(x, '#6b4a32', X + 1, 1, 1, 22); }
    c.ax = w >> 1; return c;
  }
  // 문장. 7x7 안에 대강.
  function drawMon(x, mon, X, Y, col) {
    const c = col || '#1b1a1f', d = (a, b, w, h) => rect(x, c, X + a, Y + b, w || 1, h || 1);
    if (mon === 'hojo') { d(3, 0); d(2, 1, 3); d(1, 4); d(0, 5, 3); d(5, 4); d(4, 5, 3); d(3, 2, 1, 1); }
    else if (mon === 'kikusui') { d(1, 0, 5); d(0, 1, 7); d(1, 2, 5); d(0, 4, 2); d(3, 4, 2); d(6, 4); d(1, 5, 2); d(4, 5, 2); d(0, 6, 2); d(3, 6, 2); d(6, 6); }
    else if (mon === 'takeda') { d(3, 0); d(2, 1, 3); d(3, 2); d(0, 3); d(6, 3); d(1, 3, 1, 1); d(5, 3); d(3, 4); d(2, 5, 3); d(3, 6); d(1, 2); d(1, 4); d(5, 2); d(5, 4); }
    else if (mon === 'wada') { d(1, 0, 5); d(0, 1); d(6, 1); d(1, 2, 5); d(0, 3); d(6, 3); d(1, 4, 5); d(0, 5); d(6, 5); d(1, 6, 5); }
    else if (mon === 'kuyo') { d(3, 3); d(3, 0); d(3, 6); d(0, 3); d(6, 3); d(1, 1); d(5, 1); d(1, 5); d(5, 5); }
    else if (mon === 'genji') { d(2, 0, 3); d(1, 1); d(5, 1); d(3, 2); d(2, 3, 3); d(3, 4, 1, 3); d(1, 5); d(5, 5); }
    else if (mon === 'cho') { d(0, 0, 2); d(5, 0, 2); d(1, 1, 2); d(4, 1, 2); d(3, 2); d(2, 3, 3); d(1, 4, 2); d(4, 4, 2); d(0, 5, 2); d(5, 5, 2); }
  }
  // 노보리. 바람에 두 장으로 흔들린다.
  function nobori(cloth, mon, monCol, kanji) {
    const out = [];
    const len = kanji ? Math.max(30, kanji.length * 11 + 6) : 30, H = len + 16;
    for (let f = 0; f < 2; f++) {
      const c = cv(18, H), x = c.getContext('2d');
      rect(x, PAL.k, 2, 0, 3, H); rect(x, '#8f6f48', 3, 1, 1, H - 2);
      rect(x, PAL.k, 2, 2, 14, 2);
      for (let Y = 0; Y < len; Y++) {
        const off = Math.round(Math.sin(Y / 6 + f * 1.6) * (Y / len) * 1.6);
        rect(x, PAL.k, 5 + off, 4 + Y, 12, 1);
        rect(x, cloth, 5 + off, 4 + Y, 11, 1);
        if (Y === len - 1) rect(x, PAL.k, 5 + off, 4 + Y, 12, 1);
      }
      if (kanji) G.text.vdraw(x, kanji, 10, 6, monCol || '#1b1a1f', 'small', 1, 1);
      else if (mon) { drawMon(x, mon, 7, 9, monCol); if (len > 28) drawMon(x, mon, 7, 20, monCol); }
      c.ax = 3; out.push(c);
    }
    return out;
  }
  function stall(kind) {
    const c = cv(40, 34), x = c.getContext('2d');
    rect(x, PAL.k, 3, 8, 2, 25); rect(x, PAL.k, 35, 8, 2, 25);
    rect(x, '#6b4a32', 3, 9, 1, 24); rect(x, '#6b4a32', 35, 9, 1, 24);
    rect(x, PAL.k, 0, 0, 40, 10);
    for (let X = 1; X < 39; X++) rect(x, Math.floor(X / 5) % 2 ? '#e8e2d0' : (kind ? '#a63c2e' : '#314b5a'), X, 1, 1, 8);
    for (let X = 1; X < 39; X += 4) rect(x, PAL.k, X + 2, 8, 2, 2);
    rect(x, PAL.k, 4, 20, 32, 9); rect(x, '#8a6a44', 5, 21, 30, 3); rect(x, '#6b4a32', 5, 24, 30, 4);
    const goods = kind ? ['#e8e2d0', '#cfa64a', '#e8e2d0', '#b99a6b'] : ['#cf6a3d', '#5f7d42', '#8e8f8c', '#a63c2e'];
    for (let i = 0; i < 4; i++) { rect(x, PAL.k, 7 + i * 7, 17, 6, 5); rect(x, goods[i], 8 + i * 7, 18, 4, 3); }
    c.ax = 20; return c;
  }
  function well() {
    const c = cv(22, 20), x = c.getContext('2d');
    canopy(c, [[11, 11, 10.5, 8]], ['#1b1a1f', '#5a5c63', '#8e8f8c', '#a9a9a2'], 12);
    rect(x, PAL.k, 5, 7, 12, 7); rect(x, '#2f4a66', 6, 8, 10, 5); rect(x, '#47708c', 7, 9, 4, 1);
    c.ax = 11; return c;
  }
  // 가마. 불을 땐다.
  function kiln() {
    const c = cv(40, 30), x = c.getContext('2d');
    canopy(c, [[20, 20, 19, 15]], ['#1b1a1f', '#5a4636', '#7a6048', '#93785a'], 31);
    x.clearRect(0, 29, 40, 1);
    rect(x, PAL.k, 14, 16, 12, 14); rect(x, '#2a1410', 15, 17, 10, 13);
    rect(x, '#a63c2e', 17, 24, 6, 5); rect(x, '#cf6a3d', 18, 26, 4, 3); rect(x, '#e6cc78', 19, 27, 2, 2);
    rect(x, PAL.k, 0, 29, 40, 1);
    c.ax = 20; return c;
  }
  function boat(wreck, small) {
    const W = small ? 34 : 46, H = small ? 16 : 20, c = cv(W, H), x = c.getContext('2d');
    const f = X => { const t = Math.abs(X / (W - 1) - 0.5) * 2; return [Math.round(3 + 5 * t * t * t), Math.round(H - 3 - (H * 0.45) * Math.pow(t, 2.5))]; };
    for (let X = 0; X < W; X++) {
      const [tp, bt] = f(X);
      for (let Y = tp; Y <= bt; Y++) {
        const e = Y === tp || Y === bt || X === 0 || X === W - 1 || Y > f(Math.min(W - 1, X + 1))[1] || Y > f(Math.max(0, X - 1))[1];
        let col = e ? PAL.k : Y < tp + 3 ? '#8a6a44' : (Y - tp) % 4 === 0 ? '#46301f' : '#6b4a32';
        if (!e && Y > tp + 2 && Y < bt - 3 && X > 8 && X < W - 8) col = (X % 9 === 0) ? '#6b4a32' : '#3a281c';
        if (wreck && G.hash2(X >> 2, Y >> 2, 44) < 0.16 && X > 12 && X < W - 6) continue;
        shadePix(x, col, X, Y);
      }
    }
    c.ax = W >> 1; return c;
  }
  // 큰 배의 이물
  function prow() {
    const c = cv(22, 30), x = c.getContext('2d');
    for (let Y = 0; Y < 30; Y++) {
      const t = Y / 29, cx = 11 + Math.round(Math.sin(t * 1.4) * 5) - 5, hw = 2 + Math.round(t * 6);
      rect(x, PAL.k, cx - hw - 1, Y, hw * 2 + 2, 1);
      rect(x, Y % 5 === 0 ? '#46301f' : '#6b4a32', cx - hw, Y, hw * 2, 1);
      shadePix(x, '#8f6f48', cx - hw, Y);
    }
    rect(x, PAL.k, 3, 0, 8, 2);
    c.ax = 11; return c;
  }
  // 큰 배의 둥근 끝. 갑판 오른쪽에 붙인다.
  function hullEnd() {
    const c = cv(20, 48), x = c.getContext('2d');
    for (let Y = 0; Y < 48; Y++) {
      const t = (Y - 23.5) / 24, w = Math.round(19 * (1 - t * t));
      if (w <= 0) continue;
      rect(x, PAL.k, 0, Y, w + 1, 1);
      rect(x, Y > 41 ? '#46301f' : Y % 5 === 0 ? '#6b4a32' : '#8f6f48', 0, Y, w, 1);
      if (Y < 3) rect(x, '#46301f', 0, Y, w, 1);
    }
    c.ax = 10; return c;
  }
  // 돛대. 돛은 말아 올렸고 깃발이 달렸다.
  function mast(flag) {
    const c = cv(30, 64), x = c.getContext('2d');
    rect(x, PAL.k, 13, 4, 4, 60); rect(x, '#8f6f48', 14, 5, 2, 58); rect(x, '#b99a6b', 14, 5, 1, 58);
    rect(x, PAL.k, 2, 16, 26, 7); rect(x, '#e8e2d0', 3, 17, 24, 5);
    for (let X = 5; X < 26; X += 4) rect(x, '#c9c2ae', X, 17, 1, 5);
    rect(x, '#6b4a32', 3, 17, 24, 1);
    rect(x, PAL.k, 16, 3, 12, 9); rect(x, flag, 17, 4, 10, 7);
    c.ax = 15; return c;
  }
  function caveMouth() {
    const c = cv(36, 30), x = c.getContext('2d');
    canopy(c, [[18, 18, 17, 16]], ['#1b1a1f', '#4d4944', '#6a655f', '#8a857b'], 21);
    for (let Y = 8; Y < 30; Y++) for (let X = 8; X < 28; X++) {
      const dx = (X - 18) / 9, dy = (Y - 22) / 13;
      if (dx * dx + dy * dy < 1) shadePix(x, dx * dx + dy * dy > 0.78 ? '#1b1a1f' : '#0c0b0f', X, Y);
    }
    c.ax = 18; return c;
  }
  function fence() {
    const c = cv(16, 13), x = c.getContext('2d');
    for (const X of [1, 9]) { rect(x, PAL.k, X - 1, 1, 4, 12); rect(x, '#8f6f48', X, 2, 2, 10); }
    rect(x, PAL.k, 0, 3, 16, 3); rect(x, '#b99a6b', 0, 4, 16, 1);
    rect(x, PAL.k, 0, 7, 16, 3); rect(x, '#93714a', 0, 8, 16, 1);
    c.ax = 8; return c;
  }
  // 볏단 말리는 덕
  function hasa() {
    const c = cv(34, 22), x = c.getContext('2d');
    for (const X of [2, 30]) { rect(x, PAL.k, X - 1, 2, 4, 20); rect(x, '#6b4a32', X, 3, 2, 18); }
    rect(x, PAL.k, 0, 3, 34, 3); rect(x, '#8f6f48', 1, 4, 32, 1);
    for (let X = 4; X < 30; X += 4) {
      rect(x, PAL.k, X - 1, 5, 5, 12); rect(x, '#d7bd6c', X, 6, 3, 10); rect(x, '#a8862f', X + 2, 7, 1, 9); rect(x, '#8f7a4a', X, 6, 3, 1);
    }
    c.ax = 17; return c;
  }
  // 상어 지느러미
  function fin(f) {
    const c = cv(14, 9), x = c.getContext('2d');
    for (let i = 0; i < 6; i++) { rect(x, PAL.k, 4 + i - (f ? 1 : 0), 1 + i, 7 - i, 1); rect(x, '#5a5c63', 5 + i - (f ? 1 : 0), 1 + i, 5 - i, 1); }
    rect(x, '#d7e6da', 1, 7, 12, 1); rect(x, '#6b9aa6', 0, 8, 14, 1);
    c.ax = 7; return c;
  }
  // 문짝. 아사히나가 뜯어 든다.
  function door() {
    const c = cv(30, 40), x = c.getContext('2d');
    rect(x, PAL.k, 0, 0, 30, 40); rect(x, '#7a5a3a', 1, 1, 28, 38);
    for (let X = 5; X < 28; X += 6) rect(x, '#5a4028', X, 1, 1, 38);
    for (const Y of [6, 19, 32]) { rect(x, '#33303a', 1, Y, 28, 3); for (let X = 3; X < 28; X += 5) shadePix(x, '#aeb4b8', X, Y + 1); }
    c.ax = 15; return c;
  }
  // 통나무(굴러 내려온다)
  function logRoll(f) {
    const c = cv(30, 12), x = c.getContext('2d');
    rect(x, PAL.k, 1, 0, 28, 12); rect(x, PAL.k, 0, 2, 30, 8);
    rect(x, '#8f6f48', 2, 1, 26, 10); rect(x, '#6b4a32', 2, 7, 26, 4); rect(x, '#b99a6b', 2, 1 + (f ? 2 : 0), 26, 2);
    for (let X = 6; X < 26; X += 7) rect(x, '#46301f', X + (f ? 2 : 0), 4, 3, 1);
    rect(x, '#d9bd8a', 1, 3, 2, 6); rect(x, '#d9bd8a', 27, 3, 2, 6); shadePix(x, '#8f6f48', 1, 5); shadePix(x, '#8f6f48', 28, 6);
    c.ax = 15; return c;
  }
  // 통나무 더미
  function logPile() {
    const c = cv(34, 22), x = c.getContext('2d');
    const one = (X, Y) => { rect(x, PAL.k, X, Y + 1, 10, 8); rect(x, PAL.k, X + 1, Y, 8, 10); rect(x, '#d9bd8a', X + 1, Y + 1, 8, 8); rect(x, '#b99a6b', X + 3, Y + 3, 4, 4); shadePix(x, '#8f6f48', X + 4, Y + 4); };
    one(1, 12); one(12, 12); one(23, 12); one(6, 5); one(17, 5); one(12, -1);
    c.ax = 17; return c;
  }

  // 말 탄 이: 말 그림 위에 윗몸을 얹는다
  function mounted(horse, rider, dx) {
    const c = cv(horse.width, horse.height + 10), x = c.getContext('2d');
    x.drawImage(horse, 0, 10);
    x.drawImage(rider, 0, 0, 16, 15, dx, 0, 16, 15);
    rect(x, PAL.k, dx + 5, 15, 6, 5); rect(x, '#33303a', dx + 6, 15, 4, 4);
    rect(x, PAL.k, dx + 7, 19, 4, 4); rect(x, '#232a3a', dx + 8, 19, 2, 3);
    return c;
  }

  // ================= 사람들 생김새 =================
  const LOOK = {
    // 고갯마루
    granny: ['woman', 'woman', { top: 't', shade: 'b', bot: 'i', bshade: 'u', acc: 'w', hair: 'G' }],
    // 단노우라
    fisher: ['kasa', 'kimono', { top: 'T', shade: 't', bot: 'G', acc: 'b' }],
    ama: ['woman', 'woman', { top: 'w', shade: 'G', bot: 'w', bshade: 'G', acc: 'r' }],
    monk: ['bald', 'robe', { top: 'K', shade: 'k', acc: 'y' }],
    genji: ['eboshi', 'armor', { top: 'M', shade: 'w', bot: 'K' }],
    // 가마쿠라
    tomoe: ['cowl', 'robe', { top: 'g', shade: 'K', acc: 'w' }],
    smith: ['hachi', 'bare', { bot: 'K', acc: 'b' }],
    fishwife: ['woman', 'woman', { top: 'l', shade: 'N', bot: 'i', bshade: 'u', acc: 'w' }],
    priest: ['eboshi', 'kimono', { top: 'w', shade: 'G', bot: 'U', bshade: 'u', acc: 'w' }],
    wada: ['eboshi', 'kimono', { top: 'u', shade: 'm', bot: 'G', bshade: 'g', acc: 'y' }],
    hojo: ['eboshi', 'armor', { top: 'n', shade: 'y', bot: 'K' }],
    peddler: ['kasa', 'kimono', { top: 'I', shade: 'i', bot: 'w', bshade: 'G', acc: 'b' }],
    // 지하야
    captain: ['kabuto', 'armor', { top: 'u', shade: 'T', bot: 'K' }],
    siege1: ['eboshi', 'armor', { top: 'u', shade: 'T', bot: 'K' }],
    siege2: ['eboshi', 'armor', { top: 'n', shade: 'T', bot: 'K' }],
    veteran: ['old', 'armor', { top: 'g', shade: 'T', bot: 'K' }],
    sutler: ['kasa', 'kimono', { top: 'b', shade: 'B', bot: 'T', bshade: 't', acc: 'r' }],
    kusuGuard: ['hachi', 'armor', { top: 'K', shade: 'y', bot: 'm' }],
    waterboy: null,
    // 가시마
    ferry: ['kasa', 'kimono', { top: 'i', shade: 'm', bot: 'T', bshade: 't', acc: 'b' }],
    miko: ['woman', 'woman', { top: 'w', shade: 'G', bot: 'v', bshade: 'r', acc: 'v' }],
    farmer: ['kasa', 'kimono', { top: 'N', shade: 'n', bot: 'T', bshade: 't', acc: 'b' }],
    // 가와나카지마
    takeda: ['jingasa', 'armor', { top: 'r', shade: 'd', bot: 'K', hat: 'd', crest: 'Y' }],
    uesugi: ['jingasa', 'armor', { top: 'M', shade: 'm', bot: 'K', hat: 'K', crest: 'w' }],
    shingen: ['kabuto', 'armor', { top: 'r', shade: 'y', bot: 'K', hat: 'K', crest: 'Y' }],
    salter: ['kasa', 'kimono', { top: 'w', shade: 'G', bot: 'w', bshade: 'G', acc: 'i' }],
    burier: ['bald', 'robe', { top: 'z', shade: 'K', acc: 'y' }],
    // 후나시마
    potter: ['hachi', 'kimono', { top: 'w', shade: 'G', bot: 'w', bshade: 'G', acc: 'w', wrap: 'K' }],
    biwa: ['bald', 'robe', { top: 'i', shade: 'm', acc: 'p' }],
    agent: ['mage', 'kimono', { top: 'T', shade: 't', bot: 'i', bshade: 'm', acc: 'K' }],
    official: ['mage', 'kimono', { top: 'u', shade: 'm', bot: 'u', bshade: 'm', acc: 'w' }],
    townswoman: ['woman', 'woman', { top: 'F', shade: 'f', bot: 'p', bshade: 'p', acc: 'y' }],
    // 레이간도
    magonojo: ['mage', 'kimono', { top: 'G', shade: 'g', bot: 'K', bshade: 'k', acc: 'w' }],
    abbot: ['bald', 'robe', { top: 'y', shade: 'b', acc: 'p' }]
  };
  // 걷고 싸우는 이들
  const FIGHT = {
    ochi: ['mage', 'armor', { top: 'd', shade: 'K', bot: 'K' }],
    bandit: ['hachi', 'kimono', { top: 'z', shade: 'B', bot: 'K', bshade: 'k', acc: 'B', wrap: 'r' }],
    roto: ['eboshi', 'kimono', { top: 'n', shade: 'N', bot: 'z', bshade: 'B', acc: 'y' }],
    spear: ['eboshi', 'armor', { top: 'u', shade: 'T', bot: 'K' }],
    archer: ['eboshi', 'armor', { top: 'n', shade: 'y', bot: 'K' }],
    akuto: ['kasa', 'kimono', { top: 'z', shade: 'B', bot: 'b', bshade: 'B', acc: 'k' }],
    deshi: ['hachi', 'kimono', { top: 'w', shade: 'G', bot: 'u', bshade: 'm', acc: 'K' }],
    deshi2: ['hachi', 'kimono', { top: 'w', shade: 'G', bot: 'K', bshade: 'k', acc: 'K' }],
    deshi3: ['mage', 'kimono', { top: 'C', shade: 'c', bot: 'i', bshade: 'm', acc: 'K' }],
    ashiT: ['jingasa', 'armor', { top: 'r', shade: 'd', bot: 'K', hat: 'd', crest: 'Y' }],
    ashiU: ['jingasa', 'armor', { top: 'M', shade: 'm', bot: 'K', hat: 'K', crest: 'w' }],
    gunner: ['jingasa', 'armor', { top: 'z', shade: 'y', bot: 'K', hat: 'K', crest: 'Y' }],
    ronin: ['mage', 'kimono', { top: 'g', shade: 'K', bot: 'z', bshade: 'B', acc: 'k' }],
    kabuki: ['pony', 'kimono', { top: 'P', shade: 'p', bot: 'y', bshade: 'b', acc: 'v' }],
    yoshitsune: ['yoshi', 'armor', { top: 'W', shade: 'v', bot: 'p' }],
    kusunoki: ['kabuto', 'armor', { top: 'K', shade: 'y', bot: 'm', crest: 'Y' }],
    bokuden: ['old', 'kimono', { top: 'G', shade: 'g', bot: 'K', bshade: 'k', acc: 'w' }],
    kenshin: ['hood', 'armor', { top: 'm', shade: 'e', bot: 'K' }],
    kojiro: ['pony', 'kimono', { top: 'v', shade: 'd', bot: 'p', bshade: 'p', acc: 'y' }],
    musashi: ['wild', 'kimono', { top: 'i', shade: 'm', bot: 'z', bshade: 'B', acc: 'K' }],
    musashiOld: ['wild', 'kimono', { top: 'g', shade: 'K', bot: 'K', bshade: 'k', acc: 'w', hair: 'G', wrap: 'G' }]
  };

  // ================= 한데 모으기 =================
  A.build = function () {
    const S = G.spr = {};
    const pl = (base, legs) => mk(base.concat(legs));
    const side = [pl(g.P_SIDE, g.LEGS_S), pl(g.P_SIDE, g.LEGS_S2)];
    S.player = {
      down: [pl(g.P_DOWN, g.LEGS_F), pl(g.P_DOWN, g.LEGS_F2), pl(g.P_DOWN, g.LEGS_F), pl(g.P_DOWN, g.LEGS_F3)],
      up: [pl(g.P_UP, g.LEGS_F), pl(g.P_UP, g.LEGS_F2), pl(g.P_UP, g.LEGS_F), pl(g.P_UP, g.LEGS_F3)],
      right: [side[0], side[1], side[0], side[1]],
      left: [flip(side[0]), flip(side[1]), flip(side[0]), flip(side[1])],
      sit: mk(g.P_SIT)
    };

    S.npc = {};
    for (const id in LOOK) if (LOOK[id]) S.npc[id] = A.person(LOOK[id][0], LOOK[id][1], LOOK[id][2]);
    S.npc.kid = mk(g.CHILD, { '2': PAL.l, '4': PAL.i });
    S.npc.kid2 = mk(g.CHILD, { '2': PAL.R, '4': PAL.K });
    S.npc.waterboy = mk(g.CHILD, { '2': PAL.T, '4': PAL.z });
    S.npc.tengu = mk(g.TENGU);

    const two = (a, b, over) => { const A1 = mk(a, over), B1 = mk(b, over); return { r: [A1, B1], l: [flip(A1), flip(B1)] }; };
    S.crab = two(g.CRAB.concat(g.CRAB_L1), g.CRAB.concat(g.CRAB_L2));
    S.heike = two(g.HEIKE.concat(g.CRAB_L1), g.HEIKE.concat(g.CRAB_L2), { R: PAL.d });
    S.boar = two(g.BOAR.concat(g.BOAR_L1), g.BOAR.concat(g.BOAR_L2));
    S.dog = two(g.DOG.concat(g.DOG_L1), g.DOG.concat(g.DOG_L2));
    S.wolf = two(g.DOG.concat(g.DOG_L1), g.DOG.concat(g.DOG_L2), { T: '#8e8f8c', t: '#5a5c63' });
    S.deer = two(g.DEER.concat(g.DEER_L1), g.DEER.concat(g.DEER_L2));
    S.bat = two(g.BAT1, g.BAT2);
    S.kite = two(g.KITE1, g.KITE2);
    const wi = mk(g.WISP);
    S.wisp = { r: [wi, flip(wi)], l: [wi, flip(wi)] };
    const ka = mk(g.KAPPA);
    S.kappa = { r: [ka, A.shiftY(ka, 1)], l: [flip(ka), A.shiftY(flip(ka), 1)] };
    S.horse = two(g.HORSE.concat(g.HORSE_L1), g.HORSE.concat(g.HORSE_L2));
    const cream = { T: '#e8dcc0', t: '#cdbf9c', B: '#b9a983' };
    S.horseW = two(g.HORSE.concat(g.HORSE_L1), g.HORSE.concat(g.HORSE_L2), cream);

    S.f = {};
    for (const id in FIGHT) S.f[id] = A.walker(FIGHT[id][0], FIGHT[id][1], FIGHT[id][2]);
    // 원령: 패잔병을 푸르스름하게
    // 동료: 해녀 이소, 늙은 비구니 도모에
    S.f.iso = A.walker(LOOK.ama[0], LOOK.ama[1], LOOK.ama[2]);
    S.f.tomoe = A.walker(LOOK.tomoe[0], LOOK.tomoe[1], LOOK.tomoe[2]);
    S.f.ghost = { r: S.f.ochi.r.map(i => A.tint(i, '#9fc4c8')), l: S.f.ochi.l.map(i => A.tint(i, '#9fc4c8')) };
    const be = mk(g.BENKEI); S.f.benkei = { r: [be, A.shiftY(be, 1)], l: [flip(be), A.shiftY(flip(be), 1)] };
    const as = mk(g.ASAHINA); S.f.asahina = { r: [as, A.shiftY(as, 1)], l: [flip(as), A.shiftY(flip(as), 1)] };
    // 말 탄 겐신
    const kr = S.f.kenshin.r[0];
    const m1 = mounted(S.horseW.r[0], kr, 8), m2 = mounted(S.horseW.r[1], kr, 8);
    S.f.kenshinH = { r: [m1, m2], l: [flip(m1), flip(m2)] };

    S.jizo = mk(g.JIZO); S.jizo.ax = 7;
    S.jizoS = snowcap(S.jizo, 2);
    S.toro = mk(g.TORO); S.toro.ax = 6;
    S.koma = [mk(g.KOMA), flip(mk(g.KOMA))];
    S.sign = mk(g.SIGN);
    S.chest = mk(g.CHEST); S.chestOpen = mk(g.CHEST_OPEN);
    const f = mk(g.FIRE); S.fire = [f, flip(f)];
    S.kakashi = mk(g.KAKASHI); S.dummy = mk(g.DUMMY); S.makiwara = mk(g.MAKIWARA);
    S.jar = mk(g.JAR); S.taru = mk(g.TARU); S.bale = mk(g.BALE); S.hay = mk(g.HAY);
    S.reed = [mk(g.REED), flip(mk(g.REED))]; S.susuki = [mk(g.SUSUKI), flip(mk(g.SUSUKI))]; S.stump = mk(g.STUMP);
    S.hpFull = mk(g.PERSIMMON);
    S.hpEmpty = mk(g.PERSIMMON, { R: PAL.K, Y: PAL.K, r: PAL.K, N: PAL.K });
    S.coin = mk(g.COIN); S.pouch = mk(g.POUCH); S.dango = mk(g.DANGO);
    S.tate = mk(g.TATE); S.arrows = mk(g.ARROWS); S.taiko = mk(g.TAIKO); S.bench = mk(g.BENCH);
    S.desk = mk(g.DESK); S.rack = mk(g.RACK); S.cart = mk(g.CART); S.nets = mk(g.NETS);
    S.floatR = mk(g.FLOATR); S.floatW = mk(g.FLOATR, { r: PAL.w, R: PAL.W });
    S.pots = mk(g.POTS); S.kaname = mk(g.KANAME);

    S.pine = [pine(11), pine(23), pine(37)];
    S.pineS = S.pine.map(p => snowcap(p, 2));
    S.oak = [leafy(51, GREEN), leafy(64, GREEN), leafy(72, GREEN)];
    S.oakA = [leafy(51, OAK), leafy(64, OAK), leafy(72, GINK)];
    S.maple = [leafy(83, MAPLE), leafy(97, MAPLE)];
    S.sakura = [leafy(105, SAKURA), leafy(118, SAKURA)];
    S.cedar = [cedar(7), cedar(19), cedar(29)];
    S.cedarS = S.cedar.map(p => snowcap(p, 2));
    S.goshinboku = goshinboku();
    S.bare = [bare(41), bare(57)];
    S.bareS = [bare(41, true), bare(57, true)];
    S.plum = [bare(61, false, ['#f4d3da', '#e3a3b4']), bare(77, false, ['#f6f1e3', '#f4d3da'])];
    S.bamboo = [bamboo(3), bamboo(14)];
    S.bush = [bush(5), bush(9)];
    S.bushS = S.bush.map(p => snowcap(p, 1));
    S.rock = [rock(3), rock(8), rock(15, true)];
    S.rockS = S.rock.map(p => snowcap(p, 1));
    S.boulder = boulder(27);
    S.cloud = [cloud(1), cloud(9), cloud(17)];
    S.minka = minka(false); S.minkaS = minka(true);
    S.machiya = [machiya('#2f4a66'), machiya('#7a2a24'), machiya('#3f5a3a')];
    S.dojo = machiya('#33303a', '新當流');
    S.inn = machiya('#5b3d5c', '船宿');
    S.forge = machiya('#33303a', '鍛冶');
    S.chaya = chaya(); S.hut = hut();
    S.shrineR = shrine(true); S.shrine = shrine(false);
    S.hokora = hokora();
    S.torii = torii(false); S.toriiStone = torii(true); S.toriiS = snowcap(S.torii, 2);
    S.rope = ropeGate();
    S.palisade = palisade(); S.gate = gate(false); S.gateOpen = gate(true); S.yagura = yagura();
    S.jinmakuG = jinmaku(64, 'genji'); S.jinmakuT = jinmaku(64, 'takeda', '#a63c2e'); S.jinmakuH = jinmaku(64, 'hojo');
    S.jinmakuK = jinmaku(48, 'kuyo', '#2f4a66');
    S.nobori = {
      white: nobori('#e8e2d0', 'genji', '#1b1a1f'), red: nobori('#a63c2e', 'cho', '#e6cc78'),
      hojo: nobori('#e8e2d0', 'hojo', '#1b1a1f'), wada: nobori('#2f4a66', 'wada', '#e8e2d0'),
      kiku: nobori('#e8e2d0', 'kikusui', '#1b1a1f'), takeda: nobori('#a63c2e', 'takeda', '#e8e2d0'),
      bi: nobori('#e8e2d0', null, '#1b1a1f', '毘'), ryu: nobori('#e8e2d0', null, '#1b1a1f', '龍'),
      furin: nobori('#232a3a', null, '#e6cc78', '風林火山'), kuyo: nobori('#2f4a66', 'kuyo', '#e8e2d0'),
      hachi: nobori('#e8e2d0', null, '#a63c2e', '八幡')
    };
    for (const k in S.nobori) S['nb_' + k] = S.nobori[k];
    S.stall = [stall(0), stall(1)];
    S.well = well(); S.kiln = kiln();
    S.boat = boat(false); S.wreck = boat(true); S.rowboat = boat(false, true);
    S.prow = prow(); S.mastW = mast('#e8e2d0'); S.mastR = mast('#a63c2e');
    S.hullR = hullEnd(); S.hullL = flip(S.hullR);
    S.cavemouth = caveMouth(); S.fence = fence(); S.hasa = hasa();
    S.fin = [fin(0), fin(1)];
    S.door = door(); S.log = [logRoll(0), logRoll(1)]; S.logpile = logPile();
  };
  A.LOOK = LOOK; A.FIGHT = FIGHT;
})();
