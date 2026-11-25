// 집중 훈련: 시즌마다 최대 3명. 매일 조금씩 능력치를 올려 잠재력까지 끌어올린다.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, R = HM.Ratings, L = HM.L, P = HM.P;

  const MAX = 3;
  // 훈련 분야: [이름, 오르는 능력치, 설명]
  const FOCUS = {
    shoot: ['슈팅', ['tp', 'mid', 'ft'], '3점·중거리·자유투'],
    inside: ['골밑 마무리', ['ins', 'str'], '골밑 득점·몸싸움'],
    play: ['플레이메이킹', ['pss', 'hdl', 'iq'], '패스·볼 핸들링·판단'],
    perD: ['외곽 수비', ['pdef', 'stl', 'spd'], '대인 수비·스틸·발'],
    inD: ['골밑 수비', ['idef', 'blk', 'drb'], '림 보호·블록·수비 리바운드'],
    reb: ['리바운드', ['orb', 'drb', 'str'], '공수 리바운드·근력'],
    phys: ['신체 조건', ['ath', 'spd', 'str', 'sta'], '운동 능력·스피드·근력·지구력'],
    mind: ['농구 IQ·멘탈', ['iq', 'cmp', 'ldr'], '판단·침착성·리더십'],
    all: ['전체 균형', ['ins', 'mid', 'tp', 'pss', 'hdl', 'pdef', 'idef', 'drb', 'iq'], '고르게(느림)'],
  };
  const INT = { 0: ['가볍게', 0.7, '부상 위험 없음, 사기 조금 오름'], 1: ['보통', 1.0, ''], 2: ['강하게', 1.4, '부상 위험·사기 저하'] };
  const BASE = 0.045; // 하루에 오르는 능력치(내부 눈금) 기본값
  // 포지션별로 그 분야가 얼마나 쓸모 있나(추천에 쓴다)
  const REL = {
    PG: { shoot: 1.1, inside: 0.7, play: 1.2, perD: 1.0, inD: 0.4, reb: 0.5, phys: 0.9, mind: 0.9 },
    SG: { shoot: 1.25, inside: 0.8, play: 0.95, perD: 1.0, inD: 0.5, reb: 0.6, phys: 0.9, mind: 0.8 },
    SF: { shoot: 1.1, inside: 1.0, play: 0.8, perD: 1.05, inD: 0.8, reb: 0.85, phys: 1.0, mind: 0.8 },
    PF: { shoot: 0.9, inside: 1.1, play: 0.6, perD: 0.7, inD: 1.15, reb: 1.15, phys: 1.0, mind: 0.8 },
    C: { shoot: 0.6, inside: 1.2, play: 0.5, perD: 0.5, inD: 1.35, reb: 1.25, phys: 1.0, mind: 0.8 },
  };

  function state(G) {
    if (!G.training) G.training = { slots: [], log: [], season: G.season };
    G.training.slots = G.training.slots.filter(s => G.players[s.pid] && G.players[s.pid].tid === G.userTid);
    return G.training;
  }
  const slotOf = (G, pid) => state(G).slots.find(s => s.pid === pid) || null;
  const isTrainee = (G, pid) => !!(G.training && G.training.slots.some(s => s.pid === pid));

  const ovrOf = (a, t) => R.ovr(a, t);
  // 분야별 효율: 그 분야 능력치를 1단계(내부 5) 올리면 OVR이 얼마나 오르나
  function efficiency(p, focus) {
    const keys = FOCUS[focus][1];
    const a = Object.assign({}, p.a);
    for (const k of keys) a[k] = Math.min(99, a[k] + 5);
    return ovrOf(a, p.t) - ovrOf(p.a, p.t);
  }
  function ageMult(age) { return age <= 21 ? 1.5 : age <= 24 ? 1.25 : age <= 27 ? 1.0 : age <= 30 ? 0.7 : 0.4; }
  function rate(G, p, slot) {
    const age = P.age(p, G.season);
    const gap = p.pa - p.ovr;
    const gapMult = U.clamp(gap / 5, 0, 1);
    return BASE * ageMult(age) * (0.6 + p.a.wrk / 100) * INT[slot.int][1] * gapMult;
  }
  // 코치 추천 분야: OVR 효율 × 남은 여지
  function recommend(p) {
    let best = 'all', bs = -1;
    const fs = Object.keys(FOCUS).filter(f => f !== 'all');
    const effMax = Math.max(0.01, ...fs.map(f => efficiency(p, f)));
    for (const f of fs) {
      const room = U.avg(FOCUS[f][1].map(k => 99 - p.a[k])) / 50;
      const s = (0.4 + 0.6 * Math.max(0, efficiency(p, f)) / effMax) * (0.5 + room) * ((REL[p.pos] || REL.SF)[f] || 1);
      if (s > bs) { bs = s; best = f; }
    }
    return best;
  }
  // 훈련 가치(대상 추천용)
  function prospectScore(G, p) {
    const age = P.age(p, G.season);
    return Math.max(0, p.pa - p.ovr) * ageMult(age) * (0.6 + p.a.wrk / 100);
  }

  function assign(G, pid, focus, int) {
    const st = state(G);
    const s = slotOf(G, pid);
    if (s) { if (focus) s.focus = focus; if (int !== undefined) s.int = int; return s; }
    if (st.slots.length >= MAX) return null;
    const p = G.players[pid];
    const n = { pid, focus: focus || recommend(p), int: int ?? 1, prog: 0, gain: {}, since: G.date, ovr0: p.ovr, capped: false };
    st.slots.push(n);
    return n;
  }
  function remove(G, pid) { const st = state(G); st.slots = st.slots.filter(s => s.pid !== pid); }

  // 하루치 훈련
  function tick(G) {
    const st = state(G);
    if (!st.slots.length) return;
    for (const s of st.slots) {
      const p = G.players[s.pid];
      if (!p || (p.injury && p.injury.days > 0)) continue;
      // 강도에 따른 사기·부상
      if (s.int === 2) {
        p.morale = U.clamp((p.morale ?? 60) - 0.03, 0, 100);
        if (Math.random() < 0.00035 && HM.Season.injure) { HM.Season.injure(G, p); st.log.push({ date: G.date, pid: p.pid, inj: p.injury && p.injury.type }); continue; }
      } else if (s.int === 0) p.morale = U.clamp((p.morale ?? 60) + 0.01, 0, 100);
      if (p.ovr >= p.pa - 0.2) {
        if (!s.capped) { s.capped = true; HM.Season.msg(G, `🏋️ 잠재력 도달: ${p.name}`, `${p.name} 선수가 지금 잠재력(${Math.round(p.pa)})에 닿았습니다. 더 오르기는 어렵습니다. 다른 선수에게 훈련 자리를 넘기는 것을 고려하세요.`, { type: 'train', pid: p.pid }); }
        continue;
      }
      s.capped = false;
      s.prog += rate(G, p, s);
      let changed = false;
      while (s.prog >= 1) {
        s.prog -= 1;
        const keys = FOCUS[s.focus][1].filter(k => p.a[k] < 99);
        if (!keys.length) break;
        // 남은 여지가 클수록 잘 오른다(고르게 퍼지게)
        const k = U.wpick(keys, keys.map(x => Math.pow(100 - p.a[x], 1.3)));
        const before = R.disp(p.a[k]);
        p.a[k] = Math.min(99, p.a[k] + 1);
        s.gain[k] = (s.gain[k] || 0) + 1;
        p.tb = p.tb || {}; p.tb[k] = (p.tb[k] || 0) + 1;
        // 3점이 늘면 3점 시도도 조금 는다
        if (k === 'tp' && p.a.tp >= 50) p.t.r3 = U.clamp(p.t.r3 + 0.002, 0, 0.85);
        const after = R.disp(p.a[k]);
        if (after > before) st.log.push({ date: G.date, pid: p.pid, k, from: before, to: after });
        changed = true;
      }
      if (changed) { const pa = p.pa; P.update(p); p.pa = Math.max(pa, p.ovr); }
    }
    if (G.date.endsWith('-01') && st.log.length) report(G, `🏋️ 훈련 보고서 — ${+G.date.slice(5, 7)}월`);
  }

  function report(G, title) {
    const st = state(G);
    const by = {};
    for (const e of st.log) (by[e.pid] = by[e.pid] || []).push(e);
    const rows = Object.entries(by).map(([pid, evs]) => {
      const p = G.players[pid]; if (!p) return '';
      const ups = evs.filter(e => e.k).map(e => `${R.LABEL[e.k]} ${e.from}→${e.to}`);
      const inj = evs.filter(e => e.inj).map(e => `부상: ${e.inj}`);
      return `<li><a class="lnk" href="#/player/${p.pid}">${U.esc(p.name)}</a> — ${ups.concat(inj).join(', ')} <span class="muted">(지금 능력 ${Math.round(p.ovr)} / 잠재력 ${Math.round(p.pa)})</span></li>`;
    }).join('');
    st.log = [];
    if (rows) HM.Season.msg(G, title, `<ul>${rows}</ul><a class="btn" href="#/training">집중 훈련 화면</a>`, { type: 'train' });
  }

  // 시즌이 끝날 때: 지난 시즌 성과를 알리고 시즌 기록을 새로 시작한다
  function seasonEnd(G) {
    const st = state(G);
    if (st.log.length) report(G, '🏋️ 훈련 보고서 — 시즌 마무리');
    const rows = st.slots.map(s => {
      const p = G.players[s.pid];
      const g = Object.entries(s.gain).filter(([, v]) => v > 0).map(([k, v]) => `${R.LABEL[k]} +${(v / 5).toFixed(1)}`);
      return `<li><b>${U.esc(p.name)}</b> (${FOCUS[s.focus][0]}, ${INT[s.int][0]}): ${g.join(', ') || '변화 없음'} · 능력 ${Math.round(s.ovr0)} → ${Math.round(p.ovr)}</li>`;
    }).join('');
    if (rows) HM.Season.msg(G, `🏋️ ${U.seasonLabel(G.season)} 집중 훈련 결과`, `<ul>${rows}</ul>훈련 대상과 분야는 그대로 이어집니다. 새 시즌에 맞게 다시 골라 보세요.<br><span class="small muted">능력치 변화는 1~20 눈금 기준</span>`, { type: 'train' });
    for (const s of st.slots) { s.gain = {}; s.since = G.date; s.ovr0 = G.players[s.pid].ovr; }
    st.season = G.season + 1;
  }

  // 실제 커리어 모드: 새 시즌 실제 능력치 위에 그동안 훈련으로 얻은 몫을 다시 얹는다(잠재력 한도 안)
  function applyBonus(p, age) {
    if (!p.tb) return;
    if (age >= 30) for (const k in p.tb) p.tb[k] *= 0.8; // 나이 들면 조금씩 사라진다
    const base = Object.assign({}, p.a);
    const pa = p.pa;
    const at = s => { const a = Object.assign({}, base); for (const k in p.tb) a[k] = U.clamp(base[k] + p.tb[k] * s, 1, 99); return a; };
    if (ovrOf(base, p.t) >= pa) return;
    let s = 1;
    if (ovrOf(at(1), p.t) > pa) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (ovrOf(at(m), p.t) > pa) hi = m; else lo = m; }
      s = lo;
    }
    p.a = at(s);
    P.update(p);
    p.pa = Math.max(pa, p.ovr);
  }

  HM.Train = { MAX, FOCUS, INT, state, slotOf, isTrainee, efficiency, recommend, prospectScore, rate, assign, remove, tick, seasonEnd, applyBonus, report };
})();
