// 생중계 코트 재생: 포제션마다 선수 열 명이 움직이며 공 운반 → 패스 → 돌파·슛 → 리바운드·자유투를 보여 준다.
// 경기 엔진이 남긴 장면 기록(plays)을 그대로 따라가므로 결과는 중계·박스스코어와 같다.
(function () {
  const HM = globalThis.HM;
  const U = HM.U, App = HM.App, HL = HM.HL, Sim = HM.Sim;
  const esc = U.esc;
  const G_ = () => App.G;
  const ID = 'lv-viz';
  const RIM = { x: 250, y: 52.5 };
  const POSN = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  // 공격 자리(10px = 1ft): 탑, 오른쪽 윙, 왼쪽 윙, 오른쪽 엘보, 왼쪽 블록
  const SLOTS = [[250, 300], [410, 205], [90, 205], [325, 125], [175, 95]];
  // 속도별 재생 배율(4단계 '아주 빠르게'는 움직임 없이 결과만)
  const SCALE = { 1: 1.6, 2: 1, 3: 0.45 };
  const CANCEL = { cancel: true };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const st = { seq: 0, pos: {}, ball: null, f0: 1, cur: null };

  const svgEl = () => document.querySelector(`#${ID} svg`);
  const nameOf = pid => { const p = G_().players[pid]; return p ? Sim.shortName(p.name) : '?'; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = U.clamp;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function mk(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function look() { const lv = App.live, G = G_(); const teams = [G.teams[lv.g.h], G.teams[lv.g.a]]; return { teams, colors: App.vizColors(teams) }; }

  // ---------- 그리기 ----------
  const dot = pid => document.querySelector(`#${ID} .pl .pd[data-pid="${pid}"]`);
  function ensureDots(off, def, colors, offSide) {
    const g = document.querySelector(`#${ID} .pl`); if (!g) return;
    const want = new Set([...off, ...def].map(String));
    for (const d of [...g.querySelectorAll('.pd')]) if (!want.has(d.dataset.pid)) d.remove();
    const style = (pid, isOff) => {
      let d = dot(pid);
      if (!d) {
        d = mk('g', { class: 'pd', 'data-pid': pid });
        d.appendChild(mk('circle', { r: 13 }));
        const t = mk('text', { y: 28, 'text-anchor': 'middle', class: 'pn' });
        const nm = nameOf(pid); t.textContent = nm.length > 9 ? nm.slice(0, 8) + '…' : nm;
        d.appendChild(t);
        const p = st.pos[pid]; if (p) d.setAttribute('transform', `translate(${p.x},${p.y})`);
      }
      const col = colors[isOff ? offSide : 1 - offSide];
      const c = d.firstChild;
      c.setAttribute('fill', isOff ? col : 'none'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', isOff ? 2 : 3.5);
      g.appendChild(d); // 공격 팀을 위에 그린다
    };
    def.forEach(pid => style(pid, false)); off.forEach(pid => style(pid, true));
  }
  function put(pid, x, y) {
    st.pos[pid] = { x, y };
    const d = dot(pid); if (d) d.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
  }
  function ball(x, y, h = 0, vis = 1) {
    st.ball = { x, y };
    const b = document.querySelector(`#${ID} .ball`); if (!b) return;
    b.setAttribute('cx', x.toFixed(1)); b.setAttribute('cy', (y - h).toFixed(1)); b.setAttribute('r', (6 + h / 6).toFixed(1)); b.setAttribute('opacity', vis);
  }
  function pop(color) {
    const fx = document.querySelector(`#${ID} .rimfx`); if (!fx) return;
    fx.setAttribute('stroke', color); fx.setAttribute('opacity', 1); fx.setAttribute('r', 8);
    fx.classList.remove('pop'); void fx.getBBox(); fx.classList.add('pop');
  }
  // 점수·시계를 장면에 맞춰 바로 바꾼다(나머지 중계 글은 포제션이 끝난 뒤)
  function board(e) {
    const ps = document.querySelectorAll('#lv-score .pts');
    if (ps.length === 2 && e.score) { ps[0].textContent = e.score[0]; ps[1].textContent = e.score[1]; }
    const n = document.querySelector('#lv-score .mid .num');
    if (n && e.clock !== undefined) n.textContent = `${Math.floor(e.clock / 60)}:${String(e.clock % 60).padStart(2, '0')}`;
  }
  function addShot(e) {
    const lv = App.live; const f = lv.shotFilter || 'all';
    if (e.t !== 'shot' || e.fouled || e.x === undefined) return;
    if (f === 'all' || String(e.side) === f) App.courtAddShot(ID, e, look().colors[e.side]);
  }
  // 이 장면까지 보여 줬다: 하이라이트 배너와 목록
  function shown(i, banner = true) {
    const lv = App.live; if (!lv) return;
    lv.vizShown = Math.max(lv.vizShown ?? -1, i);
    const { teams, colors } = look();
    const hl = HL.analyze(lv.game.plays.slice(0, lv.vizShown + 1), nameOf, s => teams[s].abbr);
    lv.hl = hl;
    if (hl.length > (lv.hlSeen || 0)) {
      const nw = hl.slice(lv.hlSeen || 0).filter(h => h.sc >= 3).pop();
      lv.hlSeen = hl.length;
      if (banner && nw && !lv.finished) App.courtBanner(ID, `🔥 ${nw.cap}`, colors[nw.def ? 1 - nw.e.side : nw.e.side]);
    }
    // 목록은 하이라이트가 늘었을 때만 다시 그린다(누르는 중에 바뀌지 않게)
    const list = document.getElementById('lv-hl');
    if (list && (list._n !== hl.length || !list.firstChild)) { list._n = hl.length; list.innerHTML = App.hlList(HL.top(hl, 12), teams, 'liveHl'); }
    const fs = document.getElementById('lv-shotstat');
    if (fs) {
      const plays = lv.game.plays.slice(0, lv.vizShown + 1);
      const s = side => { const x = plays.filter(e => e.t === 'shot' && !e.fouled && e.side === side); return `${teams[side].abbr} ${x.filter(e => e.made).length}/${x.length}`; };
      fs.innerHTML = `<span style="color:${colors[0]}">●</span> ${esc(s(0))} · <span style="color:${colors[1]}">●</span> ${esc(s(1))}`;
    }
  }

  // ---------- 움직임 ----------
  let runSvg = null;
  // 재생 도중 속도를 바꾸면 바로 반영된다(ms는 재생을 시작할 때 속도 기준)
  const rate = () => { const lv = App.live; const now = lv && SCALE[lv.speed]; return now ? st.f0 / now : st.f0 / 0.06; };
  function tween(ms, fn) {
    const seq = st.seq;
    return new Promise((res, rej) => {
      let last = performance.now(), prog = 0;
      const f = now => {
        if (seq !== st.seq || svgEl() !== runSvg) return rej(CANCEL);
        prog += (now - last) * rate(); last = now;
        const t = ms <= 0 ? 1 : Math.min(1, prog / ms);
        fn(t);
        if (t < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  }
  const wait = ms => tween(ms, () => { });
  // 수비수는 자기가 맡은 선수와 골대 사이에 선다(k가 작을수록 바짝)
  function guardSpot(c, d, k = 0.27) {
    const m = st.pos[c.man[d]] || { x: 250, y: 300 };
    return { x: lerp(m.x, RIM.x, k) + (m.x < RIM.x ? 7 : -7), y: lerp(m.y, RIM.y, k) };
  }
  // targets에 없는 공격수는 그대로, 수비수는 자기 선수를 따라간다(noGuard면 그대로)
  function move(c, ms, targets, opt = {}) {
    const from = {};
    for (const p of [...c.off, ...c.def]) from[p] = Object.assign({}, st.pos[p] || { x: 250, y: 440 });
    return tween(ms, t => {
      const e = ease(t);
      for (const p of c.off) { const to = targets[p]; if (to) put(p, lerp(from[p].x, to.x, e), lerp(from[p].y, to.y, e)); }
      for (const d of c.def) {
        const to = targets[d] || (opt.noGuard ? null : guardSpot(c, d, opt.tight != null && c.man[d] === opt.tight ? 0.12 : 0.27));
        if (to) put(d, lerp(from[d].x, to.x, e), lerp(from[d].y, to.y, e));
      }
      if (opt.ball) opt.ball(t);
      else if (opt.ball !== null && c.holder != null && st.pos[c.holder]) { const h = st.pos[c.holder]; ball(h.x + 9, h.y - 4, Math.abs(Math.sin(t * Math.PI * 4)) * 5); }
    });
  }
  // 공 없는 선수들이 자리 근처에서 조금씩 움직인다
  function drift(c, except) {
    const tg = {};
    for (const p of c.off) if (p !== except && p !== c.holder) { const h = c.home[p]; tg[p] = { x: clamp(h.x + rnd(-28, 28), 25, 475), y: clamp(h.y + rnd(-22, 22), 30, 440) }; }
    return tg;
  }

  // ---------- 장면 ----------
  function context(evs, f) {
    const lv = App.live, game = lv.game;
    const pe = evs.find(e => e.t === 'poss');
    const first = evs.find(e => e.t !== 'poss');
    const side = pe ? pe.side : first ? (first.t === 'reb' && !first.off ? 1 - first.side : first.side) : game.poss;
    const rows = new Map(); for (const t of game.T) for (const r of t.roster) rows.set(r.p.pid, r);
    const posn = pid => { const r = rows.get(pid); return POSN[r ? r.pp || r.p.pos : 'SF'] ?? 2; };
    const ids = s => (pe ? (s === side ? pe.o : pe.d) : game.T[s].court.map(r => r.p.pid)).slice();
    const off = ids(side), def = ids(1 - side);
    // 기록에 나온 선수가 빠져 있으면(예전 기록) 넣는다
    for (const e of evs) {
      if (e.t === 'poss') continue;
      const list = e.side === side ? off : def; // 리바운드도 side는 잡은 팀
      if (e.pid != null && !off.includes(e.pid) && !def.includes(e.pid)) { list.pop(); list.push(e.pid); }
    }
    off.sort((a, b) => posn(a) - posn(b)); def.sort((a, b) => posn(a) - posn(b));
    const man = {}; def.forEach((d, i) => { man[d] = off[i] ?? off[0]; });
    const home = {}; off.forEach((p, i) => { const [x, y] = SLOTS[i] || SLOTS[0]; home[p] = { x: x + rnd(-20, 20), y: y + rnd(-16, 16) }; });
    return { side, off, def, man, home, holder: off[0], f };
  }
  async function bring(c) {
    const f = c.f;
    const bottom = {};
    c.off.forEach((p, i) => { const [x] = SLOTS[i] || SLOTS[0]; bottom[p] = { x: lerp(250, x, 0.45) + rnd(-15, 15), y: rnd(425, 458) }; });
    if (c.off.some(p => st.pos[p])) {
      // 공수 전환: 새 공격 팀은 뒤로 빠졌다가 올라오고, 수비 팀은 자기 골대 앞으로
      const tg = Object.assign({}, bottom);
      c.def.forEach(d => { const h = c.home[c.man[d]]; tg[d] = { x: lerp(h.x, RIM.x, 0.3), y: lerp(h.y, RIM.y, 0.3) }; });
      await move(c, 420 * f, tg, { noGuard: true, ball: t => ball(st.ball ? st.ball.x : 250, st.ball ? st.ball.y : 60, 0, Math.max(0, 1 - t * 2)) });
    } else c.off.forEach(p => put(p, bottom[p].x, bottom[p].y));
    c.holder = c.off[0];
    await move(c, 1000 * f, c.home, {});
  }
  async function pass(c, to) {
    const f = c.f;
    if (to == null || to === c.holder || !st.pos[to] || !st.pos[c.holder]) { c.holder = to ?? c.holder; return; }
    const a = st.pos[c.holder];
    const tg = drift(c, to);
    const h = c.home[to] || st.pos[to]; tg[to] = { x: lerp(st.pos[to].x, h.x, 0.6) + rnd(-12, 12), y: lerp(st.pos[to].y, h.y, 0.6) + rnd(-10, 10) };
    const from = { x: a.x + 9, y: a.y - 4 };
    await move(c, 420 * f, tg, { ball: t => { const r = st.pos[to]; ball(lerp(from.x, r.x + 9, t), lerp(from.y, r.y - 4, t), Math.sin(t * Math.PI) * 8); } });
    c.holder = to;
  }
  async function passesTo(c, shooter, ast) {
    const extra = Math.random() < 0.35 ? 0 : Math.random() < 0.6 ? 1 : 2;
    const path = []; let cur = c.holder;
    for (let k = 0; k < extra; k++) {
      const cands = c.off.filter(p => p !== cur && p !== shooter && p !== ast);
      if (!cands.length) break;
      cur = pick(cands); path.push(cur);
    }
    if (ast != null && ast !== cur && c.off.includes(ast)) { path.push(ast); cur = ast; }
    if (shooter != null && shooter !== cur) path.push(shooter);
    for (const p of path) await pass(c, p);
  }
  async function shoot(c, e) {
    const f = c.f, sh = e.pid, col = look().colors[e.side];
    const loc = e.x !== undefined ? { x: e.x * 10, y: e.y * 10 } : { x: RIM.x, y: RIM.y + 45 };
    c.holder = sh;
    const p0 = st.pos[sh] || { x: 250, y: 300 };
    const dist = Math.hypot(p0.x - loc.x, p0.y - loc.y);
    const tg = drift(c, sh);
    tg[sh] = e.dunk ? { x: RIM.x + rnd(-6, 6), y: RIM.y + 20 } : { x: loc.x, y: loc.y + 10 };
    await move(c, clamp(dist * 2.4, 260, 800) * f, tg, { tight: sh });
    const s = st.pos[sh];
    const from = { x: s.x + 3, y: s.y - 14 };
    const air = (e.type === 'three' ? 680 : e.type === 'mid' ? 560 : 360) * f;
    const arc = e.type === 'three' ? 36 : e.type === 'mid' ? 28 : 16;
    if (e.blk != null && st.pos[e.blk]) {
      // 블록: 공이 막 떠오를 때 수비수가 뛰어올라 쳐낸다
      const meet = { x: lerp(from.x, RIM.x, 0.28), y: lerp(from.y, RIM.y, 0.28) };
      const b0 = Object.assign({}, st.pos[e.blk]);
      await tween(air * 0.45, t => { const k = ease(t); ball(lerp(from.x, meet.x, t), lerp(from.y, meet.y, t), Math.sin(t * Math.PI / 2) * arc * 0.5); put(e.blk, lerp(b0.x, meet.x + 8, k), lerp(b0.y, meet.y + 12, k)); });
      addShot(e); board(e); shown(e.i);
      const loose = { x: clamp(meet.x + rnd(-110, 110), 30, 470), y: clamp(meet.y + rnd(50, 130), 30, 420) };
      await tween(380 * f, t => ball(lerp(meet.x, loose.x, t), lerp(meet.y, loose.y, t), Math.sin(t * Math.PI) * 10));
      return;
    }
    if (e.dunk) {
      await tween(200 * f, t => ball(lerp(from.x, RIM.x, t), lerp(from.y, RIM.y, t), Math.sin(t * Math.PI) * 10));
    } else {
      await tween(air, t => ball(lerp(from.x, RIM.x, t), lerp(from.y, RIM.y, t), Math.sin(t * Math.PI) * arc));
    }
    if (e.made) {
      pop(col); addShot(e); board(e); shown(e.i);
      await tween(260 * f, t => ball(RIM.x, RIM.y + t * 18, 0, 1 - t));
    } else if (e.fouled) {
      board(e); shown(e.i);
      await tween(240 * f, t => ball(RIM.x + t * 8, RIM.y + t * 30, 0, 1 - t));
    } else {
      // 림에 맞고 튄다(어디로 갈지는 리바운드 장면에서)
      addShot(e); board(e); shown(e.i);
      const k = rnd(-1, 1);
      await tween(160 * f, t => ball(RIM.x + k * 14 * t, RIM.y + 10 * t, Math.sin(t * Math.PI) * 10));
    }
  }
  async function rebound(c, e) {
    const f = c.f, rb = e.pid;
    const ang = rnd(0.12, 0.88) * Math.PI, rad = e.off ? rnd(55, 125) : rnd(35, 100);
    const spot = { x: clamp(RIM.x + Math.cos(ang) * rad, 30, 470), y: RIM.y + Math.sin(ang) * rad + 12 };
    const b0 = st.ball ? Object.assign({}, st.ball) : { x: RIM.x, y: RIM.y };
    const tg = { [rb]: { x: spot.x, y: spot.y + 12 } };
    for (const p of [...c.off, ...c.def]) {
      if (p === rb || !st.pos[p] || Math.random() < 0.45) continue;
      const q = st.pos[p]; tg[p] = { x: lerp(q.x, RIM.x, 0.22) + rnd(-10, 10), y: lerp(q.y, RIM.y + 70, 0.22) };
    }
    await move(c, 460 * c.f, tg, { noGuard: true, ball: t => ball(lerp(b0.x, spot.x, t), lerp(b0.y, spot.y, t), Math.sin(t * Math.PI) * 18) });
    c.holder = rb; board(e); shown(e.i);
    if (!e.off) await move(c, 260 * f, {}, { noGuard: true }); // 수비 리바운드: 공을 잡고 멈춘다
  }
  async function turnover(c, e) {
    const f = c.f;
    const h = st.pos[c.holder] || { x: 250, y: 300 };
    if (e.stl != null && st.pos[e.stl]) {
      const recv = pick(c.off.filter(p => p !== c.holder)) ?? c.holder;
      const r = st.pos[recv] || h;
      const mid = { x: lerp(h.x, r.x, 0.55), y: lerp(h.y, r.y, 0.55) };
      const s0 = Object.assign({}, st.pos[e.stl]);
      await tween(420 * f, t => { const k = ease(t); ball(lerp(h.x + 9, mid.x, t), lerp(h.y - 4, mid.y, t), Math.sin(t * Math.PI) * 8); put(e.stl, lerp(s0.x, mid.x, k), lerp(s0.y, mid.y + 10, k)); });
      board(e); shown(e.i);
      c.holder = e.stl;
      await move(c, 650 * f, { [e.stl]: { x: clamp(mid.x + rnd(-50, 50), 40, 460), y: Math.min(455, mid.y + 170) } }, { noGuard: true });
    } else {
      const out = { x: h.x < 250 ? 4 : 496, y: clamp(h.y + rnd(-50, 50), 20, 450) };
      await tween(480 * f, t => ball(lerp(h.x + 9, out.x, t), lerp(h.y - 4, out.y, t), Math.sin(t * Math.PI) * 10, 1 - t * 0.7));
      board(e); shown(e.i);
      await wait(200 * f);
    }
  }
  async function ftSetup(c, e) {
    const tg = {};
    const shooterOff = c.off.includes(e.pid);
    const offs = (shooterOff ? c.off : c.def).filter(p => p !== e.pid), defs = shooterOff ? c.def.slice() : c.off.slice();
    tg[e.pid] = { x: 250, y: 214 };
    const lane = [[156, 78], [344, 78], [156, 120], [344, 120], [156, 162]];
    [defs[0], defs[1], offs[0], offs[1], defs[2]].forEach((p, i) => { if (p != null) tg[p] = { x: lane[i][0], y: lane[i][1] }; });
    if (offs[2] != null) tg[offs[2]] = { x: 105, y: 300 };
    if (defs[3] != null) tg[defs[3]] = { x: 395, y: 300 };
    if (defs[4] != null) tg[defs[4]] = { x: 250, y: 330 };
    c.holder = e.pid;
    await move(c, 700 * c.f, tg, { noGuard: true, ball: t => { const s = st.pos[e.pid]; ball(s.x + 9, s.y - 4, 0, Math.min(1, t * 2)); } });
  }
  async function freeThrow(c, e) {
    const f = c.f, col = look().colors[e.side];
    const s = st.pos[e.pid] || { x: 250, y: 214 };
    ball(s.x + 6, s.y - 6);
    await wait(320 * f);
    const from = { x: s.x + 3, y: s.y - 16 };
    await tween(520 * f, t => ball(lerp(from.x, RIM.x, t), lerp(from.y, RIM.y, t), Math.sin(t * Math.PI) * 28));
    board(e); shown(e.i);
    if (e.made) { pop(col); await tween(220 * f, t => ball(RIM.x, RIM.y + t * 16, 0, 1 - t)); }
    else { const k = rnd(-1, 1); await tween(200 * f, t => ball(RIM.x + k * 20 * t, RIM.y + 14 * t, Math.sin(t * Math.PI) * 10)); }
    await wait(200 * f);
  }

  async function run(evs, f) {
    const { colors } = look();
    const c = context(evs, f);
    ensureDots(c.off, c.def, colors, c.side);
    await bring(c);
    let started = false, ftReady = false, lastOffReb = false;
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k];
      if (e.t === 'poss') continue;
      if (e.t === 'shot') {
        ftReady = false;
        if (!started) await passesTo(c, e.pid, e.ast);
        else if (lastOffReb && c.holder !== e.pid) await pass(c, e.pid); // 공격 리바운드 뒤 빼 주기
        started = true; lastOffReb = false;
        await shoot(c, e);
      } else if (e.t === 'tov') {
        if (!started) { const o = c.off.filter(p => p !== c.holder); if (o.length && Math.random() < 0.6) await pass(c, pick(o)); }
        started = true;
        await turnover(c, e);
      } else if (e.t === 'reb') {
        await rebound(c, e); lastOffReb = !!e.off;
      } else if (e.t === 'ft') {
        if (!ftReady) { await ftSetup(c, e); ftReady = true; }
        await freeThrow(c, e);
      }
    }
    await wait(300 * f);
  }
  // 재생하지 못한(건너뛴·끊긴) 장면은 결과만 반영한다
  function finalize(evs) {
    const lv = App.live; if (!lv) return;
    let last = lv.vizShown ?? -1;
    for (const e of evs) if (e.i > last) { addShot(e); last = e.i; }
    if (evs.length) shown(evs[evs.length - 1].i, false);
  }

  // 새로 그려진 코트(화면 이동 뒤)에는 지금까지 보여 준 슛을 다시 찍는다
  function initSvg() {
    const lv = App.live, svg = svgEl(); if (!lv || !svg || svg._hm) return;
    svg._hm = true;
    if (lv.playIdx === undefined) { lv.playIdx = 0; lv.vizShown = -1; }
    const plays = lv.game.plays || [];
    App.courtShots(ID, HL.compactShots(plays.slice(0, (lv.vizShown ?? -1) + 1)), look().colors, lv.shotFilter || 'all');
  }
  // 멈춰 있는 그림: 지금 공격 팀이 자리를 잡은 모습
  function formation() {
    const lv = App.live, game = lv.game;
    const c = context([], 1);
    c.side = game.poss;
    const { colors } = look();
    const rows = new Map(); for (const t of game.T) for (const r of t.roster) rows.set(r.p.pid, r);
    const order = t => t.court.map(r => r.p.pid).sort((a, b) => (POSN[rows.get(a).pp] ?? 2) - (POSN[rows.get(b).pp] ?? 2));
    c.off = order(game.T[game.poss]); c.def = order(game.T[1 - game.poss]);
    c.def.forEach((d, i) => { c.man[d] = c.off[i]; });
    ensureDots(c.off, c.def, colors, game.poss);
    c.off.forEach((p, i) => { const [x, y] = SLOTS[i] || SLOTS[0]; put(p, x, y); });
    c.def.forEach(d => { const g = guardSpot(c, d); put(d, g.x, g.y); });
    const h = st.pos[c.off[0]]; if (h) ball(h.x + 9, h.y - 4, 0, lv.finished ? 0 : 1);
  }

  // tick이 부른다: 이번 포제션 장면을 재생하는 Promise(재생하지 않으면 null)
  App.livePlay = () => {
    const lv = App.live; if (!lv || lv.finished || !svgEl()) return null;
    const f = SCALE[lv.speed];
    initSvg();
    const plays = lv.game.plays || [];
    const evs = plays.slice(lv.playIdx); lv.playIdx = plays.length;
    if (!f || document.hidden || !evs.some(e => e.t !== 'poss')) { finalize(evs); return null; }
    const my = ++st.seq; runSvg = svgEl(); lv.anim = true; st.f0 = f; st.cur = evs;
    return run(evs, f)
      .catch(err => { if (err !== CANCEL) console.error(err); finalize(evs); })
      .finally(() => { if (st.seq === my) { lv.anim = false; st.cur = null; } });
  };
  // 재생 중인 장면을 끊는다(건너뛰기·끝까지): 못 보여 준 장면의 슛은 바로 찍는다
  App.stopPlay = () => {
    st.seq++;
    if (st.cur) { finalize(st.cur); st.cur = null; }
    if (App.live) { App.live.anim = false; App.live.reform = true; }
  };
  // liveUpdate가 부른다: 재생 중이 아니면 남은 장면을 반영하고, 필요할 때만 자리를 다시 잡는다
  App.liveCourt = () => {
    const lv = App.live; if (!lv || !svgEl()) return;
    initSvg();
    if (lv.anim) return;
    const plays = lv.game.plays || [];
    const fresh = plays.slice(lv.playIdx); lv.playIdx = plays.length;
    finalize(fresh);
    if (!fresh.length) shown(lv.vizShown ?? -1, false);
    const noDots = !document.querySelector(`#${ID} .pl .pd`);
    if (noDots || lv.reform || !SCALE[lv.speed] || lv.finished) { lv.reform = false; formation(); }
  };
})();
