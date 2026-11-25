// 매니저 모드: 수석 코치의 분석과 조언. 전술 효과는 경기 엔진과 같은 공식(Sim.tacticTermFor)으로 계산한다.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, AI = HM.AI, Sim = HM.Sim, R = HM.Ratings;

  const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const ADJ = { PG: ['SG'], SG: ['PG', 'SF'], SF: ['SG', 'PF'], PF: ['SF', 'C'], C: ['PF'] };
  const CATS = [
    ['tp', '3점 슛', p => p.a.tp, '외곽 슈터'],
    ['ins', '골밑 득점', p => p.a.ins, '골밑 득점원'],
    ['play', '볼 운반·패스', p => (p.a.pss + p.a.hdl) / 2, '볼 핸들러·패서'],
    ['reb', '리바운드', p => (p.a.orb + p.a.drb) / 2, '리바운더'],
    ['rim', '림 보호', p => (p.a.blk + p.a.idef) / 2, '림 프로텍터'],
    ['per', '외곽 수비', p => (p.a.pdef + p.a.stl) / 2, '외곽 수비수'],
    ['ath', '운동 능력', p => (p.a.spd + p.a.ath) / 2, '운동 능력 좋은 선수'],
    ['iq', '경기 운영', p => (p.a.iq + p.a.cmp) / 2, '노련한 선수'],
  ];
  const catF = Object.fromEntries(CATS.map(c => [c[0], c[2]]));

  // 팀의 예상 로테이션(사용자가 직접 정했으면 그대로)
  function rotation(G, tid) {
    const ps = L.roster(G, tid).filter(p => !(p.injury && p.injury.days > 0));
    const t = G.teams[tid];
    if (tid === G.userTid && t.rotation && !t.rotation.auto && t.rotation.starters && t.rotation.starters.length) {
      const minutes = {};
      for (const p of ps) minutes[p.pid] = +t.rotation.minutes[p.pid] || 0;
      return { ps, minutes, starters: t.rotation.starters.filter(id => ps.some(p => p.pid === id)) };
    }
    const r = Sim.autoRotation(ps, G.phase === 'playoffs');
    return { ps, minutes: r.minutes, starters: r.starters };
  }
  function starters(G, tid) {
    const r = rotation(G, tid);
    const five = r.starters.map(id => r.ps.find(p => p.pid === id)).filter(Boolean);
    for (const p of r.ps.slice().sort((a, b) => b.ovr - a.ovr)) if (five.length < 5 && !five.includes(p)) five.push(p);
    return five;
  }

  // ---------- 팀 진단 ----------
  function teamCats(G, tid) {
    const r = rotation(G, tid);
    let w = 0; const v = {}; let o = 0, d = 0;
    for (const c of CATS) v[c[0]] = 0;
    for (const p of r.ps) {
      const m = r.minutes[p.pid] || 0; if (!m) continue;
      w += m; o += p.o * m; d += p.d * m;
      for (const c of CATS) v[c[0]] += c[2](p) * m;
    }
    for (const c of CATS) v[c[0]] /= w || 1;
    v.off = o / (w || 1) * 5; v.def = d / (w || 1) * 5;
    const byOvr = r.ps.slice().sort((a, b) => b.ovr - a.ovr);
    v.bench = U.avg(byOvr.slice(5, 9).map(p => p.ovr));
    return v;
  }
  let profCache = null;
  function leagueProfile(G) {
    const key = G.date + '|' + G.season + '|' + Object.keys(G.players).length + '|' + (G.tradeLog ? G.tradeLog.length : 0);
    if (profCache && profCache.key === key && profCache.G === G) return profCache.data;
    const all = G.teams.map(t => ({ tid: t.tid, v: teamCats(G, t.tid) }));
    const keys = CATS.map(c => c[0]).concat(['off', 'def', 'bench']);
    const rank = {}, avg = {};
    for (const k of keys) {
      const sorted = all.slice().sort((a, b) => b.v[k] - a.v[k]);
      sorted.forEach((x, i) => { (rank[x.tid] = rank[x.tid] || {})[k] = i + 1; });
      avg[k] = U.avg(all.map(x => x.v[k]));
    }
    const data = { all: Object.fromEntries(all.map(x => [x.tid, x.v])), rank, avg, n: G.teams.length };
    profCache = { key, G, data };
    return data;
  }
  const LABEL = Object.assign(Object.fromEntries(CATS.map(c => [c[0], c[1]])), { off: '공격력', def: '수비력', bench: '벤치 깊이' });
  function diagnose(G, tid) {
    const lp = leagueProfile(G);
    const n = lp.n, v = lp.all[tid], rk = lp.rank[tid];
    const items = Object.keys(LABEL).map(k => ({ k, label: LABEL[k], val: v[k], avg: lp.avg[k], rank: rk[k], tag: rk[k] <= Math.ceil(n * 0.2) ? 'good' : rk[k] > Math.floor(n * 0.7) ? 'bad' : '' }));
    const weak = items.filter(x => x.tag === 'bad' && CATS.some(c => c[0] === x.k));
    const strong = items.filter(x => x.tag === 'good');
    return { items, weak, strong, n };
  }

  // ---------- 포지션 뎁스 ----------
  function depth(G, tid) {
    const ps = L.roster(G, tid).slice().sort((a, b) => b.ovr - a.ovr);
    const healthy = ps.filter(p => !(p.injury && p.injury.days > 20));
    const top5 = U.avg(healthy.slice(0, 5).map(p => p.ovr));
    const cut = healthy[Math.min(8, healthy.length - 1)]?.ovr || 0;
    const res = {};
    for (const pos of POS) {
      const list = ps.filter(p => p.pos === pos);
      const avail = list.filter(p => !(p.injury && p.injury.days > 20));
      const cover = healthy.filter(p => ADJ[pos].includes(p.pos)).map(p => p.ovr - 3);
      const best = Math.max(avail[0]?.ovr || 0, ...cover, 0);
      const rot = avail.filter(p => p.ovr >= cut).length;
      let need = Math.max(0, top5 - best) + (avail.length === 0 ? 6 : rot === 0 ? 4 : avail.length === 1 ? 1.5 : 0);
      if (list.length >= 4) need -= 2;
      res[pos] = { list, best, rot, need, count: list.length, short: need >= 6 || avail.length === 0, many: list.length >= 4 };
    }
    const needs = POS.slice().sort((a, b) => res[b].need - res[a].need).filter(p => res[p].need >= 4);
    return { pos: res, needs, top5, cut };
  }

  // ---------- 방출 추천 ----------
  function releaseCands(G) {
    const tid = G.userTid, cy = AI.capYear(G);
    const ps = L.roster(G, tid).slice().sort((a, b) => b.ovr - a.ovr);
    const dp = depth(G, tid);
    const out = [];
    ps.forEach((p, i) => {
      const age = P.age(p, cy);
      const mv = F.marketValue(p, cy, age);
      const reasons = [];
      let keep = AI.value(G, p, tid) + (i < 8 ? 3 : i < 10 ? 1 : 0);
      if (dp.pos[p.pos].short) keep += 1.5;
      if (p.contract && p.contract.amt > mv * 1.4 && p.contract.amt > F.minSal(cy) * 2) reasons.push(`능력 대비 연봉이 높음(시장 가치 ${U.money(mv)})`);
      if (i >= 11) reasons.push(`로스터 ${i + 1}번째 — 출전 기회가 거의 없음`);
      if (age >= 32 && p.ovr < 76) reasons.push(`${age}세, 하락세`);
      const better = ps.filter(x => x.pos === p.pos && x.ovr > p.ovr).length;
      if (better >= 2 && dp.pos[p.pos].many) reasons.push(`같은 포지션(${p.pos})에 더 나은 선수 ${better}명`);
      if (p.injury && p.injury.days > 60) reasons.push(`장기 부상(${p.injury.days}일)`);
      if (P.age(p, cy) <= 23 && p.pa - p.ovr >= 6) { keep += 2; }
      const yrs = p.contract ? Math.max(0, p.contract.exp - cy + 1) : 0;
      const dead = p.contract ? p.contract.amt * yrs : 0;
      if (reasons.length) out.push({ p, keep, reasons, dead, yrs, rank: i + 1 });
    });
    return out.sort((a, b) => a.keep - b.keep).slice(0, 5);
  }

  // ---------- 영입 추천 ----------
  function fitOf(G, p, diag, dp) {
    const reasons = [];
    let fit = 0;
    if (dp.pos[p.pos] && dp.pos[p.pos].need >= 4) { fit += 4; reasons.push(`부족한 ${p.pos} 보강`); }
    for (const w of diag.weak) {
      const f = catF[w.k];
      if (f && f(p) >= 72) { fit += 2.5; reasons.push(`약점(${w.label}) 보완`); }
    }
    return { fit, reasons };
  }
  function faTargets(G) {
    const tid = G.userTid, cy = AI.capYear(G);
    const diag = diagnose(G, tid), dp = depth(G, tid);
    const full = L.roster(G, tid).length >= 15;
    const out = [];
    for (const p of L.fas(G)) {
      const ask = AI.asking(G, p);
      const age = P.age(p, cy);
      const gain = p.ovr - dp.cut;
      const youth = age <= 24 && p.pa - p.ovr >= 6 ? (p.pa - p.ovr) * 0.3 : 0;
      if (gain <= 0 && youth < 2) continue;
      const { fit, reasons } = fitOf(G, p, diag, dp);
      if (gain > 0) reasons.unshift(`현재 로테이션보다 능력 +${Math.round(gain)}`);
      if (youth) reasons.push(`성장 가능성(잠재력 ${P.potShown(p, G)})`);
      const can = AI.canSign(G, tid, ask.amt, false);
      let score = gain * 1.2 + fit + youth;
      if (!can) { score -= 8; reasons.push('캡 여유 부족 — 지금 요구액으로는 계약 불가'); }
      out.push({ p, score, reasons, ask, can: !!can, full });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }
  function tradeTargets(G) {
    const tid = G.userTid, cy = AI.capYear(G);
    const diag = diagnose(G, tid), dp = depth(G, tid);
    const mine = L.roster(G, tid).slice().sort((a, b) => b.ovr - a.ovr);
    const starterCut = mine[4]?.ovr || 0;
    const out = [];
    // 우리가 내줄 수 있는 자산(상대 팀이 보는 가치): 핵심 두 명을 뺀 선수 넷 + 1라운드 지명권 둘
    const core = coreOf(G, tid);
    const budgetCache = {};
    const budget = partner => {
      if (budgetCache[partner] !== undefined) return budgetCache[partner];
      const pv = mine.filter(x => !core.includes(x.pid)).map(x => AI.value(G, x, partner)).sort((a, b) => b - a).slice(0, 4).reduce((s, v) => s + v, 0);
      const kv = G.picks.filter(k => k.tid === tid && k.round === 1 && k.season > G.season).slice(0, 2).reduce((s, k) => s + AI.pickValue(G, k, partner), 0);
      return (budgetCache[partner] = pv + kv);
    };
    for (const p of Object.values(G.players)) {
      if (p.tid < 0 || p.tid === tid) continue;
      if (p.injury && p.injury.days > 30) continue;
      const t = G.teams[p.tid];
      const cost0 = AI.value(G, p, p.tid), bud = budget(p.tid);
      if (cost0 > bud * 0.6) continue; // 핵심 선수를 내주지 않고는 현실성이 없다
      const { fit, reasons } = fitOf(G, p, diag, dp);
      const gain = p.ovr - dp.cut;
      if (p.ovr < starterCut - 2 && !(fit >= 4 && gain >= 3)) continue;
      const age = P.age(p, cy);
      let score = gain * 0.9 + fit;
      if (p.ovr >= starterCut) reasons.unshift(`주전급(능력 ${Math.round(p.ovr)})`);
      if (t.strategy === 'rebuild' && age >= 27) { score += 3; reasons.push('상대가 리빌딩 중 — 베테랑을 내줄 의향'); }
      if (t.strategy === 'contend' && p.ovr >= 84) { score -= 3; reasons.push('우승 도전 팀이라 내주기 어려움'); }
      const cost = cost0;
      score -= cost / (bud || 1) * 4;
      reasons.push(cost < bud * 0.35 ? '대가 부담이 적음' : '주요 자산 한둘이 필요');
      out.push({ p, score, reasons, cost, team: t });
    }
    // 실제로 상대가 받아 줄 묶음을 만들 수 있는 대상만 남긴다(예상 대가 포함)
    const res = [];
    for (const x of out.sort((a, b) => b.score - a.score).slice(0, 14)) {
      const pkg = AI.balance(G, { a: tid, b: x.p.tid, ap: [], bp: [x.p.pid], ak: [], bk: [] }, x.p.tid, core);
      if (!pkg) continue;
      x.pkg = pkg;
      res.push(x);
      if (res.length >= 5) break;
    }
    return res;
  }

  // 팀의 핵심(내주지 않을) 선수 두 명
  function coreOf(G, tid) {
    return L.roster(G, tid).map(p => ({ p, v: AI.value(G, p, tid) })).sort((a, b) => b.v - a.v).slice(0, 2).map(x => x.p.pid);
  }

  // ---------- 전술 추천 ----------
  // 리그 평균 수비/공격 다섯 명(가상의 선수)
  function avgFive(G) {
    const lp = leagueProfile(G);
    void lp;
    const ps = [];
    for (const t of G.teams) ps.push(...starters(G, t.tid));
    const a = {}; for (const k of R.KEYS) a[k] = U.avg(ps.map(p => p.a[k]));
    const p0 = { a, ovr: U.avg(ps.map(p => p.ovr)), hgt: 200 };
    return [p0, p0, p0, p0, p0];
  }
  const BASE = { pace: 1, focus: 'bal', def: 'man', reb: 'bal' };
  const TXT = {
    focus: { bal: '균형', in: '골밑 공략', out: '외곽·3점', motion: '모션 오펜스', star: '에이스 중심' },
    def: { man: '대인 방어', zone: '지역 방어', press: '전면 압박' },
    reb: { bal: '보통', crash: '공격 리바운드 가담', back: '백코트 우선' },
    pace: { 0: '느리게', 1: '보통', 2: '빠르게' },
  };
  // myFive vs oppFive(없으면 리그 평균). 각 항목의 선택지별 효과(100포제션당 득실)
  function tacticOptions(G, myFive, oppFive, oppTac) {
    const opp = oppFive || avgFive(G);
    const ot = Object.assign({}, BASE, oppTac || {});
    const res = {};
    // 공격 전술: 우리 공격 효율
    res.focus = Object.keys(TXT.focus).map(f => ({ v: f, eff: Sim.tacticTermFor(myFive, opp, { focus: f, reb: 'bal' }, { def: ot.def, reb: ot.reb }) - Sim.tacticTermFor(myFive, opp, { focus: 'bal', reb: 'bal' }, { def: ot.def, reb: ot.reb }) }));
    // 수비 전술: 상대 공격 효율을 얼마나 깎나
    res.def = Object.keys(TXT.def).map(d => ({ v: d, eff: -(Sim.tacticTermFor(opp, myFive, { focus: ot.focus, reb: ot.reb }, { def: d, reb: 'bal' }) - Sim.tacticTermFor(opp, myFive, { focus: ot.focus, reb: ot.reb }, { def: 'man', reb: 'bal' })) }));
    // 리바운드: 우리 공격 + 상대 공격 양쪽
    res.reb = Object.keys(TXT.reb).map(r => {
      const mine = Sim.tacticTermFor(myFive, opp, { focus: 'bal', reb: r }, { def: 'man', reb: ot.reb }) - Sim.tacticTermFor(myFive, opp, { focus: 'bal', reb: 'bal' }, { def: 'man', reb: ot.reb });
      const theirs = Sim.tacticTermFor(opp, myFive, { focus: 'bal', reb: ot.reb }, { def: 'man', reb: r }) - Sim.tacticTermFor(opp, myFive, { focus: 'bal', reb: ot.reb }, { def: 'man', reb: 'bal' });
      return { v: r, eff: mine - theirs };
    });
    for (const k of ['focus', 'def', 'reb']) res[k].sort((a, b) => b.eff - a.eff);
    return res;
  }
  function paceAdvice(G, tid, oppTid) {
    const mine = L.strength(G, tid);
    const opp = oppTid !== undefined && oppTid !== null ? L.strength(G, oppTid) : U.avg(G.teams.map(t => L.strength(G, t.tid)));
    const five = starters(G, tid);
    const sta = U.avg(five.map(p => p.a.sta));
    const diff = mine - opp;
    if (diff >= 1.5 && sta >= 55) return { v: 2, why: `전력이 ${oppTid !== undefined ? '상대보다' : '리그 평균보다'} 앞섭니다. 포제션이 많을수록 강한 팀이 이길 확률이 커집니다.` };
    if (diff <= -1.5) return { v: 0, why: `전력이 ${oppTid !== undefined ? '상대보다' : '리그 평균보다'} 뒤집니다. 포제션을 줄여 변수를 키우세요.` };
    if (sta < 50) return { v: 0, why: '주전들의 지구력이 낮아 빠른 템포는 후반에 무너집니다.' };
    return { v: 1, why: '전력 차가 크지 않아 보통 템포가 무난합니다.' };
  }
  function recommendTactics(G, tid, oppTid) {
    const my = starters(G, tid);
    const opp = oppTid !== undefined && oppTid !== null ? starters(G, oppTid) : null;
    const oppTac = opp ? G.teams[oppTid].tactics : null;
    const opts = tacticOptions(G, my, opp, oppTac);
    const cur = G.teams[tid].tactics;
    const pick = k => opts[k][0].eff > 0.25 ? opts[k][0] : opts[k].find(x => x.v === BASE[k]);
    const rec = { focus: pick('focus').v, def: pick('def').v, reb: pick('reb').v, pace: paceAdvice(G, tid, oppTid).v };
    const effOf = (k, v) => (opts[k].find(x => x.v === v) || { eff: 0 }).eff;
    const gain = ['focus', 'def', 'reb'].reduce((s, k) => s + effOf(k, rec[k]) - effOf(k, cur[k]), 0);
    return { rec, opts, pace: paceAdvice(G, tid, oppTid), cur, gain };
  }

  // ---------- 상대 분석 ----------
  function matchup(G, oppTid) {
    const d = diagnose(G, oppTid);
    const t = G.teams[oppTid];
    const notes = [];
    for (const x of d.items) {
      if (x.tag === 'good') notes.push({ good: false, txt: `${x.label} 리그 ${x.rank}위 — 경계` });
      if (x.tag === 'bad') notes.push({ good: true, txt: `${x.label} 리그 ${x.rank}위 — 공략 지점` });
    }
    const key = L.roster(G, oppTid).filter(p => !(p.injury && p.injury.days > 0)).sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    const out = L.roster(G, oppTid).filter(p => p.injury && p.injury.days > 0 && p.ovr >= 76);
    return { notes, key, out, tac: t.tactics, rt: recommendTactics(G, G.userTid, oppTid) };
  }

  // ---------- 경기 중 조언 ----------
  function sums(t) {
    const o = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pts: 0 };
    for (const r of t.roster) for (const k in o) o[k] += r.s[k];
    return o;
  }
  function bestSub(t, out, pred) {
    const bench = t.roster.filter(r => !r.onCourt && !r.out && r !== out && r.energy > 0.8 && r.target > 0);
    const same = bench.filter(r => r.p.pos === out.p.pos || ADJ[out.p.pos].includes(r.p.pos));
    const pool = (pred ? bench.filter(pred) : same.length ? same : bench);
    return pool.sort((a, b) => b.p.ovr - a.p.ovr)[0] || null;
  }
  // tips: [{id, pri, txt, kind:'sub'|'tac', act()}]
  function liveTips(game, side) {
    const my = game.T[side], op = game.T[1 - side];
    const q = game.q, clock = game.clock;
    const margin = game.score[side] - game.score[1 - side];
    const ms = sums(my), os = sums(op);
    const tips = [];
    const setTac = (k, v) => () => { my.tac[k] = v; };
    const hold = () => { my.holdUntil = game.elapsed + 150; };
    const swap = (outR, inR) => () => { const court = my.court.map(r => r === outR ? inR : r); game.setCourt(my, court); hold(); };
    const late = q >= 4 && clock <= 300;
    // 클로징 라인업
    if (q >= 4 && clock <= 240 && Math.abs(margin) <= 8) {
      const best = my.roster.filter(r => !r.out).sort((a, b) => b.p.ovr - a.p.ovr).slice(0, 5);
      const missing = best.filter(r => !r.onCourt);
      if (missing.length && missing.every(r => r.energy > 0.5)) tips.push({ id: 'close', pri: 10, kind: 'sub', txt: `접전 막판입니다. 최고 다섯 명(${best.map(r => r.nm).join(', ')})으로 마무리하세요.`, act: () => { game.setCourt(my, best); my.holdUntil = game.elapsed + 600; } });
    }
    // 추격 / 굳히기
    if (q >= 4 && clock <= 420 && margin <= -9 && margin >= -22 && (my.tac.pace !== 2 || my.tac.def !== 'press')) tips.push({ id: 'chase', pri: 9, kind: 'tac', txt: `${-margin}점 차 추격 중입니다. 템포를 올리고 전면 압박으로 공을 빼앗으세요.`, act: () => { my.tac.pace = 2; my.tac.def = 'press'; } });
    if (q >= 4 && clock <= 300 && margin >= 18 && my.court.some(r => r.target >= 28)) {
      const bench = my.roster.filter(r => !r.out && r.target < 26).sort((a, b) => b.energy - a.energy).slice(0, 5);
      if (bench.length === 5) tips.push({ id: 'rest', pri: 6, kind: 'sub', txt: `${margin}점 차 — 승부가 기울었습니다. 주전을 쉬게 해 부상 위험을 줄이세요.`, act: () => { game.setCourt(my, bench); my.holdUntil = game.elapsed + 600; } });
    }
    if (q >= 4 && clock <= 300 && margin >= 6 && margin < 18 && my.tac.def === 'press') tips.push({ id: 'unpress', pri: 7, kind: 'tac', txt: '앞서고 있습니다. 압박을 풀고 대인 방어로 실점을 줄이세요.', act: setTac('def', 'man') });
    // 체력·파울
    for (const r of my.court) {
      if (r.energy < 0.6 && !late) {
        const sub = bestSub(my, r);
        if (sub) tips.push({ id: 'tired' + r.p.pid, pri: 7, kind: 'sub', txt: `${r.nm} 체력 ${Math.round(r.energy * 100)}% — ${sub.nm}로 바꿔 숨을 돌리게 하세요.`, act: swap(r, sub) });
      }
      const lim = q <= 2 ? q + 1 : q === 3 ? 4 : 5;
      if (r.fouls >= lim && !(q >= 4 && clock < 360) && r.fouls < 6) {
        const sub = bestSub(my, r);
        if (sub) tips.push({ id: 'foul' + r.p.pid, pri: 8, kind: 'sub', txt: `${r.nm} 파울 트러블(${r.fouls}반칙) — 벤치에서 아끼세요.`, act: swap(r, sub) });
      }
    }
    // 상대 슈팅
    if (os.tpa >= 8 && os.tpm / os.tpa >= 0.45 && my.tac.def === 'zone') tips.push({ id: 'zone3', pri: 8, kind: 'tac', txt: `상대가 3점을 ${os.tpm}/${os.tpa}로 터뜨립니다. 지역 방어를 풀고 대인 방어로 바꾸세요.`, act: setTac('def', 'man') });
    const oppPaint = op.st.pitp, myIdef = U.avg(my.court.map(r => r.p.a.idef)), oppTp = U.avg(op.court.map(r => r.p.a.tp));
    if (my.tac.def === 'man' && oppPaint >= 14 + q * 6 && oppTp < 58 && myIdef >= 55) tips.push({ id: 'zonein', pri: 6, kind: 'tac', txt: `상대가 골밑에서 ${oppPaint}점을 넣었고 외곽은 약합니다. 지역 방어로 페인트존을 잠그세요.`, act: setTac('def', 'zone') });
    // 우리 공격
    if (ms.tpa >= 10 && ms.tpm / ms.tpa < 0.27 && my.tac.focus === 'out') tips.push({ id: 'cold', pri: 6, kind: 'tac', txt: `3점이 ${ms.tpm}/${ms.tpa}로 안 들어갑니다. 골밑 공략으로 바꿔 보세요.`, act: setTac('focus', 'in') });
    const tovLim = q <= 2 ? 9 : q === 3 ? 13 : 17;
    if (ms.tov >= tovLim && my.tac.pace !== 0) tips.push({ id: 'tov', pri: 6, kind: 'tac', txt: `턴오버가 ${ms.tov}개입니다${op.tac.def === 'press' ? '(상대 전면 압박)' : ''}. 템포를 늦추고 공을 소중히 다루세요.`, act: setTac('pace', 0) });
    if (os.orb - ms.orb >= 6 && my.tac.reb === 'crash') tips.push({ id: 'reb', pri: 5, kind: 'tac', txt: `공격 리바운드를 ${os.orb}개 내줬습니다. 공격 리바운드 가담을 멈추고 수비 리바운드에 집중하세요.`, act: setTac('reb', 'bal') });
    const big = my.roster.filter(r => !r.onCourt && !r.out && r.energy > 0.8 && r.target > 0).sort((a, b) => b.p.a.drb - a.p.a.drb)[0];
    const weakReb = my.court.slice().sort((a, b) => a.p.a.drb - b.p.a.drb)[0];
    if (os.orb - ms.orb >= 7 && big && weakReb && big.p.a.drb > weakReb.p.a.drb + 15 && !late) tips.push({ id: 'rebsub' + big.p.pid, pri: 5, kind: 'sub', txt: `리바운드 싸움에서 밀립니다(${ms.orb + ms.drb}-${os.orb + os.drb}). ${big.nm}를 넣어 골밑을 보강하세요.`, act: swap(weakReb, big) });
    return tips.sort((a, b) => b.pri - a.pri);
  }
  // 코치에게 맡긴 경우: 조언을 그대로 따른다(같은 조언은 한동안 반복하지 않는다)
  function autoAdjust(game, side) {
    const seen = game._coachSeen || (game._coachSeen = {});
    const now = game.elapsed;
    const tips = liveTips(game, side).slice(0, 2);
    const done = [];
    for (const t of tips) {
      if (seen[t.id] && now - seen[t.id] < 180) continue;
      seen[t.id] = now;
      t.act();
      done.push(t);
      game.say(side, `🧠 코치 조정: ${t.txt}`, 'coach');
    }
    return done;
  }

  // ---------- 월간 보고서 ----------
  function reportHtml(G) {
    const tid = G.userTid;
    const dg = diagnose(G, tid), dp = depth(G, tid);
    const rel = releaseCands(G)[0], fa = faTargets(G)[0];
    const rt = recommendTactics(G, tid);
    const lines = [];
    if (dg.weak.length) lines.push(`약점: ${dg.weak.map(w => `${w.label}(리그 ${w.rank}위)`).join(', ')}`);
    if (dg.strong.length) lines.push(`강점: ${dg.strong.slice(0, 3).map(w => `${w.label}(리그 ${w.rank}위)`).join(', ')}`);
    if (dp.needs.length) lines.push(`부족한 포지션: ${dp.needs.join(', ')}`);
    if (fa) lines.push(`영입 후보: <a class="lnk" href="#/player/${fa.p.pid}">${U.esc(fa.p.name)}</a>(${fa.p.pos}, 능력 ${Math.round(fa.p.ovr)}) — ${U.esc(fa.reasons.slice(0, 2).join(', '))}`);
    if (rel) lines.push(`정리 후보: <a class="lnk" href="#/player/${rel.p.pid}">${U.esc(rel.p.name)}</a> — ${U.esc(rel.reasons[0])}`);
    if (rt.gain > 0.5) lines.push(`전술: ${TXT.focus[rt.rec.focus]} · ${TXT.def[rt.rec.def]}로 바꾸면 100포제션당 약 ${rt.gain.toFixed(1)}점 이득으로 봅니다.`);
    return `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul><a class="btn" href="#/manager">매니저 모드에서 자세히 보기</a>`;
  }

  HM.Adv = { coreOf, CATS, LABEL, TXT, rotation, starters, diagnose, depth, releaseCands, faTargets, tradeTargets, recommendTactics, tacticOptions, paceAdvice, matchup, liveTips, autoAdjust, reportHtml };
})();
