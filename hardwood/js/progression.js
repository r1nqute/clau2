// 선수 성장·노쇠·은퇴, 실제 선수의 합류
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, R = HM.Ratings, L = HM.L, P = HM.P;
  const D = () => globalThis.HM_DATA;

  const AGE_CURVE = { 18: 4.5, 19: 4.2, 20: 3.8, 21: 3.3, 22: 2.8, 23: 2.2, 24: 1.6, 25: 1.0, 26: 0.5, 27: 0.1, 28: -0.3, 29: -0.8, 30: -1.3, 31: -1.9, 32: -2.5, 33: -3.2, 34: -3.9, 35: -4.6, 36: -5.2 };
  const ageCurve = a => a <= 18 ? 4.5 : a >= 36 ? -5.5 : AGE_CURVE[a];

  // 능력치 전체를 OVR 변화량만큼 옮긴다(신체는 나이에 따라 따로)
  function shiftOvr(p, dOvr, age) {
    const a = p.a;
    // 개별 능력치에 약간의 흔들림
    for (const k of R.SKILL) a[k] = U.clamp(a[k] + U.gauss(0, 1.3), 1, 99);
    if (age >= 29) {
      const k = (age - 28) / 3;
      a.ath = U.clamp(a.ath - U.gauss(1.8, 0.8) * k, 1, 99);
      a.spd = U.clamp(a.spd - U.gauss(1.6, 0.8) * k, 1, 99);
      if (age >= 31) a.sta = U.clamp(a.sta - U.gauss(1.5, 0.8), 1, 99);
    } else if (age <= 23) {
      a.str = U.clamp(a.str + U.gauss(1.5, 1), 1, 99);
      a.ath = U.clamp(a.ath + U.gauss(0.6, 1), 1, 99);
    }
    // 경험이 쌓이면 IQ·침착성·리더십이 오른다
    if (age <= 31) { a.iq = U.clamp(a.iq + U.gauss(0.8, 0.8), 1, 99); a.cmp = U.clamp(a.cmp + U.gauss(0.6, 0.8), 1, 99); }
    a.ldr = U.clamp(a.ldr + U.gauss(age <= 30 ? 0.8 : 0.3, 0.8), 1, 99);
    // 젊은 선수는 3점 비중이 조금씩 는다(리그 흐름)
    if (age <= 27 && a.tp > 45) p.t.r3 = U.clamp(p.t.r3 + U.gauss(0.012, 0.01), 0, 0.85);
    const cur = p.o + p.d;
    const target = R.ovrToBpm(U.clamp(p.ovr + dOvr, 30, 99));
    const diff = target - cur;
    R.fitTo(a, p.t, p.o + diff * 0.68, p.d + diff * 0.32);
    P.update(p);
  }

  // 무작위 성장
  function randomDevelop(G, p, age) {
    let d = ageCurve(age);
    const gap = p.pa - p.ovr;
    if (age <= 25 && gap > 0) d += gap * (age <= 21 ? 0.22 : 0.17);
    else if (age <= 27 && gap > 0) d += gap * 0.1;
    if (gap <= 0 && d > 0) d *= 0.3;
    d += (p.a.wrk - 60) / 40;
    d += U.gauss(0, age <= 24 ? 2.6 : 2.0);
    shiftOvr(p, d, age);
    if (age >= 27) p.pa = Math.max(p.ovr, p.pa - 1.5);
  }

  // 실제 커리어 따라가기: 그 해의 실제 능력치 + 선수만의 편차
  function realDevelop(G, p, s, age) {
    const x = L.decodeSnap(s);
    p.dev = 0.55 * (p.dev || 0) + U.gauss(0, 1.4);
    p.a = x.a; p.t = x.t; p.pos = x.pos;
    // 바깥 쪽에서 쌓인 경험(정신 능력)은 줄지 않는다
    P.update(p);
    if (Math.abs(p.dev) > 0.05) {
      const target = R.ovrToBpm(U.clamp(p.ovr + p.dev, 30, 99));
      const diff = target - (p.o + p.d);
      R.fitTo(p.a, p.t, p.o + diff * 0.68, p.d + diff * 0.32);
      P.update(p);
    }
    void age;
  }

  // 새 시즌 직전: 모든 선수 성장/노쇠
  function developAll(G) {
    const y = G.season; // 이미 새 시즌으로 바뀐 뒤
    const d = D();
    for (const p of Object.values(G.players)) {
      if (p.tid === -3) continue;
      const age = P.age(p, y);
      if (p.tid === -2) continue; // 드래프트 후보는 드래프트 때 이미 맞춰져 있다
      let done = false;
      if (G.settings.prog === 'real' && p.rid && y <= d.last) {
        const s = L.snapAt(p.rid, y);
        if (s) { realDevelop(G, p, s, age); done = true; }
        else {
          // 실제로는 그 해를 쉬었지만 나중에 다시 뛴 경우: 다음 기록 쪽으로 반쯤 다가간다
          const later = L.snapsOf(p.rid).find(z => z[0] > y);
          if (later && later[0] - y <= 3) {
            const x = L.decodeSnap(later); const lo = R.ovr(x.a, x.t);
            shiftOvr(p, (lo - p.ovr) * 0.5 + U.gauss(0, 1), age); done = true;
          }
        }
      }
      if (!done) randomDevelop(G, p, age);
      if (p.stats.some(l => l.s === y - 1 && l.gp > 0)) p.yearsPro = (p.yearsPro || 0) + 1;
    }
  }

  // 은퇴: 플레이오프 뒤. 실제로 그 해에 은퇴한 선수는 대개 은퇴한다.
  function retirements(G) {
    const y = G.season, d = D();
    const out = [];
    for (const p of Object.values(G.players)) {
      if (p.tid === -3 || p.tid === -2) continue;
      const age = P.age(p, y);
      let pr = 0;
      if (age >= 33) pr = 0.05 + (age - 33) * 0.12;
      if (p.ovr < 70) pr += (70 - p.ovr) * 0.02 * (age >= 29 ? 1 : 0.3);
      if (p.tid === -1) pr += age >= 30 ? 0.25 : 0.06;
      if (p.ovr >= 82) pr *= 0.35;
      if (G.settings.prog === 'real' && p.rid && y < d.last) {
        const lastReal = L.snapsOf(p.rid).slice(-1)[0];
        if (lastReal && lastReal[0] <= y && (age >= 30 || p.tid === -1)) pr = Math.max(pr, 0.85);
        else if (lastReal && lastReal[0] > y + 1) pr *= 0.25;
      }
      if (p.contract && p.contract.exp > y && p.tid >= 0) pr *= 0.35;
      if (age >= 41) pr = 1;
      if (Math.random() < U.clamp(pr, 0, 1)) {
        p.tid = -3; p.retiredYear = y; p.contract = null;
        out.push(p);
      }
    }
    return out;
  }

  // 새 시즌에 실제로 데뷔/복귀하는 선수를 들인다
  function injectEntrants(G, y) {
    const d = D();
    if (y > d.last) return [];
    const byFr = {}; G.teams.forEach(t => { byFr[t.fr] = t; });
    const added = [];
    for (const [rid, list] of Object.entries(d.snaps)) {
      if (G.ridMap[rid] !== undefined) continue;
      const s = list.find(x => x[0] === y);
      if (!s) continue;
      const p = L.makeReal(G, rid, s, -1);
      // 시작 전에 지명된 선수(해외 체류 등)는 지명 팀이 권리를 가진다
      const bio = d.players[rid];
      if (bio && bio[8] && bio[8][0] < G.startYear) {
        const fr = (d.seasons[bio[8][0] + 1]?.teams.find(r => r[0] === bio[8][3]) || [])[2] || bio[8][3];
        const t = byFr[fr];
        if (t && L.roster(G, t.tid).length < 15) p.tid = t.tid;
      }
      p.yearsPro = Math.max(0, (s[20] || 1) - 1);
      L.initContract(G, p, y);
      if (p.tid === -1) p.contract = null;
      added.push(p);
    }
    return added;
  }

  // 리그 전체 수준 유지: 상위 선수들의 평균 능력이 기준에서 벗어나면 모두를 조금씩 되돌린다.
  // 실제 커리어 모드에서 실제 자료가 있는 시즌은 손대지 않는다.
  function measure(G) {
    const o = Object.values(G.players).filter(p => p.tid >= 0).map(p => p.ovr).sort((a, b) => b - a);
    const n = Math.min(o.length, G.teams.length * 8);
    return n ? o.slice(0, n).reduce((s, v) => s + v, 0) / n : 0;
  }
  function normalize(G) {
    if (!G.talentRef) { G.talentRef = measure(G); return 0; }
    if (G.settings.prog === 'real' && G.season <= D().last) return 0;
    const delta = (G.talentRef - measure(G)) * 0.85;
    if (Math.abs(delta) < 0.25) return 0;
    for (const p of Object.values(G.players)) {
      if (p.tid < -2) continue;
      const target = R.ovrToBpm(U.clamp(p.ovr + delta, 25, 99));
      const diff = target - (p.o + p.d);
      R.fitTo(p.a, p.t, p.o + diff * 0.68, p.d + diff * 0.32);
      p.pa = Math.max(25, p.pa + delta);
      P.update(p);
    }
    return delta;
  }

  HM.Prog = { developAll, retirements, injectEntrants, randomDevelop, shiftOvr, ageCurve, normalize, measure };
})();
