// 시즌 진행: 일정, 경기 기록, 순위, 플레이인·플레이오프, 시상, 드래프트, 오프시즌
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, AI = HM.AI, Sim = HM.Sim, Prog = HM.Prog;
  const D = () => globalThis.HM_DATA;

  // ---------- 자동 진행(턴 끄기) 설정 ----------
  const AUTO_DEFAULT = { games: 'all', gameMode: 'ask', preseason: false, draft: false, resign: false, fa: false, halftime: true, offers: true, minorInjury: true, watchStop: true };
  // 매니저 모드 설정
  function mgrSet(G) {
    G.settings.mgr = Object.assign({ on: true, live: true, auto: false, report: true }, G.settings.mgr || {});
    return G.settings.mgr;
  }
  function autoSet(G) {
    G.settings.auto = Object.assign({}, AUTO_DEFAULT, G.settings.auto || {});
    return G.settings.auto;
  }

  // ---------- 관심 FA 알림(스카우트 조건·관심 선수) ----------
  // 조건: { id, name, on, pos:[..], minOvr, minPot, minAge, maxAge, maxAsk($M), attr, attrMin(1~20) }
  function watchList(G) { return G.watch || (G.watch = []); }
  function shortlist(G) { return G.shortlist || (G.shortlist = []); }
  function matchWatch(G, p, w) {
    if (w.pos && w.pos.length && !w.pos.includes(p.pos)) return false;
    if (w.minOvr && p.ovr < w.minOvr) return false;
    if (w.minPot && P.potShown(p, G) < w.minPot) return false;
    const age = P.age(p, AI.capYear(G));
    if (w.maxAge && age > w.maxAge) return false;
    if (w.minAge && age < w.minAge) return false;
    if (w.attr && w.attrMin && HM.Ratings.disp(p.a[w.attr]) < w.attrMin) return false;
    if (w.maxAsk && AI.asking(G, p).amt > w.maxAsk * 1000) return false;
    return true;
  }
  // 이 선수가 걸리는 알림(조건 이름들)
  function watchHits(G, p) {
    const why = [];
    if (shortlist(G).includes(p.pid)) why.push('★ 관심 선수');
    for (const w of watchList(G)) if (w.on !== false && matchWatch(G, p, w)) why.push(w.name);
    return why;
  }
  function watchSummary(w) {
    const R = HM.Ratings, parts = [];
    parts.push(w.pos && w.pos.length ? w.pos.join('·') : '모든 포지션');
    if (w.minOvr) parts.push(`능력 ${w.minOvr}+`);
    if (w.minPot) parts.push(`잠재력 ${w.minPot}+`);
    if (w.minAge || w.maxAge) parts.push(`${w.minAge || ''}~${w.maxAge || ''}세`);
    if (w.attr && w.attrMin) parts.push(`${R.LABEL[w.attr]} ${w.attrMin}+`);
    if (w.maxAsk) parts.push(`요구 $${w.maxAsk}M 이하`);
    return parts.join(' · ');
  }
  // 시장에 새로 나온 선수 중 알림 대상을 찾아 받은 편지함으로 알린다
  function scanFA(G) {
    const fas = L.fas(G);
    if (!G.faSeen) { G.faSeen = {}; for (const p of fas) G.faSeen[p.pid] = 1; return []; }
    const now = {}, hits = [];
    for (const p of fas) {
      now[p.pid] = 1;
      if (G.faSeen[p.pid] || p.lastTid === G.userTid) continue;
      const why = watchHits(G, p);
      if (why.length) hits.push({ p, why });
    }
    G.faSeen = now;
    if (!hits.length) return hits;
    hits.sort((a, b) => b.p.ovr - a.p.ovr);
    const cy = AI.capYear(G);
    const li = hits.map(({ p, why }) => {
      const ask = AI.asking(G, p);
      const prev = p.lastTid !== undefined && p.lastTid >= 0 ? ` · 전 소속 ${G.teams[p.lastTid].ko}` : p.undrafted ? ' · 드래프트 미지명' : '';
      return `<li><a class="lnk" href="#/player/${p.pid}">${U.esc(p.name)}</a> ${p.pos} · ${P.age(p, cy)}세 · 능력 ${Math.round(p.ovr)} · 잠재력 ${P.potShown(p, G)} · 요구 ${U.money(ask.amt)}×${ask.yrs}년${prev}<br><span class="small muted">🔔 ${why.map(U.esc).join(', ')}</span></li>`;
    }).join('');
    const first = hits[0].p;
    msg(G, `🔔 관심 FA 등장: ${first.name}${hits.length > 1 ? ` 외 ${hits.length - 1}명` : ''}`,
      `알림 조건에 맞는 선수가 자유계약 시장에 나왔습니다.<ul>${li}</ul>`, { type: 'scout', pids: hits.map(h => h.p.pid) });
    return hits;
  }

  // ---------- 메시지 ----------
  function msg(G, title, body, o = {}) {
    G.inbox.unshift(Object.assign({ id: G.nextMsg++, date: G.date, title, body, read: false, type: 'info' }, o));
    if (G.inbox.length > 250) G.inbox.length = 250;
  }
  function news(G, text, o = {}) {
    G.news.unshift(Object.assign({ date: G.date, text }, o));
    if (G.news.length > 400) G.news.length = 400;
  }
  const T = (G, tid) => G.teams[tid];
  const nm = (G, tid) => G.teams[tid].ko;

  // ---------- 달력 ----------
  function firstWeekdayOnOrAfter(dateStr, wd) {
    let d = dateStr;
    for (let i = 0; i < 7; i++) { if (new Date(d + 'T12:00:00Z').getUTCDay() === wd) return d; d = U.addDays(d, 1); }
    return dateStr;
  }
  function calendar(y) {
    return {
      pre: `${y - 1}-10-01`,
      open: firstWeekdayOnOrAfter(`${y - 1}-10-22`, 2),
      end: firstWeekdayOnOrAfter(`${y}-04-10`, 0),
      asb: [`${y}-02-14`, `${y}-02-19`],
      deadline: `${y}-02-08`,
      draft: `${y}-06-25`,
      resign: `${y}-06-30`,
      fa: `${y}-07-01`,
      faEnd: `${y}-09-30`,
    };
  }

  // ---------- 일정 만들기 ----------
  function genSchedule(G) {
    const n = G.teams.length, per = 82;
    let cnt, rem, ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      cnt = Array.from({ length: n }, () => new Array(n).fill(0));
      rem = new Array(n).fill(per - 2 * (n - 1));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) cnt[i][j] = 2;
      const capOf = (i, j) => {
        const a = G.teams[i], b = G.teams[j];
        if (a.div === b.div && a.conf === b.conf) return n <= 24 ? 7 : 5;
        if (a.conf === b.conf) return n <= 24 ? 6 : 4;
        return n <= 24 ? 4 : 3;
      };
      ok = true;
      let guard = 0;
      while (rem.some(r => r > 0) && guard++ < 5000) {
        let i = 0; for (let k = 1; k < n; k++) if (rem[k] > rem[i] || (rem[k] === rem[i] && Math.random() < 0.5)) i = k;
        const cand = [];
        for (let j = 0; j < n; j++) {
          if (j === i || rem[j] <= 0 || cnt[i][j] >= capOf(i, j)) continue;
          const a = G.teams[i], b = G.teams[j];
          const pri = (a.div === b.div && a.conf === b.conf ? 3 : a.conf === b.conf ? 2 : 1) + rem[j] / 50 + Math.random() * 0.8 - cnt[i][j] * 0.3;
          cand.push([pri, j]);
        }
        if (!cand.length) { ok = false; break; }
        cand.sort((x, y) => y[0] - x[0]);
        const j = cand[0][1];
        cnt[i][j]++; cnt[j][i]++; rem[i]--; rem[j]--;
      }
      if (rem.some(r => r !== 0)) ok = false;
    }
    // 경기 목록(홈·원정 나누기)
    const games = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const c = cnt[i][j];
      const hi = Math.floor(c / 2) + (c % 2 && Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < c; k++) games.push(k < hi ? [i, j] : [j, i]);
    }
    U.shuffle(games);
    // 날짜 배정
    const cal = G.cal;
    const days = [];
    for (let d = cal.open; d <= cal.end; d = U.addDays(d, 1)) if (!(d >= cal.asb[0] && d <= cal.asb[1])) days.push(d);
    const left = new Array(n).fill(0); games.forEach(([h, a]) => { left[h]++; left[a]++; });
    const last = new Array(n).fill(-9), last2 = new Array(n).fill(-9);
    let pool = games.slice();
    const sched = [];
    let gid = 1;
    for (let di = 0; di < days.length || pool.length; di++) {
      const day = di < days.length ? days[di] : U.addDays(cal.end, di - days.length + 1);
      const daysLeft = Math.max(1, days.length - di);
      const target = Math.ceil(pool.length / daysLeft * (di >= days.length ? 3 : 1));
      const busy = new Set();
      pool.sort((x, y) => (left[y[0]] + left[y[1]]) - (left[x[0]] + left[x[1]]) + (Math.random() - 0.5) * 6);
      const rest = [];
      let made = 0;
      for (const g of pool) {
        const [h, a] = g;
        const b2b = (last[h] === di - 1 && last2[h] === di - 2) || (last[a] === di - 1 && last2[a] === di - 2);
        if (made < target && !busy.has(h) && !busy.has(a) && !b2b) {
          busy.add(h); busy.add(a); made++;
          for (const t of [h, a]) { last2[t] = last[t]; last[t] = di; left[t]--; }
          sched.push({ gid: gid++, date: day, h, a, type: 'reg', played: false });
        } else rest.push(g);
      }
      pool = rest;
      if (di > days.length + 60) break;
    }
    sched.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.gid - y.gid);
    G.schedule = sched;
    G.nextGid = gid;
  }

  // ---------- 새 시즌 준비 ----------
  function setupSeason(G, first) {
    const y = G.season, d = D();
    G.cal = calendar(y);
    G.phase = 'preseason';
    G.date = G.cal.pre;
    G.playoffs = null; G.playin = null; G.draft = null; G.lottery = null;
    G.games = {};
    if (!first) {
      // 실제 연고 이전·팀 이름 변경
      if (y <= d.last && d.seasons[y]) {
        for (const t of G.teams) {
          const row = d.seasons[y].teams.find(r => r[2] === t.fr);
          if (row && (row[0] !== t.abbr || row[1] !== t.name)) {
            const old = t.ko;
            t.abbr = row[0]; t.name = row[1]; t.ko = d.ko[row[1]] || row[1]; t.colors = d.colors[row[0]] || t.colors;
            news(G, `${old} → ${t.ko}: 연고지 이전·팀명 변경`, { type: 'team' });
            if (t.tid === G.userTid) msg(G, '구단 이름이 바뀌었습니다', `우리 구단은 이번 시즌부터 <b>${t.ko}</b>(${t.name})로 불립니다.`, { type: 'board' });
          }
        }
      }
      L.makeDraftClass(G, y);
      for (const t of G.teams) for (const rd of [1, 2]) {
        const s = y + 3;
        if (!G.picks.some(k => k.season === s && k.round === rd && k.orig === t.tid)) G.picks.push({ id: `${s}-${rd}-${t.tid}`, season: s, round: rd, orig: t.tid, tid: t.tid });
      }
    }
    for (const t of G.teams) { L.rec(G, t.tid); t.mleUsed = false; }
    // 선수 시즌 시작 상태
    for (const p of Object.values(G.players)) {
      if (p.tid < -1) continue;
      p.ovrStart = p.ovr;
      if (!p.ovrHist) p.ovrHist = {};
      p.ovrHist[y] = Math.round(p.ovr);
    }
    AI.setStrategies(G);
    for (const t of G.teams) {
      if (t.tid === G.userTid) continue;
      AI.trimRoster(G, t.tid, 15); AI.fillRoster(G, t.tid, 13); AI.aiTactics(G, t);
    }
    genSchedule(G);
    if (first && !G.talentRef) G.talentRef = Prog.measure(G);
    L.computeLgAdj(G);
    setExpectation(G);
    G.dead = (G.dead || []).filter(x => x.exp >= y);
  }

  const EXP = [
    { lv: 1, txt: '리빌딩 — 유망주를 키우고 미래를 준비하라' },
    { lv: 2, txt: '5할 승률 근처에서 플레이오프를 다퉈 보라' },
    { lv: 3, txt: '플레이오프에 진출하라' },
    { lv: 4, txt: '컨퍼런스 결승까지 올라가라' },
    { lv: 5, txt: '파이널 진출, 그 이상 — 우승에 도전하라' },
  ];
  function setExpectation(G) {
    const n = G.teams.length;
    const ranked = G.teams.map(t => ({ tid: t.tid, s: L.strength(G, t.tid) })).sort((a, b) => b.s - a.s);
    const r = ranked.findIndex(x => x.tid === G.userTid) / n;
    const lv = r < 0.1 ? 5 : r < 0.24 ? 4 : r < 0.47 ? 3 : r < 0.7 ? 2 : 1;
    G.board.exp = { lv, txt: EXP[lv - 1].txt, rank: ranked.findIndex(x => x.tid === G.userTid) + 1 };
    msg(G, `${U.seasonLabel(G.season)} 시즌 구단 수뇌부의 기대`,
      `구단주와 이사회는 이번 시즌 <b>${EXP[lv - 1].txt}</b>는 목표를 세웠습니다.<br>프리시즌 전력 평가는 리그 ${n}개 팀 중 <b>${G.board.exp.rank}위</b>입니다.<br>현재 이사회 신뢰도: ${Math.round(G.board.conf)}/100`, { type: 'board' });
  }

  // ---------- 경기 ----------
  function gameTeam(G, tid, playoffs) {
    const t = G.teams[tid];
    const players = L.roster(G, tid).filter(p => !(p.injury && p.injury.days > 0));
    for (const p of players) p.moralePen = (p.morale ?? 60) < 30 ? 0.8 : 0;
    return { tid, name: t.ko, abbr: t.abbr, players, tactics: t.tactics, rotation: tid === G.userTid ? t.rotation : { auto: true } };
  }
  function hcaFor(y) { return y <= 1990 ? 3.6 : y <= 2010 ? 3.1 : 2.4; }
  function makeGame(G, g, live) {
    const po = g.type === 'po';
    const M = mgrSet(G);
    const coach = M.on && M.auto;
    return new Sim.Game({ home: gameTeam(G, g.h, po), away: gameTeam(G, g.a, po), env: L.env(G), playoffs: po, live, hca: hcaFor(G.season),
      autoCoach: [coach && g.h === G.userTid, coach && g.a === G.userTid] });
  }

  const INJ = [
    [0.62, 1, 7, ['발목 염좌', '허리 통증', '무릎 타박상', '손가락 탈구', '엉덩이 타박상', '종아리 경련', '독감', '뇌진탕 증세', '발목 통증']],
    [0.25, 8, 30, ['햄스트링 염좌', '사타구니 부상', '발목 인대 손상', '손목 골절', '무릎 염좌', '어깨 탈구', '갈비뼈 타박상']],
    [0.10, 31, 90, ['발 골절', '무릎 반월판 손상', '종아리 근육 파열', '손 골절', '허리 디스크']],
    [0.03, 120, 300, ['전방십자인대 파열', '아킬레스건 파열', '슬개건 파열']],
  ];
  function injure(G, p) {
    const r = Math.random();
    let acc = 0, band = INJ[0];
    for (const b of INJ) { acc += b[0]; if (r < acc) { band = b; break; } }
    const days = U.randInt(band[1], band[2]);
    p.injury = { type: U.pick(band[3]), days };
    if (p.tid === G.userTid && (days >= 7 || autoSet(G).minorInjury)) msg(G, `부상: ${p.name}`, `${p.name} 선수가 <b>${p.injury.type}</b>로 약 <b>${days}일</b> 결장할 전망입니다.`, { type: 'injury', pid: p.pid });
    if (p.ovr >= 84 && days >= 14) news(G, `${p.name}(${nm(G, p.tid)}) ${p.injury.type}, 약 ${days}일 결장`, { type: 'injury' });
    if (days >= 120) { p.a.ath = Math.max(1, p.a.ath - U.randInt(2, 6)); p.a.spd = Math.max(1, p.a.spd - U.randInt(1, 4)); P.update(p); }
  }

  function addLine(p, season, tid, po) {
    for (let i = p.stats.length - 1; i >= 0; i--) {
      const l = p.stats[i];
      if (l.s === season && l.tid === tid && l.po === po) return l;
      if (l.s < season) break;
    }
    const l = { s: season, tid, po, gp: 0, gs: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0, rat: 0 };
    p.stats.push(l);
    return l;
  }
  const KEYS = ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm'];

  function record(G, g, res) {
    const po = g.type === 'po' ? 1 : 0;
    const [rh, ra] = res.teams;
    g.played = true; g.hs = rh.pts; g.as = ra.pts; g.ot = res.ot;
    const hw = rh.pts > ra.pts;
    const W = hw ? g.h : g.a, Lz = hw ? g.a : g.h;
    if (g.type === 'reg') {
      const rw = L.rec(G, W), rl = L.rec(G, Lz);
      rw.w++; rl.l++;
      if (hw) { rw.hw++; } else { rl.hl++; }
      const tw = T(G, W), tl = T(G, Lz);
      if (tw.conf === tl.conf) { rw.cw++; rl.cl++; if (tw.div === tl.div) { rw.dw++; rl.dl++; } }
      rw.streak = rw.streak > 0 ? rw.streak + 1 : 1; rl.streak = rl.streak < 0 ? rl.streak - 1 : -1;
      rw.last.push(1); rl.last.push(0); if (rw.last.length > 10) rw.last.shift(); if (rl.last.length > 10) rl.last.shift();
      const recH = L.rec(G, g.h), recA = L.rec(G, g.a);
      recH.pf += rh.pts; recH.pa += ra.pts; recA.pf += ra.pts; recA.pa += rh.pts;
    }
    // 선수 기록
    for (const side of res.teams) {
      for (const s of side.players) {
        const p = G.players[s.pid]; if (!p) continue;
        if (!s.min) continue;
        const l = addLine(p, G.season, side.tid, po);
        l.gp++; l.gs += s.gs; l.min += s.min / 60;
        for (const k of KEYS) l[k] += s[k];
        const r = Sim.rating(s); s.rat = r; l.rat += r || 0;
        // 경기별 기록(이번 시즌만 보관): [gid, tid, 선발, 분×10, 득점, 공리, 수리, 어시, 스틸, 블록, 턴오버, FGM, FGA, 3PM, 3PA, FTM, FTA, 파울, +/-, 평점×10]
        if (!G.logs || G.logsSeason !== G.season) { G.logs = {}; G.logsSeason = G.season; }
        (G.logs[s.pid] = G.logs[s.pid] || []).push([g.gid, side.tid, s.gs, Math.round(s.min / 6), s.pts, s.orb, s.drb, s.ast, s.stl, s.blk, s.tov, s.fgm, s.fga, s.tpm, s.tpa, s.ftm, s.fta, s.pf, s.pm, Math.round((r || 0) * 10)]);
        // 화제의 기록
        const reb = s.orb + s.drb;
        const dd = [s.pts, reb, s.ast, s.stl, s.blk].filter(x => x >= 10).length;
        if (s.pts >= 50) news(G, `${p.name}(${nm(G, side.tid)}) ${s.pts}점 폭발!`, { type: 'perf' });
        else if (dd >= 3 && (s.pts >= 25 || p.tid === G.userTid)) news(G, `${p.name}(${nm(G, side.tid)}) 트리플더블: ${s.pts}점 ${reb}리바운드 ${s.ast}어시스트`, { type: 'perf' });
      }
    }
    for (const pid of res.injuries) { const p = G.players[pid]; if (p) injure(G, p); }
    if (g.h === G.userTid || g.a === G.userTid || po || g.type === 'playin') G.games[g.gid] = { gid: g.gid, date: g.date, h: g.h, a: g.a, type: g.type, res };
    if (G.userTid === g.h || G.userTid === g.a) {
      G.lastUserGame = g.gid;
      // 팬 열기
      const t = T(G, G.userTid); const won = (g.h === G.userTid) === hw;
      t.hype = U.clamp(t.hype + (won ? 0.006 : -0.006), 0.05, 0.98);
    }
  }

  function playGameQuick(G, g) {
    const game = makeGame(G, g, false);
    const res = game.play();
    record(G, g, res);
    return res;
  }

  // ---------- 순위 ----------
  function standings(G, conf) {
    const list = G.teams.filter(t => !conf || t.conf === conf).map(t => ({ t, r: L.rec(G, t.tid) }));
    list.sort((x, y) => {
      const px = x.r.w / Math.max(1, x.r.w + x.r.l), py = y.r.w / Math.max(1, y.r.w + y.r.l);
      if (py !== px) return py - px;
      if (y.r.w !== x.r.w) return y.r.w - x.r.w;
      return (y.r.pf - y.r.pa) - (x.r.pf - x.r.pa);
    });
    return list;
  }
  function gamesBehind(list) {
    const top = list[0]?.r; if (!top) return [];
    return list.map(x => ((top.w - x.r.w) + (x.r.l - top.l)) / 2);
  }

  // ---------- 플레이인·플레이오프 ----------
  function bestOf(G, round) {
    const y = G.season;
    if (y <= 1983) return round === 0 ? 3 : 7;
    if (y <= 2002) return round === 0 ? 5 : 7;
    return 7;
  }
  function startPostseason(G) {
    const y = G.season;
    const confs = ['E', 'W'];
    const seeds = {};
    for (const c of confs) seeds[c] = standings(G, c).map(x => x.t.tid);
    G.seeds = seeds;
    for (const c of confs) seeds[c].forEach((tid, i) => { L.rec(G, tid).seed = i + 1; });
    if (y >= 2021) {
      G.phase = 'playin';
      G.playin = { conf: {} };
      for (const c of confs) {
        const s = seeds[c];
        G.playin.conf[c] = { a: [s[6], s[7]], b: [s[8], s[9]], c: null, seed7: null, seed8: null, out: [] };
      }
      msg(G, '정규시즌 종료', regSeasonSummary(G) + '<br>이제 <b>플레이인 토너먼트</b>가 열립니다(각 컨퍼런스 7~10위).', { type: 'season' });
    } else {
      msg(G, '정규시즌 종료', regSeasonSummary(G), { type: 'season' });
      startPlayoffs(G);
    }
    regularAwards(G);
  }
  function regSeasonSummary(G) {
    const r = L.rec(G, G.userTid);
    const conf = T(G, G.userTid).conf;
    const pos = standings(G, conf).findIndex(x => x.t.tid === G.userTid) + 1;
    return `${nm(G, G.userTid)}는 <b>${r.w}승 ${r.l}패</b>로 ${conf === 'E' ? '동부' : '서부'} 컨퍼런스 <b>${pos}위</b>로 정규시즌을 마쳤습니다.`;
  }
  function playoffTeams(G) {
    const y = G.season; const n = y <= 1983 ? 6 : 8;
    const res = {};
    for (const c of ['E', 'W']) {
      if (G.playin) {
        const pi = G.playin.conf[c];
        res[c] = G.seeds[c].slice(0, 6).concat([pi.seed7, pi.seed8]);
      } else res[c] = G.seeds[c].slice(0, n);
    }
    return res;
  }
  function startPlayoffs(G) {
    G.phase = 'playoffs';
    const teams = playoffTeams(G);
    const y = G.season;
    const rounds = [[]];
    for (const c of ['E', 'W']) {
      const s = teams[c];
      if (y <= 1983) {
        rounds[0].push(series(G, s[2], s[5], 3, 6, c, 0), series(G, s[3], s[4], 4, 5, c, 0));
      } else {
        rounds[0].push(series(G, s[0], s[7], 1, 8, c, 0), series(G, s[3], s[4], 4, 5, c, 0), series(G, s[2], s[5], 3, 6, c, 0), series(G, s[1], s[6], 2, 7, c, 0));
      }
    }
    G.playoffs = { rounds, cur: 0, byes: y <= 1983 ? { E: teams.E.slice(0, 2), W: teams.W.slice(0, 2) } : null, champ: null };
    for (const c of ['E', 'W']) for (const tid of teams[c]) L.rec(G, tid).po = 0;
    // 드래프트 로터리
    doLottery(G);
    const inPO = teams.E.includes(G.userTid) || teams.W.includes(G.userTid);
    msg(G, '플레이오프 대진 확정', inPO ? `${nm(G, G.userTid)}가 플레이오프에 진출했습니다! 대진표를 확인하세요.` : `아쉽게도 ${nm(G, G.userTid)}는 플레이오프에 오르지 못했습니다. 드래프트 로터리 결과를 확인하세요.`, { type: 'season' });
    news(G, `${U.seasonLabel(y)} 플레이오프 개막`, { type: 'season' });
  }
  function series(G, h, a, hs, as, conf, round) {
    return { h, a, hs, as, conf, round, w: [0, 0], need: Math.ceil(bestOf(G, round) / 2), games: [], done: false, winner: null };
  }
  const HOME_PATTERN = { 3: [1, 0, 1], 5: [1, 1, 0, 0, 1], 7: [1, 1, 0, 0, 1, 0, 1] };
  function todayPostseasonGames(G) {
    const today = G.schedule.filter(g => g.date === G.date && (g.type === 'po' || g.type === 'playin'));
    if (today.length) return;
    if (G.phase === 'playin') {
      for (const c of ['E', 'W']) {
        const pi = G.playin.conf[c];
        if (!pi.aDone) { addGame(G, pi.a[0], pi.a[1], 'playin', { pi: c, slot: 'a' }); addGame(G, pi.b[0], pi.b[1], 'playin', { pi: c, slot: 'b' }); }
        else if (pi.c && !pi.cDone) addGame(G, pi.c[0], pi.c[1], 'playin', { pi: c, slot: 'c' });
      }
    } else if (G.phase === 'playoffs') {
      for (const s of G.playoffs.rounds[G.playoffs.cur]) {
        if (s.done) continue;
        const k = s.w[0] + s.w[1];
        const bo = s.need * 2 - 1;
        const home = HOME_PATTERN[bo][k] ? s.h : s.a;
        addGame(G, home, home === s.h ? s.a : s.h, 'po', { series: [G.playoffs.cur, G.playoffs.rounds[G.playoffs.cur].indexOf(s)] });
      }
    }
  }
  function addGame(G, h, a, type, extra) {
    const g = Object.assign({ gid: G.nextGid++, date: G.date, h, a, type, played: false }, extra);
    G.schedule.push(g);
    return g;
  }
  function afterPostseasonGame(G, g) {
    const hw = g.hs > g.as;
    const W = hw ? g.h : g.a, Lz = hw ? g.a : g.h;
    if (g.type === 'playin') {
      const pi = G.playin.conf[g.pi];
      if (g.slot === 'a') { pi.seed7 = W; pi.aLoser = Lz; }
      if (g.slot === 'b') { pi.bWinner = W; pi.out.push(Lz); }
      if (g.slot === 'c') { pi.seed8 = W; pi.out.push(Lz); pi.cDone = true; }
      if (pi.seed7 !== null && pi.bWinner !== undefined && !pi.c) { pi.aDone = true; pi.c = [pi.aLoser, pi.bWinner]; }
      return;
    }
    const [ri, si] = g.series;
    const s = G.playoffs.rounds[ri][si];
    s.games.push(g.gid);
    s.w[W === s.h ? 0 : 1]++;
    if (s.w[0] >= s.need || s.w[1] >= s.need) {
      s.done = true; s.winner = s.w[0] >= s.need ? s.h : s.a;
      const loser = s.winner === s.h ? s.a : s.h;
      L.rec(G, s.winner).po = Math.max(L.rec(G, s.winner).po, ri + 1);
      const rname = roundName(G, ri);
      news(G, `${rname}: ${nm(G, s.winner)} ${Math.max(...s.w)}-${Math.min(...s.w)} ${nm(G, loser)}`, { type: 'po' });
      if (s.winner === G.userTid) msg(G, `${rname} 통과!`, `${nm(G, G.userTid)}가 ${nm(G, loser)}를 ${Math.max(...s.w)}승 ${Math.min(...s.w)}패로 꺾었습니다.`, { type: 'season' });
      if (loser === G.userTid) msg(G, `${rname} 탈락`, `${nm(G, G.userTid)}의 시즌이 ${nm(G, s.winner)}에게 막혀 끝났습니다(${Math.min(...s.w)}승 ${Math.max(...s.w)}패).`, { type: 'season' });
    }
  }
  function roundName(G, ri) {
    return ['플레이오프 1라운드', '컨퍼런스 준결승', '컨퍼런스 결승', 'NBA 파이널'][ri];
  }
  function advancePostseason(G) {
    if (G.phase === 'playin') {
      const all = ['E', 'W'].every(c => G.playin.conf[c].cDone);
      if (all) {
        for (const c of ['E', 'W']) for (const tid of G.playin.conf[c].out) if (tid === G.userTid) msg(G, '플레이인 탈락', '플레이인 토너먼트에서 탈락했습니다.', { type: 'season' });
        startPlayoffs(G);
      }
      return;
    }
    const po = G.playoffs;
    const round = po.rounds[po.cur];
    if (!round.every(s => s.done)) return;
    if (po.cur === 3) return finishPlayoffs(G, round[0]);
    const next = [];
    const seedOf = tid => L.rec(G, tid).seed;
    const win = s => s.winner;
    if (po.cur === 0) {
      for (const c of ['E', 'W']) {
        const r = round.filter(s => s.conf === c);
        if (G.season <= 1983) {
          // 1·2번 시드가 기다린다
          const w = r.map(win).sort((a, b) => seedOf(a) - seedOf(b));
          const [b1, b2] = po.byes[c];
          next.push(series(G, b1, w[1], 1, seedOf(w[1]), c, 1), series(G, b2, w[0], 2, seedOf(w[0]), c, 1));
          for (const t of [b1, b2]) L.rec(G, t).po = Math.max(L.rec(G, t).po, 1);
        } else {
          next.push(mk(G, win(r[0]), win(r[1]), c, 1), mk(G, win(r[2]), win(r[3]), c, 1));
        }
      }
    } else if (po.cur === 1) {
      for (const c of ['E', 'W']) { const r = round.filter(s => s.conf === c); next.push(mk(G, win(r[0]), win(r[1]), c, 2)); }
    } else if (po.cur === 2) {
      const [e, w] = [round.find(s => s.conf === 'E'), round.find(s => s.conf === 'W')];
      const a = win(e), b = win(w);
      const ra = L.rec(G, a), rb = L.rec(G, b);
      const aFirst = ra.w / (ra.w + ra.l) >= rb.w / (rb.w + rb.l);
      next.push(series(G, aFirst ? a : b, aFirst ? b : a, 0, 0, 'F', 3));
    }
    po.rounds.push(next); po.cur++;
    function mk(G2, x, y, c, r) { const [h, a] = seedOf(x) <= seedOf(y) ? [x, y] : [y, x]; return series(G2, h, a, seedOf(h), seedOf(a), c, r); }
  }

  function finishPlayoffs(G, fin) {
    const y = G.season;
    const champ = fin.winner, runner = fin.winner === fin.h ? fin.a : fin.h;
    G.playoffs.champ = champ;
    L.rec(G, champ).po = 4;
    // 파이널 MVP: 우승팀 파이널 경기 평점
    const tally = {};
    for (const gid of fin.games) {
      const gm = G.games[gid]; if (!gm) continue;
      const side = gm.res.teams.find(t => t.tid === champ);
      for (const s of side.players) { if (!s.min) continue; tally[s.pid] = (tally[s.pid] || 0) + (s.rat || 0) * 2 + s.pts * 0.3; }
    }
    const fmvp = +Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const h = G.history[y] = G.history[y] || {};
    Object.assign(h, { champ, runner, fmvp, champName: nm(G, champ), runnerName: nm(G, runner), score: `${Math.max(...fin.w)}-${Math.min(...fin.w)}` });
    if (fmvp && G.players[fmvp]) G.players[fmvp].awards.push({ s: y, k: 'FMVP' });
    for (const p of L.roster(G, champ)) p.awards.push({ s: y, k: 'CH' });
    news(G, `🏆 ${nm(G, champ)}, ${U.seasonLabel(y)} NBA 챔피언! (${h.score}, 파이널 MVP ${fmvp ? G.players[fmvp].name : '-'})`, { type: 'champ' });
    if (champ === G.userTid) msg(G, '🏆 NBA 챔피언!', `축하합니다! ${nm(G, champ)}가 ${nm(G, runner)}를 ${h.score}로 꺾고 <b>NBA 우승</b>을 차지했습니다.<br>파이널 MVP: ${fmvp ? G.players[fmvp].name : '-'}`, { type: 'champ' });
    endSeason(G);
  }

  // ---------- 시상 ----------
  function seasonLine(p, y, po = 0) {
    const ls = p.stats.filter(l => l.s === y && l.po === po);
    if (!ls.length) return null;
    const t = { gp: 0, gs: 0, min: 0, rat: 0 }; for (const k of KEYS) t[k] = 0;
    for (const l of ls) { t.gp += l.gp; t.gs += l.gs; t.min += l.min; t.rat += l.rat; for (const k of KEYS) t[k] += l[k]; }
    t.tid = ls[ls.length - 1].tid;
    return t;
  }
  function regularAwards(G) {
    const y = G.season;
    const teamG = 82;
    const cands = [];
    for (const p of Object.values(G.players)) {
      const s = seasonLine(p, y); if (!s || s.gp < 20) continue;
      const tid = p.tid >= 0 ? p.tid : s.tid;
      const rec = L.rec(G, tid); const wp = rec.w / Math.max(1, rec.w + rec.l);
      const pg = k => s[k] / s.gp;
      const mvp = (s.rat / s.gp) * 9 + p.ovr * 0.55 + wp * 28 + pg('pts') * 0.45 + (pg('ast') + pg('orb') + pg('drb')) * 0.15;
      cands.push({ p, s, tid, wp, pg, mvp, gpOk: s.gp >= teamG * 0.7 });
    }
    const top = (arr, f, n = 1) => arr.slice().sort((a, b) => f(b) - f(a)).slice(0, n);
    const elig = cands.filter(c => c.gpOk && c.s.min / c.s.gp >= 20);
    const aw = {};
    aw.mvp = top(elig, c => c.mvp)[0];
    aw.dpoy = top(elig.filter(c => c.s.min / c.s.gp >= 24), c => Math.max(c.p.a.idef, c.p.a.pdef) * 0.12 + c.pg('blk') * 1.8 + c.pg('stl') * 1.5 + c.p.d * 1.5 + c.wp * 4)[0];
    const rookies = cands.filter(c => c.p.yearsPro === 0 && c.s.gp >= 40);
    aw.roy = top(rookies, c => c.pg('pts') + c.pg('orb') + c.pg('drb') + c.pg('ast') * 1.2 + c.p.ovr * 0.25)[0];
    aw.smoy = top(cands.filter(c => c.s.gs < c.s.gp * 0.35 && c.s.gp >= 50), c => c.pg('pts') + (c.pg('orb') + c.pg('drb') + c.pg('ast')) * 0.5 + c.p.ovr * 0.15)[0];
    aw.mip = top(cands.filter(c => c.s.gp >= 50 && c.p.ovrHist && c.p.ovrHist[y - 1] && c.p.yearsPro >= 1), c => (c.p.ovr - c.p.ovrHist[y - 1]) * 1.5 + c.pg('pts') * 0.15)[0];
    // 올-NBA
    const pool = top(elig, c => c.mvp, 40);
    const teams = [[], [], []];
    const used = new Set();
    if (y < 2024) {
      const slot = c => (c.p.pos === 'PG' || c.p.pos === 'SG') ? 'G' : c.p.pos === 'C' ? 'C' : 'F';
      for (let t = 0; t < 3; t++) {
        const need = { G: 2, F: 2, C: 1 };
        for (const c of pool) { if (used.has(c.p.pid)) continue; const s = slot(c); if (need[s] > 0) { need[s]--; teams[t].push(c); used.add(c.p.pid); } }
      }
    } else {
      pool.slice(0, 15).forEach((c, i) => teams[Math.floor(i / 5)].push(c));
    }
    const h = G.history[y] = G.history[y] || {};
    const id = c => c ? c.p.pid : null;
    h.awards = { mvp: id(aw.mvp), dpoy: id(aw.dpoy), roy: id(aw.roy), smoy: id(aw.smoy), mip: id(aw.mip), allNba: teams.map(t => t.map(c => c.p.pid)) };
    const give = (c, k) => { if (c) c.p.awards.push({ s: y, k }); };
    give(aw.mvp, 'MVP'); give(aw.dpoy, 'DPOY'); give(aw.roy, 'ROY'); give(aw.smoy, '6MOY'); give(aw.mip, 'MIP');
    teams.forEach((t, i) => t.forEach(c => give(c, 'ANBA' + (i + 1))));
    const line = (label, c) => c ? `<li>${label}: <b>${c.p.name}</b> (${nm(G, c.tid)}) — ${U.fix(c.pg('pts'))}점 ${U.fix(c.pg('orb') + c.pg('drb'))}리바운드 ${U.fix(c.pg('ast'))}어시스트</li>` : '';
    msg(G, `${U.seasonLabel(y)} 정규시즌 시상`, `<ul>${line('MVP', aw.mvp)}${line('올해의 수비수', aw.dpoy)}${line('신인왕', aw.roy)}${line('식스맨', aw.smoy)}${line('기량발전상', aw.mip)}</ul>`, { type: 'award' });
    if (aw.mvp) news(G, `MVP: ${aw.mvp.p.name}(${nm(G, aw.mvp.tid)})`, { type: 'award' });
  }

  // ---------- 로터리·드래프트 ----------
  function doLottery(G) {
    const y = G.season;
    const pot = playoffTeams(G);
    const inPO = new Set([...pot.E, ...pot.W]);
    const all = standings(G).map(x => x.t.tid).reverse(); // 나쁜 팀부터
    const lotto = all.filter(t => !inPO.has(t));
    const rest = all.filter(t => inPO.has(t));
    let order = lotto.slice();
    let draws = 0, info = '';
    if (y <= 1984) {
      // 각 컨퍼런스 꼴찌끼리 동전 던지기
      const worstE = lotto.find(t => T(G, t).conf === 'E'), worstW = lotto.find(t => T(G, t).conf === 'W');
      if (worstE !== undefined && worstW !== undefined) {
        const first = Math.random() < 0.5 ? worstE : worstW, second = first === worstE ? worstW : worstE;
        order = [first, second].concat(lotto.filter(t => t !== first && t !== second));
        info = '동전 던지기(각 컨퍼런스 최하위 팀)';
      }
    } else {
      const n = lotto.length;
      let w;
      if (y <= 1989) { w = lotto.map(() => 1); draws = 3; info = '균등 확률 추첨'; }
      else if (y <= 2018) { const base = [250, 199, 156, 119, 88, 63, 43, 28, 17, 11, 8, 7, 6, 5]; w = lotto.map((_, i) => base[Math.min(i, 13)]); draws = 3; info = '가중 확률 추첨(상위 3순위)'; }
      else { const base = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]; w = lotto.map((_, i) => base[Math.min(i, 13)]); draws = 4; info = '가중 확률 추첨(상위 4순위)'; }
      const winners = [];
      const remain = lotto.slice(), rw = w.slice();
      for (let k = 0; k < Math.min(draws, n); k++) {
        const pick = U.wpick(remain.map((_, i) => i), rw);
        winners.push(remain[pick]); remain.splice(pick, 1); rw.splice(pick, 1);
      }
      order = winners.concat(lotto.filter(t => !winners.includes(t)));
    }
    const full = order.concat(rest);
    const r2 = all.slice();
    G.lottery = { order: full, info, pre: lotto };
    for (const k of G.picks) if (k.season === y) {
      k.slot = (k.round === 1 ? full : r2).indexOf(k.orig) + 1;
    }
    const userSlots = G.picks.filter(k => k.season === y && k.tid === G.userTid).sort((a, b) => a.round - b.round || a.slot - b.slot);
    news(G, `${y} 드래프트 로터리: 1순위 ${nm(G, full[0])}`, { type: 'draft' });
    msg(G, `${y} 드래프트 로터리 결과`, `방식: ${info}<br>1순위 지명권: <b>${nm(G, full[0])}</b><br>2순위: ${nm(G, full[1])}<br>3순위: ${nm(G, full[2])}` +
      (userSlots.length ? `<br><br>우리 구단 지명권: ${userSlots.map(k => `${k.round}라운드 ${k.slot}순위${k.orig !== G.userTid ? `(${nm(G, k.orig)} 원 지명권)` : ''}`).join(', ')}` : '<br><br>우리 구단은 올해 지명권이 없습니다.'), { type: 'draft' });
  }

  function startDraft(G) {
    const y = G.season;
    const picks = G.picks.filter(k => k.season === y).sort((a, b) => a.round - b.round || a.slot - b.slot);
    G.draft = { year: y, order: picks.map(k => k.id), idx: 0, results: [] };
    G.phase = 'draft'; G.date = G.cal.draft;
    msg(G, `${y} NBA 드래프트`, '드래프트 날입니다. <b>드래프트</b> 화면에서 우리 차례에 선수를 지명하세요. 유망주 목록과 스카우팅 평가를 참고하세요.', { type: 'draft' });
  }
  function draftPlayer(G, pid) {
    const dr = G.draft;
    const pk = G.picks.find(k => k.id === dr.order[dr.idx]);
    const p = G.players[pid];
    const y = dr.year;
    const overall = dr.idx + 1;
    p.tid = pk.tid;
    p.draft = { year: y, round: pk.round, pick: overall, abbr: T(G, pk.tid).abbr, tid: pk.tid };
    p.contract = pk.round === 1 ? { amt: F.rookieScale(overall, y + 1), exp: y + 4, rookie: true } : { amt: F.minSal(y + 1), exp: y + 2 };
    p.yearsPro = 0; p.morale = 70;
    dr.results.push({ pick: overall, round: pk.round, tid: pk.tid, pid, real: p.prospect?.realPick || null });
    if (pk.tid === G.userTid) msg(G, `드래프트: ${p.name} 지명`, `${pk.round}라운드 ${pk.slot}순위(전체 ${overall}순위)로 <b>${p.name}</b>(${p.pos}, ${P.age(p, y + 1)}세)를 지명했습니다.${p.prospect?.realPick ? `<br><small>실제 역사에서는 ${p.prospect.realPick}순위 지명</small>` : ''}`, { type: 'draft', pid });
    if (overall <= 3) news(G, `${y} 드래프트 ${overall}순위: ${p.name} → ${nm(G, pk.tid)}`, { type: 'draft' });
    dr.idx++;
  }
  // 사용자 차례까지(또는 끝까지) AI가 지명
  function draftUntilUser(G) {
    const dr = G.draft;
    while (dr.idx < dr.order.length) {
      const pk = G.picks.find(k => k.id === dr.order[dr.idx]);
      if (pk.tid === G.userTid) return 'user';
      const pool = L.prospects(G);
      if (!pool.length) { dr.idx++; continue; }
      draftPlayer(G, AI.aiDraftPick(G, pk.tid, pool).pid);
    }
    return 'done';
  }
  function finishDraft(G) {
    const y = G.season;
    for (const p of L.prospects(G)) { p.tid = -1; p.contract = null; p.undrafted = y; delete p.prospect; }
    for (const p of Object.values(G.players)) if (p.draft && p.draft.year === y) delete p.prospect;
    G.picks = G.picks.filter(k => k.season > y);
    for (const t of G.teams) for (const rd of [1, 2]) {
      const s = y + 4;
      if (!G.picks.some(k => k.season === s && k.round === rd && k.orig === t.tid)) G.picks.push({ id: `${s}-${rd}-${t.tid}`, season: s, round: rd, orig: t.tid, tid: t.tid });
    }
    G.phase = 'resign'; G.date = G.cal.resign;
    scanFA(G);
    const exp = L.roster(G, G.userTid).filter(p => p.contract && p.contract.exp <= y);
    msg(G, '재계약 기간', exp.length ? `계약이 끝나는 선수가 ${exp.length}명 있습니다: ${exp.map(p => p.name).join(', ')}.<br><b>재정·계약</b> 화면에서 재계약 여부를 정하세요. 다음 단계로 넘어가면 재계약하지 않은 선수는 자유계약 시장에 나갑니다.` : '올해 계약이 끝나는 선수가 없습니다.', { type: 'contract' });
  }

  // 코치에게 맡긴 드래프트: 남은 지명을 모두 끝낸다
  function autoDraftAll(G) {
    while (draftUntilUser(G) === 'user') {
      const pool = L.prospects(G);
      if (!pool.length) { G.draft.idx++; continue; }
      draftPlayer(G, AI.aiDraftPick(G, G.userTid, pool).pid);
    }
    finishDraft(G);
  }
  // 코치에게 맡긴 재계약
  function autoResignUser(G) {
    const { kept, left } = AI.resignTeam(G, G.teams[G.userTid]);
    if (kept.length || left.length) msg(G, '코치진 재계약 결과', (kept.length ? `재계약: ${kept.map(p => `<b>${p.name}</b>(${U.money(p.contract.amt)}×${p.contract.exp - G.season}년)`).join(', ')}<br>` : '') + (left.length ? `떠난 선수: ${left.map(p => p.name).join(', ')}` : ''), { type: 'contract' });
  }

  // ---------- 시즌 마무리 ----------
  function endSeason(G) {
    const y = G.season;
    const t = T(G, G.userTid);
    const r = L.rec(G, G.userTid);
    // 이사회 평가
    const lv = G.board.exp?.lv || 3;
    const wp = r.w / Math.max(1, r.w + r.l);
    const ach = r.po >= 4 ? 6 : r.po >= 3 ? 5 : r.po >= 2 ? 4 : r.po >= 0 ? 3 : wp >= 0.5 ? 2 : wp >= 0.24 ? 1 : 0;
    let delta = ach >= lv ? 6 + (ach - lv) * 8 : -(lv - ach) * 11;
    if (r.po >= 4) delta = Math.max(delta, 25);
    if (lv === 1 && wp >= 0.3) delta = Math.max(delta, 2);
    const pay = F.payroll(G, G.userTid, y), tax = F.taxLine(y);
    const taxBill = Math.max(0, pay - tax) * 1.5;
    if (taxBill > 0 && ach < lv) delta -= 4;
    G.board.conf = U.clamp(G.board.conf + delta, 0, 100);
    // 재정
    for (const tm of G.teams) {
      const rr = L.rec(G, tm.tid);
      const cap = F.cap(y);
      const rev = cap * (0.95 + 0.45 * tm.pop + 0.35 * tm.hype) + Math.max(0, rr.po + 1) * cap * 0.05;
      const exp2 = F.payroll(G, tm.tid, y) + Math.max(0, F.payroll(G, tm.tid, y) - F.taxLine(y)) * 1.5;
      rr.rev = Math.round(rev); rr.expense = Math.round(exp2);
      tm.cash = (tm.cash || 0) + Math.round(rev - exp2);
      tm.hype = U.clamp(tm.hype * 0.6 + (rr.w / Math.max(1, rr.w + rr.l)) * 0.4 + (rr.po >= 2 ? 0.05 : 0), 0.05, 0.98);
    }
    const h = G.history[y] = G.history[y] || {};
    h.user = { tid: G.userTid, w: r.w, l: r.l, po: r.po, conf: Math.round(G.board.conf), exp: lv };
    h.standings = G.teams.map(tm => { const rr = L.rec(G, tm.tid); return [tm.tid, rr.w, rr.l, rr.po, tm.ko, tm.abbr]; });
    const poTxt = ['플레이오프 진출 실패', '플레이오프 1라운드 탈락', '컨퍼런스 준결승 탈락', '컨퍼런스 결승 탈락', '파이널 준우승', 'NBA 우승'][r.po + 1];
    msg(G, `${U.seasonLabel(y)} 시즌 평가`,
      `성적: <b>${r.w}승 ${r.l}패</b>, ${poTxt}<br>목표: ${G.board.exp?.txt || '-'}<br>이사회 평가: ${delta >= 0 ? '만족' : '불만'} (${delta >= 0 ? '+' : ''}${delta}) → 신뢰도 <b>${Math.round(G.board.conf)}</b>/100` +
      (taxBill ? `<br>사치세 납부: ${U.money(taxBill)}` : ''), { type: 'board' });
    if (G.board.conf <= 12) {
      G.fired = { season: y, team: G.userTid };
      msg(G, '해임 통보', `이사회는 더 이상 감독님을 신뢰하지 않습니다. ${nm(G, G.userTid)} 감독직에서 해임되었습니다.`, { type: 'board' });
    } else if (G.board.conf <= 30) {
      msg(G, '이사회 경고', '이사회의 신뢰가 바닥에 가깝습니다. 다음 시즌에도 기대에 못 미치면 자리를 지키기 어려울 것입니다.', { type: 'board' });
    }
    // 은퇴
    const retired = Prog.retirements(G);
    if (retired.length) news(G, `은퇴: ${retired.filter(p => p.ovr >= 78 || p.hof).slice(0, 8).map(p => p.name).join(', ') || retired.slice(0, 5).map(p => p.name).join(', ')} 등 ${retired.length}명`, { type: 'retire' });
    startDraft(G);
  }

  // 재계약 단계를 넘긴다(사용자가 처리하지 않은 만료 선수는 시장으로)
  function endResign(G) {
    const y = G.season;
    for (const p of L.roster(G, G.userTid)) {
      if (p.contract && p.contract.exp <= y) { p.lastTid = G.userTid; p.tid = -1; p.contract = null; }
    }
    const left = AI.aiResign(G);
    for (const t of G.teams) if (t.tid !== G.userTid) AI.trimRoster(G, t.tid, 15);
    const big = left.filter(p => p.ovr >= 82).slice(0, 8);
    if (big.length) news(G, `FA 시장 주요 선수: ${big.map(p => p.name).join(', ')}`, { type: 'fa' });
    G.phase = 'fa'; G.date = G.cal.fa;
    const added = Prog.injectEntrants(G, y + 1);
    for (const p of added) if (p.tid >= 0) news(G, `${p.name}, ${nm(G, p.tid)} 합류`, { type: 'fa' });
    scanFA(G);
    msg(G, '자유계약 시장 개장', `자유계약 시장이 열렸습니다. <b>자유계약</b> 화면에서 선수에게 계약을 제안하세요.<br>샐러리캡(${y + 1 - 1}-${String((y + 1) % 100).padStart(2, '0')}): ${U.money(F.cap(y + 1))}, 우리 팀 다음 시즌 연봉 총액: ${U.money(F.payroll(G, G.userTid, y + 1))}`, { type: 'contract' });
  }

  function newSeason(G) {
    G.logs = {}; G.logsSeason = G.season + 1;
    G.season++;
    const y = G.season;
    Prog.developAll(G);
    Prog.normalize(G);
    for (const p of Object.values(G.players)) {
      if (p.tid >= -1) { p.morale = U.clamp((p.morale ?? 60) * 0.5 + 32, 20, 90); }
      if (p.injury && p.injury.days > 0) p.injury.days = Math.max(0, p.injury.days - 90);
      if (p.injury && p.injury.days <= 0) p.injury = null;
    }
    setupSeason(G, false);
    const u = L.roster(G, G.userTid);
    msg(G, `${U.seasonLabel(y)} 시즌 프리시즌`, `새 시즌이 시작됩니다. 선수들의 능력치가 바뀌었습니다(${G.settings.prog === 'real' ? '실제 커리어 흐름 반영' : '무작위 성장'}).<br>현재 로스터 ${u.length}명. 개막 전까지 로스터를 15명 이하로 맞추세요.`, { type: 'season' });
  }

  // ---------- 하루 진행 ----------
  function userGameToday(G) {
    if (!['regular', 'playin', 'playoffs'].includes(G.phase)) return null;
    if (G.phase !== 'regular') todayPostseasonGames(G);
    return G.schedule.find(g => g.date === G.date && !g.played && (g.h === G.userTid || g.a === G.userTid)) || null;
  }

  // 오늘 경기를 모두 치르고 하루를 넘긴다. userResult: 사용자가 생중계로 치른 결과
  function day(G, userResult, opts = {}) {
    const r = dayInner(G, userResult, opts);
    if (r !== 'wait' && r !== 'roster') scanFA(G);
    return r;
  }
  function dayInner(G, userResult, opts = {}) {
    if (G.fired) return 'fired';
    const ph = G.phase;
    if (ph === 'preseason') {
      const nd = U.addDays(G.date, 1);
      if (nd >= G.cal.open) {
        // 개막: 사용자 로스터 확인
        const n = L.roster(G, G.userTid).length;
        if (n > 15 && opts.autoRoster) {
          const cut = AI.trimRoster(G, G.userTid, 15);
          msg(G, '로스터 정리', `개막 로스터를 15명으로 맞추느라 코치진이 ${cut.map(p => p.name).join(', ')}을(를) 방출했습니다.`, { type: 'contract' });
        } else if (n > 15) return 'roster';
        if (n < 12) { const add = AI.fillRoster(G, G.userTid, 12); msg(G, '로스터 보충', `로스터가 12명보다 적어 최저 연봉으로 ${add.map(p => p.name).join(', ')}와 계약했습니다.`, { type: 'contract' }); }
        G.phase = 'regular'; G.date = G.cal.open;
        L.computeLgAdj(G);
        msg(G, '정규시즌 개막', `${U.seasonLabel(G.season)} 정규시즌이 개막했습니다. 82경기 대장정의 시작입니다.`, { type: 'season' });
        return 'phase';
      }
      G.date = nd;
      if (Math.random() < 0.05) AI.faDay(G, 0.5);
      return 'day';
    }
    if (ph === 'regular' || ph === 'playin' || ph === 'playoffs') {
      if (ph !== 'regular') todayPostseasonGames(G);
      const today = G.schedule.filter(g => g.date === G.date && !g.played);
      for (const g of today) {
        if (userResult && (g.h === G.userTid || g.a === G.userTid)) { record(G, g, userResult); }
        else playGameQuick(G, g);
        if (g.type !== 'reg') afterPostseasonGame(G, g);
      }
      dailyUpdates(G);
      if (ph === 'regular') {
        if (!G.schedule.some(g => g.type === 'reg' && !g.played)) { G.date = U.addDays(G.date, 2); startPostseason(G); return 'phase'; }
        G.date = U.addDays(G.date, 1);
        // 다음 경기일까지 빈 날을 건너뛴다(올스타 휴식기 등)
        if (!G.schedule.some(g => g.date === G.date) && G.schedule.some(g => !g.played && g.type === 'reg')) {
          const nxt = G.schedule.find(g => !g.played && g.type === 'reg');
          while (G.date < nxt.date) { G.date = U.addDays(G.date, 1); dailyUpdates(G); }
        }
        return 'day';
      }
      const before = G.phase;
      advancePostseason(G);
      if (G.phase === 'draft') return 'phase';
      G.date = U.addDays(G.date, 1);
      return before !== G.phase ? 'phase' : 'day';
    }
    if (ph === 'fa') {
      const signed = AI.faDay(G, G.date <= U.addDays(G.cal.fa, 10) ? 1 : 0.4, !!opts.autoUser);
      for (const s2 of signed) if (s2.t.tid === G.userTid) msg(G, `코치진 영입: ${s2.p.name}`, `자유계약 시장에서 <b>${s2.p.name}</b>(${s2.p.pos}, 능력 ${Math.round(s2.p.ovr)})와 ${U.money(s2.amt)}×${s2.p.contract.exp - G.season}년 계약했습니다.`, { type: 'contract', pid: s2.p.pid });
      for (const s of signed) if (s.p.ovr >= 80) news(G, `FA: ${s.p.name} → ${s.t.ko} (${U.money(s.amt)}×${s.p.contract.exp - G.season}년)`, { type: 'fa' });
      G.date = U.addDays(G.date, 1);
      if (G.date > G.cal.faEnd) { newSeason(G); return 'phase'; }
      return 'day';
    }
    return 'wait';
  }

  function dailyUpdates(G) {
    for (const p of Object.values(G.players)) {
      if (p.injury && p.injury.days > 0) {
        p.injury.days--;
        if (p.injury.days <= 0) {
          if (p.tid === G.userTid) msg(G, `복귀: ${p.name}`, `${p.name} 선수가 ${p.injury.type}에서 회복해 출전할 수 있습니다.`, { type: 'injury', pid: p.pid });
          p.injury = null;
        }
      }
    }
    if (G.phase === 'regular') {
      const beforeDeadline = G.date <= G.cal.deadline;
      // AI: 부상으로 사람이 모자라면 자유계약 영입
      for (const t of G.teams) {
        if (t.tid === G.userTid) continue;
        const ps = L.roster(G, t.tid);
        const healthy = ps.filter(p => !(p.injury && p.injury.days > 0)).length;
        if (healthy < 10 && ps.length < 15) {
          const fa = L.fas(G).sort((a, b) => b.ovr - a.ovr)[0];
          if (fa) { fa.tid = t.tid; fa.contract = { amt: F.minSal(G.season), exp: G.season }; }
        }
      }
      if (beforeDeadline && Math.random() < 0.045) {
        const o = AI.aiTrade(G);
        if (o) news(G, tradeText(G, o), { type: 'trade' });
      }
      if (beforeDeadline && autoSet(G).offers && Math.random() < 0.025 && !G.inbox.some(m => m.type === 'offer' && !m.done)) {
        const o = AI.aiOfferToUser(G);
        if (o) msg(G, `트레이드 제안: ${nm(G, o.a)}`, tradeText(G, o, true), { type: 'offer', offer: o });
      }
      if (G.date === G.cal.deadline) msg(G, '트레이드 마감', '오늘로 트레이드 마감입니다. 플레이오프가 끝날 때까지 트레이드를 할 수 없습니다.', { type: 'info' });
      if (Math.random() < 0.08) AI.faDay(G, 0.15);
      // 주간: 사기
      if (new Date(G.date + 'T12:00:00Z').getUTCDay() === 1) weeklyMorale(G);
      // 중간 평가
      if (G.date.endsWith('-01-15')) midCheck(G);
      // 매니저 모드: 월간 코치 보고서
      const M = mgrSet(G);
      if (M.on && M.report && G.date.endsWith('-01') && HM.Adv) {
        try { msg(G, `🧠 코치 보고서 — ${+G.date.slice(5, 7)}월`, HM.Adv.reportHtml(G), { type: 'coach' }); } catch (e) { /* 보고서는 건너뛴다 */ }
      }
    }
  }

  function tradeText(G, o, forUser) {
    const pl = ids => ids.map(id => G.players[id]).map(p => `${p.name}(${Math.round(p.ovr)})`).join(', ');
    const pk = ids => ids.map(id => { const k = G.picks.find(x => x.id === id); return `${k.season} ${k.round}라운드 지명권(${G.teams[k.orig].abbr})`; }).join(', ');
    const side = (ps, ks) => [pl(ps), pk(ks)].filter(Boolean).join(', ') || '없음';
    if (forUser) return `${nm(G, o.a)}가 트레이드를 제안했습니다.<br><br><b>받는 것:</b> ${side(o.ap, o.ak)}<br><b>주는 것:</b> ${side(o.bp, o.bk)}`;
    return `트레이드: ${nm(G, o.a)} ⇄ ${nm(G, o.b)} — ${G.teams[o.a].abbr} 받음: ${side(o.bp, o.bk)} / ${G.teams[o.b].abbr} 받음: ${side(o.ap, o.ak)}`;
  }

  function weeklyMorale(G) {
    for (const t of G.teams) {
      const ps = L.roster(G, t.tid).sort((a, b) => b.ovr - a.ovr);
      const rec = L.rec(G, t.tid); const wp = rec.w / Math.max(1, rec.w + rec.l);
      ps.forEach((p, i) => {
        const s = seasonLine(p, G.season); if (!s || s.gp < 5) return;
        const mpg = s.min / s.gp;
        const exp = i < 5 ? 28 : i < 8 ? 18 : i < 10 ? 10 : 0;
        let m = p.morale ?? 60;
        m += U.clamp((mpg - exp) * 0.25, -3, 2) + (wp - 0.5) * 3;
        m += (62 - m) * 0.05;
        p.morale = U.clamp(m, 0, 100);
        if (t.tid === G.userTid && p.morale < 30 && !p.complained && P.age(p, G.season) >= 22) {
          p.complained = G.season;
          msg(G, `불만: ${p.name}`, `${p.name} 선수가 출전 시간에 불만을 드러냈습니다. "저는 더 뛸 수 있는 선수입니다."<br>사기가 낮으면 경기력과 재계약 의사에 영향이 갑니다.`, { type: 'complaint', pid: p.pid });
        }
      });
    }
  }

  function midCheck(G) {
    const r = L.rec(G, G.userTid); const wp = r.w / Math.max(1, r.w + r.l);
    const lv = G.board.exp?.lv || 3;
    const need = [0, 0.25, 0.45, 0.52, 0.6, 0.66][lv];
    if (wp < need - 0.12) msg(G, '이사회: 시즌 중간 점검', `현재 ${r.w}승 ${r.l}패. 이사회는 지금 성적이 목표(${G.board.exp.txt})에 크게 못 미친다고 우려하고 있습니다.`, { type: 'board' });
    else if (wp > need + 0.1) msg(G, '이사회: 시즌 중간 점검', `현재 ${r.w}승 ${r.l}패. 이사회는 기대 이상의 성적에 만족하고 있습니다.`, { type: 'board' });
  }

  // 시작 직후 초기 메시지
  function welcome(G) {
    const t = T(G, G.userTid);
    const ps = L.roster(G, G.userTid).sort((a, b) => b.ovr - a.ovr);
    const prev = t.prevReal ? `지난 시즌 실제 성적은 ${t.prevReal[0]}승 ${t.prevReal[1]}패였습니다.` : '';
    msg(G, `${t.ko}에 오신 것을 환영합니다`,
      `${G.manager.name} 감독님, ${U.seasonLabel(G.season)} 시즌 <b>${t.ko}</b>의 지휘봉을 잡으셨습니다. ${prev}<br><br>핵심 선수: ${ps.slice(0, 3).map(p => `<b>${p.name}</b>(${Math.round(p.ovr)})`).join(', ')}<br><br>` +
      '왼쪽 메뉴에서 선수단·전술·일정을 확인하고, 위의 <b>계속</b> 단추로 시간을 진행하세요. 경기 날에는 생중계로 지휘하거나 결과만 볼 수 있습니다.', { type: 'board' });
  }

  HM.Season = {
    calendar, genSchedule, setupSeason, standings, gamesBehind, userGameToday, day, makeGame, record, playGameQuick, afterPostseasonGame,
    startDraft, draftPlayer, draftUntilUser, finishDraft, endResign, newSeason, autoSet, autoDraftAll, autoResignUser,
    watchList, shortlist, matchWatch, watchHits, watchSummary, scanFA, mgrSet, seasonLine, msg, news, welcome, roundName, tradeText, bestOf, KEYS, playoffTeams,
  };
})();
