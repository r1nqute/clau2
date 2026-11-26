// AI 단장: 선수 가치, 트레이드, 자유계약, 재계약, 드래프트, 로스터 관리
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin;

  const OFF = ['draft', 'resign', 'fa'];
  // 계약·연봉 계산의 기준 시즌(오프시즌이면 다음 시즌)
  const capYear = G => OFF.includes(G.phase) ? G.season + 1 : G.season;
  const payroll = (G, tid) => F.payroll(G, tid, capYear(G));

  // ---------- 가치 ----------
  function value(G, p, tid, opt = {}) {
    const y = G.season;
    const age = P.age(p, y);
    const strat = tid >= 0 ? G.teams[tid].strategy : 'mid';
    let v = p.ovr;
    const pot = Math.max(p.ovr, p.pa);
    if (age <= 24) v += (pot - p.ovr) * (strat === 'rebuild' ? 0.6 : strat === 'contend' ? 0.3 : 0.45);
    else if (age <= 26) v += (pot - p.ovr) * 0.2;
    if (age >= 30) v -= (age - 29) * (strat === 'rebuild' ? 2.0 : strat === 'contend' ? 0.6 : 1.1);
    if (strat === 'contend' && age >= 25 && age <= 32) v += 1;
    let base = Math.pow(Math.max(0, v - 62) / 10, 2.6);
    if (!opt.noContract && p.contract) {
      const cy = capYear(G);
      const yrs = Math.max(1, p.contract.exp - cy + 1);
      const mv = F.marketValue(p, cy, age);
      const surplus = (mv - p.contract.amt) / F.cap(cy) * Math.min(yrs, 4);
      base += surplus * (strat === 'rebuild' ? 8 : 5);
    }
    if (p.injury && p.injury.days > 60) base *= 0.6;
    return Math.max(0.03, base);
  }

  // 지명권 가치: 예상 순위로
  function projectedPick(G, pk) {
    if (pk.slot) return pk.slot + (pk.round - 1) * 30;
    const n = G.teams.length;
    const ranks = G.teams.map(t => ({ tid: t.tid, s: L.strength(G, t.tid) + (pk.season === G.season ? recPct(G, t.tid) * 15 : 0) })).sort((a, b) => a.s - b.s);
    const r = ranks.findIndex(x => x.tid === pk.orig) + 1;
    return r + (pk.round - 1) * n;
  }
  function recPct(G, tid) { const r = L.rec(G, tid); return r.w + r.l ? r.w / (r.w + r.l) - 0.5 : 0; }
  function pickValue(G, pk, tid) {
    const pos = projectedPick(G, pk);
    let v = pos <= 1 ? 9 : pos <= 3 ? 7.5 - (pos - 2) * 0.8 : pos <= 30 ? Math.max(0.9, 6.2 * Math.pow(0.9, pos - 3)) : Math.max(0.15, 0.7 * Math.pow(0.93, pos - 30));
    const ahead = pk.season - G.season;
    v *= Math.pow(0.88, Math.max(0, ahead));
    if (ahead > 0) v = v * 0.7 + 2.0 * 0.3 * (pk.round === 1 ? 1 : 0.15); // 먼 미래는 평균으로
    const strat = tid >= 0 ? G.teams[tid].strategy : 'mid';
    return v * (strat === 'rebuild' ? 1.35 : strat === 'contend' ? 0.75 : 1);
  }

  // ---------- 트레이드 ----------
  // offer: { a: tidA, b: tidB, ap: [pid], bp: [pid], ak: [pickId], bk: [pickId] }  (a가 보내는 것 ap/ak, b가 보내는 것 bp/bk)
  function tradeCheck(G, o) {
    const sal = ids => ids.reduce((s, id) => s + (G.players[id].contract?.amt || 0), 0);
    const outA = sal(o.ap), outB = sal(o.bp);
    const rosterA = L.roster(G, o.a).length - o.ap.length + o.bp.length;
    const rosterB = L.roster(G, o.b).length - o.bp.length + o.ap.length;
    const errs = [];
    if (rosterA > 15) errs.push(`${G.teams[o.a].ko} 로스터가 15명을 넘습니다`);
    if (rosterB > 15) errs.push(`${G.teams[o.b].ko} 로스터가 15명을 넘습니다`);
    if (rosterA < 12 && G.phase !== 'fa' && G.phase !== 'draft' && G.phase !== 'resign') errs.push(`${G.teams[o.a].ko} 로스터가 12명보다 적어집니다`);
    if (rosterB < 12 && G.phase !== 'fa' && G.phase !== 'draft' && G.phase !== 'resign') errs.push(`${G.teams[o.b].ko} 로스터가 12명보다 적어집니다`);
    const cy = capYear(G);
    const okA = F.payroll(G, o.a, cy) - outA + outB <= F.cap(cy) || outB <= outA * 1.25 + F.cap(cy) * 0.001;
    const okB = F.payroll(G, o.b, cy) - outB + outA <= F.cap(cy) || outA <= outB * 1.25 + F.cap(cy) * 0.001;
    if (!okA) errs.push(`${G.teams[o.a].ko}: 샐러리캡 초과 팀은 보내는 연봉의 125%까지만 받을 수 있습니다`);
    if (!okB) errs.push(`${G.teams[o.b].ko}: 샐러리캡 초과 팀은 보내는 연봉의 125%까지만 받을 수 있습니다`);
    if (!o.ap.length && !o.bp.length && !o.ak.length && !o.bk.length) errs.push('트레이드할 자산이 없습니다');
    return errs;
  }
  // tid 입장에서 받는 가치 - 주는 가치
  function tradeDelta(G, o, tid) {
    const gets = tid === o.a ? { p: o.bp, k: o.bk } : { p: o.ap, k: o.ak };
    const gives = tid === o.a ? { p: o.ap, k: o.ak } : { p: o.bp, k: o.bk };
    const pv = ids => ids.reduce((s, id) => s + value(G, G.players[id], tid), 0);
    const kv = ids => ids.reduce((s, id) => s + pickValue(G, G.picks.find(x => x.id === id), tid), 0);
    // 받는 선수가 많으면 로스터 자리 값어치를 깎는다(2대1 남용 방지)
    const extra = Math.max(0, gets.p.length - gives.p.length);
    const getsV = pv(gets.p) + kv(gets.k);
    const recvPlayers = gets.p.map(id => value(G, G.players[id], tid)).sort((a, b) => b - a);
    const filler = recvPlayers.slice(1).reduce((s, x) => s + x * 0.25, 0) * (extra > 0 ? 1 : 0);
    return { gets: getsV - filler, gives: pv(gives.p) + kv(gives.k) };
  }
  function aiAccepts(G, o, aiTid) {
    const errs = tradeCheck(G, o);
    if (errs.length) return { ok: false, why: errs[0] };
    const d = tradeDelta(G, o, aiTid);
    const need = d.gives * 1.06 + 0.15;
    if (d.gets >= need) return { ok: true, d };
    const gap = need - d.gets;
    const why = gap > d.gives * 0.5 ? '터무니없는 제안이라며 웃어넘깁니다.' : gap > 1 ? '받는 쪽이 한참 모자랍니다.' : '조금만 더 얹어 주면 생각해 보겠답니다.';
    return { ok: false, why, d };
  }
  function execTrade(G, o) {
    for (const id of o.ap) { G.players[id].tid = o.b; G.players[id].morale = 55; }
    for (const id of o.bp) { G.players[id].tid = o.a; G.players[id].morale = 55; }
    for (const id of o.ak) G.picks.find(x => x.id === id).tid = o.b;
    for (const id of o.bk) G.picks.find(x => x.id === id).tid = o.a;
    // 떠난 선수만 선발·출전 시간에서 빼고, 나머지 설정은 그대로 둔다
    for (const [t, gone] of [[o.a, o.ap], [o.b, o.bp]]) {
      const r = G.teams[t].rotation; if (!r || !r.starters) continue;
      r.starters = r.starters.map(id => gone.includes(id) ? null : id);
      if (r.minutes) for (const id of gone) delete r.minutes[id];
    }
    if (!G.tradeLog) G.tradeLog = [];
    G.tradeLog.push({ date: G.date, season: G.season, o: U.deepCopy(o) });
  }
  // AI가 균형을 맞추려 요구하는 것(사용자 → AI)
  // protect: 사용자 쪽에서 내주지 않을 선수
  function balance(G, o, aiTid, protect = []) {
    const userTid = aiTid === o.a ? o.b : o.a;
    const userGives = userTid === o.a ? 'ap' : 'bp', userGivesK = userTid === o.a ? 'ak' : 'bk';
    const aiGives = userTid === o.a ? 'bp' : 'ap';
    const n = U.deepCopy(o);
    const cy = capYear(G);
    const sal = ids => ids.reduce((s, id) => s + (G.players[id].contract?.amt || 0), 0);
    const slack = F.cap(cy) * 0.001;
    for (let i = 0; i < 10; i++) {
      const r = aiAccepts(G, n, aiTid);
      if (r.ok) return n;
      const errs = tradeCheck(G, n);
      const userOut = sal(n[userGives]), userIn = sal(n[aiGives]);
      const salErr = name => errs.some(e => e.startsWith(G.teams[name].ko + ':') && e.includes('125%'));
      // 1) 우리가 캡을 넘어 받는 연봉이 너무 많다: 연봉을 맞출 선수를 더 보낸다
      if (salErr(userTid)) {
        const need = (userIn - slack) / 1.25 - userOut;
        const pool = L.roster(G, userTid).filter(p => !n[userGives].includes(p.pid) && p.contract && !protect.includes(p.pid));
        const fit = pool.filter(p => p.contract.amt >= need).sort((a, b) => value(G, a, userTid) - value(G, b, userTid))[0];
        const pick = fit || pool.sort((a, b) => b.contract.amt / (value(G, b, userTid) + 0.5) - a.contract.amt / (value(G, a, userTid) + 0.5))[0];
        if (!pick) return null;
        n[userGives].push(pick.pid);
        continue;
      }
      // 2) 상대가 캡을 넘어 받는 연봉이 너무 많다: 상대가 연봉을 더 돌려보낸다
      if (salErr(aiTid)) {
        const need = (userOut - slack) / 1.25 - userIn;
        const pool = L.roster(G, aiTid).filter(p => !n[aiGives].includes(p.pid) && p.contract);
        const fit = pool.filter(p => p.contract.amt >= need).sort((a, b) => value(G, a, aiTid) - value(G, b, aiTid))[0];
        const pick = fit || pool.sort((a, b) => b.contract.amt - a.contract.amt)[0];
        if (!pick) return null;
        n[aiGives].push(pick.pid);
        continue;
      }
      // 3) 로스터가 넘치면 AI 쪽 보낼 선수(가치 낮은 순)를 더한다
      if (errs.some(e => e.includes('15명'))) {
        const over = errs.find(e => e.includes('15명'));
        const side = over.startsWith(G.teams[aiTid].ko) ? aiTid : userTid;
        const key = side === aiTid ? aiGives : userGives;
        const low = L.roster(G, side).filter(p => !n[key].includes(p.pid) && !(side === userTid && protect.includes(p.pid))).sort((a, b) => value(G, a, side) - value(G, b, side))[0];
        if (!low) return null;
        n[key].push(low.pid);
        continue;
      }
      // 4) 가치가 모자라면 우리 자산 중 모자란 만큼에 가장 가까운 것을 더한다
      const d = tradeDelta(G, n, aiTid);
      const gap = d.gives * 1.06 + 0.15 - d.gets;
      const assets = [];
      for (const p of L.roster(G, userTid)) if (!n[userGives].includes(p.pid) && !protect.includes(p.pid)) assets.push({ kind: 'p', id: p.pid, v: value(G, p, aiTid) });
      for (const pk of G.picks) if (pk.tid === userTid && pk.season >= G.season && !n[userGivesK].includes(pk.id)) assets.push({ kind: 'k', id: pk.id, v: pickValue(G, pk, aiTid) });
      const cand = assets.filter(x => x.v >= gap * 0.6).sort((a, b) => a.v - b.v)[0] || assets.sort((a, b) => b.v - a.v)[0];
      if (!cand) return null;
      if (cand.kind === 'p') n[userGives].push(cand.id); else n[userGivesK].push(cand.id);
    }
    return aiAccepts(G, n, aiTid).ok ? n : null;
  }

  // AI끼리 트레이드(가끔)
  function aiTrade(G) {
    const ai = G.teams.filter(t => t.tid !== G.userTid);
    const A = U.pick(ai);
    const others = ai.filter(t => t.tid !== A.tid && t.strategy !== A.strategy);
    if (!others.length) return null;
    const B = U.pick(others);
    // 리빌딩 팀은 베테랑을 내주고, 우승 도전 팀은 유망주·지명권을 내준다
    const [con, reb] = A.strategy === 'contend' || B.strategy === 'rebuild' ? [A, B] : [B, A];
    const vets = L.roster(G, reb.tid).filter(p => P.age(p, G.season) >= 27 && p.ovr >= 76).sort((a, b) => b.ovr - a.ovr);
    if (!vets.length) return null;
    const target = U.pick(vets.slice(0, 3));
    const pieces = L.roster(G, con.tid).filter(p => p.pid !== target.pid).sort((a, b) => value(G, b, reb.tid) - value(G, a, reb.tid));
    const picks = G.picks.filter(k => k.tid === con.tid && k.season > G.season && k.round === 1);
    for (let tries = 0; tries < 12; tries++) {
      const o = { a: con.tid, b: reb.tid, ap: [], bp: [target.pid], ak: [], bk: [] };
      const sal = target.contract?.amt || 0;
      let got = 0;
      const pool = U.shuffle(pieces.slice(0, 9));
      for (const p of pool) { if (got >= sal * 0.8 && o.ap.length) break; o.ap.push(p.pid); got += p.contract?.amt || 0; if (o.ap.length >= 3) break; }
      if (Math.random() < 0.6 && picks.length) o.ak.push(U.pick(picks).id);
      if (aiAccepts(G, o, reb.tid).ok && aiAccepts(G, o, con.tid).ok) { execTrade(G, o); return o; }
    }
    return null;
  }

  // AI가 사용자에게 트레이드를 제안
  function aiOfferToUser(G) {
    const user = G.userTid;
    const mine = L.roster(G, user).filter(p => p.ovr >= 72 && !(p.injury && p.injury.days > 30));
    if (!mine.length) return null;
    const target = U.pick(mine);
    const ai = U.shuffle(G.teams.filter(t => t.tid !== user));
    for (const T of ai.slice(0, 6)) {
      const vTarget = value(G, target, T.tid);
      const pool = L.roster(G, T.tid).sort((a, b) => value(G, b, T.tid) - value(G, a, T.tid));
      const picks = G.picks.filter(k => k.tid === T.tid && k.season > G.season);
      const o = { a: T.tid, b: user, ap: [], bp: [target.pid], ak: [], bk: [] };
      let sum = 0;
      for (const p of pool) {
        const v = value(G, p, T.tid);
        if (v > vTarget * 0.9) continue;
        if (sum + v > vTarget * 1.0) continue;
        o.ap.push(p.pid); sum += v;
        if (sum > vTarget * 0.7 || o.ap.length >= 3) break;
      }
      if (sum < vTarget * 0.7 && picks.length) o.ak.push(picks[0].id);
      if (!o.ap.length) continue;
      if (!tradeCheck(G, o).length && aiAccepts(G, o, T.tid).ok) return o;
    }
    return null;
  }

  // ---------- 자유계약 ----------
  function asking(G, p) {
    const cy = capYear(G);
    const age = P.age(p, cy);
    let amt = F.marketValue(p, cy, age);
    // 기분: 좋으면 덜, 나쁘면 더
    amt *= 1 + (60 - (p.morale ?? 60)) / 400;
    if (p.faDays) amt *= Math.max(0.55, 1 - p.faDays * 0.012); // 오래 못 구하면 낮춘다
    amt = Math.max(F.minSal(cy), Math.round(amt / 10) * 10);
    const yrs = age <= 25 ? 4 : age <= 29 ? 3 : age <= 32 ? 2 : 1;
    return { amt, yrs };
  }
  // 팀 매력(선수 입장)
  function teamAppeal(G, tid, p) {
    const t = G.teams[tid];
    const rec = t.seasons[G.season] || {};
    const wp = rec.w + rec.l ? rec.w / (rec.w + rec.l) : t.hype;
    // 이 팀에서의 역할(로스터 내 순위)
    const better = L.roster(G, tid).filter(x => x.ovr > p.ovr).length;
    const role = better < 3 ? 0.08 : better < 5 ? 0.05 : better < 8 ? 0 : -0.08;
    return (wp - 0.5) * 0.3 + (t.hype - 0.5) * 0.1 + (t.pop - 0.5) * 0.08 + role;
  }
  // 제안 판단: 점수 1 이상이면 수락
  function offerScore(G, p, tid, amt, yrs) {
    const ask = asking(G, p);
    let s = amt / ask.amt;
    s += teamAppeal(G, tid, p);
    if (tid === p.tid || tid === p.lastTid) s += (p.morale ?? 60) >= 60 ? 0.06 : (p.morale ?? 60) < 40 ? -0.12 : 0;
    s -= Math.abs(yrs - ask.yrs) * 0.025;
    return s;
  }
  function capRoom(G, tid) { const cy = capYear(G); return F.cap(cy) - payroll(G, tid); }
  // 팀이 이 금액으로 계약할 수 있나(캡 여유, 미드레벨, 최저연봉, 자기 선수 재계약)
  function canSign(G, tid, amt, own) {
    const cy = capYear(G);
    if (own) return true; // 버드 권리
    if (amt <= F.minSal(cy) * 1.0001) return true;
    const room = capRoom(G, tid);
    if (room >= amt) return true;
    const t = G.teams[tid];
    if (!t.mleUsed && amt <= F.mle(cy) && payroll(G, tid) + amt <= F.taxLine(cy) * 1.05) return 'mle';
    return false;
  }
  // 관심 FA 알림을 받은 선수는 며칠 동안 AI가 데려가지 않는다(사용자 우선 협상)
  const reserved = (G, p) => !!(p.reserveUntil && G.date <= p.reserveUntil);
  function sign(G, p, tid, amt, yrs) {
    const cy = capYear(G);
    const how = canSign(G, tid, amt, p.lastTid === tid || p.tid === tid);
    if (how === 'mle') G.teams[tid].mleUsed = true;
    p.tid = tid; p.contract = { amt, exp: cy + yrs - 1 }; p.faDays = 0; p.morale = Math.max(p.morale ?? 60, 62);
    p.signedDate = G.date;
  }

  // AI 팀들이 자유계약 선수와 계약(하루치). 좋은 선수부터 자기에게 맞는 팀을 고른다.
  function faDay(G, intensity = 1, includeUser = false) {
    const cy = capYear(G);
    const signed = [];
    const perTeam = {};
    const fas = L.fas(G).sort((a, b) => b.ovr - a.ovr).slice(0, 70);
    const depthOf = {};
    for (const t of G.teams) depthOf[t.tid] = L.roster(G, t.tid).sort((a, b) => b.ovr - a.ovr);
    for (const p of fas) {
      if (reserved(G, p)) continue; // 사용자 우선 협상 기간
      if (p.tid !== -1) continue;
      if (Math.random() > 0.45 * intensity + (p.faDays > 14 ? 0.2 : 0)) continue;
      const ask = asking(G, p);
      const cands = [];
      for (const t of G.teams) {
        if ((t.tid === G.userTid && !includeUser) || (perTeam[t.tid] || 0) >= 2) continue;
        const dep = depthOf[t.tid];
        const n = dep.length;
        const worst = dep[n - 1];
        const tenth = dep[Math.min(9, n - 1)];
        const full = n >= 15;
        if (full && !(worst && p.ovr >= worst.ovr + 4 && p.ovr >= 74)) continue;
        if (n >= 13 && tenth && p.ovr < tenth.ovr - 1) continue;
        let amt = ask.amt;
        const how = canSign(G, t.tid, amt, p.lastTid === t.tid);
        if (!how) continue;
        cands.push({ t, amt, s: offerScore(G, p, t.tid, amt, ask.yrs) + Math.random() * 0.1, full });
      }
      if (!cands.length) continue;
      cands.sort((a, b) => b.s - a.s);
      const c = cands[0];
      if (c.s < 0.92) continue;
      if (c.full) release(G, depthOf[c.t.tid][depthOf[c.t.tid].length - 1]);
      sign(G, p, c.t.tid, c.amt, ask.yrs);
      perTeam[c.t.tid] = (perTeam[c.t.tid] || 0) + 1;
      depthOf[c.t.tid] = L.roster(G, c.t.tid).sort((a, b) => b.ovr - a.ovr);
      signed.push({ p, t: c.t, amt: c.amt });
    }
    // 아무도 데려가지 않는 선수: 최저 연봉으로라도(로스터 13명 미만 팀)
    for (const t of G.teams) {
      if (t.tid === G.userTid && !includeUser) continue;
      if (L.roster(G, t.tid).length < 13 && Math.random() < 0.5 * intensity) {
        const p = L.fas(G).filter(x => !reserved(G, x)).sort((a, b) => b.ovr - a.ovr)[0];
        if (p) { sign(G, p, t.tid, Math.max(F.minSal(cy), Math.min(asking(G, p).amt, F.minSal(cy) * 2)), 1); signed.push({ p, t, amt: p.contract.amt }); }
      }
    }
    for (const p of L.fas(G)) p.faDays = (p.faDays || 0) + 1;
    return signed;
  }

  // 재계약: 한 팀의 만료 선수를 정한다. 반환: { kept, left }
  function resignTeam(G, t) {
    const y = G.season;
    const kept = [], left = [];
    const exp = L.roster(G, t.tid).filter(p => p.contract && p.contract.exp <= y);
    for (const p of exp.sort((a, b) => b.ovr - a.ovr)) {
      const ask = asking(G, p);
      const age = P.age(p, y + 1);
      const v = value(G, p, t.tid, { noContract: true });
      const worth = F.cap(y + 1) * F.shareFor(p.ovr + (age <= 24 ? (p.pa - p.ovr) * 0.4 : 0));
      const tax = F.taxLine(y + 1);
      const pay = F.payroll(G, t.tid, y + 1);
      const want = ask.amt <= worth * 1.15 && (pay + ask.amt <= tax * 1.08 || p.ovr >= 86) && v > 0.2;
      if (want && Math.random() < 0.85 && offerScore(G, p, t.tid, ask.amt, ask.yrs) >= 0.95) {
        p.contract = { amt: ask.amt, exp: y + ask.yrs };
        kept.push(p);
      } else { p.lastTid = t.tid; p.tid = -1; p.contract = null; left.push(p); }
    }
    return { kept, left };
  }
  // AI 팀 전체 재계약. 반환: 떠난 선수 목록
  function aiResign(G) {
    const left = [];
    for (const t of G.teams) if (t.tid !== G.userTid) left.push(...resignTeam(G, t).left);
    return left;
  }

  // ---------- 드래프트 ----------
  function draftScore(G, p, tid) {
    const scout = 0.65 * p.pa + 0.35 * p.ovr + (U.hrand(p.pid + 's' + tid) - 0.5) * 7;
    const rp = p.prospect && (p.prospect.realPick || p.prospect.fakeRank);
    if (rp) return (70 - rp) * 0.55 + scout * 0.45;
    return scout;
  }
  function aiDraftPick(G, tid, pool) {
    let best = null, bs = -1e9;
    for (const p of pool) { const s = draftScore(G, p, tid); if (s > bs) { bs = s; best = p; } }
    return best;
  }

  // ---------- 로스터·전술 ----------
  function aiTactics(G, t) {
    const ps = L.roster(G, t.tid).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
    if (!ps.length) return;
    const avg = k => U.avg(ps.map(p => p.a[k]));
    const tac = { pace: 1, focus: 'bal', def: 'man', reb: 'bal' };
    if (ps[0].ovr >= 91 && ps[0].ovr - (ps[1]?.ovr || 0) >= 6) tac.focus = 'star';
    else if (avg('tp') >= 66 && G.season >= 1995) tac.focus = 'out';
    else if (avg('ins') >= 68) tac.focus = 'in';
    else if (avg('pss') >= 66) tac.focus = 'motion';
    if (avg('spd') >= 64) tac.pace = 2; else if (avg('spd') <= 52) tac.pace = 0;
    if (avg('orb') >= 64) tac.reb = 'crash';
    t.tactics = tac;
  }
  function setStrategies(G) {
    const ranked = G.teams.map(t => ({ t, s: L.strength(G, t.tid) })).sort((a, b) => b.s - a.s);
    ranked.forEach((x, i) => {
      if (x.t.tid === G.userTid) return;
      x.t.strategy = i < 9 ? 'contend' : i >= ranked.length - 9 ? 'rebuild' : 'mid';
    });
  }
  // 13~15명으로 맞춘다. 사용자 팀은 opts.user로만.
  function fillRoster(G, tid, min = 13) {
    const cy = capYear(G);
    const out = [];
    while (L.roster(G, tid).length < min) {
      const fa = L.fas(G).filter(x => !reserved(G, x)).sort((a, b) => b.ovr - a.ovr)[0];
      if (!fa) {
        const p = L.genPlayer(G, { ovr: 62 + Math.random() * 5, pa: 66, age: 23 + Math.random() * 6, tid });
        G.players[p.pid] = p; p.contract = { amt: F.minSal(cy), exp: cy }; out.push(p); continue;
      }
      fa.tid = tid; fa.contract = { amt: F.minSal(cy), exp: cy }; fa.signedDate = G.date; out.push(fa);
    }
    return out;
  }
  function trimRoster(G, tid, max = 15) {
    const out = [];
    const ps = L.roster(G, tid).sort((a, b) => value(G, a, tid) - value(G, b, tid));
    while (ps.length > max) { const p = ps.shift(); release(G, p); out.push(p); }
    return out;
  }
  // 방출 방법: waive(그대로) / buyout(선수가 일부 포기) / stretch(나눠 내기, 2012~)
  function releaseOptions(G, p) {
    const cy = capYear(G);
    if (!p.contract || p.contract.exp < cy) return [{ mode: 'waive', label: '방출', now: 0, total: 0, yrs: 0 }];
    const yrs = p.contract.exp - cy + 1, amt = p.contract.amt, total = amt * yrs;
    const age = P.age(p, cy);
    const mv = F.marketValue(p, cy, age);
    // 나이가 많거나 몸값보다 많이 받는 선수일수록, 다른 팀에서 뛰고 싶어 더 많이 포기한다
    const give = U.clamp(0.12 + Math.max(0, age - 29) * 0.03 + (amt > mv * 1.2 ? 0.12 : 0) + (p.ovr < 72 ? 0.06 : 0), 0.08, 0.45);
    const opts = [
      { mode: 'waive', label: '그냥 방출(웨이브)', now: amt, total, yrs, desc: '남은 연봉 전액이 계약 만료까지 캡에 남습니다.' },
      { mode: 'buyout', label: `바이아웃 합의 (선수가 ${Math.round(give * 100)}% 포기)`, now: Math.round(amt * (1 - give)), total: Math.round(total * (1 - give)), yrs, give, desc: '남은 연봉 일부를 덜 주고 내보냅니다.' },
    ];
    if (cy >= 2012) {
      const n = yrs * 2 + 1;
      opts.push({ mode: 'stretch', label: `스트레치 조항 (${n}년에 나눠 냄)`, now: Math.round(total / n), total, yrs: n, desc: '총액은 같지만 해마다 내는 몫이 작아져 올해 캡 여유가 커집니다.' });
    }
    return opts;
  }
  function release(G, p, mode = 'waive') {
    const cy = capYear(G);
    if (p.contract && p.contract.exp >= cy && p.tid >= 0) {
      const o = releaseOptions(G, p).find(x => x.mode === mode) || releaseOptions(G, p)[0];
      const per = o.yrs ? Math.round(o.total / o.yrs) : 0;
      if (per > 0) G.dead.push({ tid: p.tid, amt: per, exp: cy + o.yrs - 1, name: p.name, mode });
    }
    p.lastTid = p.tid; p.tid = -1; p.contract = null; p.faDays = 0;
  }

  HM.AI = {
    value, pickValue, projectedPick, tradeCheck, tradeDelta, aiAccepts, execTrade, balance, aiTrade, aiOfferToUser,
    reserved, releaseOptions, asking, offerScore, teamAppeal, canSign, sign, faDay, aiResign, resignTeam, capRoom, capYear, payroll,
    draftScore, aiDraftPick, aiTactics, setStrategies, fillRoster, trimRoster, release,
  };
})();
