/* STARLANE 4K — 화면과 흐름
 * 곡 넣기(분석 대기열) → 곡 고르기(미리듣기) → 게임 → 결과.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const DIFF_KEYS = ['easy', 'normal', 'hard', 'expert', 'master'];
  const DIFF_NAMES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];
  const DIFF_COL = { easy: '#7ee0a5', normal: '#6cc4ff', hard: '#ffc15e', expert: '#ff7b8a', master: '#c99bff' };
  const MEDIA_EXT = /\.(mp4|m4v|webm|mkv|mov|ogv|mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i;
  const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|mov|ogv)$/i;
  const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

  const DEFAULTS = { speed: 4.5, offset: 0, bg: 40, lane: 72, vol: 80, hit: 0, keys: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'] };
  const settings = Store.loadJSON('starlane.settings', DEFAULTS);
  if (!Array.isArray(settings.keys) || settings.keys.length !== 4) settings.keys = DEFAULTS.keys.slice();
  const best = Store.loadJSON('starlane.best', {});
  const gameSettings = {};
  function syncGameSettings() {
    gameSettings.speed = settings.speed;
    gameSettings.offset = settings.offset;
    gameSettings.lane = settings.lane / 100;
    gameSettings.vol = settings.vol / 100;
    gameSettings.hit = settings.hit / 100;
    gameSettings.keys = settings.keys;
    document.documentElement.style.setProperty('--bg-op', String(settings.bg / 100));
  }
  syncGameSettings();

  const state = {
    songs: [],            // 화면에 보이는 순서
    sel: 0,
    diff: 2,
    screen: 'select',     // select | loading | game | result
    queue: [],
    working: false,
    lastPlay: null,       // { song, diffIndex, buffer }
    demoBuffer: null,
  };
  const urls = new Map();
  let ac = null;

  function ensureAC() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC({ latencyHint: 'interactive' });
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  // ───────────────────────── 알림
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 2600);
  }

  // ───────────────────────── 별 배경
  const stars = (() => {
    const c = $('bgStars'), g = c.getContext('2d');
    let W = 0, H = 0, pts = [], last = 0, pulse = 0;
    function resize() {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      let s = 3;
      const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      pts = [];
      const n = Math.round(clamp(W * H / 7000, 80, 260));
      for (let i = 0; i < n; i++) pts.push({ x: r() * W, y: r() * H, z: r(), tw: r() * 6.28, sp: 0.4 + r() * 1.2 });
    }
    function frame(ts) {
      requestAnimationFrame(frame);
      if (ts - last < 33) return;
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      // 게임 중에는 박에 맞춰 살짝 밝아진다
      let beat = 0;
      if (Game.active && Game.analysis && !Game.hasVideo) {
        const t = Game.now(performance.now());
        const bars = Game.analysis.bars;
        if (bars && bars.length > 1) {
          const T = (bars[1] - bars[0]) / 4;
          const ph = ((t - bars[0]) / T) % 1;
          beat = ph >= 0 ? Math.pow(1 - ph, 3) : 0;
        }
      }
      pulse = pulse * 0.8 + beat * 0.2;
      g.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.y += p.sp * (8 + p.z * 22) * dt;
        if (p.y > H + 2) { p.y = -2; }
        p.tw += dt * p.sp * 2;
        const a = (0.25 + 0.5 * p.z) * (0.75 + 0.25 * Math.sin(p.tw)) + pulse * 0.35 * p.z;
        const sz = 0.6 + p.z * 1.6;
        g.fillStyle = p.z > 0.85 ? `rgba(247,164,211,${a})` : p.z > 0.7 ? `rgba(107,230,247,${a})` : `rgba(238,240,255,${a})`;
        g.fillRect(p.x, p.y, sz, sz);
      }
      // 영상이 없는 곡: 박에 맞춰 숨 쉬는 무대 조명
      if (Game.active && !Game.hasVideo) {
        const k = 0.06 + pulse * 0.16;
        const sway = Math.sin(ts / 2600) * W * 0.08;
        for (const [x, rgb] of [[W * 0.18 + sway, '107,230,247'], [W * 0.82 - sway, '247,164,211']]) {
          const gr = g.createRadialGradient(x, H * 1.05, 0, x, H * 1.05, H * 0.95);
          gr.addColorStop(0, `rgba(${rgb},${k})`);
          gr.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = gr;
          g.fillRect(0, 0, W, H);
        }
      }
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
    return { resize };
  })();

  // ───────────────────────── 곡 목록
  function fmtTime(s) {
    if (!isFinite(s)) return '–';
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }

  function songNo(i) { return 'M' + String(i + 1).padStart(2, '0'); }

  function cleanTitle(name) {
    let t = name.replace(/\.[^.]+$/, '');
    t = t.replace(/\s*\[[A-Za-z0-9_-]{11}\]\s*$/, '');     // yt-dlp가 붙이는 영상 ID
    t = t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return t || name;
  }

  const jackets = new Map();
  function jacketFor(title) {
    if (jackets.has(title)) return jackets.get(title);
    const url = drawJacket(title);
    jackets.set(title, url);
    return url;
  }

  function drawJacket(title) {
    let h = 0;
    for (const ch of title) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const hue = h % 360, hue2 = (hue + 50 + (h >> 9) % 80) % 360;
    const gr = g.createLinearGradient(0, 0, 160, 160);
    gr.addColorStop(0, `hsl(${hue} 55% 22%)`); gr.addColorStop(1, `hsl(${hue2} 60% 30%)`);
    g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
    g.fillStyle = 'rgba(255,255,255,.1)';
    for (let i = 0; i < 4; i++) g.fillRect(28 + i * 26 + 2, 0, 22, 160);
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.font = '700 64px "IBM Plex Sans KR", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(Array.from(title)[0] || '♪', 80, 84);
    return c.toDataURL('image/png');
  }

  function renderList() {
    const ul = $('songList');
    const frag = document.createDocumentFragment();
    state.songs.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'song' + (i === state.sel ? ' sel' : '');
      li.dataset.i = i;
      const no = document.createElement('span'); no.className = 'no'; no.textContent = songNo(i);
      const img = document.createElement('img'); img.className = 'jk'; img.alt = ''; img.src = s.thumb || jacketFor(s.title);
      const tt = document.createElement('div'); tt.className = 'tt';
      const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = s.title;
      const meta = document.createElement('div'); meta.className = 'meta';
      const right = document.createElement('div');
      if (s.state === 'busy' || s.state === 'wait') {
        meta.textContent = s.progress || '분석 대기';
        const bar = document.createElement('div'); bar.className = 'bar'; bar.appendChild(document.createElement('i'));
        tt.append(nm, meta, bar);
        right.className = 'busy'; right.textContent = s.state === 'busy' ? '분석 중' : '대기';
      } else if (s.state === 'error') {
        meta.className = 'err'; meta.textContent = s.error || '분석하지 못했습니다';
        tt.append(nm, meta);
      } else {
        const a = s.analysis;
        meta.textContent = a ? `${fmtTime(a.duration)} · BPM ${a.bpm}${s.kind === 'video' || s.bgKind === 'video' ? ' · 영상' : ''}` : '';
        tt.append(nm, meta);
        if (a) {
          right.className = 'lvs';
          right.title = '난이도별 레벨 (EASY → MASTER)';
          for (const c of a.charts) { const b = document.createElement('span'); b.textContent = c.level; b.style.color = DIFF_COL[c.key]; right.appendChild(b); }
        }
      }
      li.append(no, img, tt, right);
      frag.appendChild(li);
    });
    ul.replaceChildren(frag);
    const ready = state.songs.filter(s => s.analysis).length;
    $('songCount').textContent = `${state.songs.length}곡` + (ready < state.songs.length ? ` · ${state.songs.length - ready}곡 분석 중` : '');
  }

  function scrollSelIntoView() {
    const el = $('songList').children[state.sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function current() { return state.songs[state.sel]; }

  function renderDetail() {
    const s = current();
    if (!s) return;
    $('dNo').textContent = songNo(state.sel) + (s.demo ? ' · 연습곡' : '');
    $('dTitle').textContent = s.title;
    $('dJacket').src = s.thumb || jacketFor(s.title);
    const a = s.analysis;
    const facts = [];
    if (a) {
      facts.push(`<span>BPM <b>${a.bpm}</b></span>`);
      facts.push(`<span>길이 <b>${fmtTime(a.duration)}</b></span>`);
      facts.push(`<span>박 <b>${a.gridMode === 'constant' ? '고정 템포' : a.gridMode === 'hybrid' ? '고정+일부 흔들림' : '흔들리는 템포'}</b></span>`);
      if (a.triplet) facts.push('<span>리듬 <b>셋잇단(셔플)</b></span>');
      facts.push(`<span>배경 <b>${s.kind === 'video' || s.bgKind === 'video' ? '영상' : s.bgKind === 'image' ? '그림' : '별빛'}</b></span>`);
    } else if (s.state === 'error') {
      facts.push(`<span>${escapeHtml(s.error || '분석하지 못했습니다')}</span>`);
    } else {
      facts.push(`<span>${escapeHtml(s.progress || '분석 대기')}…</span>`);
    }
    $('dFacts').innerHTML = facts.join('');
    $('renameBtn').hidden = !!s.demo;
    $('delBtn').hidden = !!s.demo;
    $('reBtn').hidden = !!s.demo || s.state === 'busy' || s.state === 'wait';
    $('delBtn').textContent = '지우기';
    $('delBtn').dataset.arm = '';
    $('renameBox').hidden = true;
    $('dTitle').hidden = false;

    const wrap = $('diffs');
    const frag = document.createDocumentFragment();
    DIFF_KEYS.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'diff' + (i === state.diff ? ' sel' : '');
      b.dataset.k = k; b.dataset.i = i;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === state.diff ? 'true' : 'false');
      const ch = a && a.charts[i];
      const bs = best[s.id] && best[s.id][k];
      b.innerHTML = `<span class="dn">${DIFF_NAMES[i]}</span><span class="dl">${ch ? ch.level : '–'}</span>` +
        `<span class="dc">${ch ? ch.notes.length + ' 노트' : ''}</span>` +
        `<span class="db">${bs ? bs.rank + (bs.ap ? ' · AP' : bs.fc ? ' · FC' : '') : ''}</span>`;
      frag.appendChild(b);
    });
    wrap.replaceChildren(frag);
    drawDensity();
    const ok = !!a;
    $('startBtn').disabled = !ok;
    $('startBtn').style.opacity = ok ? '' : '.5';
    renderKeyCaps();
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function prepCanvas(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 300, h = c.clientHeight || 64;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  // 곡의 세기(회색 면) 위에 고른 난이도의 노트 밀도(색 막대)
  function drawDensity() {
    const { g, w, h } = prepCanvas($('density'));
    const s = current();
    const a = s && s.analysis;
    if (!a) { $('gRight').textContent = ''; $('gAxis').textContent = ''; return; }
    const ch = a.charts[state.diff];
    const col = DIFF_COL[ch.key];
    const dur = a.duration || 1;
    const base = h - 4, top = 6;
    if (a.energy && a.energy.length) {
      const E = a.energy;
      g.beginPath();
      g.moveTo(0, base);
      for (let i = 0; i < E.length; i++) g.lineTo(i / (E.length - 1) * w, base - (base - top) * E[i]);
      g.lineTo(w, base);
      g.closePath();
      g.fillStyle = 'rgba(143,151,198,.22)';
      g.fill();
      g.strokeStyle = 'rgba(143,151,198,.55)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < E.length; i++) { const x = i / (E.length - 1) * w, y = base - (base - top) * E[i]; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    const nb = Math.max(20, Math.min(160, Math.round(w / 5)));
    const per = dur / nb;
    const npsOf = notes => {
      const bins = new Array(nb).fill(0);
      for (const n of notes) bins[Math.min(nb - 1, Math.floor(n.t / dur * nb))]++;
      return bins.map(v => v / per);
    };
    const nps = npsOf(ch.notes);
    // 모든 난이도를 MASTER의 최고 밀도에 맞춘 같은 눈금으로 그려, 난이도를 바꾸면 높이가 달라 보이게
    const topN = Math.max(4, ...npsOf(a.charts[4].notes));
    const bw = w / nb;
    for (let i = 0; i < nb; i++) {
      const bh = (base - top) * nps[i] / topN * 0.92;
      if (bh <= 0) continue;
      g.fillStyle = col;
      g.globalAlpha = 0.85;
      g.fillRect(i * bw + bw * 0.2, base - bh, Math.max(1, bw * 0.6), bh);
    }
    g.globalAlpha = 1;
    // 분 눈금
    g.fillStyle = 'rgba(255,255,255,.12)';
    for (let m = 60; m < dur; m += 60) g.fillRect(Math.round(m / dur * w), top, 1, base - top);
    const holds = ch.notes.filter(n => n.e).length;
    const seen = new Set(), chords = new Set();
    for (const n of ch.notes) { const k = n.t.toFixed(3); if (seen.has(k)) chords.add(k); seen.add(k); }
    $('gLeft').textContent = '곡 분석';
    $('gRight').textContent = `${ch.name} · 노트 ${ch.notes.length} · 롱노트 ${holds} · 동시치기 ${chords.size} · 최고 ${Math.max(...nps).toFixed(1)}/초`;
    $('lgN').textContent = `노트 밀도(${ch.name})`;
    $('lgN').style.setProperty('--lg', col);
    $('gAxis').textContent = `0:00 ─ ${fmtTime(dur)}`;
    drawRoll();
  }

  // 후렴(노트가 가장 빽빽한 곳)부터 4마디를 옆으로 펼쳐 보인다. 위에서부터 D F J K.
  function drawRoll() {
    const { g, w, h } = prepCanvas($('roll'));
    const s = current();
    const a = s && s.analysis;
    if (!a) { $('rollRight').textContent = ''; return; }
    const ch = a.charts[state.diff];
    const hook = hookTime(s);
    const bars = a.bars || [];
    let bi = 0;
    for (let i = 0; i < bars.length; i++) if (bars[i] <= hook + 0.01) bi = i;
    const t0 = bars.length ? bars[bi] : hook;
    const t1 = bars.length > bi + 4 ? bars[bi + 4] : t0 + 8;
    const padL = 22, padR = 6, rowH = (h - 8) / 4, y0 = 4;
    const X = t => padL + (t - t0) / (t1 - t0) * (w - padL - padR);
    const LC = ['#6be6f7', '#f7a4d3', '#f7a4d3', '#6be6f7'];
    for (let l = 0; l < 4; l++) {
      g.fillStyle = l % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)';
      g.fillRect(padL, y0 + l * rowH, w - padL - padR, rowH);
      g.fillStyle = 'rgba(238,240,255,.5)';
      g.font = '600 10px Oxanium, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(Game.keyLabel(settings.keys[l]), padL / 2, y0 + l * rowH + rowH / 2);
    }
    // 박·마디선
    for (let i = bi; i <= bi + 4 && i < bars.length; i++) {
      const b0 = bars[i], b1 = bars[i + 1] || (b0 + (t1 - t0) / 4);
      g.fillStyle = 'rgba(255,255,255,.28)';
      g.fillRect(Math.round(X(b0)), y0, 1, h - 8);
      if (i === bi + 4) break;
      g.fillStyle = 'rgba(255,255,255,.09)';
      for (let q = 1; q < 4; q++) g.fillRect(Math.round(X(b0 + (b1 - b0) * q / 4)), y0, 1, h - 8);
    }
    const nw = 5;
    let count = 0;
    for (const n of ch.notes) {
      const e = n.e || n.t;
      if (e < t0 || n.t > t1) continue;
      count++;
      const y = y0 + n.l * rowH + 2, hh = rowH - 4;
      g.fillStyle = LC[n.l];
      if (n.e) {
        g.globalAlpha = 0.4;
        g.fillRect(X(Math.max(n.t, t0)), y + hh * 0.25, X(Math.min(n.e, t1)) - X(Math.max(n.t, t0)), hh * 0.5);
        g.globalAlpha = 1;
      }
      if (n.t >= t0) g.fillRect(X(n.t) - nw / 2, y, nw, hh);
    }
    $('rollCap').textContent = `채보 미리 보기 · ${ch.name}`;
    $('rollRight').textContent = `${fmtTime(t0)}부터 4마디 · 노트 ${count}`;
  }

  function renderKeyCaps() {
    const caps = $('keyCaps').children;
    for (let i = 0; i < 4; i++) caps[i].textContent = Game.keyLabel(settings.keys[i]);
  }

  function select(i, opts) {
    if (!state.songs.length) return;
    const ni = clamp(i, 0, state.songs.length - 1);
    const changed = ni !== state.sel;
    state.sel = ni;
    renderList();
    renderDetail();
    scrollSelIntoView();
    if (changed || (opts && opts.preview)) schedulePreview();
  }

  function setDiff(i) {
    state.diff = clamp(i, 0, 4);
    renderDetail();
  }

  // ───────────────────────── 미리듣기
  const preview = { song: null, timer: 0, audio: new Audio(), node: null, gain: null, fade: 0, loopTimer: 0 };
  preview.audio.preload = 'auto';

  function schedulePreview() {
    clearTimeout(preview.timer);
    preview.timer = setTimeout(() => startPreview(current()), 260);
  }

  function hookTime(s) {
    const a = s.analysis;
    if (!a) return 0;
    const notes = a.charts[4].notes;
    if (!notes.length) return a.duration * 0.35;
    // 10초 창 가운데 노트가 가장 많은 곳(보통 후렴)
    let bestT = notes[0].t, bestN = 0, j = 0;
    for (let i = 0; i < notes.length; i++) {
      while (notes[j].t < notes[i].t - 10) j++;
      if (i - j > bestN) { bestN = i - j; bestT = notes[j].t; }
    }
    return Math.max(0, Math.min(bestT, a.duration - 20));
  }

  function stopPreview() {
    clearInterval(preview.fade);
    clearTimeout(preview.loopTimer);
    try { preview.audio.pause(); } catch (e) { /* */ }
    if (preview.node) { try { preview.node.stop(); } catch (e) { /* */ } preview.node = null; }
    const v = $('bgVideo');
    if (!Game.active) { try { v.pause(); } catch (e) { /* */ } v.muted = true; }
    preview.song = null;
  }

  async function mediaUrls(s) {
    if (urls.has(s.id)) return urls.get(s.id);
    const rec = await Store.getFiles(s.id);
    if (!rec || !rec.blob) return null;
    const u = { media: URL.createObjectURL(rec.blob), bg: rec.bgBlob ? URL.createObjectURL(rec.bgBlob) : null };
    urls.set(s.id, u);
    return u;
  }

  function fadeIn(el, target) {
    clearInterval(preview.fade);
    el.volume = 0;
    const t0 = performance.now();
    preview.fade = setInterval(() => {
      const k = clamp((performance.now() - t0) / 700, 0, 1);
      el.volume = target * k;
      if (k >= 1) clearInterval(preview.fade);
    }, 40);
  }

  async function setBackground(s, u, at, withSound) {
    const v = $('bgVideo');
    const hasVid = s.kind === 'video' || s.bgKind === 'video';
    v.classList.remove('on');
    v.removeAttribute('poster');
    if (!u || (!hasVid && s.bgKind !== 'image')) {
      if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
      return null;
    }
    if (s.bgKind === 'image') {
      if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
      v.poster = u.bg;
      v.classList.add('on');
      return null;
    }
    const src = s.kind === 'video' ? u.media : u.bg;
    if (v.src !== src) { v.src = src; }
    v.muted = !withSound;
    v.playbackRate = 1;
    await new Promise(res => {
      if (v.readyState >= 1) res();
      else { v.addEventListener('loadedmetadata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 3000); }
    });
    try { if (isFinite(at)) v.currentTime = Math.min(at, Math.max(0, (v.duration || at) - 1)); } catch (e) { /* */ }
    v.classList.add('on');
    return v;
  }

  async function startPreview(s) {
    stopPreview();
    if (!s || Game.active || state.screen !== 'select') return;
    preview.song = s;
    const at = hookTime(s);
    const vol = settings.vol / 100 * 0.75;
    if (s.demo) {
      setBackground(s, null, 0, false);
      if (!ac || ac.state !== 'running' || !state.demoBuffer) return;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.7);
      g.connect(ac.destination);
      const n = ac.createBufferSource();
      n.buffer = state.demoBuffer; n.connect(g);
      n.start(ac.currentTime, at, 20);
      preview.node = n;
      return;
    }
    const u = await mediaUrls(s);
    if (preview.song !== s || !u) return;
    if (s.kind === 'video') {
      const v = await setBackground(s, u, at, true);
      if (!v || preview.song !== s) return;
      v.volume = 0;
      try { await v.play(); fadeIn(v, vol); }
      catch (e) { v.muted = true; v.play().catch(() => {}); }
    } else {
      const v = await setBackground(s, u, at, false);
      if (v) v.play().catch(() => {});
      const au = preview.audio;
      au.src = u.media;
      await new Promise(res => { if (au.readyState >= 1) res(); else { au.addEventListener('loadedmetadata', res, { once: true }); au.addEventListener('error', res, { once: true }); setTimeout(res, 3000); } });
      if (preview.song !== s) return;
      try { au.currentTime = at; } catch (e) { /* */ }
      try { await au.play(); fadeIn(au, vol); } catch (e) { /* 소리는 첫 클릭 뒤부터 */ }
    }
    clearTimeout(preview.loopTimer);
    preview.loopTimer = setTimeout(() => { if (preview.song === s) startPreview(s); }, 20000);
  }

  // ───────────────────────── 곡 넣기와 분석
  function fileId(f) {
    let h = 0;
    for (const ch of f.name) h = (h * 33 + ch.codePointAt(0)) >>> 0;
    return `f${f.size.toString(36)}-${(f.lastModified || 0).toString(36)}-${h.toString(36)}`;
  }

  function groupFiles(files) {
    const by = new Map();
    for (const f of files) {
      const isMedia = MEDIA_EXT.test(f.name) || /^(audio|video)\//.test(f.type);
      const isImg = IMAGE_EXT.test(f.name) || /^image\//.test(f.type);
      if (!isMedia && !isImg) continue;
      const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
      if (!by.has(base)) by.set(base, []);
      by.get(base).push({ f, isImg, isVid: VIDEO_EXT.test(f.name) || /^video\//.test(f.type) });
    }
    const out = [];
    for (const list of by.values()) {
      const audio = list.find(x => !x.isImg && !x.isVid);
      const vids = list.filter(x => x.isVid);
      const img = list.find(x => x.isImg);
      if (audio) out.push({ media: audio.f, bg: vids[0] ? vids[0].f : img ? img.f : null, bgKind: vids[0] ? 'video' : img ? 'image' : null });
      else if (vids.length) for (const v of vids) out.push({ media: v.f, bg: null, bgKind: null });
    }
    return out;
  }

  async function addFiles(fileList) {
    const groups = groupFiles(Array.from(fileList));
    if (!groups.length) { toast('영상이나 음악 파일만 넣을 수 있습니다 (mp4·webm·mkv·mp3·m4a·ogg·wav·flac)'); return; }
    let added = 0, firstNew = -1;
    for (const gp of groups) {
      const id = fileId(gp.media);
      if (state.songs.some(s => s.id === id)) continue;
      const s = {
        id, title: cleanTitle(gp.media.name), fileName: gp.media.name, size: gp.media.size,
        kind: VIDEO_EXT.test(gp.media.name) || /^video\//.test(gp.media.type) ? 'video' : 'audio',
        bgKind: gp.bgKind, addedAt: Date.now(), thumb: null, analysis: null,
        state: 'wait', progress: '분석 대기', _files: gp,
      };
      state.songs.push(s);
      if (firstNew < 0) firstNew = state.songs.length - 1;
      state.queue.push(s);
      added++;
    }
    if (!added) { toast('이미 목록에 있는 파일입니다'); return; }
    toast(`${added}곡을 넣었습니다. 분석이 끝나면 바로 할 수 있어요`);
    select(firstNew);
    pump();
  }

  function decodeCtx() {
    if (ac) return ac;
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    return new Off(2, 1, 44100);
  }

  function decodeAudio(ab) {
    const ctx = decodeCtx();
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  function grabFrame(url) {
    return new Promise(resolve => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      let doneFlag = false;
      const done = r => { if (doneFlag) return; doneFlag = true; clearTimeout(to); v.removeAttribute('src'); try { v.load(); } catch (e) { /* */ } resolve(r); };
      const to = setTimeout(() => done({ ok: false }), 9000);
      v.addEventListener('loadedmetadata', () => {
        if (!v.videoWidth) { done({ ok: false, noVideo: true }); return; }
        try { v.currentTime = Math.min(v.duration * 0.3, Math.max(0, v.duration - 1)); } catch (e) { done({ ok: false }); }
      }, { once: true });
      v.addEventListener('seeked', () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 240;
          const g = c.getContext('2d');
          const vw = v.videoWidth, vh = v.videoHeight, side = Math.min(vw, vh);
          g.drawImage(v, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, 240, 240);
          done({ ok: true, img: c.toDataURL('image/jpeg', 0.82) });
        } catch (e) { done({ ok: false }); }
      }, { once: true });
      v.addEventListener('error', () => done({ ok: false, noVideo: true }), { once: true });
      v.src = url;
    });
  }

  function imageThumb(url) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 240;
        const g = c.getContext('2d');
        const side = Math.min(im.width, im.height);
        g.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, 240, 240);
        try { resolve(c.toDataURL('image/jpeg', 0.82)); } catch (e) { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = url;
    });
  }

  const STAGE_TXT = { resample: '소리 고르는 중', features: '스펙트럼 읽는 중', tempo: '템포·박 찾는 중', grid: '박 격자 맞추는 중', charts: '채보 만드는 중' };

  async function analyzeSong(s, blob) {
    s.state = 'busy'; s.progress = '소리 읽는 중'; s.error = null;
    renderList(); if (current() === s) renderDetail();
    await new Promise(r => setTimeout(r, 30));
    let buf;
    try { buf = await decodeAudio(await blob.arrayBuffer()); }
    catch (e) { throw new Error('소리를 읽지 못했습니다. mp4(AAC)·webm·mp3·m4a·ogg·wav 파일을 넣어 주세요'); }
    if (!buf || buf.duration < 8) throw new Error('너무 짧은 파일입니다(8초 넘는 곡만)');
    const res = await Analyzer.analyzeBuffer(buf, stage => {
      s.progress = STAGE_TXT[stage] || s.progress;
      renderList(); if (current() === s) renderDetail();
    });
    s.analysis = res;
    s.duration = res.duration;
    return buf;
  }

  async function pump() {
    if (state.working) return;
    state.working = true;
    while (state.queue.length) {
      const s = state.queue.shift();
      if (!state.songs.includes(s)) continue;
      try {
        let blob, bgBlob;
        if (s._files) { blob = s._files.media; bgBlob = s._files.bg; }
        else { const rec = await Store.getFiles(s.id); blob = rec && rec.blob; bgBlob = rec && rec.bgBlob; }
        if (!blob) throw new Error('원본 파일이 사라졌습니다. 다시 넣어 주세요');
        await analyzeSong(s, blob);
        // 그림
        if (!s.thumb) {
          s.progress = '표지 만드는 중'; renderList();
          if (s.kind === 'video') {
            const u = URL.createObjectURL(blob);
            const r = await grabFrame(u);
            URL.revokeObjectURL(u);
            if (r.ok) s.thumb = r.img;
            else if (r.noVideo) s.kind = 'audio';
          }
          if (!s.thumb && bgBlob) {
            const u = URL.createObjectURL(bgBlob);
            if (s.bgKind === 'video') { const r = await grabFrame(u); if (r.ok) s.thumb = r.img; else s.bgKind = null; }
            else if (s.bgKind === 'image') s.thumb = await imageThumb(u);
            URL.revokeObjectURL(u);
          }
        }
        if (s._files) {
          const ok = await Store.putFiles(s.id, s._files.media, s._files.bg);
          if (!ok && Store.persistent) toast('저장 공간이 모자라 이 곡은 이번 창에서만 쓸 수 있어요', 4000);
          delete s._files;
        }
        s.state = 'ready'; s.progress = '';
        await Store.putSong(s);
      } catch (e) {
        console.error(e);
        s.state = 'error'; s.error = e && e.message ? e.message : '분석하지 못했습니다';
      }
      renderList();
      if (current() === s) { renderDetail(); schedulePreview(); }
    }
    state.working = false;
  }

  // ───────────────────────── 게임
  function showLoading(title, msg) {
    $('loadTitle').textContent = title;
    $('loadMsg').textContent = msg || '';
    $('loading').hidden = false;
  }

  async function play(song, diffIndex, opts) {
    opts = opts || {};
    if (!song || !song.analysis) return;
    ensureAC();
    stopPreview();
    state.screen = 'loading';
    showLoading('불러오는 중', song.title);
    try {
      let buffer = null;
      if (state.lastPlay && state.lastPlay.song === song && state.lastPlay.buffer) buffer = state.lastPlay.buffer;
      else if (song.demo) buffer = state.demoBuffer;
      else {
        const rec = await Store.getFiles(song.id);
        if (!rec || !rec.blob) throw new Error('원본 파일을 찾지 못했습니다. 곡을 지우고 다시 넣어 주세요');
        $('loadMsg').textContent = '소리 푸는 중…';
        buffer = await new Promise((res, rej) => { rec.blob.arrayBuffer().then(ab => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }, rej); });
      }
      if (song.analysis.version !== Analyzer.VERSION && !song.demo) {
        $('loadMsg').textContent = '새 분석기로 다시 분석하는 중…';
        song.analysis = await Analyzer.analyzeBuffer(buffer);
        await Store.putSong(song);
      }
      state.lastPlay = { song, diffIndex, buffer };
      const hasVideo = song.kind === 'video' || song.bgKind === 'video';
      if (!song.demo) {
        const u = await mediaUrls(song);
        await setBackground(song, u, 0, false);
      } else setBackground(song, null, 0, false);
      $('loading').hidden = true;
      $('select').hidden = true;
      $('result').hidden = true;
      document.body.classList.add('playing');
      state.screen = 'game';
      if (document.fonts && document.fonts.load) { try { await Promise.race([document.fonts.load('800 30px Oxanium'), new Promise(r => setTimeout(r, 600))]); } catch (e) { /* */ } }
      syncGameSettings();
      Game.start({ song, chart: song.analysis.charts[diffIndex], analysis: song.analysis, buffer, auto: opts.auto, hasVideo });
      if (hasVideo) $('bgVideo').classList.add('on');
    } catch (e) {
      console.error(e);
      $('loading').hidden = true;
      state.screen = 'select';
      toast(e && e.message ? e.message : '곡을 열지 못했습니다', 4000);
    }
  }

  function backToSelect() {
    Game.stop();
    $('pause').hidden = true;
    $('result').hidden = true;
    $('countdown').hidden = true;
    $('select').hidden = false;
    document.body.classList.remove('playing');
    state.screen = 'select';
    renderList(); renderDetail();
    schedulePreview();
  }

  function retry() {
    if (!state.lastPlay) return;
    $('pause').hidden = true;
    $('result').hidden = true;
    Game.stop(true);
    play(state.lastPlay.song, state.lastPlay.diffIndex, { auto: $('autoChk').checked });
  }

  Game.attach({
    canvas: $('play'), video: $('bgVideo'), settings: gameSettings,
    onFinish: showResult,
    onPauseChange: p => { $('pause').hidden = !p; },
  });
  Object.defineProperty(Game, 'ac', { get: () => ac, configurable: true });

  function resumeGame() {
    if (!Game.paused) return;
    $('pause').hidden = true;
    const cd = $('countdown');
    let n = 3;
    cd.textContent = n; cd.hidden = false;
    const iv = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(iv); cd.hidden = true; Game.resume(); }
      else cd.textContent = n;
    }, 420);
  }

  function showResult(r) {
    state.screen = 'result';
    const song = state.lastPlay.song, di = state.lastPlay.diffIndex;
    const ch = song.analysis.charts[di];
    $('rRank').textContent = r.rank;
    $('rRank').className = r.acc >= 90 ? '' : 'low';
    $('rTitle').textContent = song.title;
    $('rDiff').textContent = `${ch.name} · Lv.${ch.level}${r.auto ? ' · AUTO' : ''}`;
    $('rDiff').style.color = DIFF_COL[ch.key];
    $('rScore').textContent = r.score.toLocaleString('en-US');
    $('rP').textContent = r.cnt.P; $('rG').textContent = r.cnt.G; $('rD').textContent = r.cnt.D; $('rM').textContent = r.cnt.M;
    $('rAcc').textContent = r.acc.toFixed(2) + '%';
    $('rCombo').textContent = r.maxCombo + ' / ' + r.total;
    $('rFast').textContent = r.fast; $('rSlow').textContent = r.slow;
    const badges = [];
    if (r.ap) badges.push('<span class="badge ap">ALL PERFECT</span>');
    else if (r.fc) badges.push('<span class="badge fc">FULL COMBO</span>');
    if (!r.auto) {
      const k = ch.key;
      const prev = best[song.id] && best[song.id][k];
      if (!prev || r.score > prev.score) {
        best[song.id] = best[song.id] || {};
        best[song.id][k] = { score: r.score, rank: r.rank, fc: r.fc || (prev && prev.fc) || false, ap: r.ap || (prev && prev.ap) || false };
        Store.saveJSON('starlane.best', best);
        if (prev) badges.push('<span class="badge nb">NEW BEST</span>');
      } else if ((r.fc && !prev.fc) || (r.ap && !prev.ap)) {
        prev.fc = prev.fc || r.fc; prev.ap = prev.ap || r.ap;
        Store.saveJSON('starlane.best', best);
      }
    }
    $('rBadges').innerHTML = badges.join('');
    const cal = $('rCalib');
    if (r.auto) { cal.innerHTML = '오토 플레이 결과는 기록에 남기지 않습니다.'; }
    else if (r.samples >= 20 && Math.abs(r.meanMs) >= 8) {
      const nv = clamp(settings.offset + r.meanMs, -200, 200);
      cal.innerHTML = `평균 <b>${Math.abs(r.meanMs)}ms ${r.meanMs > 0 ? '늦게' : '일찍'}</b> 쳤습니다. 싱크 보정을 <b>${settings.offset} → ${nv}ms</b>로 바꿀까요? <button class="btn sm" id="calApply" type="button">맞추기</button>`;
      $('calApply').onclick = () => {
        settings.offset = nv; Store.saveJSON('starlane.settings', settings); syncGameSettings(); fillSettings();
        cal.textContent = `싱크 보정을 ${nv}ms로 맞췄습니다.`;
      };
    } else if (r.samples >= 20) cal.textContent = `판정 평균 오차 ${r.meanMs > 0 ? '+' : ''}${r.meanMs}ms. 싱크가 잘 맞습니다.`;
    else cal.textContent = '친 노트가 적어서 싱크는 재지 않았습니다.';
    $('result').hidden = false;
    $('select').hidden = true;
    document.body.classList.remove('playing');
    $('rBack').focus();
  }

  // ───────────────────────── 설정
  const SET_FIELDS = [
    ['sSpeed', 'oSpeed', 'speed', v => (+v).toFixed(1)],
    ['sOffset', 'oOffset', 'offset', v => (v > 0 ? '+' : '') + v + 'ms'],
    ['sBg', 'oBg', 'bg', v => v + '%'],
    ['sLane', 'oLane', 'lane', v => v + '%'],
    ['sVol', 'oVol', 'vol', v => v + '%'],
    ['sHit', 'oHit', 'hit', v => (+v ? v + '%' : '끔')],
  ];
  function fillSettings() {
    for (const [inp, out, key, fmt] of SET_FIELDS) { $(inp).value = settings[key]; $(out).textContent = fmt(settings[key]); }
    renderBinds();
  }
  for (const [inp, out, key, fmt] of SET_FIELDS) {
    $(inp).addEventListener('input', e => {
      settings[key] = +e.target.value;
      $(out).textContent = fmt(settings[key]);
      syncGameSettings();
      Store.saveJSON('starlane.settings', settings);
      if (key === 'vol' && preview.song) { const v = settings.vol / 100 * 0.75; try { preview.audio.volume = v; if (!$('bgVideo').muted) $('bgVideo').volume = v; } catch (er) { /* */ } }
    });
  }
  let bindWait = -1;
  function renderBinds() {
    const row = $('bindRow');
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = bindWait === i ? 'wait' : '';
      b.textContent = bindWait === i ? '키 입력…' : Game.keyLabel(settings.keys[i]);
      b.style.color = bindWait === i ? '' : (i === 0 || i === 3 ? 'var(--pen-a)' : 'var(--pen-b)');
      b.onclick = () => { bindWait = i; renderBinds(); };
      frag.appendChild(b);
    }
    row.replaceChildren(frag);
  }
  function openSettings() { fillSettings(); $('settings').hidden = false; $('setClose').focus(); }
  function closeSettings() { bindWait = -1; $('settings').hidden = true; renderKeyCaps(); }
  $('setBtn').onclick = openSettings;
  $('setClose').onclick = closeSettings;
  $('setReset').onclick = () => {
    Object.assign(settings, JSON.parse(JSON.stringify(DEFAULTS)));
    Store.saveJSON('starlane.settings', settings);
    syncGameSettings(); fillSettings();
  };
  $('settings').addEventListener('click', e => { if (e.target === $('settings')) closeSettings(); });

  // ───────────────────────── 입력
  function typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' && a.type === 'text');
  }

  window.addEventListener('keydown', e => {
    if (bindWait >= 0) {
      e.preventDefault();
      if (e.code !== 'Escape') {
        const other = settings.keys.indexOf(e.code);
        if (other >= 0 && other !== bindWait) settings.keys[other] = settings.keys[bindWait];
        settings.keys[bindWait] = e.code;
        Store.saveJSON('starlane.settings', settings);
        syncGameSettings();
      }
      bindWait = -1; renderBinds(); renderKeyCaps();
      return;
    }
    if (state.screen === 'game') {
      if (e.repeat) { if (settings.keys.includes(e.code) || e.code === 'Space') e.preventDefault(); return; }
      if (Game.keyDown(e.code, e.timeStamp)) { e.preventDefault(); return; }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (Game.paused) { if ($('countdown').hidden) resumeGame(); }
        else Game.pause();
        return;
      }
      if (Game.paused) {
        if (e.code === 'Enter') { e.preventDefault(); if ($('countdown').hidden) resumeGame(); }
        return;
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        settings.speed = clamp(Math.round((settings.speed + (e.code === 'ArrowUp' ? 0.1 : -0.1)) * 10) / 10, 1, 10);
        Store.saveJSON('starlane.settings', settings);
        syncGameSettings();
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); Game.skipIntro(); return; }
      return;
    }
    if (!$('settings').hidden) { if (e.code === 'Escape') closeSettings(); return; }
    if (state.screen === 'result') {
      if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); backToSelect(); }
      else if (e.code === 'KeyR') { e.preventDefault(); retry(); }
      return;
    }
    if (state.screen !== 'select' || typing()) return;
    if (e.code === 'ArrowDown') { e.preventDefault(); ensureAC(); select(state.sel + 1); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); ensureAC(); select(state.sel - 1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); setDiff(state.diff + 1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); setDiff(state.diff - 1); }
    else if (e.code === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement !== $('startBtn'))) {
      e.preventDefault();
      play(current(), state.diff, { auto: $('autoChk').checked });
    }
  });
  window.addEventListener('keyup', e => {
    if (state.screen === 'game' && Game.keyUp(e.code, e.timeStamp)) e.preventDefault();
  });
  window.addEventListener('blur', () => { if (state.screen === 'game') { Game.releaseAll(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'game' && !Game.paused && !Game.finishing) Game.pause();
  });
  // 첫 손짓에 소리 길을 연다
  const unlock = () => { ensureAC(); if (preview.song && preview.song.demo) startPreview(preview.song); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  $('songList').addEventListener('click', e => {
    const li = e.target.closest('.song');
    if (!li) return;
    ensureAC();
    const i = +li.dataset.i;
    if (i === state.sel) startPreview(current()); else select(i);
  });
  $('songList').addEventListener('dblclick', e => {
    const li = e.target.closest('.song');
    if (!li) return;
    select(+li.dataset.i);
    play(current(), state.diff, { auto: $('autoChk').checked });
  });
  $('diffs').addEventListener('click', e => {
    const b = e.target.closest('.diff');
    if (b) setDiff(+b.dataset.i);
  });
  $('startBtn').onclick = () => play(current(), state.diff, { auto: $('autoChk').checked });
  $('addBtn').onclick = () => $('fileInput').click();
  $('dropZone').onclick = () => $('fileInput').click();
  $('dropZone').onkeydown = e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('fileInput').click(); } };
  $('fileInput').onchange = e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ''; };
  let dragDepth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    if (state.screen !== 'select') return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  $('pResume').onclick = resumeGame;
  $('pRetry').onclick = retry;
  $('pQuit').onclick = backToSelect;
  $('rRetry').onclick = retry;
  $('rBack').onclick = backToSelect;

  $('renameBtn').onclick = () => {
    const s = current(); if (!s || s.demo) return;
    $('renameInput').value = s.title;
    $('renameBox').hidden = false; $('dTitle').hidden = true;
    $('renameInput').focus(); $('renameInput').select();
  };
  const doRename = () => {
    const s = current(); if (!s) return;
    const v = $('renameInput').value.trim();
    if (v) { s.title = v; Store.putSong(s); }
    renderList(); renderDetail();
  };
  $('renameOk').onclick = doRename;
  $('renameInput').addEventListener('keydown', e => {
    if (e.code === 'Enter') { e.preventDefault(); doRename(); }
    if (e.code === 'Escape') { e.preventDefault(); renderDetail(); }
  });
  $('reBtn').onclick = () => {
    const s = current(); if (!s || s.demo || s.state === 'busy') return;
    s.state = 'wait'; s.progress = '다시 분석 대기';
    if (state.lastPlay && state.lastPlay.song === s) state.lastPlay = null;
    state.queue.push(s); renderList(); renderDetail(); pump();
  };
  $('delBtn').onclick = async () => {
    const s = current(); if (!s || s.demo) return;
    const b = $('delBtn');
    if (!b.dataset.arm) {
      b.dataset.arm = '1'; b.textContent = '한 번 더 누르면 지웁니다';
      setTimeout(() => { if (b.dataset.arm) { b.dataset.arm = ''; b.textContent = '지우기'; } }, 3000);
      return;
    }
    stopPreview();
    const u = urls.get(s.id);
    if (u) { URL.revokeObjectURL(u.media); if (u.bg) URL.revokeObjectURL(u.bg); urls.delete(s.id); }
    const v = $('bgVideo'); v.classList.remove('on');
    if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
    await Store.remove(s.id);
    if (state.lastPlay && state.lastPlay.song === s) state.lastPlay = null;
    state.songs.splice(state.sel, 1);
    delete best[s.id]; Store.saveJSON('starlane.best', best);
    state.sel = clamp(state.sel, 0, state.songs.length - 1);
    renderList(); renderDetail(); schedulePreview();
    toast('곡을 지웠습니다');
  };
  window.addEventListener('resize', () => { if (state.screen === 'select') drawDensity(); });

  // ───────────────────────── 시작
  async function boot() {
    const demo = { id: Demo.id, demo: true, title: Demo.title, kind: 'audio', bgKind: null, thumb: Demo.jacket(240), analysis: null, state: 'busy', progress: '연습곡 만드는 중' };
    state.songs = [demo];
    renderList(); renderDetail();
    await Store.init();
    const saved = (await Store.listSongs()).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    for (const s of saved) {
      s.state = s.analysis ? 'ready' : 'wait';
      state.songs.push(s);
      if (!s.analysis || s.analysis.version !== Analyzer.VERSION) { s.state = 'wait'; s.progress = '새 분석기로 다시 분석 대기'; state.queue.push(s); }
    }
    renderList(); renderDetail();
    // 연습곡 합성과 분석
    try {
      const buf = await Demo.render();
      state.demoBuffer = buf;
      demo.progress = '박자 분석 중'; renderList(); renderDetail();
      demo.analysis = await Analyzer.analyzeBuffer(buf, stage => { demo.progress = STAGE_TXT[stage] || demo.progress; renderList(); if (current() === demo) renderDetail(); });
      demo.state = 'ready'; demo.progress = '';
    } catch (e) {
      console.error(e);
      demo.state = 'error'; demo.error = '연습곡을 만들지 못했습니다';
    }
    renderList(); renderDetail();
    if (!Store.persistent) toast('이 창에서는 넣은 곡을 저장할 수 없어서, 창을 닫으면 목록이 비워집니다', 5000);
    pump();
    window.__starlane = { state, settings, Game, Analyzer, addFiles, play, select, setDiff };
  }
  boot();
})();
