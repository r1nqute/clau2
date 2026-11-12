'use strict';
// 칼 너머 — 공용 기초: 난수, 입력, 소리, 가락, 글자, 저장
(function () {
  const G = window.G = { W: 384, H: 216, TS: 16 };

  // ---------- 수학 ----------
  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  // 두 각의 차이를 -π..π 로
  G.angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
  G.rnd = (a, b) => a + Math.random() * (b - a);
  G.pick = arr => arr[Math.floor(Math.random() * arr.length)];

  G.mulberry = function (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  G.hash2 = function (x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  G.vnoise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = G.hash2(xi, yi, s), b = G.hash2(xi + 1, yi, s);
    const c = G.hash2(xi, yi + 1, s), d = G.hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  G.fbm = (x, y, s) => G.vnoise(x, y, s) * 0.65 + G.vnoise(x * 2.1, y * 2.1, s + 7) * 0.35;

  // ---------- 입력 ----------
  // a 베기 · b 막기(말 걸기) · c 비기 · d 보법 · e 먹기 · q 비기 바꾸기
  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', KeyJ: 'a',
    KeyX: 'b', KeyK: 'b', Enter: 'b',
    KeyC: 'c', KeyL: 'c',
    Space: 'd', ShiftLeft: 'd', ShiftRight: 'd',
    KeyV: 'e', KeyF: 'e', KeyU: 'e',
    KeyQ: 'q', KeyO: 'q',
    Escape: 'menu', KeyI: 'menu', Tab: 'menu',
    KeyM: 'map', Digit0: 'mute'
  };
  const held = {}, pressed = {}, released = {}, heldT = {};
  G.input = {
    down: a => !!held[a],
    hit: a => !!pressed[a],
    up: a => !!released[a],
    time: a => heldT[a] || 0,
    set(a, v) {
      if (v && !held[a]) pressed[a] = true;
      if (!v && held[a]) released[a] = true;
      held[a] = v;
    },
    endFrame() {
      for (const k in pressed) delete pressed[k];
      for (const k in released) delete released[k];
      for (const k in held) heldT[k] = held[k] ? (heldT[k] || 0) + 1 / 60 : 0;
    },
    // 대화/메뉴에서 '확인'으로 치는 키
    ok() { return pressed.a || pressed.b || pressed.d; },
    back() { return pressed.menu || pressed.c; },
    eat(a) { delete pressed[a]; },
    clear() {
      for (const k in held) { held[k] = false; heldT[k] = 0; }
      for (const k in pressed) delete pressed[k];
      for (const k in released) delete released[k];
    }
  };
  // 손가락으로 할 때는 글쇠 이름 대신 단추 이름을 일러 준다
  G.touch = false;
  const KEYNAME = { a: 'Z', b: 'X', c: 'C', d: 'Space', e: 'V', q: 'Q', menu: 'Esc' };
  const BTN = { a: '베기', b: '막기', c: '비기', d: '보법', e: '먹기', q: '바꿈', menu: '봇짐' };
  G.key = a => (G.touch ? BTN : KEYNAME)[a];
  window.addEventListener('keydown', e => {
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) G.input.set(a, true);
    G.audio.wake();
  });
  window.addEventListener('keyup', e => {
    const a = KEYS[e.code];
    if (a) { e.preventDefault(); G.input.set(a, false); }
  });
  window.addEventListener('blur', () => G.input.clear());

  // ---------- 소리 ----------
  let ac = null, noiseBuf = null, muted = false, bus = null, mbus = null;
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, delay, q, f1) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.8;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.02);
  }
  const SFX = {
    swing() { noise(0.09, 0.15, 1900, 0, 0.8, 900); },
    swing2() { noise(0.12, 0.17, 1300, 0, 0.8, 600); },
    thrust() { noise(0.08, 0.16, 2600, 0, 1.2, 1400); },
    cut() { noise(0.16, 0.26, 3600, 0, 0.7, 700); tone('sawtooth', 1400, 300, 0.1, 0.05); },
    hit() { noise(0.07, 0.3, 700); tone('square', 180, 90, 0.08, 0.12); },
    clang() { tone('square', 1250, 1180, 0.07, 0.07); tone('square', 1870, 1800, 0.05, 0.05); noise(0.05, 0.16, 4200, 0, 2); },
    parry() { tone('triangle', 2090, 2090, 0.3, 0.12); tone('square', 3130, 3100, 0.12, 0.05); tone('square', 1560, 1540, 0.16, 0.06); noise(0.06, 0.2, 5200, 0, 2); },
    brk() { tone('sawtooth', 240, 60, 0.3, 0.14); noise(0.22, 0.26, 900, 0, 0.6, 200); },
    hurt() { tone('square', 220, 70, 0.22, 0.16); noise(0.12, 0.2, 400); },
    kill() { tone('square', 300, 60, 0.25, 0.12); noise(0.2, 0.2, 300, 0.03); },
    pick() { tone('square', 660, 660, 0.05, 0.09); tone('square', 990, 990, 0.08, 0.09, 0.05); },
    coin() { tone('square', 1320, 1320, 0.04, 0.07); tone('square', 1760, 1760, 0.1, 0.07, 0.04); },
    talk() { tone('square', 340 + Math.random() * 60, 300, 0.025, 0.035); },
    move() { tone('square', 520, 520, 0.03, 0.05); },
    ok() { tone('square', 620, 780, 0.07, 0.07); },
    deny() { tone('square', 150, 120, 0.12, 0.09); },
    dash() { noise(0.13, 0.13, 1100, 0, 0.7, 2600); },
    leap() { noise(0.2, 0.12, 700, 0, 0.7, 2400); tone('sine', 260, 520, 0.18, 0.06); },
    land() { tone('sine', 120, 45, 0.22, 0.32); noise(0.14, 0.22, 260); },
    eat() { tone('triangle', 300, 420, 0.08, 0.14); tone('triangle', 420, 560, 0.1, 0.14, 0.09); },
    tea() { tone('triangle', 520, 660, 0.14, 0.1); tone('triangle', 780, 880, 0.2, 0.08, 0.12); },
    save() { tone('triangle', 392, 392, 0.12, 0.13); tone('triangle', 523, 523, 0.12, 0.13, 0.12); tone('triangle', 659, 659, 0.22, 0.13, 0.24); },
    open() { tone('square', 200, 400, 0.12, 0.09); noise(0.08, 0.1, 1200); },
    thud() { tone('sine', 110, 40, 0.3, 0.4); noise(0.2, 0.3, 200); },
    stone() { tone('square', 900, 500, 0.04, 0.08); noise(0.05, 0.14, 2200); },
    die() { tone('square', 330, 50, 0.7, 0.15); },
    chg() { tone('triangle', 880, 1320, 0.07, 0.07); },
    chg2() { tone('triangle', 1320, 1980, 0.09, 0.09); tone('triangle', 1980, 2640, 0.12, 0.06, 0.06); },
    bow() { tone('sawtooth', 190, 120, 0.08, 0.1); noise(0.07, 0.1, 3000, 0.02, 2); },
    gun() { noise(0.3, 0.5, 500, 0, 0.5, 120); noise(0.05, 0.4, 3000); tone('sine', 150, 40, 0.25, 0.3); },
    fuse() { noise(0.5, 0.05, 6000, 0, 3); },
    clap() { noise(0.035, 0.4, 2300, 0, 3); tone('square', 1150, 1100, 0.03, 0.09); },
    taiko() { tone('sine', 105, 48, 0.4, 0.5); noise(0.08, 0.2, 320); },
    bell() { tone('sine', 196, 194, 2.4, 0.16); tone('sine', 294.5, 292, 1.8, 0.07); tone('sine', 523, 520, 0.9, 0.035); noise(0.03, 0.1, 900); },
    splash() { noise(0.25, 0.18, 1400, 0, 0.6, 500); },
    hoof() { noise(0.04, 0.16, 500, 0, 1.5); noise(0.04, 0.12, 420, 0.09, 1.5); },
    wind() { noise(0.9, 0.08, 500, 0, 0.5, 1300); },
    ghost() { tone('sine', 620, 310, 0.8, 0.05); tone('sine', 930, 500, 0.8, 0.03, 0.05); },
    focus() { tone('sine', 110, 220, 0.4, 0.14); noise(0.4, 0.06, 4000, 0, 2, 8000); },
    learn() { [587, 659, 784, 880, 1175].forEach((f, i) => tone('triangle', f, f, 0.22, 0.11, i * 0.09)); },
    // 이겼을 때: 굿거리 한 마디. 덩 — 기덕 쿵 더러러러
    win() {
      const dn = d => { tone('sine', 150, 70, 0.22, 0.3, d); noise(0.04, 0.18, 1900, d, 2); }, kn = d => tone('sine', 130, 60, 0.2, 0.26, d), dk = (d, v) => noise(0.03, v || 0.16, 2100, d, 2.5);
      dn(0); dk(0.3, 0.1); dk(0.36); kn(0.54); dk(0.72, 0.1); dk(0.78, 0.08); dk(0.84, 0.07); dk(0.9, 0.06); dn(1.08);
      [587, 784, 880, 1175, 880, 1175].forEach((f, i) => tone('triangle', f, f, 0.3, 0.07, i * 0.18));
    }
  };
  G.audio = {
    wake() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        bus = ac.createGain(); bus.gain.value = 0.9; bus.connect(ac.destination);
        mbus = ac.createGain(); mbus.gain.value = 0.55; mbus.connect(ac.destination);
      } catch (e) { ac = null; }
    },
    toggle() {
      muted = !muted;
      if (ac) { bus.gain.value = muted ? 0 : 0.9; mbus.gain.value = muted ? 0 : 0.55; }
      return muted;
    },
    get muted() { return muted; }
  };
  G.sfx = function (name) {
    if (!ac || muted || ac.state !== 'running') return;
    const f = SFX[name];
    if (f) try { f(); } catch (e) { /* 소리는 실패해도 게임은 돈다 */ }
  };

  // ---------- 가락 ----------
  // 녹음한 것은 없다. 음계와 빠르기만 정해 두고 그때그때 뜯는다.
  // 미야코부시(도·레♭·파·솔·라♭)와 요 음계(평조와 음이 같다)를 쓴다.
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function pluck(f, t, dur, vol, bright) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sawtooth';
    o.frequency.value = f; o2.frequency.value = f * 2.004;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(bright || 2600, t); lp.frequency.exponentialRampToValueAtTime(420, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    g2.gain.value = 0.16;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(mbus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function flute(f, t, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.12);
    l.frequency.value = 4.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.14); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g); g.connect(mbus);
    o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
    const s = ac.createBufferSource(), ng = ac.createGain(), bp = ac.createBiquadFilter();
    s.buffer = noiseBuf; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.5;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.22, t + 0.08); ng.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.9);
    s.connect(bp); bp.connect(ng); ng.connect(mbus); s.start(t); s.stop(t + dur);
  }
  function drum(t, vol, f) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f || 100, t); o.frequency.exponentialRampToValueAtTime((f || 100) * 0.45, t + 0.22);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
    o.connect(g); g.connect(mbus); o.start(t); o.stop(t + 0.4);
  }
  function tick(t, vol) {
    const s = ac.createBufferSource(), g = ac.createGain(), bp = ac.createBiquadFilter();
    s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 3;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.04);
    s.connect(bp); bp.connect(g); g.connect(mbus); s.start(t); s.stop(t + 0.06);
  }
  const IN = [0, 1, 5, 7, 8], YO = [0, 2, 5, 7, 9];
  // bpm, 밑음, 음계, 뜯는 정도, 악기, 북 장단(16칸: D 큰북 d 작은북 k 채), 깔리는 음
  const MOODS = {
    title: { bpm: 54, root: 50, sc: IN, den: 0.34, inst: 'koto', drone: 1 },
    sea: { bpm: 60, root: 50, sc: YO, den: 0.36, inst: 'koto', flute: 0.1 },
    town: { bpm: 76, root: 52, sc: YO, den: 0.5, inst: 'koto', dr: 'k...k.k.k...k.kk', dv: 0.05 },
    mount: { bpm: 58, root: 47, sc: IN, den: 0.3, inst: 'koto', flute: 0.14, drone: 1 },
    shrine: { bpm: 50, root: 50, sc: IN, den: 0.16, inst: 'flute', drone: 1 },
    fog: { bpm: 52, root: 45, sc: IN, den: 0.2, inst: 'flute', dr: 'D...............', dv: 0.16, drone: 1 },
    hub: { bpm: 46, root: 48, sc: YO, den: 0.2, inst: 'flute', drone: 1 },
    still: { bpm: 44, root: 45, sc: IN, den: 0.2, inst: 'koto', drone: 1 },
    duel: { bpm: 126, root: 45, sc: IN, den: 0.62, inst: 'koto', dr: 'D..kD.k.D..kDkdk', dv: 0.3, ost: 1 },
    duel2: { bpm: 144, root: 47, sc: IN, den: 0.7, inst: 'koto', dr: 'D.kkD.k.D.kkDdDk', dv: 0.32, ost: 1 },
    last: { bpm: 66, root: 50, sc: YO, den: 0.44, inst: 'koto', dr: 'D.....k.d..k....', dv: 0.12, flute: 0.12 }
  };
  const mus = { id: null, m: null, next: 0, step: 0, idx: 4, rng: Math.random, hold: 0 };
  G.music = {
    play(id) {
      if (mus.id === id) return;
      mus.id = id; mus.m = MOODS[id] || null; mus.step = 0; mus.idx = 4; mus.hold = 0;
      mus.next = ac ? ac.currentTime + 0.4 : 0;
    },
    get id() { return mus.id; },
    // 매 프레임 불러서 조금 앞까지만 예약해 둔다
    tick() {
      if (!ac || ac.state !== 'running' || muted || !mus.m) return;
      const m = mus.m, sp = 60 / m.bpm / 4, now = ac.currentTime;
      if (mus.next < now - 0.5) mus.next = now + 0.05;
      let guard = 0;
      while (mus.next < now + 0.14 && guard++ < 8) {
        const t = mus.next, s = mus.step % 16, n = m.sc.length;
        try {
          if (m.dr) {
            const c = m.dr[s];
            if (c === 'D') drum(t, m.dv, 92); else if (c === 'd') drum(t, m.dv * 0.6, 140); else if (c === 'k') tick(t, m.dv * 0.5);
          }
          if (m.drone && mus.step % 64 === 0) flute(hz(m.root - 12), t, sp * 60, 0.028);
          if (m.ost && s % 4 === 0) pluck(hz(m.root - 12 + (s === 8 ? 7 : 0)), t, 0.3, 0.07, 1500);
          if (mus.hold > 0) mus.hold--;
          else if (Math.random() < m.den * (s % 4 === 0 ? 1.5 : s % 2 === 0 ? 1 : 0.55)) {
            if (s === 0 && Math.random() < 0.5) mus.idx = Math.random() < 0.5 ? n : 0;
            else mus.idx = G.clamp(mus.idx + G.pick([-2, -1, -1, 1, 1, 2, 0]), 0, n * 2);
            const note = m.root + m.sc[mus.idx % n] + 12 * Math.floor(mus.idx / n);
            const useFl = m.inst === 'flute' || (m.flute && Math.random() < m.flute);
            if (useFl) { const len = 4 + Math.floor(Math.random() * 8); flute(hz(note + 12), t, sp * len, 0.05); mus.hold = len - 1; }
            else {
              pluck(hz(note), t, 1.1 + Math.random() * 0.8, 0.075 + Math.random() * 0.03);
              if (Math.random() < 0.12) pluck(hz(note + 12), t + sp * 0.5, 0.7, 0.04);
            }
          }
        } catch (e) { /* 가락이 끊겨도 게임은 돈다 */ }
        mus.next += sp; mus.step++;
      }
    }
  };

  // ---------- 글자 ----------
  // 도트 폰트를 글자 단위로 찍어 두고, 알파를 잘라서 번짐 없이 쓴다.
  const FONTS = {
    big: { css: '12px Galmuri11', size: 12, lh: 14 },
    small: { css: '10px Galmuri9', size: 10, lh: 11 }
  };
  const glyphs = new Map();
  const mctx = document.createElement('canvas').getContext('2d');
  function glyph(ch, fk, color) {
    const key = fk + color + ch;
    let g = glyphs.get(key);
    if (g) return g;
    const F = FONTS[fk];
    mctx.font = F.css;
    const adv = Math.max(1, Math.round(mctx.measureText(ch).width));
    const c = document.createElement('canvas');
    c.width = adv + 2; c.height = F.size + 4;
    const x = c.getContext('2d');
    x.font = F.css; x.textBaseline = 'alphabetic'; x.fillStyle = color;
    x.fillText(ch, 0, F.size - 1);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
    x.putImageData(im, 0, 0);
    g = { c, adv };
    if (glyphs.size > 9000) glyphs.clear();
    glyphs.set(key, g);
    return g;
  }
  G.text = {
    lh: fk => FONTS[fk || 'big'].lh,
    width(str, fk) {
      fk = fk || 'big';
      let w = 0;
      for (const ch of String(str)) w += glyph(ch, fk, '#fff').adv;
      return w;
    },
    // align: 0 왼쪽, 1 가운데, 2 오른쪽
    draw(ctx, str, x, y, color, fk, align, scale) {
      fk = fk || 'big'; color = color || '#f6f1e3'; scale = scale || 1;
      str = String(str);
      if (align) x -= Math.round(this.width(str, fk) * scale * (align === 1 ? 0.5 : 1));
      x = Math.round(x); y = Math.round(y);
      for (const ch of str) {
        const g = glyph(ch, fk, color);
        if (ch !== ' ') {
          if (scale === 1) ctx.drawImage(g.c, x, y);
          else ctx.drawImage(g.c, x, y, g.c.width * scale, g.c.height * scale);
        }
        x += g.adv * scale;
      }
    },
    // 그림자 한 겹 깔고 쓰기
    drawS(ctx, str, x, y, color, fk, align, scale) {
      this.draw(ctx, str, x + (scale || 1), y + (scale || 1), '#1b1a1f', fk, align, scale);
      this.draw(ctx, str, x, y, color, fk, align, scale);
    },
    // 세로쓰기. x는 글줄 가운데, y는 첫 글자 위.
    vdraw(ctx, str, x, y, color, fk, scale, gap) {
      fk = fk || 'big'; scale = scale || 1;
      const F = FONTS[fk];
      for (const ch of String(str)) {
        const g = glyph(ch, fk, color || '#f6f1e3');
        if (ch !== ' ') ctx.drawImage(g.c, Math.round(x - g.adv * scale / 2), Math.round(y), g.c.width * scale, g.c.height * scale);
        y += (F.size + (gap === undefined ? 1 : gap)) * scale;
      }
    },
    wrap(str, maxW, fk) {
      const out = [];
      for (const para of String(str).split('\n')) {
        let line = '', w = 0, lastSp = -1;
        for (const ch of para) {
          const cw = glyph(ch, fk || 'big', '#fff').adv;
          if (w + cw > maxW && line.length) {
            if (ch !== ' ' && lastSp > 0 && line.length - lastSp < 7) {
              out.push(line.slice(0, lastSp));
              line = line.slice(lastSp + 1);
            } else {
              out.push(line);
              line = '';
            }
            w = this.width(line, fk); lastSp = -1;
            if (ch === ' ' && !line.length) continue;
          }
          if (ch === ' ') lastSp = line.length;
          line += ch; w += cw;
        }
        out.push(line);
      }
      return out;
    }
  };

  // ---------- 저장 ----------
  const KEY = 'kal-neomeo.save.1';
  G.store = {
    read() {
      try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
      catch (e) { return null; }
    },
    write(o) {
      try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
      catch (e) { return false; }
    },
    wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } }
  };
})();
