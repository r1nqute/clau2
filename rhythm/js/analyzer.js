/* STARLANE 4K — 곡 분석기
 *
 * 모노 신호(Float32Array, 22050Hz) → 특징 → 템포 → 박 격자 → 다섯 단계 채보.
 * 브라우저에서는 window.Analyzer, Node에서는 module.exports 로 쓴다.
 *
 * 흐름
 *   1. STFT(1024/128)로 로그 대역 에너지를 구하고, 대역별 스펙트럼 플럭스를 낸다(저·중·고역 따로).
 *   2. 온셋 포락선의 자기상관으로 템포를 고르고, 동적 계획법 박 추적(Ellis 2007)으로 박을 찾는다.
 *   3. 박이 고르면 한 줄의 격자(BPM·오프셋)로 맞추고, 온셋 빗(comb)으로 위상을 다듬는다.
 *      박이 흔들리면 추적한 박을 그대로 쓴다. 셋잇단(셔플) 느낌이면 3분할 격자를 쓴다.
 *   4. 온셋을 격자에 붙이고, 세기·박 위치·곡의 고조(에너지)로 단계마다 노트를 고른다.
 *   5. 길게 이어지는 소리는 롱노트로, 큰 강세는 동시치기로 바꾸고, 음높이 흐름을 따라 레인을 정한다.
 */
(function (root) {
  'use strict';

  const VERSION = 1;
  const SR = 22050;
  const N = 1024;     // 창 46ms
  const HOP = 128;    // 5.8ms
  const TICKS = 12;   // 유효 박 하나를 12틱으로 (16분=3틱, 8분=6틱, 셋잇단=4틱)
  // 플럭스 봉우리는 실제 어택보다 조금 앞에 선다. 합성 신호로 잰 값.
  const PEAK_BIAS = 0.004;
  const GRID_BIAS = 0.005;

  // ───────────────────────────── 기초 도구
  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
    return w;
  }

  function makeFFT(n) {
    const levels = Math.round(Math.log2(n));
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, x = i;
      for (let j = 0; j < levels; j++) { r = (r << 1) | (x & 1); x >>= 1; }
      rev[i] = r;
    }
    return function fft(re, im) {
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const l = j + half;
            const tre = re[l] * cos[k] + im[l] * sin[k];
            const tim = im[l] * cos[k] - re[l] * sin[k];
            re[l] = re[j] - tre; im[l] = im[j] - tim;
            re[j] += tre; im[j] += tim;
          }
        }
      }
    };
  }

  // 30Hz~11kHz 로그 간격 대역. 낮은 쪽은 빈 하나가 대역 하나가 된다.
  function buildBands(n, sr) {
    const fMin = 30, fMax = Math.min(11000, sr / 2 - 50), B = 60;
    const out = [];
    let lo = Math.max(1, Math.round(fMin * n / sr));
    for (let k = 1; k <= B; k++) {
      const f = fMin * Math.pow(fMax / fMin, k / B);
      const hi = Math.round(f * n / sr);
      if (hi <= lo) continue;
      out.push({ lo, hi, f: (lo + hi - 1) / 2 * sr / n });
      lo = hi;
    }
    return out;
  }

  function boxMean(a, r) {
    const n = a.length, out = new Float32Array(n), ps = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + a[i];
    for (let i = 0; i < n; i++) {
      const lo = Math.max(0, i - r), hi = Math.min(n, i + r + 1);
      out[i] = (ps[hi] - ps[lo]) / (hi - lo);
    }
    return out;
  }

  function gaussSmooth(a, sigma) {
    const r = Math.max(1, Math.ceil(sigma * 3));
    const k = new Float32Array(2 * r + 1);
    let s = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-0.5 * (i / sigma) * (i / sigma)); s += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    const n = a.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let j = -r; j <= r; j++) {
        const q = i + j;
        v += k[j + r] * a[q < 0 ? 0 : q >= n ? n - 1 : q];
      }
      out[i] = v;
    }
    return out;
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const b = Float64Array.from(arr).sort();
    const i = Math.min(b.length - 1, Math.max(0, Math.round(p * (b.length - 1))));
    return b[i];
  }

  function median(arr) { return percentile(arr, 0.5); }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashFloats(a) {
    let h = 2166136261 >>> 0;
    const step = Math.max(1, Math.floor(a.length / 4096));
    for (let i = 0; i < a.length; i += step) {
      h ^= Math.round(a[i] * 1e5) & 0xffff;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // ───────────────────────────── 1. 특징
  function extract(x, sr) {
    const n = N, hop = HOP;
    const frames = x.length >= n ? Math.floor((x.length - n) / hop) + 1 : 1;
    const fps = sr / hop;
    const win = hann(n);
    const fft = makeFFT(n);
    const bands = buildBands(n, sr);
    const nb = bands.length;
    const grp = new Uint8Array(nb);
    let midLo = nb, midHi = 0;
    for (let b = 0; b < nb; b++) {
      const f = bands[b].f;
      grp[b] = f < 150 ? 0 : f < 3200 ? 1 : 2;
      if (grp[b] === 1) { midLo = Math.min(midLo, b); midHi = Math.max(midHi, b); }
    }
    const re = new Float64Array(n), im = new Float64Array(n);
    const half = n / 2;
    const magA = new Float32Array(half + 1), magB = new Float32Array(half + 1);
    const ring = [];
    for (let i = 0; i < 3; i++) ring.push(new Float32Array(nb));

    const flux = new Float32Array(frames);
    const low = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames);
    const cen = new Float32Array(frames).fill(-1);
    const rms = new Float32Array(frames);
    const midDb = new Float32Array(frames);

    function frame(t, mag, off) {
      const L = ring[t % 3];
      let midPow = 0, midCnt = 0;
      for (let b = 0; b < nb; b++) {
        const lo = bands[b].lo, hi = bands[b].hi;
        let s = 0;
        for (let k = lo; k < hi; k++) s += mag[k] * mag[k];
        const p = s / (hi - lo);
        L[b] = Math.log1p(Math.sqrt(p));
        if (grp[b] === 1) { midPow += p; midCnt++; }
      }
      midDb[t] = 10 * Math.log10(midPow / Math.max(1, midCnt) + 1e-9);
      if (t >= 2) {
        const P = ring[(t - 2) % 3];
        let tot = 0, g0 = 0, g1 = 0, g2 = 0, cw = 0;
        for (let b = 0; b < nb; b++) {
          let ref = P[b];
          if (b > 0 && P[b - 1] > ref) ref = P[b - 1];
          if (b < nb - 1 && P[b + 1] > ref) ref = P[b + 1];
          const d = L[b] - ref;
          if (d > 0) {
            tot += d;
            const g = grp[b];
            if (g === 0) g0 += d; else if (g === 1) { g1 += d; cw += d * (b - midLo); } else g2 += d;
          }
        }
        flux[t] = tot; low[t] = g0; mid[t] = g1; high[t] = g2;
        if (g1 > 1e-6) cen[t] = cw / g1 / Math.max(1, midHi - midLo);
      }
      let e = 0;
      for (let i = 0; i < n; i += 2) { const v = x[off + i] || 0; e += v * v; }
      rms[t] = 10 * Math.log10(e / (n / 2) + 1e-10);
    }

    for (let t = 0; t < frames; t += 2) {
      const offA = t * hop, offB = (t + 1) * hop;
      const hasB = t + 1 < frames;
      for (let i = 0; i < n; i++) {
        re[i] = (x[offA + i] || 0) * win[i];
        im[i] = hasB ? (x[offB + i] || 0) * win[i] : 0;
      }
      fft(re, im);
      for (let k = 0; k <= half; k++) {
        const k2 = (n - k) & (n - 1);
        const zr = re[k], zi = im[k], cr = re[k2], ci = -im[k2];
        const ar = (zr + cr) * 0.5, ai = (zi + ci) * 0.5;
        const br = (zi - ci) * 0.5, bi = (cr - zr) * 0.5;
        magA[k] = Math.sqrt(ar * ar + ai * ai);
        magB[k] = Math.sqrt(br * br + bi * bi);
      }
      frame(t, magA, offA);
      if (hasB) frame(t + 1, magB, offB);
    }

    // 가벼운 평활
    const env = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const a = flux[i > 0 ? i - 1 : 0], b = flux[i], c = flux[i < frames - 1 ? i + 1 : i];
      env[i] = 0.25 * a + 0.5 * b + 0.25 * c;
    }
    return { fps, frames, t0: n / 2 / sr, env, flux, low, mid, high, cen, rms, midDb, duration: x.length / sr };
  }

  const fTime = (F, i) => F.t0 + i / F.fps;
  const tFrame = (F, t) => (t - F.t0) * F.fps;

  function sampleAt(a, x) {
    if (x <= 0) return a[0];
    const i = Math.floor(x);
    if (i >= a.length - 1) return a[a.length - 1];
    const f = x - i;
    return a[i] * (1 - f) + a[i + 1] * f;
  }

  function maxIn(a, lo, hi) {
    lo = Math.max(0, Math.floor(lo)); hi = Math.min(a.length - 1, Math.ceil(hi));
    let m = -Infinity;
    for (let i = lo; i <= hi; i++) if (a[i] > m) m = a[i];
    return m === -Infinity ? 0 : m;
  }

  // ───────────────────────────── 2. 템포
  function estimateTempo(F) {
    const env = F.env, fps = F.fps, n = env.length;
    const lm = boxMean(env, Math.round(0.1 * fps));
    const e = new Float32Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) { e[i] = Math.max(0, env[i] - lm[i]); mean += e[i]; }
    mean /= n;
    for (let i = 0; i < n; i++) e[i] -= mean;
    const minL = Math.floor(fps * 60 / 230), maxL = Math.ceil(fps * 60 / 55);
    const top = 2 * maxL + 2;
    const ac = new Float64Array(top + 2);
    for (let L = Math.max(1, (minL >> 1) - 1); L <= top; L++) {
      let s = 0;
      for (let i = 0, m = n - L; i < m; i++) s += e[i] * e[i + L];
      ac[L] = s / Math.max(1, n - L);
    }
    const acAt = x => { const i = Math.floor(x), f = x - i; return ac[i] * (1 - f) + ac[i + 1] * f; };
    const score = new Float64Array(maxL + 2);
    let best = -Infinity, bestL = minL;
    for (let L = minL; L <= maxL; L++) {
      const bpm = 60 * fps / L;
      const z = Math.log2(bpm / 130);
      const prior = Math.exp(-0.5 * z * z);
      const s = ac[L] + 0.5 * acAt(2 * L) + 0.25 * acAt(L / 2);
      score[L] = s > 0 ? s * prior : s / prior;
      if (score[L] > best) { best = score[L]; bestL = L; }
    }
    let Lr = bestL;
    if (bestL > minL && bestL < maxL) {
      const a = score[bestL - 1], b = score[bestL], c = score[bestL + 1];
      const den = a - 2 * b + c;
      if (den < 0) Lr = bestL + clamp(0.5 * (a - c) / den, -0.5, 0.5);
    }
    return { bpm: 60 * fps / Lr, period: Lr };
  }

  // ───────────────────────────── 3. 박 추적 (동적 계획법)
  function trackBeats(F, period) {
    const env = F.env, n = env.length;
    let m = 0, v = 0;
    for (let i = 0; i < n; i++) m += env[i];
    m /= n;
    for (let i = 0; i < n; i++) v += (env[i] - m) * (env[i] - m);
    const sd = Math.sqrt(v / n) || 1;
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = env[i] / sd;
    const ls = gaussSmooth(o, Math.max(1, period / 32));
    let lsMax = 0;
    for (let i = 0; i < n; i++) if (ls[i] > lsMax) lsMax = ls[i];
    const tight = 100;
    const lo = Math.max(1, Math.round(period / 2)), hi = Math.round(period * 2);
    const txc = new Float64Array(hi + 1);
    for (let d = lo; d <= hi; d++) { const z = Math.log(d / period); txc[d] = -tight * z * z; }
    const cum = new Float64Array(n), back = new Int32Array(n).fill(-1);
    let first = true;
    for (let i = 0; i < n; i++) {
      let best = -Infinity, arg = -1;
      for (let d = lo; d <= hi; d++) {
        const j = i - d;
        const val = (j >= 0 ? cum[j] : 0) + txc[d];
        if (val > best) { best = val; arg = j; }
      }
      cum[i] = ls[i] + best;
      if (first && ls[i] < 0.01 * lsMax) back[i] = -1;
      else { back[i] = arg; first = false; }
    }
    // 마지막 박: 누적 점수의 국소 최댓값 가운데 중앙값의 절반을 넘는 마지막 것
    const peaks = [];
    for (let i = 1; i < n - 1; i++) if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1]) peaks.push(i);
    let last = n - 1;
    if (peaks.length) {
      const med = median(peaks.map(i => cum[i]));
      for (let k = peaks.length - 1; k >= 0; k--) if (cum[peaks[k]] >= 0.5 * med) { last = peaks[k]; break; }
    }
    const beats = [];
    for (let i = last; i >= 0; i = back[i]) { beats.push(i); if (back[i] < 0) break; }
    beats.reverse();
    // 앞뒤의 힘없는 박 자르기
    if (beats.length > 4) {
      const vals = beats.map(b => ls[b]);
      const sm = vals.map((_, i) => {
        let s = 0, w = 0;
        for (let k = -2; k <= 2; k++) { const q = i + k; if (q >= 0 && q < vals.length) { const ww = 1 - Math.abs(k) / 3; s += vals[q] * ww; w += ww; } }
        return s / w;
      });
      const thr = 0.5 * Math.sqrt(sm.reduce((a, b) => a + b * b, 0) / sm.length);
      let s = 0, e = beats.length - 1;
      while (s < e && sm[s] <= thr) s++;
      while (e > s && sm[e] <= thr) e--;
      return beats.slice(s, e + 1).map(b => fTime(F, b));
    }
    return beats.map(b => fTime(F, b));
  }

  // ───────────────────────────── 4. 격자 맞추기
  function lsq(ks, ts, use) {
    let n = 0, sk = 0, st = 0, skk = 0, skt = 0;
    for (let i = 0; i < ks.length; i++) {
      if (!use[i]) continue;
      n++; sk += ks[i]; st += ts[i]; skk += ks[i] * ks[i]; skt += ks[i] * ts[i];
    }
    const den = n * skk - sk * sk;
    if (n < 2 || Math.abs(den) < 1e-12) return null;
    const b = (n * skt - sk * st) / den;
    const a = (st - b * sk) / n;
    return { a, b };
  }

  function beatIndices(beats, T0) {
    const ks = [0];
    for (let i = 1; i < beats.length; i++) ks.push(ks[i - 1] + Math.max(1, Math.round((beats[i] - beats[i - 1]) / T0)));
    return ks;
  }

  // 한 줄 격자 맞추기: Theil–Sen 기울기와 위상 최빈값.
  // 박 추적이 한동안 엇박으로 미끄러져도 주된 박에 붙는다.
  function fitGrid(beats, T0) {
    const n = beats.length;
    if (n < 8) return null;
    const ks = beatIndices(beats, T0);
    const slopes = [];
    const stride = Math.max(1, Math.floor(n * n / 2 / 60000));
    let cnt = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dk = ks[j] - ks[i];
        if (dk < 16) continue;
        if ((cnt++ % stride) !== 0) continue;
        slopes.push((beats[j] - beats[i]) / dk);
      }
    }
    let T = slopes.length ? median(slopes) : T0;
    const ph = beats.map((b, i) => b - T * ks[i]);
    let lo = Infinity, hi = -Infinity;
    for (const p of ph) { if (p < lo) lo = p; if (p > hi) hi = p; }
    const nbin = Math.max(1, Math.ceil((hi - lo) / 0.002) + 1);
    const hist = new Float32Array(nbin);
    for (const p of ph) hist[Math.round((p - lo) / 0.002)] += 1;
    let bestBin = 0, bestV = -1;
    for (let b = 0; b < nbin; b++) {
      let v = 0;
      for (let q = -5; q <= 5; q++) { const bb = b + q; if (bb >= 0 && bb < nbin) v += hist[bb] * (1 - Math.abs(q) / 6); }
      if (v > bestV) { bestV = v; bestBin = b; }
    }
    let a = lo + bestBin * 0.002;
    let use = ph.map(p => Math.abs(p - a) <= 0.03);
    for (let it = 0; it < 3; it++) {
      const f = lsq(ks, beats, use);
      if (!f) break;
      a = f.a; T = f.b;
      use = beats.map((t, i) => Math.abs(t - (a + T * ks[i])) <= 0.03);
    }
    const res = beats.map((t, i) => t - (a + T * ks[i]));
    let inl = 0, ss = 0, firstIn = -1, lastIn = -1;
    for (let i = 0; i < n; i++) if (use[i]) { inl++; ss += res[i] * res[i]; if (firstIn < 0) firstIn = i; lastIn = i; }
    const spread = firstIn >= 0 ? (beats[lastIn] - beats[firstIn]) / Math.max(1e-6, beats[n - 1] - beats[0]) : 0;
    return { a, T, ks, res, inFrac: inl / n, rmsIn: Math.sqrt(ss / Math.max(1, inl)), spread };
  }

  // 온셋 빗으로 위상·주기를 다듬는다
  function refineComb(F, a, T, kFrom, kTo) {
    const envS = gaussSmooth(F.env, 1.5);
    const kc = (kFrom + kTo) / 2;
    const evalAt = (aa, TT) => {
      let s = 0;
      for (let k = kFrom; k <= kTo; k++) {
        const t = aa + k * TT;
        s += sampleAt(envS, tFrame(F, t)) + 0.5 * sampleAt(envS, tFrame(F, t + TT * 0.5));
      }
      return s;
    };
    let bestA = a, bestT = T, best = -Infinity;
    const span = Math.max(1, kTo - kFrom);
    // 주기: 곡 양 끝에서 ±12ms 끌림까지 본다
    const dTmax = 0.024 / span;
    for (let i = -15; i <= 15; i++) {
      const TT = T + dTmax * i / 15;
      for (let da = -T / 6; da <= T / 6; da += 0.002) {
        const aa = a + da - (TT - T) * kc;
        const s = evalAt(aa, TT);
        if (s > best) { best = s; bestA = aa; bestT = TT; }
      }
    }
    let a1 = bestA;
    for (let da = -0.003; da <= 0.003; da += 0.0005) {
      const s = evalAt(bestA + da, bestT);
      if (s > best) { best = s; a1 = bestA + da; }
    }
    return { a: a1, T: bestT };
  }

  // 정박과 반 박 어긋난 쪽 가운데 저역 어택이 확실히 센 쪽을 박으로
  function fixHalfPhase(F, a, T, kFrom, kTo) {
    let on = 0, off = 0;
    for (let k = kFrom; k <= kTo; k++) {
      const f1 = tFrame(F, a + k * T), f2 = tFrame(F, a + (k + 0.5) * T);
      on += maxIn(F.low, f1 - 2, f1 + 2) + 0.5 * maxIn(F.env, f1 - 2, f1 + 2);
      off += maxIn(F.low, f2 - 2, f2 + 2) + 0.5 * maxIn(F.env, f2 - 2, f2 + 2);
    }
    return off > on * 1.2 ? a + T / 2 : a;
  }

  function extendBeats(beats, dur) {
    const n0 = Math.min(4, beats.length - 1);
    const Tfirst = (beats[n0] - beats[0]) / n0;
    while (beats[0] > 0) beats.unshift(beats[0] - Tfirst);
    const nb = beats.length;
    const Tl = (beats[nb - 1] - beats[Math.max(0, nb - 5)]) / Math.min(4, nb - 1);
    while (beats[beats.length - 1] < dur) beats.push(beats[beats.length - 1] + Tl);
    return beats;
  }

  function variableBeats(F, rawBeats, T0) {
    const ks = beatIndices(rawBeats, T0);
    let b = [];
    for (let q = 0; q < rawBeats.length; q++) {
      if (q > 0) {
        const gap = ks[q] - ks[q - 1];
        for (let g = 1; g < gap; g++) b.push(rawBeats[q - 1] + (rawBeats[q] - rawBeats[q - 1]) * g / gap);
      }
      b.push(rawBeats[q]);
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < b.length - 1; i++) b[i] = 0.25 * b[i - 1] + 0.5 * b[i] + 0.25 * b[i + 1];
    }
    b = extendBeats(b, F.duration);
    const ibis = [];
    for (let i = 1; i < b.length; i++) ibis.push(b[i] - b[i - 1]);
    const Tm = median(ibis);
    return { beats: b, mode: 'variable', bpm: 60 / Tm, T: Tm, a: b[0] };
  }

  // 박 목록 후보들(실제 박, 0초부터 끝까지). 고르는 것은 온셋이 얼마나 잘 붙는지로 한다.
  function beatCandidates(F, rawBeats, T0) {
    const dur = F.duration;
    const out = [];
    if (rawBeats.length < 4) {
      const beats = [];
      for (let t = 0; t <= dur + T0; t += T0) beats.push(t);
      return [{ beats, mode: 'fallback', bpm: 60 / T0, T: T0, a: 0 }];
    }
    const fit = fitGrid(rawBeats, T0);
    if (fit && fit.inFrac >= 0.4 && fit.spread >= 0.5) {
      const ks = fit.ks;
      const kFrom = ks[0], kTo = ks[ks.length - 1];
      const r = refineComb(F, fit.a, fit.T, kFrom, kTo);
      r.a = fixHalfPhase(F, r.a, r.T, kFrom, kTo);
      const kStart = Math.floor(-r.a / r.T), kEnd = Math.ceil((dur - r.a) / r.T);
      const grid = [];
      for (let k = kStart; k <= kEnd; k++) grid.push(r.a + k * r.T);
      out.push({ beats: grid, mode: 'constant', bpm: 60 / r.T, T: r.T, a: r.a });
      // 섞기: 들쭉날쭉 어긋난 구간만 추적한 박으로
      const n = rawBeats.length;
      const res = rawBeats.map((t, q) => t - (r.a + r.T * ks[q]));
      const drift = [];
      for (let i = 0; i < n;) {
        if (Math.abs(res[i]) <= 0.035) { i++; continue; }
        let j = i;
        while (j + 1 < n && Math.abs(res[j + 1]) > 0.035) j++;
        if (j - i + 1 >= 6) {
          const seg = res.slice(i, j + 1);
          const m = seg.reduce((s, v) => s + v, 0) / seg.length;
          const sd = Math.sqrt(seg.reduce((s, v) => s + (v - m) * (v - m), 0) / seg.length);
          if (sd > 0.02) drift.push([rawBeats[i], rawBeats[j], i, j]);
        }
        i = j + 1;
      }
      if (drift.length) {
        const beats = [];
        let gi = 0;
        for (const [t0, t1, i0, i1] of drift) {
          while (gi < grid.length && grid[gi] < t0 - r.T * 0.5) beats.push(grid[gi++]);
          for (let q = i0; q <= i1; q++) {
            if (q > i0) {
              const gap = ks[q] - ks[q - 1];
              for (let g = 1; g < gap; g++) beats.push(rawBeats[q - 1] + (rawBeats[q] - rawBeats[q - 1]) * g / gap);
            }
            beats.push(rawBeats[q]);
          }
          while (gi < grid.length && grid[gi] <= t1 + r.T * 0.5) gi++;
        }
        while (gi < grid.length) beats.push(grid[gi++]);
        out.push({ beats, mode: 'hybrid', bpm: 60 / r.T, T: r.T, a: r.a });
      }
    }
    out.push(variableBeats(F, rawBeats, T0));
    return out;
  }

  // 센 온셋이 16분(또는 셋잇단) 자리에서 얼마나 떨어지나: 중앙값(초)
  function alignError(onsets, beats, triplet) {
    const errs = [];
    const step = triplet ? 1 / 3 : 1 / 4;
    for (const o of onsets) {
      if (o.s < 0.35) continue;
      const k = locateBeat(beats, o.t);
      if (k < 0 || k >= beats.length - 1) continue;
      const T = beats[k + 1] - beats[k];
      const pos = (o.t - beats[k]) / T;
      const near = Math.round(pos / step) * step;
      errs.push(Math.abs(pos - near) * T);
    }
    return errs.length ? percentile(errs, 0.6) : 1;
  }

  // ───────────────────────────── 5. 온셋 고르기
  function pickOnsets(F) {
    const env = F.env, fps = F.fps, n = env.length;
    const lm = boxMean(env, Math.round(0.15 * fps));
    const p99 = percentile(env, 0.99) || 1;
    const floor = 0.05 * p99;
    const w = 3;
    const out = [];
    let lastI = -1e9;
    for (let i = w; i < n - w; i++) {
      const v = env[i];
      if (v < floor || v < lm[i] * 1.15 + 0.02 * p99) continue;
      let isMax = true;
      for (let k = 1; k <= w; k++) if (env[i - k] > v || env[i + k] >= v) { isMax = false; break; }
      if (!isMax) continue;
      if (i - lastI < 0.03 * fps) {
        // 너무 가까우면 더 센 것만 남긴다
        const prev = out[out.length - 1];
        if (prev && v > prev.raw) out.pop(); else continue;
      }
      const a = env[i - 1], b = env[i], c = env[i + 1];
      const den = a - 2 * b + c;
      const d = den < 0 ? clamp(0.5 * (a - c) / den, -0.5, 0.5) : 0;
      const fr = i + d;
      out.push({
        i, t: fTime(F, fr) + PEAK_BIAS, raw: v,
        lo: maxIn(F.low, i - 2, i + 2), mi: maxIn(F.mid, i - 2, i + 2), hi: maxIn(F.high, i - 2, i + 2),
        cen: F.cen[i] >= 0 ? F.cen[i] : (F.cen[i - 1] >= 0 ? F.cen[i - 1] : 0.5),
      });
      lastI = i;
    }
    const ref = percentile(out.map(o => o.raw), 0.9) || 1;
    for (const o of out) o.s = o.raw / ref;
    return out;
  }

  // ───────────────────────────── 6. 격자 위의 후보
  function makeGrid(F, beatInfo) {
    let real = beatInfo.beats;
    const bpm = beatInfo.bpm;
    // 유효 박: 느린 곡은 8분을, 아주 빠른 곡은 2박을 한 박처럼 다룬다
    let eff = real, split = 1;
    if (bpm < 105) {
      split = 2;
      eff = [];
      for (let i = 0; i < real.length - 1; i++) { eff.push(real[i]); eff.push((real[i] + real[i + 1]) / 2); }
      eff.push(real[real.length - 1]);
    } else if (bpm >= 215) {
      split = 0.5;
      // 온셋이 더 센 쪽을 남긴다
      let s0 = 0, s1 = 0;
      for (let i = 0; i < real.length; i++) {
        const v = sampleAt(F.env, tFrame(F, real[i]));
        if (i % 2) s1 += v; else s0 += v;
      }
      const par = s1 > s0 ? 1 : 0;
      eff = real.filter((_, i) => i % 2 === par);
    }
    return { eff, split, effBpm: bpm * (split || 1) };
  }

  function detectTriplet(F, eff) {
    const envS = gaussSmooth(F.env, 1);
    const fr = [1 / 4, 1 / 2, 3 / 4, 1 / 3, 2 / 3];
    const acc = [0, 0, 0, 0, 0];
    for (let k = 0; k < eff.length - 1; k++) {
      const a = eff[k], T = eff[k + 1] - a;
      for (let q = 0; q < fr.length; q++) {
        const t = a + fr[q] * T;
        acc[q] += maxIn(envS, tFrame(F, t - 0.012), tFrame(F, t + 0.012));
      }
    }
    const straight = (acc[0] + acc[2]) / 2, trip = (acc[3] + acc[4]) / 2;
    const triplet = trip > straight * 1.3 && acc[4] > acc[1] * 0.9;
    return { triplet, ratio: trip / Math.max(1e-9, straight), acc };
  }

  function locateBeat(eff, t) {
    let lo = 0, hi = eff.length - 1;
    if (t < eff[0]) return -1;
    if (t >= eff[hi]) return hi;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (eff[m] <= t) lo = m; else hi = m; }
    return lo;
  }

  function gridTime(eff, k, j) {
    if (k < 0) return eff[0] - (eff[1] - eff[0]) * (-k - j / TICKS);
    if (k >= eff.length - 1) {
      const T = eff[eff.length - 1] - eff[eff.length - 2];
      return eff[eff.length - 1] + T * (k - (eff.length - 1) + j / TICKS);
    }
    return eff[k] + (eff[k + 1] - eff[k]) * j / TICKS;
  }

  function snapOnsets(onsets, eff, triplet) {
    const allowed = triplet ? [0, 4, 8, 12] : [0, 3, 6, 9, 12];
    const step = triplet ? 4 : 3;
    const map = new Map();
    for (const o of onsets) {
      const k = locateBeat(eff, o.t);
      if (k < 0 || k >= eff.length - 1) continue;
      const T = eff[k + 1] - eff[k];
      const pos = (o.t - eff[k]) / T * TICKS;
      let bj = 0, bd = 1e9;
      for (const j of allowed) { const d = Math.abs(pos - j); if (d < bd) { bd = d; bj = j; } }
      const distSec = bd * T / TICKS;
      const lim = Math.min(0.05, 0.45 * step * T / TICKS);
      if (distSec > lim) continue;
      let kk = k, jj = bj;
      if (jj === TICKS) { kk++; jj = 0; }
      const key = kk * TICKS + jj;
      const prev = map.get(key);
      if (!prev || o.s > prev.s) {
        map.set(key, {
          key, k: kk, j: jj, t: gridTime(eff, kk, jj), s: o.s, raw: o.raw,
          lo: Math.max(o.lo, prev ? prev.lo : 0), mi: Math.max(o.mi, prev ? prev.mi : 0), hi: Math.max(o.hi, prev ? prev.hi : 0),
          cen: o.cen, err: o.t - gridTime(eff, kk, jj),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key - b.key);
  }

  // 곡의 고조(0~1): 소리 크기와 온셋 밀도를 반씩
  function intensityCurve(F) {
    const fps = F.fps;
    const r = Math.round(1.2 * fps);
    const e = boxMean(F.rms, r);
    const a = boxMean(F.env, r);
    const ePct = [percentile(e, 0.1), percentile(e, 0.95)];
    const aPct = [percentile(a, 0.1), percentile(a, 0.95)];
    const out = new Float32Array(F.frames);
    for (let i = 0; i < F.frames; i++) {
      const en = clamp((e[i] - ePct[0]) / Math.max(1e-6, ePct[1] - ePct[0]), 0, 1);
      const an = clamp((a[i] - aPct[0]) / Math.max(1e-6, aPct[1] - aPct[0]), 0, 1);
      out[i] = 0.5 * en + 0.5 * an;
    }
    return out;
  }

  // ───────────────────────────── 7. 단계별 채보
  const DIFFS = [
    { key: 'easy', name: 'EASY', ticks: [[0], [0]], gapBeat: 1.0, gapSec: 0.36, nps: [0.9, 2.1], minS: 0.12, offS: 9, slowOffS: 9, chord2: 0, chord3: 0, holdGap: 2, holdGapSec: 0.7, holdRel: 1, holdMin: 1, holdMinSec: 0.45, holdQ: 0.5, holdCap: 0.2, jackSafe: 0, overlay: 0, maxHolds: 1 },
    { key: 'normal', name: 'NORMAL', ticks: [[0, 6], [0, 8]], gapBeat: 0.5, gapSec: 0.22, nps: [1.7, 3.5], minS: 0.1, offS: 9, slowOffS: 9, chord2: 0.045, chord3: 0, holdGap: 1.5, holdGapSec: 0.55, holdRel: 0.5, holdMin: 1, holdMinSec: 0.35, holdQ: 0.5, holdCap: 0.18, jackSafe: 0.3, overlay: 0, maxHolds: 1 },
    { key: 'hard', name: 'HARD', ticks: [[0, 3, 6, 9], [0, 4, 8]], gapBeat: 0.25, gapSec: 0.1, nps: [2.6, 4.7], minS: 0.08, offS: 0.75, slowOffS: 9, chord2: 0.08, chord3: 0, holdGap: 1, holdGapSec: 0.45, holdRel: 0.5, holdMin: 0.5, holdMinSec: 0.25, holdQ: 0.25, holdCap: 0.15, jackSafe: 0.25, overlay: 0, maxHolds: 1 },
    { key: 'expert', name: 'EXPERT', ticks: [[0, 3, 6, 9], [0, 4, 8]], gapBeat: 0.25, gapSec: 0.085, nps: [4.0, 7.6], minS: 0.06, offS: 0.25, slowOffS: 9, chord2: 0.13, chord3: 0.01, holdGap: 1, holdGapSec: 0.4, holdRel: 0.25, holdMin: 0.5, holdMinSec: 0.22, holdQ: 0.25, holdCap: 0.14, jackSafe: 0.2, overlay: 0.05, maxHolds: 2 },
    { key: 'master', name: 'MASTER', ticks: [[0, 3, 6, 9], [0, 4, 8]], gapBeat: 0.25, gapSec: 0.065, nps: [5.4, 10.4], minS: 0.04, offS: 0, slowOffS: 0.7, chord2: 0.18, chord3: 0.035, holdGap: 0.75, holdGapSec: 0.35, holdRel: 0.25, holdMin: 0.5, holdMinSec: 0.2, holdQ: 0.25, holdCap: 0.12, jackSafe: 0.17, overlay: 0.09, maxHolds: 2 },
  ];

  const TICK_W = { 0: 1.0, 6: 0.8, 3: 0.6, 9: 0.6, 4: 0.75, 8: 0.75 };

  function selectTimes(cands, G, d, prevSel, ctx) {
    const { eff, triplet, inten, F, downPhase, realParity } = ctx;
    const allowed = new Set(d.ticks[triplet ? 1 : 0]);
    const out = [];
    // 2 유효 박씩 묶어 예산을 나눈다
    const byWin = new Map();
    for (const c of cands) {
      if (!allowed.has(c.j)) continue;
      if (c.s < d.minS) continue;
      if ((c.j === 3 || c.j === 9) && c.s < (G.split === 2 ? d.slowOffS : d.offS)) continue;
      const w = Math.floor(c.k / 2);
      if (!byWin.has(w)) byWin.set(w, []);
      byWin.get(w).push(c);
    }
    const effBpm = G.effBpm;
    const tempoF = clamp(Math.pow(effBpm / 150, 0.6), 0.75, 1.3);
    let carry = 0;
    let lastT = -1e9;
    const wins = Array.from(byWin.keys()).sort((a, b) => a - b);
    let prevW = null;
    for (const w of wins) {
      if (prevW !== null && w - prevW > 1) carry = Math.min(carry, 0.5);
      prevW = w;
      const list = byWin.get(w);
      const t0 = gridTime(eff, w * 2, 0), t1 = gridTime(eff, w * 2 + 2, 0);
      const I = inten[clamp(Math.round(tFrame(F, (t0 + t1) / 2)), 0, inten.length - 1)];
      const target = (d.nps[0] + (d.nps[1] - d.nps[0]) * Math.pow(I, 1.15)) * tempoF;
      carry += target * (t1 - t0);
      const budget = Math.floor(carry + 1e-9);
      if (budget <= 0) continue;
      const T = (t1 - t0) / 2;
      const gap = Math.max(d.gapBeat * T, d.gapSec) - 1e-4;
      const scored = list.map(c => {
        let sc = c.s * TICK_W[c.j];
        if (c.j === 0) {
          const realBeat = G.split === 2 ? ((c.k - realParity) % 2 === 0) : true;
          if (realBeat) sc *= 1.12;
          const barBeat = G.split === 2 ? ((c.k - realParity) / 2) : c.k;
          if ((((barBeat - downPhase) % 4) + 4) % 4 === 0) sc *= 1.1;
        }
        if (prevSel && prevSel.has(c.key)) sc *= 1.45;
        return { c, sc };
      }).sort((a, b) => b.sc - a.sc);
      const chosen = [];
      for (const { c } of scored) {
        if (chosen.length >= budget) break;
        if (c.t - lastT < gap) continue;
        let ok = true;
        for (const u of chosen) if (Math.abs(u.t - c.t) < gap) { ok = false; break; }
        if (ok) chosen.push(c);
      }
      chosen.sort((a, b) => a.t - b.t);
      for (const c of chosen) out.push(c);
      if (chosen.length) lastT = chosen[chosen.length - 1].t;
      carry -= chosen.length;
      if (carry > 2) carry = 2;
    }
    return out;
  }

  // 소리가 이어지는지: 기준보다 7dB 넘게 떨어지지 않는 프레임 비율
  function sustainInfo(F, a, b) {
    const fa = Math.max(0, Math.floor(tFrame(F, a)));
    const fRef = Math.min(F.frames - 1, Math.ceil(tFrame(F, a + 0.09)));
    const fb = Math.min(F.frames - 1, Math.floor(tFrame(F, b)));
    let ref = -200;
    for (let i = fa; i <= fRef; i++) if (F.midDb[i] > ref) ref = F.midDb[i];
    let ok = 0, tot = 0, end = b, run = 0, ended = false;
    for (let i = fRef; i <= fb; i++) {
      tot++;
      if (F.midDb[i] >= ref - 7) { ok++; run = 0; }
      else {
        run++;
        if (!ended && run >= 6) { ended = true; end = fTime(F, i - run); }
      }
    }
    return { frac: tot ? ok / tot : 0, end: ended ? end : b };
  }

  // 중역의 새 어택이 약한 채로 소리가 얼마나 이어지나(보컬 롱톤 같은 것)
  function overlaySustain(F, t, maxT, refMid) {
    const f0 = Math.ceil(tFrame(F, t + 0.07));
    const f1 = Math.min(F.frames - 1, Math.floor(tFrame(F, maxT)));
    let ref = -200;
    for (let i = Math.max(0, f0 - 12); i <= f0; i++) if (F.midDb[i] > ref) ref = F.midDb[i];
    let i = f0;
    for (; i <= f1; i++) {
      if (F.midDb[i] < ref - 6) break;
      if (F.mid[i] > refMid * 0.55) break;
    }
    return fTime(F, i);
  }

  function rateLevel(notes, dur) {
    if (!notes.length) return 1;
    const times = [];
    for (const n of notes) times.push(n.t);
    const first = times[0], last = times[times.length - 1];
    const span = Math.max(10, last - first);
    const avg = notes.length / span;
    // 2초 창의 밀도
    const dens = [];
    let j0 = 0, j1 = 0;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      while (times[j0] < t - 1) j0++;
      while (j1 < times.length && times[j1] <= t + 1) j1++;
      dens.push((j1 - j0) / 2);
    }
    const peak = percentile(dens, 0.9);
    const stamps = new Map();
    for (const n of notes) stamps.set(n.t.toFixed(3), (stamps.get(n.t.toFixed(3)) || 0) + 1);
    let chords = 0;
    for (const v of stamps.values()) if (v > 1) chords++;
    const chordR = chords / Math.max(1, stamps.size);
    const holdR = notes.filter(n => n.e).length / notes.length;
    const lv = 1.05 * Math.pow(peak, 0.97) + 0.4 * avg + 6 * chordR + 1.5 * holdR + 0.3;
    rateLevel.last = { peak, avg, chordR, holdR, lv };
    return clamp(Math.round(lv), 1, 15);
  }

  function assignLanes(sel, d, rng, ctx) {
    // sel: [{t, c, size, hold:{end}|null}] 시간순
    const lastIn = [-1e9, -1e9, -1e9, -1e9];
    const holdTo = [-1e9, -1e9, -1e9, -1e9];
    const notes = [];
    let prevLanes = [], prevT = -1e9, prevZ = 0;
    const hist = [];
    // 음높이 흐름: 이웃 후보 대비 상대 위치
    const cens = sel.map(s => s.c.cen);
    const zs = cens.map((v, i) => {
      let s = 0, s2 = 0, n = 0;
      for (let k = Math.max(0, i - 8); k <= Math.min(cens.length - 1, i + 8); k++) { s += cens[k]; s2 += cens[k] * cens[k]; n++; }
      const m = s / n, sd = Math.sqrt(Math.max(1e-6, s2 / n - m * m));
      return clamp((v - m) / Math.max(0.04, sd), -2.5, 2.5);
    });
    const handOf = l => (l < 2 ? 0 : 1);
    for (let i = 0; i < sel.length; i++) {
      const s = sel[i];
      const t = s.c.t;
      const z = zs[i];
      const free = [0, 1, 2, 3].filter(l => holdTo[l] < t - 0.03);
      if (!free.length) continue;
      const size = Math.min(s.size, free.length);
      const desired = 1.5 + 2.1 * Math.tanh(0.75 * z);
      const dz = z - prevZ;
      const dt = t - prevT;
      const laneCost = l => {
        let c = 0.55 * Math.abs(l - desired);
        const since = t - lastIn[l];
        if (d.jackSafe > 0 && since < d.jackSafe) c += 3.2 * (1 - since / d.jackSafe) + 0.8;
        if (prevLanes.includes(l)) c += dt < 0.5 ? 0.9 : 0.45;
        if (prevLanes.length === 1 && Math.abs(dz) > 0.35) {
          const dir = Math.sign(dz);
          if ((l - prevLanes[0]) * dir < 0) c += 0.7;
        }
        if (dt < 0.17 && prevLanes.length && prevLanes.every(p => handOf(p) === handOf(l))) c += 0.75;
        // 같은 손만 오래 쓰지 않게
        if (hist.length >= 3 && dt < 0.3) {
          const h = hist.slice(-3).map(handOf);
          if (h.every(x => x === handOf(l))) c += 0.6;
        }
        // 똑같은 무늬의 되풀이를 조금 깎는다
        if (hist.length >= 4 && hist[hist.length - 2] === l && hist[hist.length - 4] === l && hist[hist.length - 1] === hist[hist.length - 3]) c += 0.35;
        return c + 0.38 * rng();
      };
      let lanes;
      if (size === 1) {
        let best = 1e9, bl = free[0];
        for (const l of free) { const c = laneCost(l); if (c < best) { best = c; bl = l; } }
        lanes = [bl];
      } else {
        const combos = [];
        const pick = (start, acc) => {
          if (acc.length === size) { combos.push(acc.slice()); return; }
          for (let q = start; q < free.length; q++) { acc.push(free[q]); pick(q + 1, acc); acc.pop(); }
        };
        pick(0, []);
        let best = 1e9;
        lanes = combos[0];
        for (const cb of combos) {
          let c = 0;
          for (const l of cb) c += laneCost(l);
          if (size === 2) {
            if (handOf(cb[0]) !== handOf(cb[1])) c -= 0.5;
            else if (dt < 0.25) c += 0.4;
          }
          if (c < best) { best = c; lanes = cb; }
        }
      }
      for (let q = 0; q < lanes.length; q++) {
        const l = lanes[q];
        const note = { t, l };
        if (s.hold && q === 0) {
          note.e = s.hold;
          holdTo[l] = s.hold;
          lastIn[l] = s.hold;
        } else {
          lastIn[l] = t;
        }
        notes.push(note);
        hist.push(l);
        if (hist.length > 12) hist.shift();
      }
      prevLanes = lanes;
      prevT = t;
      prevZ = z;
    }
    notes.sort((a, b) => a.t - b.t || a.l - b.l);
    return notes;
  }

  function buildChart(cands, G, d, prevSel, ctx, rng) {
    const { F, eff } = ctx;
    const picked = selectTimes(cands, G, d, prevSel, ctx);
    if (!picked.length) return { notes: [], keys: new Set() };
    const keys = new Set(picked.map(c => c.key));
    // 동시치기: 강세 순위(곡 전체가 아니라 주변 대비 강세로 매겨 한 구간에 몰리지 않게)
    const accent = picked.map(c => {
      const tot = c.lo + c.mi + c.hi + 1e-9;
      let a = c.s * (1 + 0.7 * c.lo / tot + 0.35 * c.hi / tot);
      if (c.j === 0) a *= 1.15;
      return a;
    });
    const rel = accent.map((a, i) => {
      let s = 0, n = 0;
      for (let q = i - 1; q >= 0 && picked[i].t - picked[q].t < 4; q--) { s += accent[q]; n++; }
      for (let q = i + 1; q < picked.length && picked[q].t - picked[i].t < 4; q++) { s += accent[q]; n++; }
      return a / Math.sqrt(Math.max(1e-6, n ? s / n : a));
    });
    const order = picked.map((_, i) => i).sort((x, y) => rel[y] - rel[x]);
    const size = picked.map(() => 1);
    const n2 = Math.round(picked.length * d.chord2), n3 = Math.round(picked.length * d.chord3);
    let given2 = 0, given3 = 0;
    // 한계는 실제 박(느린 곡의 8분 유효 박이 아니라)과 초 가운데 큰 쪽으로
    const lim = {
      normal: { gapB: 2, gapS: 0.8, winS: 0.8, win: 1, tri: 99, triS: 99 },
      hard: { gapB: 1, gapS: 0.4, winS: 0.8, win: 2, tri: 99, triS: 99 },
      expert: { gapB: 1, gapS: 0.3, winS: 0.8, win: 2, tri: 4, triS: 1.6 },
      master: { gapB: 0.5, gapS: 0.22, winS: 0.8, win: 3, tri: 2, triS: 0.8 },
    }[d.key] || { gapB: 2, gapS: 0.8, winS: 0.8, win: 1, tri: 99, triS: 99 };
    const chordTimes = [], triTimes = [];
    for (const i of order) {
      if (given2 + given3 >= n2 + n3) break;
      const c = picked[i];
      const T = gridTime(eff, c.k + 1, 0) - gridTime(eff, c.k, 0);
      const TR = T * G.split;
      const prevGap = i > 0 ? c.t - picked[i - 1].t : 9;
      const nextGap = i < picked.length - 1 ? picked[i + 1].t - c.t : 9;
      const need = d.key === 'normal' ? Math.max(T * 0.99, 0.3) : d.key === 'hard' ? Math.max(T * 0.49, 0.18) : Math.max(T * 0.24, 0.12);
      if (Math.min(prevGap, nextGap) < need) continue;
      if (d.key === 'normal' && c.j !== 0) continue;
      if (d.key !== 'master' && c.j !== 0 && c.j !== 6 && c.j !== 4 && c.j !== 8) continue;
      const gapNeed = Math.max(lim.gapB * TR, lim.gapS) - 1e-4;
      if (chordTimes.some(u => Math.abs(u - c.t) < gapNeed)) continue;
      const winR = Math.max(2 * TR, lim.winS);
      if (chordTimes.filter(u => Math.abs(u - c.t) < winR).length >= lim.win) continue;
      const triGap = Math.max(lim.tri * TR, lim.triS) - 1e-4;
      const triOk = given3 < n3 && c.j === 0 && Math.min(prevGap, nextGap) >= Math.max(T * 0.49, 0.2) && !triTimes.some(u => Math.abs(u - c.t) < triGap);
      if (triOk) { size[i] = 3; given3++; triTimes.push(c.t); }
      else if (given2 < n2) { size[i] = 2; given2++; }
      else continue;
      chordTimes.push(c.t);
    }
    // 롱노트: 다음 노트까지 비고 소리가 이어지면
    const holds = picked.map(() => null);
    const holdCands = [];
    for (let i = 0; i < picked.length - 1; i++) {
      const c = picked[i], nx = picked[i + 1];
      const T = gridTime(eff, c.k + 1, 0) - gridTime(eff, c.k, 0);
      const gapB = (nx.t - c.t) / T;
      if (gapB < d.holdGap || nx.t - c.t < d.holdGapSec) continue;
      const si = sustainInfo(F, c.t, nx.t);
      if (si.frac < 0.8) continue;
      // 끝: 다음 노트 holdRel 박 전, 소리가 끊기는 곳을 넘지 않게, holdQ 박 단위로
      const limitB = Math.min(gapB - d.holdRel, (si.end - c.t) / T);
      const lenB = Math.floor(limitB / d.holdQ + 1e-6) * d.holdQ;
      if (lenB < d.holdMin || lenB * T < d.holdMinSec) continue;
      const endPos = c.k * TICKS + c.j + Math.round(lenB * TICKS);
      const end = gridTime(eff, Math.floor(endPos / TICKS), endPos % TICKS);
      holdCands.push({ i, end, score: si.frac * lenB });
    }
    // 겹쳐 흐르는 롱노트(어려운 단계): 보컬 롱톤처럼 중역이 길게 남는 곳
    if (d.overlay > 0) {
      const want = Math.round(picked.length * d.overlay);
      const ov = [];
      for (let i = 0; i < picked.length - 1; i++) {
        const c = picked[i];
        if (size[i] >= 3) continue;
        if (!(c.mi >= Math.max(c.lo, c.hi) * 0.9)) continue;
        if (c.j % 6 !== 0) continue;
        const T = gridTime(eff, c.k + 1, 0) - gridTime(eff, c.k, 0);
        const until = overlaySustain(F, c.t, c.t + 4 * T, c.mi);
        const lenB = Math.floor((until - c.t) / T / 0.5 + 1e-6) * 0.5;
        if (lenB < 1) continue;
        const endPos = c.k * TICKS + c.j + Math.round(Math.min(4, lenB) * TICKS);
        const end = gridTime(eff, Math.floor(endPos / TICKS), endPos % TICKS);
        ov.push({ i, end, score: c.s * lenB });
      }
      ov.sort((a, b) => b.score - a.score);
      for (const h of ov.slice(0, want)) holdCands.push(h);
    }
    holdCands.sort((a, b) => b.score - a.score);
    const capN = Math.round(picked.length * d.holdCap);
    let nh = 0;
    // 동시에 살아 있는 롱노트 수를 지킨다
    const active = [];
    for (const h of holdCands) {
      if (nh >= capN) break;
      if (holds[h.i]) continue;
      const t = picked[h.i].t;
      const overlapping = active.filter(a => a.s < h.end && a.e > t).length;
      if (overlapping >= d.maxHolds) continue;
      // 롱노트 동안 들어오는 동시치기가 레인을 넘치지 않게
      let tooBusy = false;
      for (let q = h.i + 1; q < picked.length && picked[q].t < h.end; q++) if (size[q] + 1 + overlapping > 4) { tooBusy = true; break; }
      if (tooBusy) continue;
      holds[h.i] = h.end;
      active.push({ s: t, e: h.end });
      nh++;
    }
    const sel = picked.map((c, i) => ({ c, size: size[i], hold: holds[i] }));
    const notes = assignLanes(sel, d, rng, ctx);
    return { notes, keys };
  }

  // ───────────────────────────── 전체
  function analyze(x, sr, opt) {
    opt = opt || {};
    const prog = opt.onProgress || (() => {});
    if (sr !== SR) throw new Error('analyzer expects ' + SR + 'Hz mono');
    prog('features');
    const F = extract(x, sr);
    prog('tempo');
    const tempo = estimateTempo(F);
    // 박 추적은 유효 박 범위(105~210)로 접어서 한다
    let trackBpm = tempo.bpm;
    while (trackBpm < 90) trackBpm *= 2;
    while (trackBpm > 220) trackBpm /= 2;
    const period = F.fps * 60 / trackBpm;
    const raw = trackBeats(F, period);
    const onsets = pickOnsets(F);
    const options = beatCandidates(F, raw, 60 / trackBpm);
    for (const b of options) for (let i = 0; i < b.beats.length; i++) b.beats[i] += GRID_BIAS;
    // 일정한 격자를 먼저 믿되, 흔들리는 곡이면 온셋이 확실히 더 잘 붙는 쪽으로
    const scored = options.map(b => {
      const G0 = makeGrid(F, b);
      const tr = detectTriplet(F, G0.eff);
      return { b, err: alignError(onsets, G0.eff, tr.triplet) };
    });
    let pick = scored[0];
    for (const c of scored.slice(1)) if (c.err < pick.err * 0.75 && pick.err - c.err > 0.003) pick = c;
    const bl = pick.b;
    {
      // 센 온셋이 격자 한가운데 오도록 전체를 살짝 민다(±15ms 안)
      const G0 = makeGrid(F, bl);
      const errs = [];
      for (const o of onsets) {
        if (o.s < 0.35) continue;
        const k = locateBeat(G0.eff, o.t);
        if (k < 0 || k >= G0.eff.length - 1) continue;
        const T = G0.eff[k + 1] - G0.eff[k];
        const pos = (o.t - G0.eff[k]) / T;
        const e = (pos - Math.round(pos * 4) / 4) * T;
        if (Math.abs(e) < 0.03) errs.push(e);
      }
      if (errs.length > 20) {
        const sh = clamp(median(errs), -0.015, 0.015);
        for (let i = 0; i < bl.beats.length; i++) bl.beats[i] += sh;
      }
    }
    const G = makeGrid(F, bl);
    const eff = G.eff;
    prog('grid');
    const trip = detectTriplet(F, eff);
    const cands = snapOnsets(onsets, eff, trip.triplet);
    // 정박 위상(마디 첫 박): 저역 어택이 가장 센 쪽
    const realBeats = bl.beats;
    const ph = [0, 0, 0, 0];
    for (let i = 0; i < realBeats.length; i++) {
      const f = tFrame(F, realBeats[i]);
      ph[i % 4] += maxIn(F.low, f - 3, f + 3) + 0.3 * maxIn(F.env, f - 3, f + 3);
    }
    let downReal = 0;
    for (let i = 1; i < 4; i++) if (ph[i] > ph[downReal]) downReal = i;
    // 유효 박 기준으로 바꾼다
    let realParity = 0, downPhase = downReal;
    if (G.split === 2) {
      // eff[2i] = real[i]
      realParity = 0;
      downPhase = downReal;
    } else if (G.split === 0.5) {
      downPhase = 0;
    }
    const inten = intensityCurve(F);
    const seed = (hashFloats(x) ^ Math.round(F.duration * 1000)) >>> 0;
    const ctx = { F, eff, triplet: trip.triplet, inten, downPhase, realParity };
    const charts = [];
    let prevKeys = null;
    prog('charts');
    for (let di = 0; di < DIFFS.length; di++) {
      const d = DIFFS[di];
      const rng = mulberry32(seed + di * 7919);
      const res = buildChart(cands, G, d, prevKeys, ctx, rng);
      prevKeys = res.keys;
      const notes = res.notes.map(n => n.e ? { t: +n.t.toFixed(4), l: n.l, e: +n.e.toFixed(4) } : { t: +n.t.toFixed(4), l: n.l });
      charts.push({ key: d.key, name: d.name, level: rateLevel(notes, F.duration), notes });
    }
    // 마디선(실제 박 기준 4박마다)
    const bars = [];
    for (let i = downReal; i < realBeats.length; i += 4) if (realBeats[i] >= 0 && realBeats[i] <= F.duration) bars.push(+realBeats[i].toFixed(4));
    const errs = cands.filter(c => c.s > 0.5).map(c => c.err);
    const energy = [];
    for (let i = 0; i < 240; i++) energy.push(+inten[Math.round(i / 239 * (inten.length - 1))].toFixed(3));
    return {
      version: VERSION,
      duration: F.duration,
      bpm: Math.round(bl.bpm * 10) / 10,
      tempoRaw: Math.round(tempo.bpm * 10) / 10,
      gridMode: bl.mode,
      triplet: trip.triplet,
      bars,
      energy,
      stats: { grids: scored.map(c => c.b.mode + ':' + Math.round(c.err * 1000)).join(' '), onsets: onsets.length, candidates: cands.length, snapErrMs: Math.round(median(errs.map(Math.abs)) * 1000), meanErrMs: errs.length ? Math.round(errs.reduce((a, b) => a + b, 0) / errs.length * 1000) : 0 },
      charts,
    };
  }

  // 브라우저: AudioBuffer → 22050Hz 모노
  async function toMono(buffer) {
    const len = Math.max(1, Math.ceil(buffer.duration * SR));
    const Off = (typeof OfflineAudioContext !== 'undefined') ? OfflineAudioContext : root.webkitOfflineAudioContext;
    const off = new Off(1, len, SR);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start(0);
    const out = await off.startRendering();
    return out.getChannelData(0);
  }

  async function analyzeBuffer(buffer, onProgress) {
    const tick = () => new Promise(r => setTimeout(r, 0));
    onProgress && onProgress('resample');
    await tick();
    const x = await toMono(buffer);
    await tick();
    return analyze(x, SR, { onProgress });
  }

  const api = { VERSION, SR, DIFFS, analyze, analyzeBuffer, toMono, extract, estimateTempo, trackBeats, rateLevel, _internal: { pickOnsets, beatCandidates, makeGrid, detectTriplet, snapOnsets } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analyzer = api;
})(typeof window !== 'undefined' ? window : globalThis);
