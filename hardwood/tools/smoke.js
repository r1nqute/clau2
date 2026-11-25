// 머리 없이 여러 시즌을 끝까지 돌려 본다. 쓰는 법: node tools/smoke.js [시작 시즌] [팀] [시즌 수] [real|random]
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const f of ['js/util.js', 'js/ratings.js', 'data/nba.js', 'js/finance.js', 'js/sim.js', 'js/league.js', 'js/progression.js', 'js/ai.js', 'js/advisor.js', 'js/season.js']) require(path.join(root, f));
const { U, L, P, AI, Season, Fin } = HM;
const Y = +(process.argv[2] || 2003), team = process.argv[3] || 'CLE', N = +(process.argv[4] || 3), prog = process.argv[5] || 'real';
let t0 = Date.now();
const G = L.create({ startYear: Y, userAbbr: team, managerName: '테스트', prog });
Season.setupSeason(G, true); Season.welcome(G);
{ const c = {}; for (const g of G.schedule) { c[g.h] = (c[g.h] || 0) + 1; c[g.a] = (c[g.a] || 0) + 1; } const v = Object.values(c); console.log('팀당 경기 수', Math.min(...v), '~', Math.max(...v), '마지막 날', G.schedule[G.schedule.length - 1].date); }
console.log(`리그 생성 ${Date.now() - t0}ms, 팀 ${G.teams.length}, 선수 ${Object.keys(G.players).length}, 일정 ${G.schedule.length}경기`);
const counts = {}; for (const t of G.teams) counts[t.abbr] = L.roster(G, t.tid).length;
console.log('로스터 수', Object.entries(counts).map(([a, n]) => a + n).join(' '));
for (let s = 0; s < N; s++) {
  t0 = Date.now();
  const startSeason = G.season;
  let guard = 0;
  while (G.season === startSeason && guard++ < 2000) {
    if (G.fired) { console.log('해임됨'); G.fired = null; G.board.conf = 50; }
    if (G.phase === 'draft') {
      while (Season.draftUntilUser(G) === 'user') Season.draftPlayer(G, AI.aiDraftPick(G, G.userTid, L.prospects(G)).pid);
      const res = G.draft.results.slice(0, 5).map(r => `${r.pick}.${G.players[r.pid].name}(${G.teams[r.tid].abbr}${r.real ? ',실제' + r.real : ''})`);
      console.log('  드래프트', res.join(' '));
      Season.finishDraft(G); continue;
    }
    if (G.phase === 'resign') { Season.endResign(G); continue; }
    const r = Season.day(G);
    if (r === 'roster') AI.trimRoster(G, G.userTid, 15);
  }
  const h = G.history[startSeason];
  const ur = h.user;
  const aw = h.awards;
  const nmP = id => id && G.players[id] ? `${G.players[id].name}` : '-';
  console.log(`[${U.seasonLabel(startSeason)}] ${(Date.now() - t0) / 1000}s 우승 ${h.champName} (${h.score}) 준우승 ${h.runnerName} | MVP ${nmP(aw.mvp)} DPOY ${nmP(aw.dpoy)} ROY ${nmP(aw.roy)} FMVP ${nmP(h.fmvp)} | 우리 ${ur.w}-${ur.l} po${ur.po} 신뢰 ${ur.conf}`);
  const st = Season.standings(G).slice(0, 6).map(x => `${x.t.abbr} ${h.standings.find(z => z[0] === x.t.tid)[1]}`);
  void st;
  const top = Object.values(G.players).filter(p => p.tid >= 0).sort((a, b) => b.ovr - a.ovr).slice(0, 8).map(p => `${p.name}(${G.teams[p.tid].abbr},${P.age(p, G.season)}세,${Math.round(p.ovr)})`);
  console.log('  새 시즌 상위', top.join(', '));
  { const act = Object.values(G.players).filter(p => p.tid >= 0); const ovrs = act.map(p => p.ovr).sort((a, b) => b - a);
    let pts = 0, gp = 0; for (const g of G.schedule) if (g.played) { pts += g.hs + g.as; gp += 2; }
    console.log('  능력 분포 1위', Math.round(ovrs[0]), '10위', Math.round(ovrs[9]), '30위', Math.round(ovrs[29]), '100위', Math.round(ovrs[99]), '중앙', Math.round(ovrs[ovrs.length >> 1]), '| 리그 기준점', JSON.stringify(G.lgAdj && { o: +G.lgAdj.o.toFixed(2), d: +G.lgAdj.d.toFixed(2) })); }
  const sizes = G.teams.filter(t => t.tid !== G.userTid).map(t => L.roster(G, t.tid).length);
  const pays = G.teams.filter(t => t.tid !== G.userTid).map(t => Fin.payroll(G, t.tid) / Fin.cap(G.season));
  console.log('  AI 페이롤/캡', Math.min(...pays).toFixed(2), '~', Math.max(...pays).toFixed(2), '평균', U.avg(pays).toFixed(2), ' 사치세 팀', pays.filter(x => x * Fin.cap(G.season) > Fin.taxLine(G.season)).length);
  console.log('  로스터', Math.min(...sizes), '~', Math.max(...sizes), ' FA', L.fas(G).length, ' 은퇴', Object.values(G.players).filter(p => p.tid === -3).length, ' 페이롤(우리)', U.money(Fin.payroll(G, G.userTid)), '캡', U.money(Fin.cap(G.season)));
  const json = JSON.stringify(G); console.log('  저장 크기', (json.length / 1e6).toFixed(2), 'MB');
}
console.log('뉴스 일부:', G.news.slice(0, 8).map(n => n.text).join(' | '));
