// 코트 시각화: 슛 차트, 선수 위치, 슛 애니메이션, 하이라이트 배너·다시 보기
(function () {
  const HM = globalThis.HM;
  const U = HM.U, App = HM.App, HL = HM.HL, Sim = HM.Sim;
  const esc = U.esc;
  const A = App.acts;
  const G_ = () => App.G;
  const RIM = { x: 250, y: 52.5 };
  // 포지션별 공격 자리(하프코트, 10px = 1ft)
  const SLOT = [[250, 330], [425, 225], [75, 225], [355, 115], [160, 95]];
  const POSN = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

  const LINES = `
    <rect x="1" y="1" width="498" height="468" class="cl" fill="none"/>
    <rect x="170" y="1" width="160" height="189" class="paint"/>
    <circle cx="250" cy="190" r="60" class="cl" fill="none"/>
    <path d="M210,52.5 A40,40 0 0 0 290,52.5" class="cl" fill="none"/>
    <path d="M30,1 L30,142 A237.5,237.5 0 0 0 470,142 L470,1" class="cl" fill="none"/>
    <line x1="220" y1="40" x2="280" y2="40" class="cl" stroke-width="3"/>
    <circle cx="250" cy="52.5" r="7.5" class="rim" fill="none"/>
    <path d="M190,469 A60,60 0 0 1 310,469" class="cl" fill="none"/>`;

  App.courtHtml = (id, extra = '') => `<div class="court-wrap" id="${id}"><svg viewBox="0 0 500 470" class="court" role="img" aria-label="코트">
      ${LINES}<g class="shots"></g><g class="pl"></g>
      <circle class="rimfx" cx="250" cy="52.5" r="8" fill="none" opacity="0"/>
      <circle class="ball" cx="250" cy="330" r="6" opacity="0"/>
    </svg><div class="hl-banner" hidden></div>${extra}</div>`;

  const q = (id, sel) => document.querySelector(`#${id} ${sel}`);
  // 코트 위에서 잘 보이고 두 팀이 서로 구분되는 색을 고른다(팀 대표색 → 보조색 → 대체색)
  const rgb = c => { c = String(c || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) || 0); };
  const cdist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.sqrt(0.3 * (x[0] - y[0]) ** 2 + 0.59 * (x[1] - y[1]) ** 2 + 0.11 * (x[2] - y[2]) ** 2); };
  function vizColors(teams) {
    let court = '#3b2c1f';
    try { court = getComputedStyle(document.documentElement).getPropertyValue('--court').trim() || court; } catch (e) { /* 기본값 */ }
    const pick = (t, avoid) => {
      const cs = [t.colors[0], t.colors[1], '#ffffff', '#ff4d6d', '#2ee6a8', '#ffd23f', '#111111'].filter(Boolean);
      const score = c => Math.min(cdist(c, court), avoid ? cdist(c, avoid) : 999);
      return cs.find(c => score(c) >= 80) || cs.slice().sort((x, y) => score(y) - score(x))[0];
    };
    const h = pick(teams[0]);
    return [h, pick(teams[1], h)];
  }
  App.vizColors = vizColors;
  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  // 슛 표시: 성공 ● / 실패 ✕
  function marker(x, y, made, color) {
    const g = el('g', { class: 'mk' });
    if (made) g.appendChild(el('circle', { cx: x, cy: y, r: 6, fill: color, stroke: '#fff', 'stroke-width': 1.2, 'fill-opacity': 0.9 }));
    else {
      g.appendChild(el('line', { x1: x - 5, y1: y - 5, x2: x + 5, y2: y + 5, stroke: color, 'stroke-width': 2.4 }));
      g.appendChild(el('line', { x1: x - 5, y1: y + 5, x2: x + 5, y2: y - 5, stroke: color, 'stroke-width': 2.4 }));
    }
    return g;
  }
  App.courtShots = (id, shots, colors, filter = 'all') => {
    const g = q(id, '.shots'); if (!g) return;
    g.innerHTML = '';
    for (const s of shots) {
      if (filter !== 'all' && String(s[3]) !== String(filter)) continue;
      g.appendChild(marker(s[0] * 10, s[1] * 10, s[2], colors[s[3]]));
    }
  };
  App.courtAddShot = (id, e, color) => { const g = q(id, '.shots'); if (g && e.x !== undefined) g.appendChild(marker(e.x * 10, e.y * 10, e.made, color)); };

  // 코트 위 열 명(공격은 자리, 수비는 골대 쪽으로 조금)
  App.courtPlayers = (id, off, def, offC, defC) => {
    const g = q(id, '.pl'); if (!g) return;
    g.innerHTML = '';
    const place = (list, col, isDef) => {
      const sorted = list.slice().sort((a, b) => (POSN[a.pos] ?? 2) - (POSN[b.pos] ?? 2));
      sorted.forEach((p, i) => {
        let [x, y] = SLOT[p.slot ?? i] || SLOT[0];
        if (isDef) { x = x + (RIM.x - x) * 0.22 + 8; y = y + (RIM.y - y) * 0.22; }
        const gg = el('g', { class: 'pd', 'data-pid': p.pid ?? '', transform: `translate(${x},${y})` });
        const big = p.slot !== undefined; // 라인업 그림은 크게
        const rr = big ? 24 : 13;
        if (p.empty) gg.appendChild(el('circle', { r: rr, fill: 'none', stroke: 'var(--court-line)', 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }));
        else gg.appendChild(el('circle', { r: rr, fill: isDef ? 'none' : col, stroke: col, 'stroke-width': isDef ? 3.5 : 2, opacity: isDef ? 0.9 : 1 }));
        if (big) { const lab = el('text', { y: 6, 'text-anchor': 'middle', class: 'pn', style: 'font-size:17px' }); lab.textContent = p.pos; gg.appendChild(lab); }
        const t = el('text', { y: big ? 44 : 27, 'text-anchor': 'middle', class: 'pn', style: big ? 'font-size:19px' : '' }); t.textContent = p.nm.length > 9 ? p.nm.slice(0, 8) + '…' : p.nm;
        gg.appendChild(t);
        g.appendChild(gg);
      });
    };
    place(def, defC, true); place(off, offC, false);
  };

  // 슛 애니메이션: 슈터가 그 자리로 가고, 공이 골대로 날아간다
  App.courtShoot = (id, e, color, ms = 650) => new Promise(res => {
    const ball = q(id, '.ball'), fx = q(id, '.rimfx');
    if (!ball || e.x === undefined) return res();
    const sx = e.x * 10, sy = e.y * 10;
    const dot = q(id, `.pd[data-pid="${e.pid}"]`);
    if (dot) dot.setAttribute('transform', `translate(${sx},${sy + 14})`);
    ball.setAttribute('opacity', 1);
    const end = e.made ? RIM : { x: RIM.x + (Math.random() - 0.5) * 60, y: RIM.y + 25 + Math.random() * 40 };
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      const x = sx + (end.x - sx) * t, y = sy + (end.y - sy) * t;
      const h = Math.sin(Math.PI * Math.min(1, t * (e.made ? 1 : 0.9)));
      ball.setAttribute('cx', x); ball.setAttribute('cy', y - h * 18); ball.setAttribute('r', 6 + h * 4);
      if (t < 1) return requestAnimationFrame(step);
      if (e.made) { fx.setAttribute('stroke', color); fx.setAttribute('opacity', 1); fx.setAttribute('r', 8); fx.classList.remove('pop'); void fx.getBBox(); fx.classList.add('pop'); }
      setTimeout(() => { ball.setAttribute('opacity', 0); App.courtAddShot(id, e, color); res(); }, 140);
    };
    requestAnimationFrame(step);
  });

  App.courtBanner = (id, text, color, ms = 1800) => {
    const b = q(id, '.hl-banner'); if (!b) return;
    b.textContent = text; b.style.setProperty('--hc', color); b.style.color = App.textOn(color); b.hidden = false;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, ms);
  };

  // ---------- 생중계 ----------
  const nameOf = pid => { const p = G_().players[pid]; return p ? Sim.shortName(p.name) : '?'; };
  App.liveCourt = () => {
    const lv = App.live; if (!lv || !document.getElementById('lv-viz')) return;
    const G = G_(), game = lv.game;
    const teams = [G.teams[lv.g.h], G.teams[lv.g.a]];
    const colors = vizColors(teams);
    const filter = lv.shotFilter || 'all';
    const plays = game.plays || [];
    if (lv.hlSeen === undefined) lv.hlSeen = 0;
    // 화면을 새로 그렸으면(새 svg) 지금까지의 슛을 한 번에 다시 찍는다
    const svg = q('lv-viz', 'svg');
    if (!svg._hm) { svg._hm = true; App.courtShots('lv-viz', HL.compactShots(plays), colors, filter); lv.playIdx = plays.length; }
    const fresh = plays.slice(lv.playIdx); lv.playIdx = plays.length;
    // 선수 위치: 공을 가진 팀이 공격
    const off = game.T[game.poss], def = game.T[1 - game.poss];
    const mk = t => t.court.map(r => ({ pid: r.p.pid, pos: r.p.pos, nm: r.nm }));
    const isShot = e => e.t === 'shot' && !e.fouled;
    const shot = fresh.filter(isShot).pop();
    const animate = !lv.paused && lv.speed <= 2 && !lv.finished;
    if (animate && shot) {
      // 슛을 쏜 팀이 공격인 장면으로 그린다
      const so = game.T[shot.side], sd = game.T[1 - shot.side];
      App.courtPlayers('lv-viz', mk(so), mk(sd), colors[shot.side], colors[1 - shot.side]);
      for (const e of fresh) if (isShot(e) && e !== shot && (filter === 'all' || String(e.side) === filter)) App.courtAddShot('lv-viz', e, colors[e.side]);
      if (filter === 'all' || String(shot.side) === filter) App.courtShoot('lv-viz', shot, colors[shot.side], lv.speed === 1 ? 800 : 450);
    } else {
      App.courtPlayers('lv-viz', mk(off), mk(def), colors[off.side], colors[def.side]);
      for (const e of fresh) if (isShot(e) && (filter === 'all' || String(e.side) === filter)) App.courtAddShot('lv-viz', e, colors[e.side]);
    }
    // 하이라이트
    const hl = HL.analyze(plays, nameOf, s => teams[s].abbr);
    lv.hl = hl;
    if (hl.length > lv.hlSeen) {
      const nw = hl.slice(lv.hlSeen).filter(h => h.sc >= 3).pop();
      lv.hlSeen = hl.length;
      if (nw && !lv.finished) App.courtBanner('lv-viz', `🔥 ${nw.cap}`, colors[nw.def ? 1 - nw.e.side : nw.e.side]);
    }
    const list = document.getElementById('lv-hl');
    if (list) list.innerHTML = hlList(HL.top(hl, 12), teams, 'liveHl');
    const fs = document.getElementById('lv-shotstat');
    if (fs) {
      const st = side => { const s = plays.filter(e => e.t === 'shot' && !e.fouled && e.side === side); const m = s.filter(e => e.made).length; return `${teams[side].abbr} ${m}/${s.length}`; };
      fs.innerHTML = `<span style="color:${colors[0]}">●</span> ${esc(st(0))} · <span style="color:${colors[1]}">●</span> ${esc(st(1))}`;
    }
  };
  function hlList(list, teams, act) {
    if (!list.length) return '<div class="small muted">아직 하이라이트가 없습니다.</div>';
    return list.map((h, k) => {
      const e = h.e || h;
      const t = teams[h.def ? 1 - e.side : e.side];
      return `<button class="hl-item" data-act="${act}" data-k="${k}"><span class="tchip" style="${App.tstyle(t)}">${esc(t.abbr)}</span><span class="small muted num">${e.q <= 4 ? e.q + 'Q' : 'OT'} ${Math.floor(e.clock / 60)}:${String(e.clock % 60).padStart(2, '0')}</span><span>${esc(h.cap)}</span><span class="small faint num">${e.score ? e.score.join('-') : ''}</span></button>`;
    }).join('');
  }
  App.hlList = hlList;
  // 하이라이트 한 장면 다시 보기
  async function replay(id, h, teams) {
    const e = h.e || h;
    const colors = vizColors(teams);
    App.courtBanner(id, `▶ ${h.cap}`, colors[h.def ? 1 - e.side : e.side], 1600);
    if (e.x !== undefined && (e.t === 'shot' || e.t === undefined)) {
      const shooter = e.pid !== undefined ? [{ pid: e.pid, pos: 'PG', nm: nameOf(e.pid) }] : [];
      if (shooter.length) App.courtPlayers(id, shooter, [], colors[e.side], colors[1 - e.side]);
      await App.courtShoot(id, Object.assign({}, e, { made: e.made !== undefined ? !!e.made : true }), colors[e.side], 800);
    }
  }
  A.liveHl = el => { const lv = App.live; const G = G_(); const list = HL.top(lv.hl || [], 12); const h = list[+el.dataset.k]; if (h) { App.pauseLive(); App.liveUpdate(); replay('lv-viz', h, [G.teams[lv.g.h], G.teams[lv.g.a]]); } };
  A.liveReel = async () => {
    const lv = App.live; const G = G_(); const list = HL.top(lv.hl || [], 8);
    App.pauseLive();
    for (const h of list) { await replay('lv-viz', h, [G.teams[lv.g.h], G.teams[lv.g.a]]); await App.sleep(900); }
  };
  A.shotFilter = el => {
    const lv = App.live; lv.shotFilter = el.value;
    const G = G_(); const teams = [G.teams[lv.g.h], G.teams[lv.g.a]];
    App.courtShots('lv-viz', HL.compactShots(lv.game.plays || []), vizColors(teams), el.value);
  };

  // ---------- 박스스코어(저장된 슛 차트·하이라이트) ----------
  App.boxCourtHtml = gm => {
    if (!gm.shots) return '';
    const G = G_(); const teams = [G.teams[gm.h], G.teams[gm.a]];
    return `<div class="card" style="margin-top:12px"><h2>슛 차트 · 하이라이트 <span class="r"><select id="boxShotFilter" data-change="boxShotFilter" data-gid="${gm.gid}"><option value="all">두 팀</option><option value="0">${esc(teams[0].abbr)}</option><option value="1">${esc(teams[1].abbr)}</option></select></span></h2>
      <div class="viz-grid">${App.courtHtml('box-viz')}<div><div class="row" style="margin-bottom:8px"><button class="btn sm pri" data-act="boxReel" data-gid="${gm.gid}">▶ 하이라이트 다시 보기</button><span class="small muted">${(c => `<span style="color:${c[0]}">●</span> ${esc(teams[0].abbr)} · <span style="color:${c[1]}">●</span> ${esc(teams[1].abbr)}`)(vizColors(teams))} · ● 성공 ✕ 실패</span></div><div class="hl-list">${hlList(gm.hl || [], teams, 'boxHl')}</div></div></div></div>`;
  };
  App.boxCourtAfter = gm => {
    if (!gm || !gm.shots || !document.getElementById('box-viz')) return;
    const G = G_(); const teams = [G.teams[gm.h], G.teams[gm.a]];
    App.courtShots('box-viz', gm.shots, vizColors(teams));
  };
  A.boxShotFilter = el => { const gm = G_().games[+el.dataset.gid]; const G = G_(); const teams = [G.teams[gm.h], G.teams[gm.a]]; App.courtShots('box-viz', gm.shots, vizColors(teams), el.value); };
  A.boxHl = el => { const gm = G_().games[+(App.route.params[0])]; const G = G_(); const h = (gm.hl || [])[+el.dataset.k]; if (h) replay('box-viz', h, [G.teams[gm.h], G.teams[gm.a]]); };
  A.boxReel = async el => {
    const gm = G_().games[+el.dataset.gid]; const G = G_(); const teams = [G.teams[gm.h], G.teams[gm.a]];
    for (const h of (gm.hl || [])) { await replay('box-viz', h, teams); await App.sleep(900); }
    App.courtShots('box-viz', gm.shots, vizColors(teams));
  };
})();
