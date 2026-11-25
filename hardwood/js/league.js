// 리그 만들기와 선수 도우미
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, R = HM.Ratings, F = HM.Fin;
  const D = () => globalThis.HM_DATA;

  // ---------- 실제 데이터 접근 ----------
  let snapIndex = null;
  function snapsOf(rid) { return (D().snaps[rid]) || []; }
  function snapAt(rid, y) {
    if (!snapIndex) {
      snapIndex = new Map();
      for (const [rid2, list] of Object.entries(D().snaps)) {
        const m = new Map(); for (const s of list) m.set(s[0], s); snapIndex.set(rid2, m);
      }
    }
    const m = snapIndex.get(rid); return m ? m.get(y) || null : null;
  }
  function decodeSnap(s) {
    return { a: R.decode(s[3]), t: { usg: s[4] / 1000, r3: s[5] / 1000, rim: s[6] / 1000, ftr: s[7] / 1000 }, pos: s[2] };
  }
  const snapOvr = s => { const x = decodeSnap(s); return R.ovr(x.a, x.t); };

  // 실제 커리어 최고치(잠재력). 아직 뛰는 젊은 선수는 나이에 따른 성장 몫을 더한다.
  const peakCache = new Map();
  function realPeak(rid) {
    if (peakCache.has(rid)) return peakCache.get(rid);
    const list = snapsOf(rid);
    let best = 0, any = 0;
    for (const s of list) {
      const o = snapOvr(s); any = Math.max(any, o);
      if (s[8] * s[10] / 10 >= 500) best = Math.max(best, o);
    }
    if (!best) best = any - 1;
    const last = list[list.length - 1];
    if (last && last[0] >= D().last - 1) {
      const age = last[19];
      const g = age <= 19 ? 11 : age >= 28 ? 0 : [11, 9, 7.5, 6, 4.5, 3.2, 2, 1, 0.4][age - 19];
      best = Math.max(best, snapOvr(last) + g * (0.6 + 0.8 * U.hrand(rid + 'pk')));
    }
    peakCache.set(rid, best);
    return best;
  }

  // ---------- 선수 도우미 ----------
  const P = {};
  P.update = p => {
    p.o = R.obpm(p.a, p.t); p.d = R.dbpm(p.a);
    p.ovr = Math.round(R.bpmToOvr(p.o + p.d) * 10) / 10;
    if (p.pa < p.ovr) p.pa = p.ovr;
  };
  P.age = (p, y) => Math.floor(y + 0.085 - p.born);
  P.ovr = p => Math.round(p.ovr);
  P.pot = p => Math.round(Math.max(p.ovr, p.pa));
  // 화면용 잠재력(실제 잠재력에 선수별 약간의 오차)
  P.potShown = (p, G) => {
    const age = P.age(p, G.season);
    if (age >= 29) return Math.round(p.ovr);
    const noise = (U.hrand(p.pid + 'pot') - 0.5) * (p.tid === G.userTid ? 3 : 6);
    return Math.round(U.clamp(Math.max(p.ovr, p.pa + noise), p.ovr, 99));
  };
  P.stars = v => U.clamp(Math.round((v - 50) / 9 * 2) / 2, 0.5, 5);

  // ---------- 이름 만들기(가상의 신인) ----------
  const FN = ('James John Michael David Chris Marcus Jalen Jaylen Tyrese Darius Malik Isaiah Elijah Caleb Cameron Jordan Trey Devin Andre Jamal Kevin ' +
    'Brandon Justin Tyler Aaron Kyle Ryan Derrick Terrence Damian Dejounte Keegan Bryce Cole Grant Reed Miles Noah Liam Ethan Mason Lucas Owen ' +
    'Nikola Luka Bogdan Dario Jonas Domantas Rudy Evan Nicolas Victor Alperen Lauri Kristaps Dennis Josh Bennedict Amen Ausar Scoot Brice Dyson ' +
    'Jabari Paolo Chet Keyonte Jaden Kobe Tari Jett Kel Taj Zion Ja Desmond Mikal Anfernee Trae Deni Franz Moritz Killian Ousmane Zaccharie ' +
    'Yuki Rui Kai Hyun Min Jae Tae Andrés Mateo Diego Facundo Leandro Santi Joel Pascal Giannis Thanasis Kostas Shai Dillon Fred Kawhi Paul ' +
    'Donovan Kemba Collin Coby Patrick Walker Harrison Quentin Tobias Wendell Marvin DeAndre Gary Gradey Brandin Toumani Khris Kris Tre').split(' ');
  const LN = ('Johnson Williams Brown Jones Davis Miller Wilson Moore Taylor Anderson Thomas Jackson White Harris Martin Thompson Robinson Clark ' +
    'Lewis Walker Allen Young King Wright Scott Green Baker Adams Nelson Hill Mitchell Carter Roberts Turner Phillips Campbell Parker Evans ' +
    'Edwards Collins Stewart Morris Rogers Reed Cook Morgan Bell Murphy Bailey Cooper Richardson Cox Howard Ward Peterson Gray James Watson ' +
    'Brooks Kelly Sanders Price Bennett Wood Barnes Ross Henderson Coleman Jenkins Perry Powell Long Patterson Hughes Washington Butler Simmons ' +
    'Foster Bryant Alexander Russell Griffin Hayes Myers Ford Hamilton Graham Sullivan Wallace West Cole Jordan Reynolds Ellis Harrison Gibson ' +
    'McDonald Marshall Owens Holmes Freeman Wells Webb Tucker Porter Hunter Hicks Crawford Henry Boyd Mason Warren Dixon Ramos Burns Gordon ' +
    'Petrović Jovanović Marković Bogdanović Šarić Valančiūnas Sabonis Dončević Nurkić Hezonja Kalinić Fernández Martínez García Rodríguez López ' +
    'Diallo Traoré Koné Sissoko Ndiaye Diop Okafor Okeke Adebayo Olawale Mensah Nwosu Antetokounmpo Papadopoulos Schröder Wagner Hartenstein ' +
    'Kim Lee Park Choi Yoon Tanaka Watanabe Hachimura Kawamura Zhou Wang Dubois Lefebvre Fournier Coulibaly Sarr Batum Gobert Wembanyama').split(' ');
  function genName(G) {
    for (let i = 0; i < 20; i++) {
      const n = U.pick(FN) + ' ' + U.pick(LN);
      if (!G.nameSet || !G.nameSet[n]) { if (G.nameSet) G.nameSet[n] = 1; return n; }
    }
    return U.pick(FN) + ' ' + U.pick(LN) + ' Jr.';
  }

  const TPL = {
    PG: { ins: 50, mid: 58, tp: 60, ft: 70, pss: 72, hdl: 74, orb: 30, pdef: 60, idef: 30, stl: 62, blk: 28, drb: 35, iq: 58, cmp: 55, ldr: 52, wrk: 58, spd: 74, ath: 58, str: 35, sta: 62 },
    SG: { ins: 55, mid: 60, tp: 62, ft: 70, pss: 52, hdl: 60, orb: 35, pdef: 58, idef: 35, stl: 56, blk: 35, drb: 40, iq: 55, cmp: 55, ldr: 50, wrk: 58, spd: 67, ath: 62, str: 42, sta: 62 },
    SF: { ins: 58, mid: 57, tp: 56, ft: 66, pss: 48, hdl: 50, orb: 45, pdef: 56, idef: 48, stl: 50, blk: 45, drb: 52, iq: 54, cmp: 55, ldr: 50, wrk: 58, spd: 58, ath: 63, str: 52, sta: 62 },
    PF: { ins: 64, mid: 52, tp: 45, ft: 62, pss: 42, hdl: 40, orb: 62, pdef: 45, idef: 60, stl: 42, blk: 60, drb: 66, iq: 54, cmp: 55, ldr: 50, wrk: 58, spd: 46, ath: 62, str: 66, sta: 60 },
    C: { ins: 68, mid: 45, tp: 30, ft: 56, pss: 40, hdl: 32, orb: 72, pdef: 35, idef: 70, stl: 38, blk: 72, drb: 74, iq: 54, cmp: 55, ldr: 50, wrk: 58, spd: 38, ath: 60, str: 74, sta: 58 },
  };
  const HGT = { PG: 189, SG: 196, SF: 201, PF: 206, C: 211 };
  const TEND = { PG: [0.22, 0.45, 0.36, 0.24], SG: [0.21, 0.48, 0.38, 0.24], SF: [0.19, 0.44, 0.46, 0.25], PF: [0.18, 0.33, 0.6, 0.27], C: [0.17, 0.12, 0.8, 0.32] };

  // 가상의 선수 하나 만들기. ovr/pa 목표에 능력치를 맞춘다.
  function genPlayer(G, o) {
    const pos = o.pos || U.wpick(R.POS, [1, 1, 1, 1, 0.9]);
    const tpl = TPL[pos];
    const a = {};
    for (const k of R.KEYS) a[k] = U.clamp(tpl[k] + U.gauss(0, 9), 5, 95);
    const eraTp = (envFor(G.season).tpar || 0.4) / 0.42;
    const [usg, r3, rim, ftr] = TEND[pos];
    const t = {
      usg: U.clamp(usg + (o.ovr - 72) * 0.004 + U.gauss(0, 0.025), 0.1, 0.36),
      r3: U.clamp(r3 * eraTp + U.gauss(0, 0.08) + (a.tp - 55) / 300, 0, 0.85),
      rim: U.clamp(rim + U.gauss(0, 0.08), 0.12, 0.9),
      ftr: U.clamp(ftr + U.gauss(0, 0.07), 0.08, 0.6),
    };
    const tgt = R.ovrToBpm(o.ovr);
    const split = 0.6 + U.gauss(0, 0.08);
    R.fitTo(a, t, tgt * split, tgt * (1 - split));
    const age = o.age ?? 21;
    const hgt = Math.round(HGT[pos] + U.gauss(0, 3.5));
    const p = {
      pid: G.nextPid++, rid: null, name: o.name || genName(G), born: G.season - age - Math.random() * 0.9 + 0.1,
      hgt, wgt: Math.round(hgt * 0.5 - 2 + U.gauss(0, 5)), pos, college: o.college || '', hof: 0,
      draft: null, tid: o.tid ?? -1, a, t, contract: null, injury: null, stats: [], awards: [], morale: 65, dev: 0,
      yearsPro: o.yearsPro || 0, pa: o.pa || o.ovr,
    };
    P.update(p);
    p.pa = Math.max(p.ovr, o.pa || p.ovr);
    return p;
  }

  function bornOf(bio, s) {
    if (bio && bio[1]) {
      const [y, m, d] = bio[1].split('-').map(Number);
      return y + ((m - 1) * 30.4 + d) / 365;
    }
    return s ? s[0] - s[19] - 0.4 : 2000;
  }

  // 실제 선수 만들기(그 시즌 스냅샷 기준)
  function makeReal(G, rid, s, tid) {
    const bio = D().players[rid] || [rid];
    const x = decodeSnap(s);
    const p = {
      pid: G.nextPid++, rid, name: bio[0], born: bornOf(bio, s),
      hgt: bio[2] || HGT[x.pos], wgt: bio[3] || Math.round((bio[2] || HGT[x.pos]) * 0.5), pos: x.pos, college: bio[4] || '', hof: bio[5] || 0,
      draft: bio[8] ? { year: bio[8][0], round: bio[8][1], pick: bio[8][2], abbr: bio[8][3] } : null,
      tid, a: x.a, t: x.t, contract: null, injury: null, stats: [], awards: [], morale: 65, dev: 0,
      yearsPro: Math.max(0, (s[20] || 1) - 1), pa: 0, realFrom: bio[6] || s[0], realTo: bio[7] || s[0],
    };
    P.update(p);
    p.pa = Math.max(p.ovr, realPeak(rid));
    G.ridMap[rid] = p.pid;
    G.players[p.pid] = p;
    return p;
  }

  function envFor(y) {
    const d = D();
    const s = d.seasons[Math.min(Math.max(y, d.first), d.last)];
    return s ? s.env : d.seasons[d.last].env;
  }

  // ---------- 신인 드래프트 후보 ----------
  function pickCurve(pick) {
    // 지명 순위별 대략적인 신인 능력/잠재력
    const ovr = 74 - Math.log(pick) * 3.2 + U.gauss(0, 2.5);
    const pa = ovr + 4 + Math.max(0, 12 - pick * 0.3) * (0.3 + Math.random() * 0.9) + U.gauss(0, 3);
    return { ovr: U.clamp(ovr, 55, 78), pa: U.clamp(pa, 58, 96) };
  }
  function makeDraftClass(G, year) {
    const d = D();
    const list = d.drafts[year] || [];
    const made = [];
    for (const [pick, round, tm, rid] of list) {
      if (G.ridMap[rid] !== undefined) continue;
      const snaps = snapsOf(rid);
      const bio = d.players[rid] || [rid];
      let p;
      if (snaps.length && snaps[0][0] >= year + 1) {
        const s = snaps[0];
        p = makeReal(G, rid, s, -2);
        const gap = s[0] - (year + 1);
        if (gap > 0) { // 해외 등에서 늦게 데뷔
          const tgt = R.ovrToBpm(Math.max(50, p.ovr - 1.8 * gap)) - (p.o + p.d);
          R.fitTo(p.a, p.t, p.o + tgt * 0.65, p.d + tgt * 0.35); P.update(p);
        }
        p.born = Math.min(p.born, year - 18.5);
      } else if (!snaps.length) {
        const recent = year >= d.last - 1;
        const c = pickCurve(pick);
        const ovr = recent ? c.ovr : U.clamp(c.ovr - 6 - Math.random() * 4, 48, 66);
        const pa = recent ? c.pa : U.clamp(ovr + 3 + Math.random() * 6, 52, 70);
        p = genPlayer(G, { ovr, pa, age: 20 + Math.random() * 2.5, name: bio[0], college: bio[4] || '' });
        p.rid = rid; G.ridMap[rid] = p.pid; p.tid = -2;
        G.players[p.pid] = p;
      } else continue; // 지명 전부터 뛴 경우(드묾)
      p.draft = null;
      p.prospect = { year, realPick: pick, realRound: round, realTeam: tm };
      p.yearsPro = 0;
      made.push(p);
    }
    // 부족하면 가상의 유망주로 채운다(실제 자료가 없는 미래 드래프트 포함)
    const need = Math.max(0, (list.length ? 64 : 72) - made.length);
    for (let i = 0; i < need; i++) {
      const rank = list.length ? 45 + i : i + 1;
      const c = pickCurve(rank);
      const p = genPlayer(G, { ovr: list.length ? c.ovr - 3 : c.ovr, pa: list.length ? c.pa - 4 : c.pa, age: 19.2 + Math.random() * 3.3 });
      p.tid = -2; p.prospect = { year, realPick: null, fakeRank: list.length ? rank : null };
      G.players[p.pid] = p; made.push(p);
    }
    return made;
  }

  // ---------- 새 리그 ----------
  const BIG = { NYK: 1, LAL: 1, CHI: 0.9, BOS: 0.85, GSW: 0.85, LAC: 0.8, BRK: 0.8, PHI: 0.75, DAL: 0.7, HOU: 0.7, MIA: 0.7, TOR: 0.7, ATL: 0.6, WAS: 0.6, PHO: 0.6, DET: 0.6, DEN: 0.55, MIN: 0.5, OKC: 0.4, POR: 0.5, SAC: 0.45, ORL: 0.5, CLE: 0.5, IND: 0.45, MIL: 0.45, CHO: 0.45, SAS: 0.5, UTA: 0.4, MEM: 0.4, NOP: 0.4 };

  function teamFromRow(row, tid, d) {
    const [abbr, name, fr, conf, div, w, l] = row;
    return {
      tid, abbr, name, ko: d.ko[name] || name, fr, conf, div, colors: d.colors[abbr] || ['#555', '#ccc'],
      tactics: { pace: 1, focus: 'bal', def: 'man', reb: 'bal' }, rotation: { auto: true, starters: [], minutes: {} },
      pop: BIG[fr] ?? 0.5, hype: 0.5, cash: 0, seasons: {}, lastReal: [w, l], strategy: 'mid',
    };
  }

  function create(opt) {
    const d = D();
    const Y = opt.startYear;
    const G = {
      v: 1, startYear: Y, season: Y, phase: 'preseason', date: `${Y - 1}-10-01`, userTid: null,
      manager: { name: opt.managerName || '감독' }, settings: { prog: opt.prog || 'real', autosave: true },
      teams: [], players: {}, ridMap: {}, nextPid: 1, nameSet: {},
      schedule: [], games: {}, picks: [], dead: [], inbox: [], news: [], history: {}, nextMsg: 1,
      board: { conf: 60, exp: null }, playoffs: null, draft: null, fa: null, stats: {}, records: {},
    };
    const rows = d.seasons[Y].teams;
    rows.forEach((row, i) => G.teams.push(teamFromRow(row, i, d)));
    const byAbbr = {}; G.teams.forEach(t => { byAbbr[t.abbr] = t; });
    const byFr = {}; G.teams.forEach(t => { byFr[t.fr] = t; });
    G.userTid = (byAbbr[opt.userAbbr] || G.teams[0]).tid;
    for (const t of G.teams) {
      const prev = d.seasons[Y - 1]?.teams.find(r => r[2] === t.fr);
      t.hype = prev ? U.clamp(prev[5] / (prev[5] + prev[6]) * 1.1 - 0.05, 0.1, 0.95) : 0.5;
      if (prev) t.prevReal = [prev[5], prev[6]];
    }

    // 그 시즌에 뛴 선수
    const minutesIn = {};
    for (const [rid, list] of Object.entries(d.snaps)) {
      const s = list.find(x => x[0] === Y);
      if (s) {
        const team = byAbbr[s[1].split('/')[0]];
        const p = makeReal(G, rid, s, team ? team.tid : -1);
        minutesIn[p.pid] = s[8] * s[10] / 10 + (s[9] || 0) * 5;
        continue;
      }
      // 시작 시즌을 통째로 쉰 선수(부상 등): 다음 시즌 팀으로, 시즌 결장 처리
      const prev = list.find(x => x[0] === Y - 1);
      if (!prev) continue;
      const next = list.find(x => x[0] > Y);
      if (next && next[0] <= Y + 2) {
        const team = byFr[(d.seasons[next[0]]?.teams.find(r => r[0] === next[1].split('/')[0]) || [])[2]];
        const p = makeReal(G, rid, prev, team ? team.tid : -1);
        if (team) p.injury = { type: '시즌 결장(장기 부상·개인 사정)', days: 230, out: true };
        minutesIn[p.pid] = 300;
      } else if (Y === d.last && prev[19] <= 34 && prev[8] * prev[10] / 10 > 300) {
        // 최신 시즌: 아직 기록이 없는 선수. 신인 계약 중이면 지난 시즌 팀에 남기고, 나머지는 자유계약으로
        const lastAbbr = prev[1].split('/').pop();
        const team = byFr[(d.seasons[Y - 1]?.teams.find(r => r[0] === lastAbbr) || [])[2]];
        const bio = d.players[rid];
        const rookieDeal = bio && bio[8] && bio[8][1] === 1 && bio[8][0] >= Y - 4;
        const p = makeReal(G, rid, prev, rookieDeal && team ? team.tid : -1);
        if (rookieDeal && team) minutesIn[p.pid] = prev[8] * prev[10] / 10 * 0.8;
      }
    }
    // 직전 드래프트에서 뽑혔지만 아직 기록이 없는 신인(최신 드래프트)
    for (const [pick, round, tm, rid] of (d.drafts[Y - 1] || [])) {
      if (G.ridMap[rid] !== undefined || snapsOf(rid).length || Y - 1 < d.last - 2 || round > 1) continue;
      const c = pickCurve(pick);
      const team = byAbbr[tm] || byFr[tm];
      const bio = d.players[rid] || [rid];
      const p = genPlayer(G, { ovr: c.ovr, pa: c.pa, age: 20 + Math.random() * 1.5, name: bio[0], college: bio[4] || '', tid: team ? team.tid : -1 });
      p.rid = rid; p.draft = { year: Y - 1, round, pick, abbr: tm }; G.ridMap[rid] = p.pid; G.players[p.pid] = p;
      minutesIn[p.pid] = 200;
    }

    // 로스터 15명 제한: 실제 출전 시간이 적은 선수부터 자유계약으로
    for (const t of G.teams) {
      const ps = Object.values(G.players).filter(p => p.tid === t.tid).sort((a, b) => (minutesIn[b.pid] || 0) - (minutesIn[a.pid] || 0));
      ps.slice(15).forEach(p => { p.tid = -1; });
    }
    // 계약
    for (const p of Object.values(G.players)) initContract(G, p, Y);
    // 드래프트 지명권(4년치)
    for (const t of G.teams) for (let y = Y; y < Y + 4; y++) for (const rd of [1, 2]) G.picks.push({ id: `${y}-${rd}-${t.tid}`, season: y, round: rd, orig: t.tid, tid: t.tid });
    // 올 시즌 드래프트 후보
    makeDraftClass(G, Y);
    for (const p of Object.values(G.players)) if (p.tid !== -2) p.yearsPro = p.yearsPro || 0;
    for (const p of Object.values(G.players)) G.nameSet[p.name] = 1;
    return G;
  }

  function initContract(G, p, y) {
    if (p.tid === -2) return;
    const age = P.age(p, y);
    const dr = p.draft;
    if (dr && dr.round === 1 && dr.year >= 1984 && y - dr.year <= 3 && y - dr.year >= 0) {
      p.contract = { amt: Math.round(F.rookieScale(dr.pick, y) * (1 + 0.06 * (y - dr.year - 1))), exp: dr.year + 4, rookie: true };
      return;
    }
    const mv = F.marketValue(p, y, age);
    const yrs = age <= 24 ? U.randInt(1, 4) : age <= 30 ? U.randInt(1, 5) : age <= 33 ? U.randInt(1, 3) : U.randInt(1, 2);
    p.contract = { amt: Math.max(F.minSal(y), Math.round(mv * (0.7 + Math.random() * 0.5) / 10) * 10), exp: y + yrs - 1 };
  }

  // ---------- 조회 ----------
  const L = {};
  L.team = (G, tid) => G.teams[tid];
  L.roster = (G, tid) => Object.values(G.players).filter(p => p.tid === tid);
  L.fas = G => Object.values(G.players).filter(p => p.tid === -1);
  L.prospects = G => Object.values(G.players).filter(p => p.tid === -2);
  L.env = (G) => {
    const base = Object.assign({}, envFor(G.season));
    if (G.lgAdj) { base.lgO = G.lgAdj.o; base.lgD = G.lgAdj.d; }
    return base;
  };
  L.tname = (G, tid) => tid >= 0 ? G.teams[tid].ko : tid === -1 ? '자유계약' : tid === -2 ? '드래프트 후보' : '은퇴';
  L.rec = (G, tid, y) => {
    const t = G.teams[tid];
    y = y ?? G.season;
    return t.seasons[y] || (t.seasons[y] = { w: 0, l: 0, hw: 0, hl: 0, pf: 0, pa: 0, cw: 0, cl: 0, dw: 0, dl: 0, streak: 0, last: [], seed: null, po: -1 });
  };
  // 리그 평균 공헌도(경기 엔진 기준점)
  L.computeLgAdj = G => {
    let so = 0, sd = 0, n = 0;
    for (const t of G.teams) {
      const ps = L.roster(G, t.tid).filter(p => !(p.injury && p.injury.days > 0));
      const rot = HM.Sim.autoRotation(ps, false);
      for (const p of ps) { const m = rot.minutes[p.pid] || 0; so += p.o * m; sd += p.d * m; n += m; }
    }
    G.lgAdj = { o: so / (n || 1) * 5, d: sd / (n || 1) * 5 };
  };
  // 팀 전력(상위 8명 가중)
  L.strength = (G, tid) => {
    const ps = L.roster(G, tid).filter(p => !(p.injury && p.injury.days > 20)).sort((a, b) => b.ovr - a.ovr).slice(0, 10);
    const w = [0.17, 0.155, 0.14, 0.125, 0.11, 0.09, 0.075, 0.06, 0.045, 0.03];
    let s = 0; ps.forEach((p, i) => { s += p.ovr * w[i]; });
    return s;
  };

  HM.L = Object.assign(L, { create, makeDraftClass, makeReal, genPlayer, genName, initContract, snapAt, snapsOf, decodeSnap, realPeak, envFor, pickCurve, teamFromRow });
  HM.P = P;
})();
