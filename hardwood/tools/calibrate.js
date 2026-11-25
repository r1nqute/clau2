// 경기 엔진 점검: 한 시즌의 실제 로스터로 리그를 돌려 실제 성적·리그 평균과 비교한다.
// 쓰는 법: node tools/calibrate.js [시즌(끝 연도)] [팀당 경기 수]
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const f of ['js/util.js', 'js/ratings.js', 'data/nba.js', 'js/sim.js']) require(path.join(root, f));
const { U, Ratings: R, Sim } = HM; const D = HM_DATA;

const Y = +(process.argv[2] || 2010), G = +(process.argv[3] || 82);
const env = Object.assign({}, D.seasons[Y].env);
const teams = {};
for (const t of D.seasons[Y].teams) teams[t[0]] = { tid: t[0], name: t[1], abbr: t[0], players: [], real: t[5] / (t[5] + t[6]), srs: t[7], w: 0, l: 0, pf: 0, pa: 0 };
for (const [pid, list] of Object.entries(D.snaps)) for (const s of list) if (s[0] === Y) {
  const tm = teams[s[1].split('/')[0]]; if (!tm) continue;
  const a = R.decode(s[3]); const t = { usg: s[4] / 1000, r3: s[5] / 1000, rim: s[6] / 1000, ftr: s[7] / 1000 };
  const bio = D.players[pid];
  tm.players.push({ pid, name: bio[0], pos: s[2], hgt: bio[2] || 200, a, t, o: R.obpm(a, t), d: R.dbpm(a), ovr: R.ovr(a, t), realMin: s[8] * s[10] / 10, real: s });
}
for (const t of Object.values(teams)) { t.players.sort((a, b) => b.realMin - a.realMin); t.players = t.players.slice(0, 15); }
// 리그 기준: 자동 로테이션 출전 시간으로 가중한 평균
let so = 0, sd = 0, n = 0;
for (const t of Object.values(teams)) {
  const rot = Sim.autoRotation(t.players, false);
  for (const p of t.players) { const m = rot.minutes[p.pid] || 0; so += p.o * m; sd += p.d * m; n += m; }
}
env.lgO = so / n * 5; env.lgD = sd / n * 5;
console.log(`${Y} env`, JSON.stringify(env));

const list = Object.values(teams);
const box = {};
const tot = { pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, tov: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, games: 0, ot: 0, poss: 0 };
const t0 = Date.now();
const games = []; const margins = [], poss = [];
for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) if (i !== j) games.push([i, j]);
const reps = Math.round(G / (2 * (list.length - 1)) * 1000) / 1000;
let played = 0;
for (let r = 0; r < Math.ceil(reps); r++) for (const [i, j] of U.shuffle(games.slice())) {
  if (r + 1 > reps && Math.random() > reps - r) continue;
  const h = list[i], a = list[j];
  const g = new Sim.Game({ home: h, away: a, env, hca: 3 });
  const res = g.play(); played++;
  const [rh, ra] = res.teams;
  if (rh.pts > ra.pts) { h.w++; a.l++; } else { a.w++; h.l++; }
  margins.push(rh.pts - ra.pts); poss.push(0);
  h.pf += rh.pts; h.pa += ra.pts; a.pf += ra.pts; a.pa += rh.pts;
  tot.games++; tot.ot += res.ot ? 1 : 0;
  for (const side of res.teams) for (const p of side.players) {
    for (const k of ['pts', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm', 'tov', 'orb', 'drb', 'ast', 'stl', 'blk']) tot[k] += p[k];
    const b = box[p.pid] = box[p.pid] || { g: 0, min: 0, pts: 0, trb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, fga: 0, fgm: 0 };
    if (p.min > 0) b.g++;
    b.min += p.min; b.pts += p.pts; b.trb += p.orb + p.drb; b.ast += p.ast; b.stl += p.stl; b.blk += p.blk; b.tpm += p.tpm; b.fga += p.fga; b.fgm += p.fgm;
  }
}
const dt = (Date.now() - t0) / 1000;
const per = k => (tot[k] / tot.games / 2).toFixed(1);
console.log(`경기 ${played}개, ${dt.toFixed(1)}초 (${(dt / played * 1000).toFixed(1)}ms/경기)`);
console.log(`팀 평균: 득점 ${per('pts')}  FGA ${per('fga')}  FG% ${(tot.fgm / tot.fga * 100).toFixed(1)}  3PA ${per('tpa')}  3P% ${(tot.tpm / tot.tpa * 100).toFixed(1)}  FTA ${per('fta')}  FT% ${(tot.ftm / tot.fta * 100).toFixed(1)}  TOV ${per('tov')}  ORB ${per('orb')}  DRB ${per('drb')}  AST ${per('ast')}  STL ${per('stl')}  BLK ${per('blk')}  연장 ${(tot.ot / tot.games * 100).toFixed(1)}%`);
function corr(x, y) { const n = x.length, mx = U.avg(x), my = U.avg(y); let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); }
const ws = list.map(t => t.w / (t.w + t.l));
console.log('점수차 표준편차', Math.sqrt(U.avg(margins.map(m => m * m))).toFixed(1), '포제션(추정)', ((tot.fga + 0.44 * tot.fta - tot.orb + tot.tov) / tot.games / 2).toFixed(1));
console.log('득실 표준편차(게임)', Math.sqrt(U.avg(list.map(t => ((t.pf - t.pa) / (t.w + t.l)) ** 2))).toFixed(2), '실제 SRS', Math.sqrt(U.avg(list.map(t => t.srs ** 2))).toFixed(2));
console.log('실제 승률과 상관', corr(ws, list.map(t => t.real)).toFixed(3), ' 승률 표준편차', Math.sqrt(U.avg(ws.map(w => (w - 0.5) ** 2))).toFixed(3), '실제', Math.sqrt(U.avg(list.map(t => (t.real - 0.5) ** 2))).toFixed(3));
for (const t of list.sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l)).slice(0, 30)) console.log(t.abbr.padEnd(4), `${t.w}-${t.l}`.padEnd(7), '실제', (t.real * 82).toFixed(0).padStart(2) + '승', ` 득실 ${((t.pf - t.pa) / (t.w + t.l)).toFixed(1)}`);
// 선수 기록
const pl = [];
for (const t of list) for (const p of t.players) { const b = box[p.pid]; if (b && b.g) pl.push({ p, b, t }); }
pl.sort((a, b) => b.b.pts / b.b.g - a.b.pts / a.b.g);
console.log('득점 상위 (게임 / 실제)');
for (const x of pl.slice(0, 12)) { const b = x.b, s = x.p.real; console.log(x.p.name.padEnd(24), x.t.abbr, 'OVR', x.p.ovr.toFixed(0), `${(b.min / b.g / 60).toFixed(1)}분 ${(b.pts / b.g).toFixed(1)}점 ${(b.trb / b.g).toFixed(1)}리 ${(b.ast / b.g).toFixed(1)}어`, '|', `${s[10] / 10}분 ${s[11] / 10}점 ${s[12] / 10}리 ${s[13] / 10}어`); }
pl.sort((a, b) => b.b.trb / b.b.g - a.b.trb / a.b.g);
console.log('리바운드 상위'); for (const x of pl.slice(0, 5)) console.log(x.p.name.padEnd(24), (x.b.trb / x.b.g).toFixed(1), '실제', x.p.real[12] / 10);
pl.sort((a, b) => b.b.ast / b.b.g - a.b.ast / a.b.g);
console.log('어시스트 상위'); for (const x of pl.slice(0, 5)) console.log(x.p.name.padEnd(24), (x.b.ast / x.b.g).toFixed(1), '실제', x.p.real[13] / 10);
// 출전 시간 분포 예시
const ex = list[0];
console.log('출전 시간 예시', ex.abbr, ex.players.map(p => `${HM.Sim.shortName(p.name)} ${box[p.pid] ? (box[p.pid].min / Math.max(1, box[p.pid].g) / 60).toFixed(0) : 0}`).join(', '));
if (process.env.WHO) for (const who of process.env.WHO.split(',')) {
  const x = pl.find(z => z.p.pid === who); if (!x) { console.log(who, '없음'); continue; }
  const b = x.b, s = x.p.real;
  console.log(x.p.name, x.t.abbr, 'OVR', x.p.ovr.toFixed(0), `${(b.min / b.g / 60).toFixed(1)}분 ${(b.pts / b.g).toFixed(1)}점 FG ${(b.fgm / b.fga * 100).toFixed(1)}% FGA ${(b.fga / b.g).toFixed(1)} ${(b.trb / b.g).toFixed(1)}리 ${(b.ast / b.g).toFixed(1)}어`, '| 실제', `${s[10] / 10}분 ${s[11] / 10}점 FG ${s[16] / 10}%`);
}
