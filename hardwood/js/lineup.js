// 주전 라인업(PG~C 다섯 자리)과 포지션 적합도·포지션 변경 제안
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, Sim = HM.Sim, R = HM.Ratings;
  const POS = R.POS;
  const POSN = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

  // ---------- 라인업 ----------
  // 다섯 명을 PG~C 자리에 놓는다: 원래 포지션에서 가장 덜 벗어나게(같으면 키 순)
  function slotOrder(players) {
    const ps = players.filter(Boolean).slice(0, 5);
    const slots = [null, null, null, null, null];
    if (!ps.length) return slots;
    let best = null, bestCost = 1e9;
    const idx = [0, 1, 2, 3, 4];
    const perm = (arr, k) => {
      if (k === ps.length) {
        let c = 0;
        for (let i = 0; i < ps.length; i++) c += Math.abs((POSN[ps[i].pos] ?? 2) - arr[i]) * 10 + Math.abs((ps[i].hgt - 180) / 8 - arr[i]) * 0.1;
        if (c < bestCost) { bestCost = c; best = arr.slice(0, ps.length); }
        return;
      }
      for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; }
    };
    perm(idx.slice(), 0);
    ps.forEach((p, i) => { slots[best[i]] = p; });
    return slots;
  }
  function rot(G, tid = G.userTid) {
    const t = G.teams[tid];
    if (!t.rotation) t.rotation = { auto: true, starters: [], minutes: {} };
    return t.rotation;
  }
  const healthy = (G, tid) => L.roster(G, tid).filter(p => !(p.injury && p.injury.days > 0));
  const isFixed = r => !!(r && r.starters && r.starters.some(x => x != null) && (r.fix || !r.auto));
  // 사용자가 고정한 선발(경기에 나설 수 있는 선수만)
  function fixedIds(G, tid = G.userTid) {
    const r = rot(G, tid);
    if (!isFixed(r)) return null;
    const ok = new Set(healthy(G, tid).map(p => p.pid));
    return r.starters.filter(id => id != null && ok.has(id));
  }
  // 지금의 다섯 자리: { slots: [pid|null ×5], fixed }
  function lineup(G, tid = G.userTid) {
    const r = rot(G, tid);
    const mine = new Set(L.roster(G, tid).map(p => p.pid));
    if (isFixed(r)) {
      if (!r.slots) { // 예전 저장(자리 순서가 없는 선발 목록) → 자리 순서로
        r.starters = slotOrder(r.starters.map(id => G.players[id]).filter(p => p && mine.has(p.pid))).map(p => p ? p.pid : null);
        r.slots = true; r.fix = true;
      }
      return { slots: POS.map((_, i) => { const id = r.starters[i]; return id != null && mine.has(id) ? id : null; }), fixed: true };
    }
    const a = Sim.autoRotation(healthy(G, tid), G.phase === 'playoffs');
    return { slots: slotOrder(a.starters.map(id => G.players[id])).map(p => p ? p.pid : null), fixed: false };
  }
  // i번 자리에 선수를 넣는다(이미 다른 자리면 맞바꾼다). pid가 null이면 비운다(코치가 채움).
  function setSlot(G, i, pid) {
    const r = rot(G);
    const cur = lineup(G).slots;
    const prev = cur[i];
    if (pid != null) { const j = cur.indexOf(pid); if (j >= 0 && j !== i) cur[j] = prev; }
    cur[i] = pid;
    // 직접 정한 출전 시간이면 새 선발과 빠진 선수의 시간을 맞바꾼다
    if (!r.auto && r.minutes && pid != null && prev != null && !cur.includes(prev)) {
      const a = +r.minutes[pid] || 0, b = +r.minutes[prev] || 0;
      if (b > a) { r.minutes[pid] = b; r.minutes[prev] = a; }
    }
    r.starters = cur; r.slots = true; r.fix = true;
  }
  function benchPlayer(G, pid) { const i = lineup(G).slots.indexOf(pid); if (i >= 0) setSlot(G, i, null); }
  function resetLineup(G) {
    const r = rot(G);
    r.fix = false;
    if (r.auto) r.starters = [];
    else { r.fix = true; r.slots = true; const a = Sim.autoRotation(healthy(G, G.userTid), G.phase === 'playoffs'); r.starters = slotOrder(a.starters.map(id => G.players[id])).map(p => p ? p.pid : null); }
  }
  // 경기에서 이 선수가 맡는 자리(선발로 지정된 자리, 아니면 원래 포지션)
  function slotPos(G, tid = G.userTid) {
    const r = rot(G, tid); const o = {};
    if (isFixed(r) && r.slots) r.starters.forEach((id, i) => { if (id != null && i < 5) o[id] = POS[i]; });
    return o;
  }

  // ---------- 포지션 적합도 ----------
  // [키, 이름, 값 함수, 가중치, 기록 여부]
  const FEAT = [
    ['hgt', '키', p => p.hgt, 1.6],
    ['pss', '패스', p => p.a.pss, 1.0],
    ['hdl', '볼 핸들링', p => p.a.hdl, 1.0],
    ['tp', '3점 슛', p => p.a.tp, 0.6],
    ['ins', '골밑 마무리', p => p.a.ins, 0.5],
    ['reb', '리바운드', p => (p.a.drb + p.a.orb) / 2, 1.0],
    ['blk', '블록', p => p.a.blk, 0.8],
    ['idef', '골밑 수비', p => p.a.idef, 0.7],
    ['pdef', '외곽 수비', p => p.a.pdef, 0.5],
    ['spd', '스피드', p => p.a.spd, 0.6],
    ['str', '근력', p => p.a.str, 0.6],
    ['ast36', '36분당 어시스트', (p, s) => s ? s.ast * 36 / s.min : null, 1.3, true],
    ['reb36', '36분당 리바운드', (p, s) => s ? (s.orb + s.drb) * 36 / s.min : null, 1.2, true],
    ['blk36', '36분당 블록', (p, s) => s ? s.blk * 36 / s.min : null, 0.7, true],
    ['tpa36', '36분당 3점 시도', (p, s) => s ? s.tpa * 36 / s.min : null, 0.8, true],
  ];
  const MIN_MIN = 250; // 기록을 믿을 만한 최소 출전 시간
  // 이번 시즌 정규리그 합계(여러 팀 합산)
  function seasonStat(p, y) {
    const ls = (p.stats || []).filter(l => l.s === y && !l.po);
    if (!ls.length) return null;
    const o = { gp: 0, min: 0, ast: 0, orb: 0, drb: 0, blk: 0, tpa: 0 };
    for (const l of ls) for (const k in o) o[k] += l[k] || 0;
    return o;
  }
  let cache = null;
  // 리그 전체 선수로 포지션별 평균과 전체 표준편차를 만든다
  function model(G) {
    const key = G.season + '|' + G.date;
    if (cache && cache.key === key && cache.G === G) return cache.m;
    const ps = Object.values(G.players).filter(p => p.tid >= 0 && POSN[p.pos] !== undefined);
    const m = { mu: {}, sd: {} };
    FEAT.forEach(([k, , f, , st]) => {
      const vals = [], byPos = { PG: [], SG: [], SF: [], PF: [], C: [] };
      for (const p of ps) {
        const s = st ? seasonStat(p, G.season) : null;
        if (st && (!s || s.min < MIN_MIN)) continue;
        const v = f(p, s);
        if (v == null || !isFinite(v)) continue;
        vals.push(v); byPos[p.pos].push(v);
      }
      if (vals.length < 30 || POS.some(x => byPos[x].length < 5)) return; // 기록이 아직 모자라면 이 항목은 뺀다
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      m.sd[k] = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
      m.mu[k] = Object.fromEntries(POS.map(x => [x, byPos[x].reduce((a, b) => a + b, 0) / byPos[x].length]));
    });
    cache = { key, G, m };
    return m;
  }
  // 선수의 포지션별 거리와 적합도(0~100)
  function fit(G, p) {
    const m = model(G);
    const s = seasonStat(p, G.season);
    const st = s && s.min >= MIN_MIN ? s : null;
    const xs = {};
    for (const [k, , f, , isSt] of FEAT) { if (!m.mu[k]) continue; const v = f(p, isSt ? st : null); if (v != null && isFinite(v)) xs[k] = v; }
    const d = {};
    for (const pos of POS) {
      let sw = 0, acc = 0;
      for (const [k, , , w] of FEAT) { if (xs[k] === undefined) continue; const z = (xs[k] - m.mu[k][pos]) / m.sd[k]; acc += w * z * z; sw += w; }
      d[pos] = Math.sqrt(acc / (sw || 1));
    }
    const dmin = Math.min(...POS.map(x => d[x]));
    const score = Object.fromEntries(POS.map(x => [x, Math.round(100 * Math.exp(-(d[x] - dmin) * 1.6) * U.clamp(1.15 - dmin * 0.25, 0.6, 1))]));
    const rank = POS.map(pos => ({ pos, d: d[pos], score: score[pos] })).sort((a, b) => a.d - b.d);
    return { d, score, rank, xs, stats: !!st, m };
  }
  // 왜 다른 포지션이 더 맞는지: 두 포지션 평균 중 새 쪽에 더 가까운 항목
  function reasons(G, p, from, to, f = fit(G, p)) {
    const out = [];
    for (const [k, label, , w, isSt] of FEAT) {
      if (f.xs[k] === undefined) continue;
      const x = f.xs[k], a = f.m.mu[k][from], b = f.m.mu[k][to], sd = f.m.sd[k];
      const gain = w * (((x - a) / sd) ** 2 - ((x - b) / sd) ** 2);
      if (gain > 0.05) out.push({ k, label, x, a, b, gain, isSt });
    }
    const fmt = (k, v, isSt) => k === 'hgt' ? Math.round(v) + 'cm' : isSt ? v.toFixed(1) : String(R.disp(v));
    return out.sort((u, v) => v.gain - u.gain).slice(0, 4).map(r => ({ ...r, txt: `${r.label} <b>${fmt(r.k, r.x, r.isSt)}</b> <span class="muted">(${to} 평균 ${fmt(r.k, r.b, r.isSt)} · ${from} 평균 ${fmt(r.k, r.a, r.isSt)})</span>` }));
  }

  // ---------- 포지션 변경 제안(매주 월요일, 우리 선수) ----------
  const GAP = 0.15; // 지금 포지션보다 이만큼 더 가까워야 제안한다
  function candidates(G, tid = G.userTid) {
    const y = G.season, out = [];
    for (const p of L.roster(G, tid)) {
      const s = seasonStat(p, y);
      if (!s || s.gp < 12 || s.min < 300) continue;
      const f = fit(G, p);
      if (!f.stats) continue;
      const best = f.rank[0];
      if (best.pos === p.pos) continue;
      const gap = f.d[p.pos] - best.d;
      // 옆 포지션으로는 쉽게, 멀리 옮기는 건 차이가 아주 클 때만
      if (gap < (Math.abs(POSN[best.pos] - POSN[p.pos]) === 1 ? GAP : GAP * 3)) continue;
      out.push({ p, from: p.pos, to: best.pos, gap, f });
    }
    return out.sort((a, b) => b.gap - a.gap);
  }
  function posCheck(G) {
    const S = HM.Season;
    if (G.phase !== 'regular' || !S.autoSet(G).posSugg) return null;
    const c = candidates(G).find(x => x.p.posAsk !== G.season);
    if (!c) return null;
    const { p, from, to, f } = c;
    p.posAsk = G.season;
    const why = reasons(G, p, from, to, f);
    const KO = R.POS_KO;
    const fitTxt = f.rank.map(r => `${r.pos} ${r.score}`).join(' · ');
    S.msg(G, `포지션 변경 제안: ${p.name} (${from} → ${to})`,
      `<p>수석 코치: 이번 시즌 기록과 능력치를 보면 <b>${U.esc(p.name)}</b>은(는) ${KO[from]}(${from})보다 <b>${KO[to]}(${to})</b>에 더 잘 맞습니다.</p>
      ${why.length ? `<ul>${why.map(r => `<li>${r.txt}</li>`).join('')}</ul>` : ''}
      <p class="small muted">포지션 적합도: ${fitTxt}</p>
      <p class="small muted">포지션은 경기에서 누구를 막는지(매치업), 코치의 선발·교체 구성, 매니저 모드의 포지션 진단에 쓰입니다. 능력치는 바뀌지 않습니다. 주전 라인업에서 자리만 바꿔 써 볼 수도 있습니다.</p>`,
      { type: 'pos', pid: p.pid, from, to });
    return c;
  }
  // 포지션 바꾸기(사용자가 정한 포지션은 실제 커리어 모드에서도 유지)
  function setPos(G, p, pos) {
    if (!POS.includes(pos)) return;
    p.pos = pos; p.posUser = true; p.posAsk = G.season;
  }

  HM.Lineup = { slotOrder, lineup, setSlot, benchPlayer, resetLineup, fixedIds, slotPos, isFixed, fit, reasons, candidates, posCheck, setPos, seasonStat, FEAT, GAP };
})();
