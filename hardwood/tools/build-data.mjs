// 실제 NBA 기록(Basketball-Reference 기반 CSV)으로 게임 데이터(data/nba.js)를 만든다.
// 쓰는 법: node tools/build-data.mjs <CSV 폴더> [나올 파일]
//   CSV 폴더: https://github.com/sumitrodatta/bball-reference-datasets 의 Data 폴더
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(resolve(here, '../js/ratings.js'));
const R = globalThis.HM.Ratings;

const SRC = process.argv[2];
const OUT = process.argv[3] || resolve(here, '../data/nba.js');
if (!SRC) { console.error('CSV 폴더를 주세요'); process.exit(1); }

const FIRST = 1978, LAST = 2027; // 1977-78 ~ 2026-27 시즌

// ---------- CSV ----------
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const load = f => parseCSV(readFileSync(join(SRC, f), 'utf8'));
const num = (x, d = 0) => { const v = parseFloat(x); return Number.isFinite(v) ? v : d; };
const has = x => x !== undefined && x !== '' && x !== 'NA';
const clamp = R.clamp;
// 같은 선수에게 늘 같은 값을 주는 작은 해시 난수
function hrand(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

console.log('CSV 읽는 중…');
const totals = load('Player Totals.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 2);
const adv = load('Advanced.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 2);
const shoot = load('Player Shooting.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 2);
const sinfo = load('Player Season Info.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 2);
const career = load('Player Career Info.csv');
const drafts = load('Draft Pick History.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 1);
const tsum = load('Team Summaries.csv').filter(r => r.lg === 'NBA' && +r.season >= FIRST - 1 && r.abbreviation !== 'NA');
const awardsCsv = load('Player Award Shares.csv');
const eos = load('End of Season Teams.csv');
const allstar = load('All-Star Selections.csv');

// ---------- 시즌별 선수 행 합치기 (여러 팀 = 2TM/3TM 행 사용) ----------
function collapse(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.season + '|' + r.player_id;
    let e = m.get(k);
    if (!e) { e = { tot: null, teams: [] }; m.set(k, e); }
    if (/^\dTM$/.test(r.team) || r.team === 'TOT') e.tot = r; else e.teams.push(r);
  }
  const out = new Map();
  for (const [k, e] of m) out.set(k, { row: e.tot || e.teams[0], teams: e.teams });
  return out;
}
const T = collapse(totals), A = collapse(adv), S = collapse(shoot), SI = collapse(sinfo);
const key = (y, pid) => y + '|' + pid;

// ---------- 리그 환경 ----------
const env = {};
for (let y = FIRST - 2; y <= LAST; y++) {
  const ts = tsum.filter(r => +r.season === y);
  const avg = f => ts.length ? ts.reduce((s, r) => s + num(r[f]), 0) / ts.length : 0;
  let ft = 0, fta = 0, tp = 0, tpa = 0, p2 = 0, p2a = 0;
  for (const [k, v] of T) if (+k.split('|')[0] === y) {
    const r = v.row; ft += num(r.ft); fta += num(r.fta); tp += num(r.x3p); tpa += num(r.x3pa); p2 += num(r.x2p); p2a += num(r.x2pa);
  }
  env[y] = {
    pace: +avg('pace').toFixed(1), ortg: +avg('o_rtg').toFixed(1), tov: +(avg('tov_percent') / 100).toFixed(3),
    orb: +(avg('orb_percent') / 100).toFixed(3), ftr: +avg('f_tr').toFixed(3), tpar: +avg('x3p_ar').toFixed(3),
    ftp: fta ? +(ft / fta).toFixed(3) : .75, tpp: tpa > 100 ? +(tp / tpa).toFixed(3) : 0, p2: p2a ? +(p2 / p2a).toFixed(3) : .48,
  };
}

// ---------- 선수 신상 ----------
const bio = new Map();
for (const r of career) bio.set(r.player_id, r);
const draftOf = new Map();
for (const r of drafts) if (!draftOf.has(r.player_id)) draftOf.set(r.player_id, r);

// ---------- 시즌별 혼합 기록(올해 1, 작년 .45, 재작년 .15) ----------
const W = [1, .45, .15];
function blended(pid, y) {
  const parts = [];
  for (let d = 0; d < 3; d++) {
    const t = T.get(key(y - d, pid)), a = A.get(key(y - d, pid));
    if (t && a) parts.push({ w: W[d], t: t.row, a: a.row, s: S.get(key(y - d, pid))?.row, y: y - d });
  }
  if (!parts.length) return null;
  const sum = f => parts.reduce((s, p) => s + p.w * num(p.t[f]), 0);
  const c = {};
  for (const f of ['g', 'mp', 'fg', 'fga', 'x3p', 'x3pa', 'x2p', 'x2pa', 'ft', 'fta', 'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts']) c[f] = sum(f);
  let wm = 0; const rate = {};
  const rf = ['orb_percent', 'drb_percent', 'ast_percent', 'stl_percent', 'blk_percent', 'tov_percent', 'usg_percent', 'ws_48', 'obpm', 'dbpm', 'bpm', 'f_tr', 'x3p_ar'];
  for (const f of rf) rate[f] = 0;
  for (const p of parts) {
    const m = p.w * Math.max(1, num(p.a.mp));
    wm += m;
    for (const f of rf) rate[f] += m * num(p.a[f]);
  }
  for (const f of rf) rate[f] /= wm;
  // 슛 거리 분포(1997년부터)
  let sw = 0, rim2 = 0;
  for (const p of parts) if (p.s && has(p.s.percent_fga_from_x2p_range) && num(p.s.percent_fga_from_x2p_range) > 0.05) {
    const m = p.w * Math.max(1, num(p.a.mp)); sw += m;
    rim2 += m * clamp((num(p.s.percent_fga_from_x0_3_range) + 0.5 * num(p.s.percent_fga_from_x3_10_range)) / num(p.s.percent_fga_from_x2p_range), 0.05, 0.98);
  }
  return { c, rate, wm, rim2: sw > 0 ? rim2 / sw : null, parts };
}

// ---------- 백분위 기준표 ----------
function pctFn(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return x => {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; }
    let eq = lo; while (eq < s.length && s[eq] === x) eq++;
    return ((lo + eq) / 2) / s.length * 100;
  };
}
function derived(b, y, pid, posKey) {
  const c = b.c, r = b.rate, e = env[y];
  const per36 = v => c.mp > 0 ? v / c.mp * 36 : 0;
  const bi = bio.get(pid) || {};
  const twoReg = (c.x2p + e.p2 * 60) / (c.x2pa + 60);
  return {
    orbP: r.orb_percent, drbP: r.drb_percent, astP: r.ast_percent, stlP: r.stl_percent, blkP: r.blk_percent,
    tovP: r.tov_percent, usg: r.usg_percent, ws48: r.ws_48, dbpm: r.dbpm, bpm: r.bpm,
    pts36: per36(c.pts), fta36: per36(c.fta), fga2_36: per36(c.x2pa), tpa36: per36(c.x3pa), two: twoReg,
    astTov: c.ast / Math.max(1, c.tov), mpg: c.g > 0 ? c.mp / c.g : 0,
    hgt: num(bi.ht_in_in, posKey === 'C' ? 83 : posKey === 'PG' ? 74 : 79), wgt: num(bi.wt, 215), ftr: c.fga > 0 ? c.fta / c.fga : 0,
  };
}
const REFKEYS = ['orbP', 'drbP', 'astP', 'stlP', 'blkP', 'tovP', 'usg', 'ws48', 'dbpm', 'bpm', 'pts36', 'fta36', 'fga2_36', 'tpa36', 'two', 'astTov', 'mpg', 'hgt', 'wgt', 'ftr'];
const refs = {};

const seasonPlayers = {}; // y -> [pid]
for (const k of T.keys()) {
  const [y, pid] = k.split('|'); const yy = +y;
  if (yy < FIRST || yy > LAST) continue;
  (seasonPlayers[yy] = seasonPlayers[yy] || []).push(pid);
}
const posOf = (y, pid) => {
  const p = T.get(key(y, pid))?.row.pos || SI.get(key(y, pid))?.row.pos || bio.get(pid)?.pos || 'SF';
  const m = String(p).match(/PG|SG|SF|PF|C/); if (m) return m[0];
  return /C/.test(p) ? 'C' : /F/.test(p) ? 'SF' : 'SG';
};

for (let y = FIRST; y <= LAST; y++) {
  const ds = [];
  for (const pid of seasonPlayers[y]) {
    const b = blended(pid, y); if (!b || b.c.mp < 250) continue;
    ds.push(derived(b, y, pid, posOf(y, pid)));
  }
  refs[y] = {};
  for (const k of REFKEYS) refs[y][k] = pctFn(ds.map(d => d[k]));
}

// ---------- 능력치 만들기 ----------
const tx = v => 18 + 0.78 * v; // 백분위(0~100) → 능력치(18~96)
function makeSnapshot(pid, y) {
  const b = blended(pid, y); if (!b) return null;
  const pos = posOf(y, pid), e = env[y], c = b.c, r = b.rate;
  const d = derived(b, y, pid, pos), P = (k, x) => refs[y][k](x === undefined ? d[k] : x);
  const si = SI.get(key(y, pid))?.row; const exp = num(si?.experience, 1);
  const age = num(T.get(key(y, pid)).row.age, 25);
  const bi = bio.get(pid) || {};
  const careerLen = has(bi.from) ? num(bi.to) - num(bi.from) + 1 : 3;
  const posN = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 }[pos];

  const ftPct = (c.ft + e.ftp * 40) / (c.fta + 40);
  const ft = clamp((ftPct - 0.40) / 0.0055, 1, 99);
  let tp;
  if (e.tpp === 0 || c.x3pa < 8) tp = clamp(0.45 * ft - 5 + [6, 5, 2, -4, -10][posN], 1, 40);
  else {
    const prior = e.tpp - 0.06 + 0.06 * Math.min(1, d.tpa36 / 4);
    const tpPct = (c.x3p + prior * 60) / (c.x3pa + 60);
    tp = 52 + (tpPct - e.tpp) * 340 + 12 * (P('tpa36') - 50) / 50;
    if (d.tpa36 < 0.6) tp = Math.min(tp, 30 + 0.25 * ft);
    else tp = Math.max(tp, 0.35 * ft);
    tp = clamp(tp, 1, 99);
  }
  const hr = k => hrand(pid + k);
  const a = {
    ins: tx(0.45 * P('two') + 0.30 * P('fta36') + 0.25 * P('fga2_36')),
    mid: tx(0.45 * ft + 0.30 * P('pts36') + 0.25 * P('two') - 5),
    tp, ft,
    pss: tx(0.7 * P('astP') + 0.3 * P('astTov')),
    hdl: tx(clamp(0.5 * P('astP') + 0.25 * P('usg') + 0.25 * (100 - P('tovP')) + [10, 5, 0, -6, -12][posN], 0, 100)),
    orb: tx(P('orbP')), drb: tx(P('drbP')), stl: tx(P('stlP')), blk: tx(P('blkP')),
    pdef: tx(0.45 * P('stlP') + 0.35 * P('dbpm') + 0.2 * [70, 70, 60, 40, 25][posN]),
    idef: tx(0.45 * P('blkP') + 0.30 * P('dbpm') + 0.25 * P('drbP')),
    iq: tx(0.30 * P('ws48') + 0.25 * P('astTov') + 0.25 * Math.min(100, exp * 9) + 0.20 * P('bpm')),
    cmp: tx(clamp(0.35 * ft + 0.35 * Math.min(100, exp * 8 + 20) + 0.30 * P('usg'), 0, 100)),
    ldr: tx(clamp(0.45 * Math.min(100, (age - 19) * 6) + 0.35 * P('bpm') + 20 * hr('l'), 0, 100)),
    wrk: tx(clamp(25 + Math.min(55, careerLen * 3.5) + 25 * hr('w') + (bi.hof === 'TRUE' ? 10 : 0), 0, 100)),
    spd: tx(clamp(0.55 * (100 - P('hgt')) + 0.25 * P('stlP') + 0.2 * P('astP') - Math.max(0, age - 30) * 2, 0, 100)),
    ath: tx(clamp(0.30 * P('blkP') + 0.25 * P('orbP') + 0.25 * P('fta36') + 0.2 * clamp(100 - (age - 22) * 8, 0, 100), 0, 100)),
    str: tx(0.5 * P('wgt') + 0.25 * P('orbP') + 0.25 * P('ftr')),
    sta: tx(0.7 * P('mpg') + 0.3 * clamp(100 - (age - 24) * 5, 0, 100)),
  };
  // 성향
  const t = {
    usg: clamp(r.usg_percent / 100, 0.05, 0.42),
    r3: e.tpp === 0 ? 0 : clamp(c.fga > 0 ? c.x3pa / c.fga : 0, 0, 0.95),
    rim: b.rim2 !== null ? b.rim2 : clamp(0.30 + 0.004 * (P('orbP') - 50) + 0.003 * (P('ftr') - 50) + [-0.08, -0.06, 0, 0.08, 0.15][posN], 0.12, 0.85),
    ftr: clamp(d.ftr, 0, 0.9),
  };
  // 실제 공헌도(BPM)에 맞춘다. 표본이 적으면 신인 지명 순위 등에 따른 사전값 쪽으로 당긴다.
  const dr = draftOf.get(pid);
  let prior = -2.3;
  if (dr && exp <= 2) { const pk = num(dr.overall_pick, 60); prior = pk <= 3 ? -0.6 : pk <= 14 ? -1.3 : pk <= 30 ? -2.0 : -2.5; }
  const K = 350;
  const oT = (r.obpm * b.wm + K * (prior * 0.7)) / (b.wm + K);
  const dT = (r.dbpm * b.wm + K * (prior * 0.3)) / (b.wm + K);
  R.fitTo(a, t, oT, dT);

  const cur = T.get(key(y, pid)); const row = cur.row; const g = num(row.g);
  const teams = cur.teams.length ? cur.teams.map(x => x.team) : [row.team];
  const per = f => g ? Math.round(num(row[f]) / g * 10) : 0;
  return [
    y, teams.join('/'), pos, R.encode(a),
    Math.round(t.usg * 1000), Math.round(t.r3 * 1000), Math.round(t.rim * 1000), Math.round(t.ftr * 1000),
    g, num(row.gs), g ? Math.round(num(row.mp) / g * 10) : 0, per('pts'), per('trb'), per('ast'), per('stl'), per('blk'),
    Math.round(num(row.fg_percent) * 1000), Math.round(num(row.x3p_percent) * 1000), Math.round(num(row.ft_percent) * 1000),
    age, exp,
  ];
}

console.log('능력치 계산 중…');
const snaps = {}; let nSnap = 0;
for (let y = FIRST; y <= LAST; y++) {
  for (const pid of seasonPlayers[y]) {
    const s = makeSnapshot(pid, y); if (!s) continue;
    (snaps[pid] = snaps[pid] || []).push(s); nSnap++;
  }
}

// ---------- 팀 ----------
const FR = { // 약어 → 프랜차이즈
  ATL: 'ATL', BOS: 'BOS', BUF: 'LAC', SDC: 'LAC', LAC: 'LAC', CHI: 'CHI', CLE: 'CLE', DAL: 'DAL', DEN: 'DEN', DET: 'DET',
  GSW: 'GSW', HOU: 'HOU', IND: 'IND', KCK: 'SAC', SAC: 'SAC', LAL: 'LAL', MIL: 'MIL', NYN: 'BRK', NJN: 'BRK', BRK: 'BRK',
  NOJ: 'UTA', UTA: 'UTA', NYK: 'NYK', PHI: 'PHI', PHO: 'PHO', POR: 'POR', SAS: 'SAS', SEA: 'OKC', OKC: 'OKC', WSB: 'WAS', WAS: 'WAS',
  CHH: 'NOP', NOH: 'NOP', NOK: 'NOP', NOP: 'NOP', MIA: 'MIA', CHA: 'CHO', CHO: 'CHO', MIN: 'MIN', ORL: 'ORL', TOR: 'TOR', VAN: 'MEM', MEM: 'MEM',
};
const COLORS = {
  ATL: ['#C8102E', '#FDB927'], BOS: ['#007A33', '#BA9653'], BRK: ['#111111', '#FFFFFF'], NJN: ['#002A60', '#CD1041'], NYN: ['#002A60', '#CD1041'],
  BUF: ['#0E3386', '#F47A38'], SDC: ['#F28C28', '#0A2240'], LAC: ['#C8102E', '#1D428A'], CHA: ['#F26532', '#29588B'], CHH: ['#00778B', '#280071'],
  CHO: ['#1D1160', '#00788C'], CHI: ['#CE1141', '#111111'], CLE: ['#860038', '#FDBB30'], DAL: ['#00538C', '#B8C4CA'], DEN: ['#0E2240', '#FEC524'],
  DET: ['#C8102E', '#1D42BA'], GSW: ['#1D428A', '#FFC72C'], HOU: ['#CE1141', '#C4CED4'], IND: ['#002D62', '#FDBB30'], KCK: ['#0067B1', '#E31837'],
  SAC: ['#5A2D81', '#63727A'], LAL: ['#552583', '#FDB927'], MEM: ['#5D76A9', '#12173F'], VAN: ['#00B2A9', '#E43C40'], MIA: ['#98002E', '#F9A01B'],
  MIL: ['#00471B', '#EEE1C6'], MIN: ['#0C2340', '#78BE20'], NOJ: ['#4B2884', '#F9A01B'], UTA: ['#002B5C', '#F9A01B'], NOH: ['#00778B', '#280071'],
  NOK: ['#00778B', '#280071'], NOP: ['#0C2340', '#C8102E'], NYK: ['#006BB6', '#F58426'], OKC: ['#007AC1', '#EF3B24'], SEA: ['#00653A', '#FFC200'],
  ORL: ['#0077C0', '#C4CED4'], PHI: ['#006BB6', '#ED174C'], PHO: ['#1D1160', '#E56020'], POR: ['#E03A3E', '#111111'], SAS: ['#8A8D8F', '#111111'],
  TOR: ['#CE1141', '#111111'], WSB: ['#002B5C', '#E31837'], WAS: ['#002B5C', '#E31837'],
};
const KO = {
  'Atlanta Hawks': '애틀랜타 호크스', 'Boston Celtics': '보스턴 셀틱스', 'Brooklyn Nets': '브루클린 네츠', 'New Jersey Nets': '뉴저지 네츠',
  'New York Nets': '뉴욕 네츠', 'Buffalo Braves': '버펄로 브레이브스', 'San Diego Clippers': '샌디에이고 클리퍼스', 'Los Angeles Clippers': 'LA 클리퍼스',
  'Charlotte Bobcats': '샬럿 밥캐츠', 'Charlotte Hornets': '샬럿 호네츠', 'Chicago Bulls': '시카고 불스', 'Cleveland Cavaliers': '클리블랜드 캐벌리어스',
  'Dallas Mavericks': '댈러스 매버릭스', 'Denver Nuggets': '덴버 너기츠', 'Detroit Pistons': '디트로이트 피스톤스', 'Golden State Warriors': '골든스테이트 워리어스',
  'Houston Rockets': '휴스턴 로키츠', 'Indiana Pacers': '인디애나 페이서스', 'Kansas City Kings': '캔자스시티 킹스', 'Sacramento Kings': '새크라멘토 킹스',
  'Los Angeles Lakers': 'LA 레이커스', 'Memphis Grizzlies': '멤피스 그리즐리스', 'Vancouver Grizzlies': '밴쿠버 그리즐리스', 'Miami Heat': '마이애미 히트',
  'Milwaukee Bucks': '밀워키 벅스', 'Minnesota Timberwolves': '미네소타 팀버울브스', 'New Orleans Jazz': '뉴올리언스 재즈', 'Utah Jazz': '유타 재즈',
  'New Orleans Hornets': '뉴올리언스 호네츠', 'New Orleans/Oklahoma City Hornets': '뉴올리언스/OKC 호네츠', 'New Orleans Pelicans': '뉴올리언스 펠리컨스',
  'New York Knicks': '뉴욕 닉스', 'Oklahoma City Thunder': '오클라호마시티 썬더', 'Seattle SuperSonics': '시애틀 슈퍼소닉스', 'Orlando Magic': '올랜도 매직',
  'Philadelphia 76ers': '필라델피아 세븐티식서스', 'Phoenix Suns': '피닉스 선즈', 'Portland Trail Blazers': '포틀랜드 트레일블레이저스',
  'San Antonio Spurs': '샌안토니오 스퍼스', 'Toronto Raptors': '토론토 랩터스', 'Washington Bullets': '워싱턴 불리츠', 'Washington Wizards': '워싱턴 위저즈',
};

// 시즌별 지구 편성
function align(y) {
  const E = 'E', Wc = 'W';
  const m = {};
  const put = (conf, div, list) => { for (const t of list) m[t] = [conf, div]; };
  if (y >= 2005) {
    put(E, 'ATL', ['BOS', 'NJN', 'BRK', 'NYK', 'PHI', 'TOR']); put(E, 'CEN', ['CHI', 'CLE', 'DET', 'IND', 'MIL']);
    put(E, 'SE', ['ATL', 'CHA', 'CHO', 'MIA', 'ORL', 'WAS']); put(Wc, 'NW', ['DEN', 'MIN', 'POR', 'SEA', 'OKC', 'UTA']);
    put(Wc, 'PAC', ['GSW', 'LAC', 'LAL', 'PHO', 'SAC']); put(Wc, 'SW', ['DAL', 'HOU', 'MEM', 'NOH', 'NOK', 'NOP', 'SAS']);
  } else if (y >= 1992) {
    put(E, 'ATL', ['BOS', 'MIA', 'NJN', 'NYK', 'ORL', 'PHI', 'WSB', 'WAS']);
    put(E, 'CEN', ['ATL', 'CHH', 'NOH', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'TOR']);
    put(Wc, 'MID', ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'VAN', 'MEM']);
    put(Wc, 'PAC', ['GSW', 'LAC', 'LAL', 'PHO', 'POR', 'SAC', 'SEA']);
  } else if (y === 1991) {
    put(E, 'ATL', ['BOS', 'MIA', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CHH', 'CHI', 'CLE', 'DET', 'IND', 'MIL']);
    put(Wc, 'MID', ['DAL', 'DEN', 'HOU', 'MIN', 'ORL', 'SAS', 'UTA']); put(Wc, 'PAC', ['GSW', 'LAC', 'LAL', 'PHO', 'POR', 'SAC', 'SEA']);
  } else if (y === 1990) {
    put(E, 'ATL', ['BOS', 'MIA', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'ORL']);
    put(Wc, 'MID', ['CHH', 'DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA']); put(Wc, 'PAC', ['GSW', 'LAC', 'LAL', 'PHO', 'POR', 'SAC', 'SEA']);
  } else if (y === 1989) {
    put(E, 'ATL', ['BOS', 'CHH', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL']);
    put(Wc, 'MID', ['DAL', 'DEN', 'HOU', 'MIA', 'SAS', 'UTA']); put(Wc, 'PAC', ['GSW', 'LAC', 'LAL', 'PHO', 'POR', 'SAC', 'SEA']);
  } else if (y >= 1981) {
    put(E, 'ATL', ['BOS', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL']);
    put(Wc, 'MID', ['DAL', 'DEN', 'HOU', 'KCK', 'SAC', 'SAS', 'UTA']); put(Wc, 'PAC', ['GSW', 'LAL', 'PHO', 'POR', 'SDC', 'LAC', 'SEA']);
  } else if (y === 1980) {
    put(E, 'ATL', ['BOS', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CLE', 'DET', 'HOU', 'IND', 'SAS']);
    put(Wc, 'MID', ['CHI', 'DEN', 'KCK', 'MIL', 'UTA']); put(Wc, 'PAC', ['GSW', 'LAL', 'PHO', 'POR', 'SDC', 'SEA']);
  } else if (y === 1979) {
    put(E, 'ATL', ['BOS', 'NJN', 'NYK', 'PHI', 'WSB']); put(E, 'CEN', ['ATL', 'CLE', 'DET', 'HOU', 'NOJ', 'SAS']);
    put(Wc, 'MID', ['CHI', 'DEN', 'IND', 'KCK', 'MIL']); put(Wc, 'PAC', ['GSW', 'LAL', 'PHO', 'POR', 'SDC', 'SEA']);
  } else {
    put(E, 'ATL', ['BOS', 'BUF', 'NJN', 'NYK', 'PHI']); put(E, 'CEN', ['ATL', 'CLE', 'HOU', 'NOJ', 'SAS', 'WSB']);
    put(Wc, 'MID', ['CHI', 'DEN', 'DET', 'IND', 'KCK', 'MIL']); put(Wc, 'PAC', ['GSW', 'LAL', 'PHO', 'POR', 'SEA']);
  }
  return m;
}

const seasons = {};
for (let y = FIRST - 1; y <= LAST; y++) {
  const al = align(y);
  const teams = tsum.filter(r => +r.season === y).map(r => {
    const ab = r.abbreviation; const cd = al[ab];
    if (y >= FIRST && !cd) console.warn('지구 편성 없음', y, ab);
    return [ab, r.team.replace(/\*$/, ''), FR[ab] || ab, cd ? cd[0] : 'E', cd ? cd[1] : 'ATL', num(r.w), num(r.l), +num(r.srs).toFixed(2)];
  });
  seasons[y] = { env: env[y], teams };
}

// ---------- 선수 신상 / 드래프트 / 수상 ----------
const players = {};
function addBio(pid, nameFallback, collegeFallback) {
  if (players[pid]) return;
  const b = bio.get(pid);
  const dr = draftOf.get(pid);
  const draft = dr ? [num(dr.season), num(dr.round), num(dr.overall_pick), dr.tm] : null;
  if (b) {
    players[pid] = [b.player, has(b.birth_date) ? b.birth_date : '', has(b.ht_in_in) ? Math.round(num(b.ht_in_in) * 2.54) : 0,
      has(b.wt) ? Math.round(num(b.wt) * 0.4536) : 0, has(b.colleges) ? b.colleges.split(',')[0] : '', b.hof === 'TRUE' ? 1 : 0,
      num(b.from), num(b.to), draft];
  } else {
    players[pid] = [nameFallback, '', 0, 0, has(collegeFallback) ? collegeFallback : '', 0, 0, 0, draft];
  }
}
for (const pid of Object.keys(snaps)) addBio(pid);

const draftOut = {};
for (const r of drafts) {
  const y = +r.season; if (y < FIRST) continue;
  const rd = num(r.round);
  if (rd > 2 && !snaps[r.player_id]) continue;
  addBio(r.player_id, r.player, r.college);
  (draftOut[y] = draftOut[y] || []).push([num(r.overall_pick), rd, r.tm, r.player_id]);
}

const AW = {};
const addAw = (pid, y, code) => { if (!players[pid] && !snaps[pid]) return; (AW[pid] = AW[pid] || []).push(y + ':' + code); };
const AWMAP = { 'nba mvp': 'MVP', 'nba dpoy': 'DPOY', 'nba roy': 'ROY', 'nba smoy': '6MOY', 'nba mip': 'MIP' };
for (const r of awardsCsv) if (r.winner === 'TRUE' && AWMAP[r.award]) addAw(r.player_id, +r.season, AWMAP[r.award]);
for (const r of eos) {
  const n = { '1st': 1, '2nd': 2, '3rd': 3 }[r.number_tm];
  if (r.type === 'All-NBA' && n) addAw(r.player_id, +r.season, 'ANBA' + n);
  if (r.type === 'All-Defense' && n) addAw(r.player_id, +r.season, 'ADEF' + n);
}
for (const r of allstar) if (r.lg === 'NBA') addAw(r.player_id, +r.season, 'AS');

const CHAMPS = {
  1970: 'NYK', 1971: 'MIL', 1972: 'LAL', 1973: 'NYK', 1974: 'BOS', 1975: 'GSW', 1976: 'BOS', 1977: 'POR',
  1978: 'WSB', 1979: 'SEA', 1980: 'LAL', 1981: 'BOS', 1982: 'LAL', 1983: 'PHI', 1984: 'BOS', 1985: 'LAL', 1986: 'BOS', 1987: 'LAL',
  1988: 'LAL', 1989: 'DET', 1990: 'DET', 1991: 'CHI', 1992: 'CHI', 1993: 'CHI', 1994: 'HOU', 1995: 'HOU', 1996: 'CHI', 1997: 'CHI',
  1998: 'CHI', 1999: 'SAS', 2000: 'LAL', 2001: 'LAL', 2002: 'LAL', 2003: 'SAS', 2004: 'DET', 2005: 'SAS', 2006: 'MIA', 2007: 'SAS',
  2008: 'BOS', 2009: 'LAL', 2010: 'LAL', 2011: 'DAL', 2012: 'MIA', 2013: 'MIA', 2014: 'SAS', 2015: 'GSW', 2016: 'CLE', 2017: 'GSW',
  2018: 'GSW', 2019: 'TOR', 2020: 'LAL', 2021: 'MIL', 2022: 'GSW', 2023: 'DEN', 2024: 'BOS', 2025: 'OKC',
};
for (const [pid, list] of Object.entries(snaps)) for (const s of list) {
  const teams = s[1].split('/'); if (CHAMPS[s[0]] && teams[teams.length - 1] === CHAMPS[s[0]]) addAw(pid, s[0], 'CH');
}
const awards = {}; for (const [k, v] of Object.entries(AW)) awards[k] = v.join(',');

const data = {
  v: 1, first: FIRST, last: LAST, built: new Date().toISOString().slice(0, 10),
  seasons, colors: COLORS, ko: KO, champs: CHAMPS, players, snaps, drafts: draftOut, awards,
};
const json = JSON.stringify(data);
writeFileSync(OUT, '// 자동 생성 파일: tools/build-data.mjs\n// 원자료: Basketball-Reference (sumitrodatta/bball-reference-datasets)\nglobalThis.HM_DATA=' + json + ';\n');
console.log(`완료: 스냅샷 ${nSnap}개, 선수 ${Object.keys(players).length}명, ${(json.length / 1e6).toFixed(2)}MB → ${OUT}`);

// 점검용 요약
const show = (pid, y) => { const s = (snaps[pid] || []).find(x => x[0] === y); if (!s) return console.log(pid, y, '없음');
  const a = R.decode(s[3]); const t = { usg: s[4] / 1000, r3: s[5] / 1000, rim: s[6] / 1000, ftr: s[7] / 1000 };
  console.log(players[pid][0], y, s[1], s[2], 'OVR', R.ovr(a, t).toFixed(1), Object.entries(a).map(([k, v]) => k + R.disp(v)).join(' ')); };
for (const [p, y] of [['jordami01', 1988], ['jamesle01', 2013], ['curryst01', 2016], ['onealsh01', 2000], ['jokicni01', 2026], ['wembavi01', 2027], ['flaggco01', 2027], ['birdla01', 1986], ['duncati01', 2003], ['boguemu01', 1990]]) show(p, y);
