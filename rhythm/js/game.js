/* STARLANE 4K — 게임 판
 * 소리는 Web Audio(AudioBufferSourceNode)로 틀고, 그 시계를 기준으로 노트를 그리고 판정한다.
 * 배경 영상은 소리 없이 따라오게 하고, 어긋나면 재생 속도를 살짝 바꾸거나 건너뛰어 맞춘다.
 */
(function (root) {
  'use strict';

  const WIN = { P: 0.042, G: 0.085, D: 0.13 };
  const HOLD_EARLY = 0.12;          // 꼬리보다 이만큼 일찍 떼도 성공
  const WEIGHT = { P: 1, G: 0.75, D: 0.4, M: 0 };
  const LANE_COL = ['#6be6f7', '#f7a4d3', '#f7a4d3', '#6be6f7'];
  const LANE_RGB = ['107,230,247', '247,164,211', '247,164,211', '107,230,247'];
  const JUDGE_COL = { P: '#ffd36b', G: '#8bf0b0', D: '#8fb8ff', M: '#ff6f86' };
  const JUDGE_TXT = { P: 'PERFECT', G: 'GREAT', D: 'GOOD', M: 'MISS' };
  const DIFF_COL = { easy: '#7ee0a5', normal: '#6cc4ff', hard: '#ffc15e', expert: '#ff7b8a', master: '#c99bff' };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function keyLabel(code) {
    if (!code) return '?';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'N' + code.slice(6);
    const map = { Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'SPC', BracketLeft: '[', BracketRight: ']',
      Backslash: '\\', Minus: '-', Equal: '=', ShiftLeft: 'LSH', ShiftRight: 'RSH', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      ControlLeft: 'LCT', ControlRight: 'RCT', AltLeft: 'LAL', AltRight: 'RAL', Backquote: '`', Enter: 'ENT', Tab: 'TAB', CapsLock: 'CAP' };
    return map[code] || code.slice(0, 3).toUpperCase();
  }

  const G = {
    ac: null, gain: null, canvas: null, cx: null, video: null, settings: null,
    onFinish: null, onPauseChange: null,
    active: false, paused: false, finishing: false,
    keyLabel,

    attach(opts) {
      Object.assign(this, opts);
      this.cx = this.canvas.getContext('2d');
      this._loop = this._loop.bind(this);
      window.addEventListener('resize', () => this.active && this._resize());
      this.canvas.addEventListener('pointerdown', e => this._pointer(e, true));
      this.canvas.addEventListener('pointerup', e => this._pointer(e, false));
      this.canvas.addEventListener('pointercancel', e => this._pointer(e, false));
      this.canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') this._pointer(e, false); });
      this._pointers = new Map();
      this._hitBuf = null;
    },

    // ───────── 시작과 끝
    start(opt) {
      // opt: { song, chart, analysis, buffer, auto, hasVideo }
      this.stop(true);
      const ac = this.ac;
      this.song = opt.song; this.chart = opt.chart; this.analysis = opt.analysis; this.buffer = opt.buffer;
      this.auto = !!opt.auto; this.hasVideo = !!opt.hasVideo;
      this.notes = opt.chart.notes.map(n => ({ t: n.t, l: n.l, e: n.e || 0, st: 0, hold: 0, endJ: 0 }));
      this.laneIdx = [[], [], [], []];
      this.notes.forEach((n, i) => this.laneIdx[n.l].push(i));
      this.lanePtr = [0, 0, 0, 0];
      this.drawFrom = 0;
      const holds = this.notes.filter(n => n.e).length;
      this.totalUnits = this.notes.length + holds;
      this.cnt = { P: 0, G: 0, D: 0, M: 0 };
      this.sum = 0; this.judged = 0;
      this.combo = 0; this.maxCombo = 0; this.fast = 0; this.slow = 0; this.offs = [];
      this.pressed = [false, false, false, false];
      this.beam = [-9, -9, -9, -9];
      this.holding = [-1, -1, -1, -1];
      this.fx = [];
      this.jd = null;
      this.comboPop = 0;
      const first = this.notes.length ? this.notes[0].t : 1;
      let last = 0;
      for (const n of this.notes) last = Math.max(last, n.e || n.t);
      this.firstT = first;
      this.endT = Math.min(this.buffer.duration - 0.05, last + 2.2);
      if (this.endT < last + 0.5) this.endT = last + 0.5;
      this.lead = Math.max(1.2, 2.2 - first);
      // 소리
      this.gain = ac.createGain();
      this.gain.gain.value = this.settings.vol;
      this.gain.connect(ac.destination);
      this.src = null;
      this._startSource(0, this.lead);
      this.clockInit = false;
      this.offsetSec = this.settings.offset / 1000;
      this.active = true; this.paused = false; this.finishing = false;
      this.frozen = -this.lead;
      this._resize();
      this._makeSprites();
      this.lastSync = 0;
      this.skipHint = first > 10;
      if (this.video && this.hasVideo) {
        try { this.video.pause(); this.video.muted = true; this.video.currentTime = 0; this.video.playbackRate = 1; } catch (e) { /* */ }
      }
      this.canvas.hidden = false;
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this._loop);
    },

    _startSource(offset, delay) {
      const ac = this.ac;
      if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) { /* */ } this.src.disconnect(); }
      const src = ac.createBufferSource();
      src.buffer = this.buffer;
      src.connect(this.gain);
      const at = ac.currentTime + delay;
      src.start(at, offset);
      this.src = src;
      this.startCtx = at - offset;
      this.clockInit = false;
    },

    stop(silent) {
      this.active = false;
      this.paused = false;
      cancelAnimationFrame(this.raf);
      if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) { /* */ } try { this.src.disconnect(); } catch (e) { /* */ } }
      this.src = null;
      if (this.gain) { try { this.gain.disconnect(); } catch (e) { /* */ } }
      if (this.video && this.hasVideo) { try { this.video.pause(); this.video.playbackRate = 1; } catch (e) { /* */ } }
      if (this.ac && this.ac.state === 'suspended' && !silent) this.ac.resume().catch(() => {});
      if (this.canvas) this.canvas.hidden = true;
    },

    pause() {
      if (!this.active || this.paused || this.finishing) return;
      this.frozen = this.now(performance.now());
      this.paused = true;
      this.ac.suspend().catch(() => {});
      if (this.video && this.hasVideo) try { this.video.pause(); } catch (e) { /* */ }
      for (let l = 0; l < 4; l++) this._release(l, null);
      this.onPauseChange && this.onPauseChange(true);
    },

    resume(cb) {
      if (!this.paused) return;
      this.ac.resume().then(() => {
        this.paused = false;
        this.clockInit = false;
        this.lastSync = 0;
        cb && cb();
      }).catch(() => { this.paused = false; this.clockInit = false; cb && cb(); });
    },

    // 인트로 건너뛰기
    skipIntro() {
      if (!this.active || this.paused || this.finishing) return false;
      const t = this.now(performance.now());
      const target = this.firstT - 2.4;
      if (t >= target - 1) return false;
      this._startSource(Math.max(0, target), 0.05);
      this.skipHint = false;
      if (this.video && this.hasVideo) try { this.video.currentTime = Math.max(0, target); } catch (e) { /* */ }
      return true;
    },

    // ───────── 시계
    _ctxNow(perf) {
      const ac = this.ac;
      if (ac.getOutputTimestamp) {
        const ts = ac.getOutputTimestamp();
        if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (perf - ts.performanceTime) / 1000;
      }
      return ac.currentTime - (ac.outputLatency || ac.baseLatency || 0) + (perf - performance.now()) / 1000;
    },
    _tickClock(perf) {
      const measured = this._ctxNow(perf) - perf / 1000;
      if (!this.clockInit || Math.abs(measured - this.clockOff) > 0.03) { this.clockOff = measured; this.clockInit = true; }
      else this.clockOff += (measured - this.clockOff) * 0.04;
    },
    now(perf) {
      if (this.paused) return this.frozen;
      if (!this.clockInit) this._tickClock(perf);
      return perf / 1000 + this.clockOff - this.startCtx - this.offsetSec;
    },

    // ───────── 입력
    keyDown(code, ts) {
      if (!this.active || this.paused || this.auto) return false;
      const l = this.settings.keys.indexOf(code);
      if (l < 0) return false;
      if (!this.pressed[l]) this._press(l, ts);
      return true;
    },
    keyUp(code, ts) {
      if (!this.active) return false;
      const l = this.settings.keys.indexOf(code);
      if (l < 0) return false;
      this._release(l, ts);
      return true;
    },
    releaseAll() { for (let l = 0; l < 4; l++) this._release(l, null); },

    _pointer(e, down) {
      if (!this.active || this.paused || this.auto) return;
      e.preventDefault();
      if (down) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let lane;
        if (e.pointerType === 'mouse') {
          lane = Math.floor((x - this.x0) / this.lw);
          if (lane < 0 || lane > 3) return;
        } else lane = clamp(Math.floor(x / (rect.width / 4)), 0, 3);
        this._pointers.set(e.pointerId, lane);
        try { this.canvas.setPointerCapture(e.pointerId); } catch (er) { /* */ }
        if (!this.pressed[lane]) this._press(lane, e.timeStamp);
      } else {
        const lane = this._pointers.get(e.pointerId);
        this._pointers.delete(e.pointerId);
        if (lane === undefined) return;
        for (const v of this._pointers.values()) if (v === lane) return;
        this._release(lane, e.timeStamp);
      }
    },

    _press(l, ts) {
      this.pressed[l] = true;
      const t = this.now(ts != null ? ts : performance.now());
      this.beam[l] = Infinity;
      this._hitSound();
      const idx = this.laneIdx[l];
      const p = this.lanePtr[l];
      if (p >= idx.length) return;
      const n = this.notes[idx[p]];
      const dt = t - n.t;
      if (dt < -WIN.D) return;          // 너무 이르면 헛손
      if (dt > WIN.D) return;           // (판정 고리에서 MISS 처리됨)
      const ad = Math.abs(dt);
      const j = ad <= WIN.P ? 'P' : ad <= WIN.G ? 'G' : 'D';
      n.st = 1;
      this.lanePtr[l]++;
      this._judge(j, dt, l);
      if (n.e) { n.hold = 1; this.holding[l] = idx[p]; }
    },

    _release(l, ts) {
      if (!this.pressed[l]) return;
      this.pressed[l] = false;
      this.beam[l] = performance.now();
      const hi = this.holding[l];
      if (hi < 0) return;
      this.holding[l] = -1;
      const n = this.notes[hi];
      if (n.hold !== 1) return;
      const t = ts != null ? this.now(ts) : this.now(performance.now());
      if (t >= n.e - HOLD_EARLY) { n.hold = 2; this._judge('P', null, l, true); }
      else { n.hold = 3; this._judge('M', null, l, true); }
    },

    _judge(j, dt, lane, isTail) {
      this.cnt[j]++;
      this.sum += WEIGHT[j];
      this.judged++;
      if (j === 'M') { this.combo = 0; }
      else { this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; this.comboPop = performance.now(); }
      let fs = '';
      if (dt != null && j !== 'M') {
        this.offs.push(dt);
        if (j !== 'P') { if (dt < 0) { this.fast++; fs = 'FAST'; } else { this.slow++; fs = 'SLOW'; } }
      }
      this.jd = { j, fs, t0: performance.now() };
      if (j !== 'M' && !isTail) this.fx.push({ l: lane, t0: performance.now(), j });
      if (j === 'P' && isTail) this.fx.push({ l: lane, t0: performance.now(), j, tail: true });
    },

    _hitSound() {
      const v = this.settings.hit;
      if (!v || !this.ac) return;
      const ac = this.ac;
      if (!this._hitBuf) {
        const len = Math.round(ac.sampleRate * 0.05);
        const b = ac.createBuffer(1, len, ac.sampleRate);
        const d = b.getChannelData(0);
        let s = 99;
        for (let i = 0; i < len; i++) {
          s = (s * 1103515245 + 12345) >>> 0;
          const k = i / ac.sampleRate;
          d[i] = ((s / 4294967296) * 2 - 1) * Math.exp(-k / 0.008) * 0.5 + Math.sin(2 * Math.PI * 1800 * k) * Math.exp(-k / 0.012) * 0.5;
        }
        this._hitBuf = b;
      }
      const src = ac.createBufferSource();
      src.buffer = this._hitBuf;
      const g = ac.createGain();
      g.gain.value = v * 0.6;
      src.connect(g); g.connect(ac.destination);
      src.start();
    },

    // ───────── 매 프레임
    _loop(perf) {
      if (!this.active) return;
      this.raf = requestAnimationFrame(this._loop);
      if (!this.paused) this._tickClock(perf);
      const t = this.now(perf);
      if (!this.paused && !this.finishing) {
        this._update(t, perf);
        this._syncVideo(t, perf);
        if (t >= this.endT) this._finish();
      }
      this._render(t, perf);
    },

    _update(t) {
      // 오토
      if (this.auto) {
        for (let l = 0; l < 4; l++) {
          const idx = this.laneIdx[l];
          const p = this.lanePtr[l];
          if (this.holding[l] >= 0) {
            const n = this.notes[this.holding[l]];
            if (t >= n.e) { this.pressed[l] = false; this.beam[l] = performance.now(); this.holding[l] = -1; n.hold = 2; this._judge('P', null, l, true); }
          }
          if (p < idx.length) {
            const n = this.notes[idx[p]];
            if (t >= n.t) {
              n.st = 1; this.lanePtr[l]++;
              this._judge('P', 0, l);
              if (n.e) { n.hold = 1; this.holding[l] = idx[p]; this.pressed[l] = true; this.beam[l] = Infinity; }
              else { this.beam[l] = performance.now(); }
            }
          }
        }
        return;
      }
      // 놓친 노트
      for (let l = 0; l < 4; l++) {
        const idx = this.laneIdx[l];
        while (this.lanePtr[l] < idx.length) {
          const n = this.notes[idx[this.lanePtr[l]]];
          if (t - n.t <= WIN.D) break;
          n.st = 2;
          this.lanePtr[l]++;
          this._judge('M', null, l);
          if (n.e) { n.hold = 3; this._judge('M', null, l, true); }
        }
        // 롱노트를 끝까지 누르고 있으면 꼬리에서 성공
        const hi = this.holding[l];
        if (hi >= 0) {
          const n = this.notes[hi];
          if (t >= n.e) { this.holding[l] = -1; n.hold = 2; this._judge('P', null, l, true); }
        }
      }
    },

    _syncVideo(t, perf) {
      const v = this.video;
      if (!v || !this.hasVideo || !v.src) return;
      if (t < 0) { if (!v.paused) v.pause(); return; }
      if (perf - this.lastSync < 250) return;
      this.lastSync = perf;
      if (v.readyState < 2) return;
      if (t > v.duration) { if (!v.paused) v.pause(); return; }
      const drift = v.currentTime - t;
      if (v.paused) { try { v.currentTime = t + 0.05; } catch (e) { /* */ } v.play().catch(() => {}); return; }
      if (Math.abs(drift) > 0.3) { try { v.currentTime = t + 0.08; } catch (e) { /* */ } v.playbackRate = 1; }
      else if (Math.abs(drift) > 0.035) v.playbackRate = clamp(1 - drift * 1.5, 0.9, 1.1);
      else v.playbackRate = 1;
    },

    _finish() {
      this.finishing = true;
      const ac = this.ac;
      try {
        this.gain.gain.cancelScheduledValues(ac.currentTime);
        this.gain.gain.setValueAtTime(this.gain.gain.value, ac.currentTime);
        this.gain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.0);
      } catch (e) { /* */ }
      for (let l = 0; l < 4; l++) this._release(l, null);
      for (const n of this.notes) {
        if (n.st === 0) { n.st = 2; this._judge('M', null, n.l); if (n.e) this._judge('M', null, n.l, true); }
      }
      setTimeout(() => {
        if (!this.finishing) return;
        const res = this.result();
        this.stop();
        this.onFinish && this.onFinish(res);
      }, 1100);
    },

    result() {
      const total = Math.max(1, this.totalUnits);
      const acc = this.sum / total;
      const score = Math.round(acc * 1000000);
      const a = acc * 100;
      const rank = a >= 98 ? 'SS' : a >= 95 ? 'S' : a >= 90 ? 'A' : a >= 80 ? 'B' : a >= 70 ? 'C' : 'D';
      const mean = this.offs.length ? this.offs.reduce((s, v) => s + v, 0) / this.offs.length : 0;
      return {
        score, acc: a, rank, cnt: Object.assign({}, this.cnt), maxCombo: this.maxCombo, total,
        fast: this.fast, slow: this.slow, meanMs: Math.round(mean * 1000), samples: this.offs.length,
        fc: this.cnt.M === 0, ap: this.cnt.M === 0 && this.cnt.G === 0 && this.cnt.D === 0, auto: this.auto,
      };
    },

    // ───────── 그리기
    _resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      this.dpr = dpr; this.W = W; this.H = H;
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
      this.lw = clamp(Math.round(Math.min(H * 0.105, W / 4.6)), 56, 118);
      this.fw = this.lw * 4;
      this.x0 = Math.round((W - this.fw) / 2);
      this.hy = Math.round(H - clamp(H * 0.15, 90, 150));
      this.nh = clamp(Math.round(this.lw * 0.23), 13, 24);
      this._makeSprites();
    },

    _makeSprites() {
      if (!this.lw) return;
      const dpr = this.dpr, w = this.lw - 8, h = this.nh;
      this.sprites = LANE_COL.map((col, l) => {
        const c = document.createElement('canvas');
        c.width = Math.ceil((w + 16) * dpr); c.height = Math.ceil((h + 16) * dpr);
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        g.shadowColor = `rgba(${LANE_RGB[l]},.85)`;
        g.shadowBlur = 10;
        const gr = g.createLinearGradient(0, 8, 0, 8 + h);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.28, col);
        gr.addColorStop(1, `rgba(${LANE_RGB[l]},.75)`);
        g.fillStyle = gr;
        rr(g, 8, 8, w, h, Math.min(5, h / 2));
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,.9)';
        rr(g, 12, 9.5, w - 8, 2, 1);
        g.fill();
        return c;
      });
    },

    _render(t, perf) {
      const g = this.cx, dpr = this.dpr, W = this.W, H = this.H;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const lw = this.lw, x0 = this.x0, fw = this.fw, hy = this.hy, nh = this.nh;
      const s = this.settings;
      const lead = 5.4 / s.speed;
      const pps = hy / lead;

      // 레인 바탕
      g.fillStyle = `rgba(6,8,18,${s.lane})`;
      g.fillRect(x0, 0, fw, H);
      const edge = g.createLinearGradient(x0, 0, x0 + fw, 0);
      edge.addColorStop(0, 'rgba(107,230,247,.5)'); edge.addColorStop(0.5, 'rgba(247,164,211,.5)'); edge.addColorStop(1, 'rgba(107,230,247,.5)');
      g.fillStyle = edge;
      g.fillRect(x0 - 2, 0, 2, H); g.fillRect(x0 + fw, 0, 2, H);
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (let l = 1; l < 4; l++) g.fillRect(x0 + l * lw, 0, 1, H);

      // 마디선
      const bars = this.analysis && this.analysis.bars;
      if (bars) {
        g.fillStyle = 'rgba(255,255,255,.14)';
        for (let i = 0; i < bars.length; i++) {
          const y = hy - (bars[i] - t) * pps;
          if (y < -2) break;
          if (y > hy) continue;
          g.fillRect(x0, Math.round(y), fw, 1);
        }
      }

      // 키 빛기둥
      const nowMs = performance.now();
      for (let l = 0; l < 4; l++) {
        const since = this.beam[l] === Infinity ? 0 : (nowMs - this.beam[l]) / 1000;
        const a = this.pressed[l] ? 1 : clamp(1 - since / 0.14, 0, 1);
        if (a <= 0) continue;
        const gr = g.createLinearGradient(0, hy, 0, hy - H * 0.45);
        gr.addColorStop(0, `rgba(${LANE_RGB[l]},${0.38 * a})`);
        gr.addColorStop(1, `rgba(${LANE_RGB[l]},0)`);
        g.fillStyle = gr;
        g.fillRect(x0 + l * lw + 1, hy - H * 0.45, lw - 2, H * 0.45);
      }

      // 판정선
      const hl = g.createLinearGradient(x0, 0, x0 + fw, 0);
      hl.addColorStop(0, '#6be6f7'); hl.addColorStop(0.5, '#f7a4d3'); hl.addColorStop(1, '#6be6f7');
      g.fillStyle = hl;
      g.globalAlpha = 0.25; g.fillRect(x0, hy - 6, fw, 12);
      g.globalAlpha = 1; g.fillRect(x0, hy - 1.5, fw, 3);

      // 노트
      const notes = this.notes;
      while (this.drawFrom < notes.length) {
        const n = notes[this.drawFrom];
        const endT = n.e || n.t;
        if (endT < t - 0.6 && n.st !== 0) this.drawFrom++;
        else break;
      }
      const top = t + (hy + nh * 2) / pps;
      for (let i = this.drawFrom; i < notes.length; i++) {
        const n = notes[i];
        if (n.t > top) break;
        const lx = x0 + n.l * lw;
        let yHead = hy - (n.t - t) * pps;
        if (n.e) {
          const yTail = hy - (n.e - t) * pps;
          if (n.hold === 2 && t > n.e) continue;
          if (n.hold === 1) yHead = hy;
          const bw = Math.round(lw * 0.56);
          const bx = lx + (lw - bw) / 2;
          const y1 = Math.min(yHead, hy + 40), y0 = Math.max(yTail, -10);
          if (y1 > y0) {
            const holdingNow = n.hold === 1;
            const broken = n.hold === 3 || (n.st === 2);
            const gr = g.createLinearGradient(0, y0, 0, y1);
            const rgb = broken ? '140,146,170' : LANE_RGB[n.l];
            gr.addColorStop(0, `rgba(${rgb},${broken ? 0.18 : holdingNow ? 0.55 : 0.32})`);
            gr.addColorStop(1, `rgba(${rgb},${broken ? 0.25 : holdingNow ? 0.85 : 0.5})`);
            g.fillStyle = gr;
            g.fillRect(bx, y0, bw, y1 - y0);
            g.fillStyle = `rgba(${rgb},${broken ? 0.4 : 0.95})`;
            g.fillRect(bx, y0 - 3, bw, 4);
          }
          if (n.hold === 1) {
            this._drawNote(n.l, hy, 1);
            continue;
          }
        }
        if (n.st === 1) continue;
        if (yHead > H + nh) continue;
        this._drawNote(n.l, yHead, n.st === 2 ? 0.3 : 1);
      }

      // 키 받침
      for (let l = 0; l < 4; l++) {
        const kx = x0 + l * lw, ky = hy + 10, kh = Math.min(44, H - hy - 18);
        if (kh < 18) break;
        g.fillStyle = this.pressed[l] ? `rgba(${LANE_RGB[l]},.35)` : 'rgba(255,255,255,.04)';
        rr(g, kx + 4, ky, lw - 8, kh, 8); g.fill();
        g.strokeStyle = this.pressed[l] ? LANE_COL[l] : 'rgba(255,255,255,.12)';
        g.lineWidth = 1; rr(g, kx + 4.5, ky + 0.5, lw - 9, kh - 1, 8); g.stroke();
        g.fillStyle = this.pressed[l] ? '#fff' : 'rgba(238,240,255,.55)';
        g.font = `700 ${Math.round(clamp(lw * 0.2, 12, 18))}px Oxanium, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(keyLabel(s.keys[l]), kx + lw / 2, ky + kh / 2 + 1);
      }

      // 타격 효과
      this.fx = this.fx.filter(f => nowMs - f.t0 < 320);
      for (const f of this.fx) {
        const k = (nowMs - f.t0) / 320;
        const cxp = x0 + f.l * lw + lw / 2;
        const col = f.j === 'P' ? '255,211,107' : f.j === 'G' ? '139,240,176' : '143,184,255';
        g.strokeStyle = `rgba(${col},${(1 - k) * 0.9})`;
        g.lineWidth = 3 * (1 - k) + 1;
        g.beginPath(); g.ellipse(cxp, hy, lw * (0.32 + 0.45 * k), nh * (0.6 + 1.2 * k), 0, 0, Math.PI * 2); g.stroke();
        if (f.j === 'P' && !f.tail) {
          g.fillStyle = `rgba(255,255,255,${(1 - k) * 0.9})`;
          for (let q = 0; q < 6; q++) {
            const ang = -Math.PI / 2 + (q - 2.5) * 0.42;
            const rr2 = lw * (0.25 + 0.7 * k);
            g.fillRect(cxp + Math.cos(ang) * rr2 - 1.5, hy + Math.sin(ang) * rr2 * 1.3 - 1.5, 3, 3);
          }
        }
      }

      // 콤보
      if (this.combo >= 3) {
        const pop = clamp((nowMs - this.comboPop) / 90, 0, 1);
        const sz = Math.round(clamp(lw * 0.62, 34, 64) * (1.12 - 0.12 * pop));
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.font = `800 ${sz}px Oxanium, sans-serif`;
        g.fillStyle = 'rgba(238,240,255,.92)';
        g.fillText(String(this.combo), x0 + fw / 2, H * 0.3);
        g.font = `600 ${Math.round(clamp(lw * 0.13, 10, 13))}px Oxanium, sans-serif`;
        g.fillStyle = 'rgba(238,240,255,.55)';
        g.fillText('C O M B O', x0 + fw / 2, H * 0.3 + 18);
      }

      // 판정 글자
      if (this.jd) {
        const age = (nowMs - this.jd.t0) / 1000;
        if (age < 0.6) {
          const pop = clamp(age / 0.08, 0, 1);
          const a = age < 0.4 ? 1 : 1 - (age - 0.4) / 0.2;
          const sz = Math.round(clamp(lw * 0.36, 20, 38) * (1.25 - 0.25 * pop));
          g.globalAlpha = a;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `800 ${sz}px Oxanium, sans-serif`;
          const y = H * 0.44;
          if (this.jd.j === 'P') {
            const gr = g.createLinearGradient(0, y - sz / 2, 0, y + sz / 2);
            gr.addColorStop(0, '#fff6d6'); gr.addColorStop(0.55, '#ffd36b'); gr.addColorStop(1, '#e59a2f');
            g.fillStyle = gr;
          } else g.fillStyle = JUDGE_COL[this.jd.j];
          g.fillText(JUDGE_TXT[this.jd.j], x0 + fw / 2, y);
          if (this.jd.fs) {
            g.font = `700 ${Math.round(sz * 0.42)}px Oxanium, sans-serif`;
            g.fillStyle = this.jd.fs === 'FAST' ? '#8fb8ff' : '#ff9f7a';
            g.fillText(this.jd.fs, x0 + fw / 2, y - sz * 0.85);
          }
          g.globalAlpha = 1;
        }
      }

      // 위 정보판
      const pad = 16;
      const safeTop = 12;
      g.textBaseline = 'top';
      // 진행 막대
      const dur = this.endT;
      const prog = clamp(t / dur, 0, 1);
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(x0, 0, fw, 3);
      g.fillStyle = hl;
      g.fillRect(x0, 0, fw * prog, 3);
      const sideW = Math.max(0, x0 - pad * 2);
      if (sideW > 120) {
        g.textAlign = 'left';
        g.font = '700 15px "IBM Plex Sans KR", system-ui, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.95)';
        fitText(g, this.song.title, pad, safeTop + 4, sideW);
        g.font = '600 12px Oxanium, sans-serif';
        g.fillStyle = DIFF_COL[this.chart.key] || '#fff';
        g.fillText(`${this.chart.name}  Lv.${this.chart.level}${this.auto ? '   AUTO' : ''}`, pad, safeTop + 28);
        g.fillStyle = 'rgba(238,240,255,.5)';
        g.fillText(`SPEED ${s.speed.toFixed(1)}   BPM ${this.analysis ? this.analysis.bpm : ''}`, pad, safeTop + 46);
        g.textAlign = 'right';
        const sc = this.totalUnits ? Math.round(this.sum / this.totalUnits * 1000000) : 0;
        g.font = '800 30px Oxanium, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.95)';
        g.fillText(String(sc).padStart(7, '0'), W - pad, safeTop);
        const accNow = this.judged ? (this.sum / this.judged) * 100 : 100;
        g.font = '600 14px Oxanium, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.6)';
        g.fillText(accNow.toFixed(2) + '%', W - pad, safeTop + 36);
      } else {
        // 좁은 화면: 레인 위쪽에 점수만
        g.textAlign = 'center';
        g.font = '800 20px Oxanium, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.9)';
        const sc = this.totalUnits ? Math.round(this.sum / this.totalUnits * 1000000) : 0;
        g.fillText(String(sc).padStart(7, '0'), x0 + fw / 2, 10);
      }

      // 시작 전 안내
      if (t < 0 && !this.paused) {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 16px "IBM Plex Sans KR", system-ui, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.85)';
        g.fillText(this.auto ? '오토 플레이' : '준비', x0 + fw / 2, H * 0.55);
      }
      if (this.skipHint && t < this.firstT - 4 && t > -0.5 && !this.paused) {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '500 13px "IBM Plex Sans KR", system-ui, sans-serif';
        g.fillStyle = 'rgba(238,240,255,.7)';
        g.fillText(`첫 노트까지 ${Math.ceil(this.firstT - t)}초 · SPACE 전주 건너뛰기`, x0 + fw / 2, H * 0.55);
      }
    },

    _drawNote(l, y, alpha) {
      const sp = this.sprites[l];
      const g = this.cx;
      const w = sp.width / this.dpr, h = sp.height / this.dpr;
      if (alpha !== 1) g.globalAlpha = alpha;
      g.drawImage(sp, this.x0 + l * this.lw + 4 - 8, y - this.nh / 2 - 8, w, h);
      if (alpha !== 1) g.globalAlpha = 1;
    },
  };

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function fitText(g, text, x, y, maxW) {
    if (g.measureText(text).width <= maxW) { g.fillText(text, x, y); return; }
    let s = text;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    g.fillText(s + '…', x, y);
  }

  root.Game = G;
})(window);
