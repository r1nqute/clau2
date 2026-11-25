// 경기 엔진: 포제션 단위로 경기를 굴린다. 생중계(한 포제션씩)와 즉시 결과 모두 같은 코드를 쓴다.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U, R = HM.Ratings;
  const { clamp, sigmoid, logit } = U;

  const POSN = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  const BASE = { rim: 0.60, mid: 0.40 };
  const FOULC = { rim: 3, mid: 1, three: 0.35 };
  const PTS = { rim: 2, mid: 2, three: 3 };
  const STRENGTH = 1.3, CAL = 0.042;
  const BLK = { rim: 0.17, mid: 0.07, three: 0.02 };
  const ASTB = { rim: 0.47, mid: 0.52, three: 0.78 };

  const TEMPLATE = [36, 34, 32, 31, 29, 24, 20, 15, 11, 8, 0, 0, 0, 0, 0];
  const TEMPLATE_PO = [39, 37, 35, 33, 31, 23, 18, 14, 10, 0, 0, 0, 0, 0, 0];

  // 자동 로테이션: 선발 5명과 출전 시간 목표
  function autoRotation(players, playoffs) {
    const list = players.slice().sort((a, b) => b.ovr - a.ovr);
    const top = list.slice(0, Math.min(7, list.length));
    let best = null, bestScore = -1e9;
    const n = top.length;
    if (n >= 5) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
        const five = [top[a], top[b], top[c], top[d], top[e]];
        let s = five.reduce((x, p) => x + p.ovr, 0);
        const guards = five.filter(p => p.pos === 'PG' || p.pos === 'SG' || p.a.hdl >= 72).length;
        const bigs = five.filter(p => p.pos === 'C' || p.pos === 'PF' || p.hgt >= 208).length;
        if (guards < 1) s -= 8; if (bigs < 1) s -= 8; if (bigs > 3) s -= 5; if (guards > 3) s -= 4;
        if (s > bestScore) { bestScore = s; best = five; }
      }
    } else best = top;
    const starters = best.map(p => p.pid);
    const order = best.slice().concat(list.filter(p => !starters.includes(p.pid)));
    const tpl = playoffs ? TEMPLATE_PO : TEMPLATE;
    const minutes = {};
    let tot = 0;
    order.forEach((p, i) => {
      let m = tpl[i] || 0;
      if (m) m += (p.a.sta - 60) / 20; // 지구력
      if (i < 5 && i > 0 && order[0].ovr - p.ovr > 14) m -= 2;
      m = clamp(m, 0, 42);
      minutes[p.pid] = m; tot += m;
    });
    // 240분에 맞춘다
    const k = 240 / (tot || 1);
    for (const id in minutes) minutes[id] = clamp(minutes[id] * k, 0, 42);
    return { starters, minutes };
  }

  function shortName(name) {
    const parts = String(name).split(' ');
    if (parts.length <= 1) return name;
    const last = parts[parts.length - 1];
    if (/^(Jr\.?|Sr\.?|II|III|IV)$/.test(last) && parts.length > 2) return parts[parts.length - 2] + ' ' + last;
    return last;
  }

  class Game {
    // opt: { home:{tid,name,abbr,players,tactics,rotation}, away:{...}, env, playoffs, live, hca }
    constructor(opt) {
      this.env = opt.env;
      this.playoffs = !!opt.playoffs;
      this.live = !!opt.live;
      this.hca = opt.hca ?? 3;
      this.neutral = !!opt.neutral;
      this.rubber = opt.rubber ?? 0.003;
      this.T = [this.prepTeam(opt.home, 0), this.prepTeam(opt.away, 1)];
      this.q = 1; this.clock = 720; this.elapsed = 0;
      this.score = [0, 0];
      this.qScore = [[0, 0, 0, 0], [0, 0, 0, 0]];
      this.poss = Math.random() < 0.5 ? 0 : 1;
      this.firstPoss = this.poss;
      this.done = false;
      this.log = [];
      this.injuries = [];
      this.lead = { changes: 0, max: [0, 0], last: 0 };
      // 이름 겹침 확인
      const counts = {};
      for (const t of this.T) for (const s of t.roster) { const sn = shortName(s.p.name); counts[sn] = (counts[sn] || 0) + 1; }
      for (const t of this.T) for (const s of t.roster) { const sn = shortName(s.p.name); s.nm = counts[sn] > 1 ? s.p.name : sn; }
      if (this.live) this.say(-1, `경기 시작! ${this.T[this.poss].name} 공격으로 시작합니다.`);
    }

    prepTeam(src, side) {
      const avail = src.players.filter(p => !(p.injury && p.injury.days > 0));
      const tac = Object.assign({ pace: 1, focus: 'bal', def: 'man', reb: 'bal' }, src.tactics || {});
      let rot = src.rotation;
      const ids = new Set(avail.map(p => p.pid));
      let starters, minutes;
      if (!rot || rot.auto || !rot.starters) {
        ({ starters, minutes } = autoRotation(avail, this.playoffs));
      } else {
        starters = rot.starters.filter(id => ids.has(id));
        minutes = {};
        let tot = 0;
        for (const p of avail) { minutes[p.pid] = rot.minutes?.[p.pid] ?? 0; tot += minutes[p.pid]; }
        const auto = autoRotation(avail, this.playoffs);
        if (starters.length < 5) for (const id of auto.starters) if (starters.length < 5 && !starters.includes(id)) starters.push(id);
        if (tot < 200) for (const id in auto.minutes) minutes[id] = Math.max(minutes[id] || 0, auto.minutes[id] * (240 - tot) / 240);
        const sum = Object.values(minutes).reduce((a, b) => a + b, 0) || 1;
        for (const id in minutes) minutes[id] = minutes[id] * 240 / sum;
      }
      const roster = avail.map(p => ({
        p, side, nm: p.name, min: 0, energy: 1, fouls: 0, out: false, onCourt: false, starter: starters.includes(p.pid),
        target: minutes[p.pid] || 0,
        s: { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 },
      }));
      const court = roster.filter(r => r.starter).slice(0, 5);
      for (const r of roster) if (court.length < 5 && !court.includes(r)) court.push(r);
      for (const r of court) r.onCourt = true;
      return {
        tid: src.tid, name: src.name, abbr: src.abbr, tac, roster, court, side,
        tfouls: 0, timeouts: 7, manualSubs: null,
        st: { fb: 0, pitp: 0, second: 0, tovPts: 0, bigLead: 0 },
      };
    }

    say(side, text, kind) {
      if (!this.live) return;
      this.log.push({ q: this.q, clock: Math.max(0, Math.round(this.clock)), side, text, kind: kind || '', score: this.score.slice() });
    }

    // ---------- 능력치 보조 ----------
    oVal(r) { return r.p.o - (1 - r.energy) * 7 - (r.p.moralePen || 0); }
    dVal(r) { return r.p.d - (1 - r.energy) * 4; }

    tempo(t) { return t.tac.pace === 2 ? 0.92 : t.tac.pace === 0 ? 1.09 : 1; }

    tacticTerm(off, def) {
      const O = off.court, D = def.court;
      const avg = (arr, k) => arr.reduce((s, r) => s + r.p.a[k], 0) / arr.length;
      let x = 0;
      switch (off.tac.focus) {
        case 'in': x += (avg(O, 'ins') - 62) / 40 * 2.0 - 0.3; break;
        case 'out': x += (avg(O, 'tp') - 62) / 40 * 2.2 - 0.3; break;
        case 'motion': x += (avg(O, 'pss') - 62) / 40 * 1.8 - 0.3; break;
        case 'star': {
          const top = O.reduce((m, r) => r.p.ovr > m ? r.p.ovr : m, 0);
          x += (top - 86) / 8 * 1.2 - 0.3; break;
        }
      }
      switch (def.tac.def) {
        case 'zone': x += (avg(O, 'tp') - 60) / 40 * 2.2 - (avg(D, 'idef') - 60) / 40 * 1.2 - 0.3; break;
        case 'press': x += (avg(O, 'hdl') - 62) / 40 * 2.0 - (avg(D, 'spd') - 60) / 40 * 1.0 - 0.2; break;
      }
      if (off.tac.reb === 'crash') x -= 0.2;
      if (def.tac.reb === 'crash') x += 0.9;
      if (def.tac.reb === 'back') x -= 0.7;
      return x;
    }

    // ---------- 포제션 하나 ----------
    step() {
      if (this.done) return;
      const off = this.T[this.poss], def = this.T[1 - this.poss];
      const meanDur = 2880 / (2 * (this.env.pace || 98)) * (this.tempo(off) * 0.7 + this.tempo(def) * 0.3);
      let dur = clamp(meanDur * (0.55 + 0.9 * Math.random()), 3, 24);
      const late = (this.q >= 4) && this.clock <= 48;
      const margin = this.score[off.side] - this.score[def.side];
      // 막판 고의 파울
      if (late && margin > 0 && margin <= 8 && this.clock > 2) {
        dur = Math.min(this.clock, 2 + Math.random() * 5);
        this.tick(dur);
        const fouler = U.wpick(def.court, def.court.map(r => 1 / (1 + r.fouls)));
        this.foul(fouler);
        const shooter = U.wpick(off.court, off.court.map(r => r.p.t.usg));
        this.say(def.side, `${fouler.nm} 작전상 파울`);
        this.freeThrows(off, def, shooter, 2, true);
        return this.endPoss();
      }
      // 막판 시계 관리: 동점·근소하게 뒤지면 마지막 슛, 앞서면 시간을 다 쓴다
      this.forceThree = false;
      if (this.q >= 4 && this.clock <= 24) {
        if (margin <= 0 && margin >= -3) dur = Math.max(0, this.clock - 1 - Math.random() * 2);
        else if (margin > 0) dur = Math.min(this.clock, 20 + Math.random() * 4);
        if (margin === -3) this.forceThree = true;
      }
      if (dur > this.clock) dur = this.clock;
      this.tick(dur);
      this.runPossession(off, def);
      return this.endPoss();
    }

    endPoss() {
      this.poss = 1 - this.poss;
      if (this.clock <= 0.01) this.endPeriod();
      if (!this.done) { this.subs(this.T[0]); this.subs(this.T[1]); }
    }

    tick(sec) {
      sec = Math.min(sec, this.clock);
      this.clock -= sec; this.elapsed += sec;
      for (const t of this.T) {
        const press = t.tac.def === 'press' ? 1.2 : 1;
        const tempo = t.tac.pace === 2 ? 1.08 : t.tac.pace === 0 ? 0.94 : 1;
        for (const r of t.roster) {
          if (r.onCourt) {
            r.min += sec;
            r.energy = Math.max(0.3, r.energy - sec * 0.00056 * (1.65 - r.p.a.sta / 100) * press * tempo);
          } else r.energy = Math.min(1, r.energy + sec * 0.0012);
        }
      }
    }

    endPeriod() {
      const reg = this.q <= 4;
      if (this.live) this.say(-1, this.q <= 4 ? `${this.q}쿼터 종료 (${this.T[0].abbr} ${this.score[0]} : ${this.score[1]} ${this.T[1].abbr})` : `연장 ${this.q - 4}차 종료`, 'period');
      if (this.q >= 4 && this.score[0] !== this.score[1]) { this.done = true; return; }
      this.q++;
      this.clock = this.q <= 4 ? 720 : 300;
      if (this.q > 4) { this.qScore[0].push(0); this.qScore[1].push(0); }
      for (const t of this.T) {
        t.tfouls = 0;
        for (const r of t.roster) r.energy = Math.min(1, r.energy + (this.q === 3 ? 0.3 : 0.1));
      }
      this.poss = (this.q === 2 || this.q === 3) ? 1 - this.firstPoss : this.firstPoss;
      if (this.q > 4) this.poss = Math.random() < 0.5 ? 0 : 1;
      void reg;
    }

    addPts(side, n, r) {
      this.score[side] += n;
      const qi = this.q - 1;
      this.qScore[side][qi] = (this.qScore[side][qi] || 0) + n;
      r.s.pts += n;
      for (const x of this.T[side].court) x.s.pm += n;
      for (const x of this.T[1 - side].court) x.s.pm -= n;
      const lead = this.score[0] - this.score[1];
      const sign = Math.sign(lead);
      if (sign !== 0 && this.lead.last !== 0 && sign !== this.lead.last) this.lead.changes++;
      if (sign !== 0) this.lead.last = sign;
      if (lead > this.lead.max[0]) this.lead.max[0] = lead;
      if (-lead > this.lead.max[1]) this.lead.max[1] = -lead;
    }

    foul(r) {
      r.s.pf++; r.fouls++;
      this.T[r.side].tfouls++;
      if (r.fouls >= 6) {
        r.out = true;
        this.say(r.side, `${r.nm} 6반칙 퇴장`, 'bad');
      }
    }

    // 목표 득점 효율(포제션당 점수)
    target(off, def) {
      let o = 0, d = 0;
      for (const r of off.court) o += this.oVal(r);
      for (const r of def.court) d += this.dVal(r);
      const e = this.env;
      let t = e.ortg / 100 + CAL + STRENGTH * ((o - (e.lgO || 0)) - (d - (e.lgD || 0))) / 100;
      if (!this.neutral) t += (off.side === 0 ? 1 : -1) * this.hca / 200;
      t += this.tacticTerm(off, def) / 100;
      // 크게 앞선 쪽은 느슨해지고 뒤진 쪽은 몰아친다
      const m = this.score[off.side] - this.score[def.side];
      t -= this.rubber * clamp(m, -30, 30);
      return clamp(t, 0.6, 1.6);
    }

    // 슛을 고르는 사람과 슛 종류, 기대값 계산에 쓰는 표
    shotTable(off, def) {
      const O = off.court, D = def.court;
      const So = O.slice().sort((a, b) => POSN[a.p.pos] - POSN[b.p.pos]);
      const Sd = D.slice().sort((a, b) => POSN[a.p.pos] - POSN[b.p.pos]);
      const bestRim = D.reduce((m, r) => Math.max(m, r.p.a.idef), 0);
      const e = this.env;
      const tpBase = e.tpp > 0 ? e.tpp : 0.30;
      const late = this.q >= 4 && this.clock < 150 && Math.abs(this.score[0] - this.score[1]) <= 6;
      const f3 = (off.tac.focus === 'out' ? 1.25 : off.tac.focus === 'in' ? 0.8 : 1) * (def.tac.def === 'zone' ? 1.12 : 1);
      const fr = (off.tac.focus === 'in' ? 1.18 : off.tac.focus === 'out' ? 0.9 : 1) * (def.tac.def === 'zone' ? 0.88 : 1) * (def.tac.def === 'press' ? 1.06 : 1);
      const star = off.tac.focus === 'star';
      const motion = off.tac.focus === 'motion';
      const rows = [];
      let usum = 0;
      for (let i = 0; i < So.length; i++) {
        const r = So[i], a = r.p.a, t = r.p.t;
        const mdef = Sd[i] || Sd[0];
        let u = Math.pow(t.usg, star ? 1.6 : motion ? 0.75 : 1.0) * (0.6 + 0.4 * r.energy);
        usum += u;
        let s3 = t.r3 * f3; if (e.tpp === 0) s3 = 0;
        s3 = clamp(s3, 0, 0.92);
        let sr = (1 - s3) * clamp(t.rim * fr, 0.05, 0.95);
        let sm = 1 - s3 - sr;
        const fatigue = -(1 - r.energy) * 0.45;
        const clutch = late ? (a.cmp - 55) / 45 * 0.12 : 0;
        const rimDef = 0.6 * mdef.p.a.idef + 0.4 * bestRim;
        const L = {
          rim: logit(BASE.rim) + (a.ins - 55) / 45 * 0.5 - (rimDef - 55) / 45 * 0.35 + fatigue + clutch,
          mid: logit(BASE.mid) + (a.mid - 55) / 45 * 0.5 - (mdef.p.a.pdef - 55) / 45 * 0.25 + fatigue + clutch,
          three: logit(tpBase) + 0.12 + (a.tp - 55) / 45 * 0.5 - (mdef.p.a.pdef - 55) / 45 * 0.22 + fatigue + clutch,
        };
        const cs = sr * FOULC.rim + sm * FOULC.mid + s3 * FOULC.three || 1;
        const fbase = t.ftr / 2.2 / cs;
        const f = { rim: Math.min(0.45, fbase * FOULC.rim), mid: Math.min(0.3, fbase * FOULC.mid), three: Math.min(0.1, fbase * FOULC.three) };
        const q = clamp(0.40 + 0.0055 * a.ft, 0.3, 0.95);
        rows.push({ r, u, sh: { rim: sr, mid: sm, three: s3 }, L, f, q, mdef });
      }
      for (const row of rows) row.u /= usum;
      return rows;
    }

    // λ(로짓 보정)에 따른 기대 득점
    expPPP(rows, lam, tov, oreb) {
      let S = 0, M = 0;
      for (const row of rows) {
        for (const k of ['rim', 'mid', 'three']) {
          const sh = row.sh[k]; if (sh <= 0) continue;
          const p = sigmoid(row.L[k] + lam), f = row.f[k], v = PTS[k];
          const pts = p * (v + f * row.q) + (1 - p) * f * v * row.q;
          S += row.u * sh * pts;
          M += row.u * sh * (1 - p) * (1 - f);
        }
      }
      return (1 - tov) * S / (1 - (1 - tov) * M * oreb) + 0.02;
    }

    runPossession(off, def) {
      const O = off.court, D = def.court;
      const e = this.env;
      const rows = this.shotTable(off, def);
      const avg = (arr, k) => arr.reduce((s, r) => s + r.p.a[k], 0) / arr.length;
      const hdlU = rows.reduce((s, row) => s + row.u * row.r.p.a.hdl, 0);
      let tovL = logit(clamp(e.tov || 0.135, 0.08, 0.2)) + (avg(D, 'stl') - 55) / 45 * 0.3 - (hdlU - 55) / 45 * 0.35 - (avg(O, 'iq') - 55) / 45 * 0.15;
      if (def.tac.def === 'press') tovL += 0.18;
      if (off.tac.pace === 2) tovL += 0.05;
      const tov = sigmoid(tovL);
      let orebL = logit(clamp(e.orb || 0.28, 0.15, 0.4)) + (avg(O, 'orb') - 55) / 45 * 0.9 - (avg(D, 'drb') - 55) / 45 * 0.9;
      if (off.tac.reb === 'crash') orebL += 0.3;
      if (off.tac.reb === 'back') orebL -= 0.3;
      const oreb = sigmoid(orebL);
      // λ 찾기
      const tgt = this.target(off, def);
      let lo = -3, hi = 3;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (this.expPPP(rows, mid, tov, oreb) < tgt) lo = mid; else hi = mid;
      }
      const lam = (lo + hi) / 2;
      this.cycle(off, def, rows, lam, tov, oreb, 0);
    }

    cycle(off, def, rows, lam, tov, oreb, n) {
      const O = off.court, D = def.court;
      // 턴오버
      if (Math.random() < (n ? tov * 0.6 : tov)) {
        const row = U.wpick(rows, rows.map(x => x.u * (130 - x.r.p.a.hdl)));
        const r = row.r; r.s.tov++;
        const avgStl = D.reduce((s, x) => s + x.p.a.stl, 0) / D.length;
        if (Math.random() < 0.5 * avgStl / 58) {
          const st = U.wpick(D, D.map(x => Math.pow(x.p.a.stl, 2.5)));
          st.s.stl++;
          this.say(off.side, `${r.nm} 턴오버 (스틸: ${st.nm})`, 'tov');
        } else this.say(off.side, `${r.nm} 턴오버`, 'tov');
        return;
      }
      // 슈팅 아닌 파울(보너스면 자유투)
      if (Math.random() < 0.045) {
        const fouler = U.wpick(D, D.map(x => 140 - x.p.a.iq));
        this.foul(fouler);
        if (this.T[def.side].tfouls >= 5) {
          const row = U.wpick(rows, rows.map(x => x.u));
          this.say(def.side, `${fouler.nm} 파울 — 보너스 자유투`);
          this.freeThrows(off, def, row.r, 2, true);
          return;
        }
        this.tick(2);
      }
      const row = this.forceThree ? U.wpick(rows, rows.map(x => x.u * Math.pow(x.r.p.a.tp, 2))) : U.wpick(rows, rows.map(x => x.u));
      const r = row.r;
      let type = U.wpick(['rim', 'mid', 'three'], [row.sh.rim * (n ? 1.6 : 1), row.sh.mid, row.sh.three * (n ? 0.7 : 1)]);
      if (this.forceThree && this.env.tpp > 0) type = 'three';
      const fouled = Math.random() < row.f[type];
      const p = sigmoid(row.L[type] + lam + (n && type === 'rim' ? 0.15 : 0));
      const made = Math.random() < p;
      const v = PTS[type];
      if (made) {
        r.s.fgm++; r.s.fga++; if (type === 'three') { r.s.tpm++; r.s.tpa++; }
        this.addPts(off.side, v, r);
        if (n) off.st.second += v;
        if (type === 'rim') off.st.pitp += 2;
        // 어시스트
        const others = O.filter(x => x !== r);
        const top2 = others.map(x => x.p.a.pss).sort((a, b) => b - a).slice(0, 2);
        const pAst = clamp(ASTB[type] + ((top2[0] + (top2[1] || 0)) / 2 - 60) / 40 * 0.12 + (off.tac.focus === 'motion' ? 0.06 : 0) - (n ? 0.25 : 0), 0.05, 0.95);
        let ast = null;
        if (others.length && Math.random() < pAst) {
          ast = U.wpick(others, others.map(x => Math.pow(x.p.a.pss, 3) * (0.5 + x.p.t.usg)));
          ast.s.ast++;
        }
        if (this.live) {
          const verb = type === 'three' ? '3점슛 성공!' : type === 'mid' ? '중거리 점프슛 성공' : (r.p.a.ath > 72 && r.p.hgt >= 198 && Math.random() < 0.45 ? '덩크!' : n ? '풋백 득점' : '골밑 득점');
          this.say(off.side, `${r.nm} ${verb}${ast ? ` (어시스트 ${ast.nm})` : ''}`, type === 'three' ? 'three' : 'score');
        }
        if (fouled) {
          const fl = row.mdef; this.foul(fl);
          this.say(def.side, `앤드원! ${fl.nm} 파울`);
          this.freeThrows(off, def, r, 1, false);
        }
        return;
      }
      if (fouled) {
        const fl = type === 'rim' ? U.wpick(D, D.map(x => x === row.mdef ? 3 : x.p.a.idef / 40)) : row.mdef;
        this.foul(fl);
        this.say(def.side, `${fl.nm} 슈팅 파울 — ${r.nm} 자유투 ${v}개`);
        this.freeThrows(off, def, r, v, true);
        return;
      }
      r.s.fga++; if (type === 'three') r.s.tpa++;
      // 블록
      let blocked = false;
      const topBlk = Math.max(...D.map(x => x.p.a.blk));
      if (Math.random() < BLK[type] * Math.pow(topBlk / 70, 1.2)) {
        const b = U.wpick(D, D.map(x => Math.pow(x.p.a.blk, 2.5)));
        b.s.blk++; blocked = true;
        this.say(def.side, `${b.nm} 블록! (${r.nm}의 ${type === 'three' ? '3점슛' : '슛'})`, 'block');
      } else if (this.live) {
        this.say(off.side, `${r.nm} ${type === 'three' ? '3점슛 빗나감' : type === 'mid' ? '점프슛 실패' : '레이업 실패'}`, 'miss');
      }
      this.rebound(off, def, rows, lam, tov, oreb * (blocked ? 0.75 : 1) * (type === 'three' ? 1.08 : 1), n);
    }

    rebound(off, def, rows, lam, tov, oreb, n) {
      const O = off.court, D = def.court;
      if (Math.random() < oreb && n < 3) {
        const rb = U.wpick(O, O.map(x => Math.pow(x.p.a.orb, 1.1) * Math.pow(x.p.hgt / 200, 1.5)));
        if (Math.random() < 0.9) rb.s.orb++;
        this.say(off.side, `${rb.nm} 공격 리바운드`, 'oreb');
        this.tick(Math.min(this.clock, 2 + Math.random() * 4));
        if (this.clock <= 0) return;
        this.cycle(off, def, rows, lam, tov, oreb, n + 1);
      } else {
        const rb = U.wpick(D, D.map(x => Math.pow(x.p.a.drb, 1.1) * Math.pow(x.p.hgt / 200, 1.5)));
        if (Math.random() < 0.87) rb.s.drb++;
      }
    }

    freeThrows(off, def, r, k, liveBall) {
      let made = 0;
      const q = clamp(0.40 + 0.0055 * r.p.a.ft + (this.q >= 4 && this.clock < 120 ? (r.p.a.cmp - 60) / 45 * 0.03 : 0), 0.3, 0.96);
      for (let i = 0; i < k; i++) {
        r.s.fta++;
        if (Math.random() < q) { r.s.ftm++; made++; this.addPts(off.side, 1, r); }
      }
      if (this.live) this.say(off.side, `${r.nm} 자유투 ${k}개 중 ${made}개 성공`, 'ft');
      if (liveBall && made < k) {
        // 마지막 자유투 실패: 리바운드
        if (Math.random() < 0.13) {
          const rb = U.wpick(off.court, off.court.map(x => Math.pow(x.p.a.orb, 1.1)));
          if (Math.random() < 0.6) rb.s.orb++;
        } else {
          const rb = U.wpick(def.court, def.court.map(x => Math.pow(x.p.a.drb, 1.1) * Math.pow(x.p.hgt / 200, 1.5)));
          if (Math.random() < 0.6) rb.s.drb++;
        }
      }
    }

    // ---------- 선수 교체 ----------
    subs(t) {
      const remainQ = this.clock;
      const elapsed = this.elapsed;
      const margin = this.score[t.side] - this.score[1 - t.side];
      const late = this.q >= 4 && remainQ <= 300 && Math.abs(margin) <= 12;
      const garbage = this.q >= 4 && ((remainQ <= 480 && Math.abs(margin) >= 24) || (remainQ <= 300 && Math.abs(margin) >= 18));
      const avail = t.roster.filter(r => !r.out);
      if (avail.length < 5) {
        // 다섯이 안 되면 퇴장 선수라도 넣는다
        for (const r of t.roster) if (avail.length < 5 && !avail.includes(r)) avail.push(r);
      }
      // 수동 교체 요청
      if (t.manualSubs) {
        const want = t.manualSubs.map(id => avail.find(r => r.p.pid === id)).filter(Boolean);
        t.manualSubs = null;
        if (want.length === 5) return this.setCourt(t, want);
      }
      if (t.lockCourt && t.court.every(r => !r.out)) return;
      const score = r => {
        const tw = r.target / 4;
        const exp = r.target / 48 * (elapsed / 60);
        const deficit = exp - r.min / 60;
        let s = tw + deficit * 1.1 + (r.energy - 0.85) * 32;
        if (r.onCourt) s += 1.8;
        if (late) s += tw * 1.2 - (r.energy - 0.85) * 18;
        if (garbage && r.target >= 26) s -= 18;
        if (garbage && r.target < 12) s += 4;
        if (r.target <= 0.5 && !garbage) s -= 20;
        const fq = this.q <= 4 ? this.q : 4;
        if (!late && this.q < 4 && r.fouls >= fq + 1) s -= 7;
        return s;
      };
      const ranked = avail.map(r => ({ r, s: score(r) })).sort((a, b) => b.s - a.s);
      let pick = ranked.slice(0, 5).map(x => x.r);
      const isG = r => r.p.pos === 'PG' || r.p.pos === 'SG' || r.p.a.hdl >= 72;
      const isB = r => r.p.pos === 'C' || r.p.pos === 'PF' || r.p.hgt >= 208;
      if (!pick.some(isG)) { const c = ranked.slice(5).find(x => isG(x.r)); if (c) pick[4] = c.r; }
      if (!pick.some(isB)) { const c = ranked.slice(5).find(x => isB(x.r)); if (c) pick[pick.length - 1 === 4 && isG(pick[4]) ? 3 : 4] = c.r; }
      this.setCourt(t, pick);
    }

    setCourt(t, pick) {
      const outs = t.court.filter(r => !pick.includes(r));
      const ins = pick.filter(r => !t.court.includes(r));
      if (!outs.length) return;
      for (const r of outs) r.onCourt = false;
      for (const r of ins) r.onCourt = true;
      t.court = pick.slice();
      if (this.live && ins.length) this.say(t.side, `교체: ${ins.map(r => r.nm).join(', ')} 투입 / ${outs.map(r => r.nm).join(', ')} 벤치`, 'sub');
    }

    // 부상 확인(경기 후 리그에서 반영)
    checkInjuries() {
      for (const t of this.T) for (const r of t.court) {
        if (!r.out && Math.random() < 0.00023 * (this.possTick || 1)) {
          r.out = true;
          this.injuries.push(r.p.pid);
          this.say(t.side, `${r.nm} 부상으로 코트를 떠납니다`, 'bad');
        }
      }
    }

    play() {
      let guard = 0;
      while (!this.done && guard++ < 2000) { this.step(); this.checkInjuries(); }
      return this.result();
    }

    // 생중계용: 한 포제션 진행
    next() {
      if (this.done) return null;
      const before = this.log.length;
      this.step(); this.checkInjuries();
      return this.log.slice(before);
    }

    result() {
      const teams = this.T.map(t => ({
        tid: t.tid,
        pts: this.score[t.side],
        q: this.qScore[t.side].slice(),
        players: t.roster.map(r => Object.assign({ pid: r.p.pid, min: Math.round(r.min), gs: r.starter ? 1 : 0 }, r.s)),
        st: t.st,
      }));
      return { teams, ot: Math.max(0, this.q - 4), injuries: this.injuries, lead: this.lead };
    }
  }

  // FM식 평점(게임 스코어 기반, 4.0~10.0)
  function rating(s) {
    if (!s.min) return null;
    const gmsc = s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.orb + 0.3 * s.drb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.tov;
    const perMin = s.min / 60;
    return clamp(6.3 + gmsc / 7 + (s.pm || 0) / 40 - (perMin < 8 ? 0.2 : 0), 3.5, 10);
  }

  HM.Sim = { Game, autoRotation, rating, shortName };
})();
