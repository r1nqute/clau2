/* STARLANE 4K — 연습곡
 * 처음 열었을 때 바로 해 볼 수 있도록 브라우저 안에서 곡 하나를 합성한다(저작권 걱정 없는 자작곡).
 * 148 BPM, 왕도 진행(IV–V–iii–vi). 북·베이스·패드·멜로디를 OfflineAudioContext로 그린 뒤,
 * 다른 곡과 똑같이 분석기에 넣어 채보를 만든다.
 */
(function (root) {
  'use strict';

  const BPM = 148;
  const B = 60 / BPM;           // 한 박
  const BAR = 4 * B;
  const LEAD = 0.6;             // 첫 박 전 여유
  const BARS = 40;
  const SR = 44100;

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // 마디마다 화음(근음, 구성음). F – G – Em – Am
  const CH = [
    { root: 41, tones: [65, 69, 72] },
    { root: 43, tones: [67, 71, 74] },
    { root: 40, tones: [64, 67, 71] },
    { root: 45, tones: [69, 72, 76] },
  ];

  // [박, 길이(박), 음]
  const VERSE = [
    [0, 1, 69], [1, 0.5, 72], [1.5, 0.5, 74], [2, 1.5, 76], [3.5, 0.5, 74],
    [4, 0.5, 74], [4.5, 0.5, 72], [5, 1, 71], [6, 2, 67],
    [8, 0.5, 71], [8.5, 0.5, 72], [9, 1, 74], [10, 0.5, 76], [10.5, 0.5, 79], [11, 1, 76],
    [12, 0.75, 74], [12.75, 0.75, 72], [13.5, 2.5, 69],
  ];
  const VERSE_END = [[12, 0.5, 72], [12.5, 0.5, 74], [13, 0.5, 76], [13.5, 0.5, 79], [14, 2, 81]];
  const CHORUS = [
    [0, 0.5, 81], [0.5, 0.5, 79], [1, 0.5, 76], [1.5, 1, 79], [2.5, 0.5, 76], [3, 0.5, 74], [3.5, 0.5, 76],
    [4, 1.5, 79], [5.5, 0.5, 76], [6, 0.5, 74], [6.5, 0.5, 72], [7, 1, 74],
    [8, 0.5, 76], [8.5, 0.25, 74], [8.75, 0.25, 76], [9, 0.5, 79], [9.5, 0.5, 83], [10, 1, 81], [11, 0.5, 79], [11.5, 0.5, 76],
    [12, 1, 76], [13, 0.5, 74], [13.5, 0.5, 72], [14, 2, 69],
  ];
  const CHORUS_END = [[12, 0.5, 72], [12.5, 0.5, 74], [13, 0.5, 76], [13.5, 0.5, 79], [14, 2, 84]];
  const BREAK = [[0, 3.5, 76], [4, 3.5, 74], [8, 3.5, 71], [12, 3.75, 72]];

  // 구간: [첫 마디, 마디 수, 이름]
  const SECTIONS = [
    [0, 4, 'intro'], [4, 8, 'verse'], [12, 4, 'pre'], [16, 8, 'chorus'],
    [24, 4, 'break'], [28, 8, 'chorus2'], [36, 4, 'outro'],
  ];
  const sectionOf = bar => { for (const s of SECTIONS) if (bar >= s[0] && bar < s[0] + s[1]) return s[2]; return 'end'; };

  let seedN = 1;
  const nOff = () => { seedN = (seedN * 16807) % 2147483647; return (seedN / 2147483647) * 0.5; };

  function noiseBuffer(ctx) {
    const len = SR;
    const b = ctx.createBuffer(1, len, SR);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    return b;
  }

  // 악기: 주어진 컨텍스트 위에 소리 마디를 놓는다
  function makeInst(ctx, master, noise) {
    const env = (g, t, a, peak, d, sus, rel, end) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setTargetAtTime(peak * sus, t + a, d);
      g.gain.setValueAtTime(peak * sus, Math.max(t + a, end));
      g.gain.setTargetAtTime(0.0001, Math.max(t + a, end), rel);
    };

    function kick(t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
    }
    function snare(t, v) {
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      n.connect(f); f.connect(g); g.connect(master); n.start(t, nOff()); n.stop(t + 0.2);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(v * 0.7, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.1);
    }
    function hat(t, v, open, pan) {
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7600;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.24 : 0.045));
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      n.connect(f); f.connect(g); g.connect(p); p.connect(master); n.start(t, nOff()); n.stop(t + (open ? 0.26 : 0.06));
    }
    function crash(t, v) {
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 1);
      const n2 = ctx.createBufferSource(); n2.buffer = noise; n2.connect(f); n2.start(t + 0.99, 0.2); n2.stop(t + 1.7);
    }
    function bass(t, len, note, v) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(note);
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = midi(note - 12);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.18); f.Q.value = 4;
      const g = ctx.createGain(); env(g, t, 0.005, v, 0.12, 0.55, 0.03, t + len - 0.03);
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
      o.start(t); o2.start(t); o.stop(t + len + 0.2); o2.stop(t + len + 0.2);
    }
    function pad(t, len, tones, v) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 0.4;
      const g = ctx.createGain(); env(g, t, 0.25, v, 0.6, 0.8, 0.25, t + len - 0.1);
      f.connect(g); g.connect(master);
      for (const n of tones) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n - 12); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + len + 1.2);
      }
    }
    function lead(t, len, note, v) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = midi(note);
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = midi(note); o2.detune.value = 9;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(len > 0.5 ? 9 : 0, t + Math.min(len, 0.5));
      lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.25); f.Q.value = 1.5;
      const g = ctx.createGain(); env(g, t, 0.006, v, 0.15, 0.62, 0.05, t + len - 0.04);
      const mix = ctx.createGain(); mix.gain.value = 0.5;
      o.connect(f); o2.connect(mix); mix.connect(f); f.connect(g); g.connect(master);
      o.start(t); o2.start(t); lfo.start(t);
      o.stop(t + len + 0.3); o2.stop(t + len + 0.3); lfo.stop(t + len + 0.3);
    }
    function pluck(t, note, v, pan) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(note);
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(g); g.connect(p); p.connect(master); o.start(t); o.stop(t + 0.25);
    }
    function stab(t, tones, v) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      f.connect(g); g.connect(master);
      for (const n of tones) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.connect(f); o.start(t); o.stop(t + 0.3); }
    }
    return { kick, snare, hat, crash, bass, pad, lead, pluck, stab };
  }

  // 노드 수천 개를 한 그래프에 올리면 오프라인 렌더가 매우 느려서(30초+), 두 마디씩 따로 그려 이어 붙인다.
  async function render() {
    seedN = 1;
    const ev = [];
    const T = (bar, beat) => LEAD + bar * BAR + beat * B;
    const E = name => (t, ...args) => ev.push([t, name, args]);
    const kick = E('kick'), snare = E('snare'), hat = E('hat'), crash = E('crash'), bass = E('bass'),
      pad = E('pad'), lead = E('lead'), pluck = E('pluck'), stab = E('stab');
    function melody(bar0, seq, v, transpose) {
      for (const [b, l, n] of seq) lead(T(bar0, b), l * B, n + (transpose || 0), v);
    }

    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionOf(bar);
      const ch = CH[bar % 4];
      const last = bar === BARS - 1;
      // 패드
      if (sec !== 'outro' || bar < BARS - 1) pad(T(bar, 0), BAR, ch.tones, sec === 'break' ? 0.05 : sec.startsWith('chorus') ? 0.035 : 0.04);
      // 북
      for (let beat = 0; beat < 4; beat++) {
        const t = T(bar, beat);
        if (sec === 'intro') {
          if (bar >= 2) hat(t + B / 2, 0.12, false, 0.3);
          if (bar === 3 && beat >= 2) snare(t, 0.25 + beat * 0.08);
          continue;
        }
        if (sec === 'break') {
          if (beat === 0) kick(t, 0.6);
          if (bar === 27) { snare(t, 0.3); snare(t + B / 2, 0.35); if (beat === 3) { snare(t + B / 4, 0.4); snare(t + B * 3 / 4, 0.45); } }
          continue;
        }
        if (last) { if (beat === 0) { kick(t, 0.95); crash(t, 0.35); } continue; }
        const four = sec === 'pre' || sec.startsWith('chorus') || sec === 'outro';
        if (four || beat === 0 || beat === 2) kick(t, 0.9);
        if (sec === 'verse' && beat === 3) kick(t + B / 2, 0.6);
        if (beat === 1 || beat === 3) snare(t, sec === 'verse' ? 0.38 : 0.45);
        if (sec === 'pre' && bar === 15) { snare(t + B / 4, 0.25 + beat * 0.05); snare(t + B / 2, 0.3 + beat * 0.05); snare(t + 3 * B / 4, 0.32 + beat * 0.05); }
        if (sec === 'verse') { hat(t, 0.1, false, -0.25); hat(t + B / 2, 0.08, false, -0.25); }
        if (sec === 'pre') for (let q = 0; q < 4; q++) hat(t + q * B / 4, q % 2 ? 0.06 : 0.1, false, 0.25);
        if (sec.startsWith('chorus') || sec === 'outro') { hat(t + B / 2, 0.11, true, 0.2); hat(t, 0.05, false, -0.2); }
      }
      if ((sec.startsWith('chorus') || sec === 'pre') && bar % 4 === 0) crash(T(bar, 0), 0.22);
      if (sec === 'chorus' && bar === 16) crash(T(bar, 0), 0.3);
      // 베이스
      if (sec !== 'intro' && sec !== 'break' && !last) {
        for (let e = 0; e < 8; e++) {
          const t = T(bar, e / 2);
          const oct = (sec.startsWith('chorus') || sec === 'outro') && e % 2 === 1 ? 12 : 0;
          bass(t, B / 2 * 0.9, ch.root + oct, 0.32);
        }
      } else if (sec === 'break') {
        bass(T(bar, 0), BAR * 0.95, ch.root, 0.22);
      }
      // 분산화음(전주, 2절 후렴)
      if (sec === 'intro' || sec === 'chorus2') {
        const ar = [ch.tones[0] + 12, ch.tones[1] + 12, ch.tones[2] + 12, ch.tones[1] + 12];
        const per = sec === 'intro' ? 2 : 4;
        for (let q = 0; q < 4 * per; q++) pluck(T(bar, q / per), ar[q % 4], sec === 'intro' ? 0.16 : 0.08, q % 2 ? 0.35 : -0.35);
      }
      // 후렴 찌르기
      if ((sec.startsWith('chorus') || sec === 'outro') && !last) {
        for (const b of [1.5, 3.5]) stab(T(bar, b), ch.tones.map(n => n + 12), 0.08);
      }
    }
    // 멜로디
    melody(4, VERSE, 0.2); melody(8, VERSE.slice(0, 13).concat(VERSE_END), 0.2);
    melody(12, [[0, 1, 72], [1, 1, 74], [2, 1, 76], [3, 1, 79], [4, 2, 79], [6, 1, 76], [7, 1, 74], [8, 1, 72], [9, 1, 74], [10, 2, 76], [12, 0.5, 79], [12.5, 0.5, 81], [13, 0.5, 83], [13.5, 0.5, 84], [14, 1, 83], [15, 0.5, 81], [15.5, 0.5, 79]], 0.19);
    melody(16, CHORUS, 0.21); melody(20, CHORUS.slice(0, 20).concat(CHORUS_END), 0.21);
    melody(24, BREAK, 0.17);
    melody(28, CHORUS, 0.22); melody(32, CHORUS.slice(0, 20).concat(CHORUS_END), 0.22);
    melody(36, [[0, 0.5, 81], [0.5, 0.5, 79], [1, 0.5, 76], [1.5, 1, 79], [2.5, 0.5, 76], [3, 1, 74], [4, 1.5, 79], [5.5, 0.5, 76], [6, 0.5, 74], [6.5, 0.5, 72], [7, 1, 74], [8, 4, 76], [12, 3, 84]], 0.22);


    const dur = LEAD + BARS * BAR + 2.4;
    const total = Math.ceil(dur * SR);
    const out = [new Float32Array(total), new Float32Array(total)];
    const CHUNK = 2 * BAR, TAIL = 2.8;
    ev.sort((x, y) => x[0] - y[0]);
    let lastCtx = null;
    for (let cs = 0, k = 0; cs < dur; cs += CHUNK) {
      const list = [];
      while (k < ev.length && ev[k][0] < cs + CHUNK) list.push(ev[k++]);
      if (!list.length) continue;
      const ctx = new OfflineAudioContext(2, Math.ceil((CHUNK + TAIL) * SR), SR);
      lastCtx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      const inst = makeInst(ctx, master, noiseBuffer(ctx));
      for (const [t, name, args] of list) inst[name](Math.max(0, t - cs), ...args);
      const buf = await ctx.startRendering();
      const off = Math.round(cs * SR);
      for (let ch = 0; ch < 2; ch++) {
        const src = buf.getChannelData(ch), dst = out[ch];
        const n = Math.min(src.length, total - off);
        for (let i = 0; i < n; i++) dst[off + i] += src[i];
      }
    }
    // 부드러운 리미터
    let peak = 1e-6;
    for (let ch = 0; ch < 2; ch++) for (let i = 0; i < total; i++) { const v = Math.abs(out[ch][i]); if (v > peak) peak = v; }
    const pre = 1.25 / peak;
    const res = (lastCtx || new OfflineAudioContext(2, 1, SR)).createBuffer(2, total, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = out[ch];
      for (let i = 0; i < total; i++) d[i] = Math.tanh(d[i] * pre) * 0.92;
      res.getChannelData(ch).set(d);
    }
    return res;
  }


  function jacket(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, size, size);
    gr.addColorStop(0, '#16204a'); gr.addColorStop(1, '#3a1840');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`;
      const x = r() * size, y = r() * size, z = r() * 1.6 + 0.4;
      g.fillRect(x, y, z, z);
    }
    // 네 줄 레인과 노트
    const lw = size * 0.12, x0 = size * 0.26;
    for (let l = 0; l < 4; l++) {
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.fillRect(x0 + l * lw + 2, 0, lw - 4, size);
    }
    const notes = [[0, 0.2], [1, 0.36], [3, 0.46], [2, 0.6], [1, 0.72], [0, 0.72]];
    for (const [l, y] of notes) {
      g.fillStyle = (l === 0 || l === 3) ? '#6be6f7' : '#f7a4d3';
      g.fillRect(x0 + l * lw + 4, size * y, lw - 8, size * 0.035);
    }
    g.fillStyle = '#ffd36b';
    g.fillRect(x0, size * 0.82, lw * 4, size * 0.012);
    return c.toDataURL('image/png');
  }

  root.Demo = {
    id: 'demo-starlane',
    title: '별빛 리허설 (연습곡)',
    bpm: BPM,
    render,
    jacket,
  };
})(window);
