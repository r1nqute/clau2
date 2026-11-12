'use strict';
// 싸움. 차례를 주고받는다. 저쪽이 무엇을 누구에게 하려는지 기색이 먼저 보이고, 우리 쪽은 저마다 한 수를 고른다.
//   흰 수는 쳐내거나 막는다. 붉은 수는 비킨다. 틈이 보이면 벤다.
// 싸움판은 192x108 칸을 두 배로 그리고, 창과 글자는 그 위에 제 크기로 얹는다.
(function () {
  const G = window.G, TX = G.text, fx = G.fx;
  const INK = '#1b1a1f', PAPER = '#e8e2d0', LIGHT = '#f6f1e3', DIM = '#8e8f8c', GOLD = '#e6cc78', RED = '#cf6a3d', HOT = '#e2714a', MUTE = '#5a5c63', GREEN = '#b8d48a';

  G.josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return w + ((c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0) ? a : b); };
  const J = G.josa;
  // 주인공의 힘은 경지와 칼에서 나온다
  const hero = G.hero = {
    atk: s => Math.round(8 + (s.lv - 1) * 1.2 + [0, 4, 9][s.wlv || 0]),
    def: s => 2 + Math.floor((s.lv - 1) * 0.6),
    spd: s => 8 + Math.floor((s.lv - 1) * 0.4),
    need: lv => 12 + lv * lv * 3,
    gain(s, exp) {
      const out = [];
      s.exp = (s.exp || 0) + exp;
      while (s.exp >= this.need(s.lv)) {
        s.exp -= this.need(s.lv); s.lv++; s.maxhp += 5; s.hp = Math.min(s.maxhp, s.hp + 5);
        out.push('경지가 올랐다. 경지 ' + s.lv + '.');
      }
      return out;
    }
  };
  // 우리 쪽 자리(오른쪽)와 저쪽 자리(왼쪽)
  const PPOS = { 1: [[152, 64]], 2: [[158, 56], [146, 72]], 3: [[160, 60], [146, 46], [148, 74]] };
  const SLOTS = [null, [[56, 62]], [[64, 52], [46, 68]], [[68, 46], [46, 58], [66, 70]]];
  const SUF = ['갑', '을', '병'];
  const CMD_H = ['베기', '비기', '쳐내기', '비키기', '막기', '도구', '보내기', '물러나기'];
  const CMD_A = ['치기', '재주', '쳐내기', '비키기', '막기', '도구'];
  const TIP_H = ['한 칼 벤다. 기가 조금 찬다.', '기를 써서 크게 벤다.', '나를 노린 흰 수 하나를 쳐내고 되친다.', '나를 노린 붉은 수를 비킨다. 기가 찬다.', '무엇이든 덜 아프게 받는다.', '먹거나 마신다. 쓰러진 동료도 일으킨다.', '기가 꺾인 것을 보내 준다.', '싸움에서 물러난다.'];
  const STANCE_TAG = { parry: '쳐내기', guard: '막기', evade: '비키기', cover: '감싸기', door: '문짝', dive: '자맥질' };

  const B = G.battle = {
    active: false, state: '', foes: [], P: [], q: [], cur: null, msg: '', sel: 0, sub: null, ssel: 0, tsel: 0, msel: 0, mi: 0, pick: null, pops: [], round: 0, t: 0,

    start(o) {
      const s = G.s, m = G.world.cur, K = G.FOEK[m.id] || [1, 1, 1, 1];
      Object.assign(this, { active: true, o, state: 'intro', q: [], cur: null, msg: '', sel: 0, sub: null, pops: [], round: 0, t: 0, decoy: 0, decoyHp: 0, used: {}, over: null, free: !!o.first, fog: (m.fog || 0) > 0.5, taunt: null, selM: [] });
      let kinds = o.boss ? [o.boss] : o.group.slice();
      const straw = kinds[0] === 'makiwara';
      // 우리 쪽. 짚단 연습은 혼자 한다.
      const keys = ['hero'].concat(straw ? [] : G.party.active());
      const np = keys.length;
      this.P = keys.map((key, i) => this.member(key, PPOS[np][i]));
      // 저쪽. 우리가 여럿이면 저쪽도 단단해진다.
      if (!o.boss && !straw && np >= 3 && kinds.length < 3 && Math.random() < 0.5) kinds.push(kinds[0]);
      const n = kinds.length, cnt = {};
      for (const k of kinds) cnt[k] = (cnt[k] || 0) + 1;
      const seen = {};
      this.foes = kinds.map((kind, i) => {
        const d = G.FOES[kind], sc = d.boss ? [1, 1, 1, 1] : K, p = SLOTS[n][i];
        const hp = Math.round(d.hp * sc[0] * (d.boss ? 1 + 0.55 * (np - 1) : straw ? 1 : 1 + 0.25 * (np - 1)));
        seen[kind] = (seen[kind] || 0) + 1;
        const f = {
          kind, d, boss: !!d.boss, name: d.name + (cnt[kind] > 1 ? ' ' + SUF[seen[kind] - 1] : ''), hp, mhp: hp, atk: d.atk * sc[1], def: d.def * sc[2], spd: d.spd,
          post: 0, mpost: d.post || 0, exp: Math.round(d.exp * sc[3]), x: p[0], y: p[1], ox: 0, oy: 0, sw: -1, flash: 0, big: d.big, sprKey: d.f || null,
          dead: false, gone: false, yielding: false, broken: 0, ints: [], intent: null, last: null, next: null, phase: 1, t: Math.random() * 3,
          acts: d.boss && np >= 3 ? 2 : 1
        };
        if (d.init) d.init(f);
        return f;
      });
      this.boss = o.boss ? this.foes[0] : null;
      this.practice = straw;
      fx.reset();
      this.bg = o.bg || G.art.cv(G.W, G.H);
      G.music.play(o.boss ? (G.duel.DEFS[o.boss].music || 'duel') : 'duel');
      const names = this.boss ? null : Object.keys(cnt).map(k => G.FOES[k].name + (cnt[k] > 1 ? ' ' + ['', '', '둘', '셋'][cnt[k]] : '')).join(', ');
      this.push(M(this.boss ? this.boss.d.intro : J(names, '이', '가') + ' 길을 막는다.', 0.9, true));
      if (o.first) this.push(M('먼저 쳤다. 한 차례 먼저 움직인다.', 0.8, true));
      if (!s.flags.sawBattle) { s.flags.sawBattle = 1; this.push(M('저쪽의 기색이 위에 먼저 보인다. 흰 수는 쳐내고, 붉은 수는 비키고, 틈이 보이면 벤다.', 2.2, true)); }
      if (np > 1 && !s.flags.sawParty) { s.flags.sawParty = 1; this.push(M('기색 끝에 누구를 노리는지 보인다. 노림받는 쪽이 쳐내거나 비킨다. 기는 모두가 함께 쓴다.', 2.2, true)); }
    },
    member(key, pos) {
      const s = G.s, base = { key, x: pos[0], y: pos[1], ox: 0, oy: 0, sw: -1, flash: 0, stance: null, air: false, stunned: false, down: false, act: null, parried: false, cover: null, t: Math.random() * 3 };
      if (key === 'hero') return Object.assign(base, { hero: true, name: '고려 검객', short: '나', hp: s.hp, mhp: s.maxhp, atk: hero.atk(s), def: hero.def(s), spd: hero.spd(s) });
      const d = G.ALLIES[key], st = G.party.stats(key);
      return Object.assign(base, { d, name: d.name, short: d.name, hp: G.party.hp(key), mhp: st.maxhp, atk: st.atk, def: st.def, spd: st.spd, big: d.big });
    },
    // ---------- 차례 줄 세우기 ----------
    push() { for (const a of arguments) if (a) this.q.push(a); },
    now(arr) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i]) this.q.unshift(arr[i]); },
    say(t, d) { this.q.unshift(M(t, d)); },
    live() { return this.foes.filter(f => !f.dead && !f.gone); },
    up() { return this.P.filter(m => !m.down); },
    get H() { return this.P[0]; },
    hasFakes() { return this.foes.some(f => f.fake && !f.dead); },
    who(m, t) { return m.hero ? t : J(m.name, '이', '가') + ' ' + t; },
    // 구스노키의 짚 인형: 진짜와 섞인다
    fakes(src, n) {
      const sl = SLOTS[3].slice().sort(() => Math.random() - 0.5);
      src.x = sl[0][0]; src.y = sl[0][1];
      for (let i = 0; i < n; i++) this.foes.push(Object.assign({}, src, { fake: true, hp: 1, mhp: 1, x: sl[i + 1][0], y: sl[i + 1][1], life: 3, ints: [], intent: null, t: Math.random() * 3 }));
      this.foes.sort((a, b) => a.y - b.y);
      fx.puff(56, 56, '#e8e2d0', 40, 60); G.sfx('dash');
    },
    // 맞을 때 어떤 자세인가: 막기·받아치기·물러남이 하나라도 있으면 그것
    stanceOf(f) {
      if (f.broken || f.yielding || !f.ints.length) return null;
      for (const it of f.ints) if (it.mv.k === 'g' || it.mv.k === 'c' || it.mv.k === 'e') return it.mv;
      return f.ints[0].mv;
    },
    // 누구를 노리나: 대개 아무나, 가끔은 약한 쪽
    aim() {
      const U = this.up();
      if (!U.length) return 0;
      let m = G.pick(U);
      if (Math.random() < 0.3) m = U.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
      return this.P.indexOf(m);
    },

    // 저쪽이 이번 차례에 무엇을 누구에게 할지 정한다
    plan() {
      this.round++;
      this.attacked = false; this.taunt = null;
      for (const m of this.P) { m.stance = null; m.air = false; m.parried = false; m.cover = null; m.act = null; }
      for (const f of this.live()) {
        f.hid = false; f.ints = [];
        if (f.fake || f.broken || f.yielding || (this.free && this.round === 1)) { f.intent = null; continue; }
        for (let k = 0; k < (f.acts || 1); k++) {
          let id = (k === 0 && f.next) || f.d.ai(f, this);
          if (k === 0) f.next = null;
          if (!f.d.moves[id]) id = Object.keys(f.d.moves)[0];
          const mv = f.d.moves[id];
          if (k > 0 && (mv.k === 'g' || mv.k === 'c' || mv.k === 'e' || mv.k === 'n')) continue;
          f.last = id;
          f.ints.push({ mv, tgt: mv.all ? 'all' : this.aim() });
        }
        f.intent = f.ints[0] ? f.ints[0].mv : null;
        if (this.fog && !f.boss && Math.random() < 0.5) f.hid = true;
      }
      for (const m of this.P) if (!m.down && m.stunned) { m.stunned = false; m.act = { type: 'none' }; }
      this.state = 'cmd'; this.sub = null; this.msg = '';
      this.mi = -1; this.nextMember();
    },
    nextMember() {
      for (let i = this.mi + 1; i < this.P.length; i++) {
        const m = this.P[i];
        if (!m.down && !m.act) { this.mi = i; this.sel = this.selM[i] || 0; this.sub = null; return; }
      }
      this.resolve();
    },
    prevMember() {
      for (let i = this.mi - 1; i >= 0; i--) {
        const m = this.P[i];
        if (!m.down && m.act && m.act.type !== 'none') { m.act = null; this.mi = i; this.sel = this.selM[i] || 0; this.sub = null; G.sfx('move'); return; }
      }
    },
    choose(act) {
      const m = this.P[this.mi];
      m.act = act; this.selM[this.mi] = this.sel;
      if (act.type === 'flee') { for (const o of this.P) if (!o.act) o.act = { type: 'none', quiet: true }; }
      this.nextMember();
    },
    canSpare() { return this.live().some(f => f.yielding); },
    kappa() { return this.live().find(f => f.d.bow && !f.yielding); },
    cmds(m) { return m.hero ? CMD_H : CMD_A; },
    cmdOk(m, i) {
      if (i === 5) return this.items().length > 0;
      if (!m.hero) return true;
      if (i === 6) return !!(this.canSpare() || this.kappa());
      if (i === 7) return !this.boss;
      return true;
    },
    arts() { return G.ART_ORDER.filter(id => id === 'iai' || G.s.skills[id]); },
    skills(m) { return m.d ? m.d.skills : []; },
    skillDef(m, id) { return m.d.skills.find(k => k.id === id); },
    // 그 재주를 지금 쓸 수 있나, 그 사람에게 쓸 수 있나
    mateOk(k, m, t) { return k.who === 'down' ? t.down : !t.down && (k.who === 'any' || t !== m); },
    skillOk(m, k) { return G.s.ki >= k.cost && (k.tgt !== 'mate' || this.P.some(t => this.mateOk(k, m, t))); },
    glow(t) { fx.ring(t.x + t.ox, t.y - 10, 12, GREEN, 0.4); for (let i = 0; i < 6; i++) fx.parts.push({ x: t.x - 6 + Math.random() * 12, y: t.y - 4 - Math.random() * 14, vx: 0, vy: -18 - Math.random() * 14, life: 0.6, col: i % 2 ? GREEN : LIGHT, s: 1 }); },
    items() { const s = G.s; return Object.keys(s.inv).filter(id => s.inv[id] > 0 && (G.ITEMS[id].heal || G.ITEMS[id].ki)); },
    targets() { return this.live(); },

    // ---------- 고른 수를 푼다 ----------
    resolve() {
      const L = this.live().filter(f => !f.fake);
      this.state = 'run'; this.sub = null;
      const acts = [], pre = [];
      for (const m of this.P) {
        const a = m.act;
        if (m.down || !a) continue;
        if (a.type === 'parry' || a.type === 'guard' || a.type === 'evade') m.stance = a.type;
        else if (a.type === 'skill') {
          const k = this.skillDef(m, a.id);
          if (k.stance) { m.stance = k.stance; if (k.stance === 'cover' && a.mate) a.mate.cover = m; if (k.stance === 'door') this.taunt = m; }
          else if (a.id === 'grab') pre.push({ call: () => this.memberTurn(m, a) });
          else acts.push({ spd: m.spd + 0.5, call: () => this.memberTurn(m, a) });
        } else if (a.type !== 'none' || !a.quiet) {
          if (a.type === 'art' && G.ARTS[a.id].air) m.air = true;
          acts.push({ spd: m.spd + 0.5, call: () => this.memberTurn(m, a) });
        }
      }
      for (const f of L) f.ints.forEach((it, k) => acts.push({ spd: f.spd - k * 6, call: () => this.foeTurn(f, k) }));
      acts.sort((a, b) => b.spd - a.spd);
      const st = this.P.filter(m => m.stance && !m.down);
      const SAY = { parry: '칼을 비스듬히 세운다.', guard: '몸을 가린다.', evade: '발을 가볍게 한다.', cover: '동료 앞을 막아선다.', door: '문짝을 세운다.', dive: '몸을 낮춘다.' };
      if (st.length) this.push(M(st.map(m => this.who(m, SAY[m.stance])).join(' '), 0.5));
      for (const c of pre) this.push(c);
      for (const c of acts) this.push(c);
      this.push({ call: () => this.endRound() });
    },
    memberTurn(m, act) {
      const s = G.s;
      if (this.over || m.down) return;
      if (act.type === 'none') { if (!act.quiet) this.now([M(this.who(m, '숨이 막혀 움직이지 못한다.'), 0.7)]); return; }
      if (act.type === 'attack') { this.attacked = true; this.now(this.strike(m, act.target, { pow: 1, post: 8, basic: true })); return; }
      if (act.type === 'art') {
        const a = G.ARTS[act.id];
        if (s.ki < a.cost) { this.attacked = true; this.now([M('기가 모자라 크게 베지 못했다.', 0.6)].concat(this.strike(m, act.target, { pow: 1, post: 8, basic: true }))); return; }
        s.ki -= a.cost;
        if (act.id === 'decoy') { this.decoy = 2; this.decoyHp = 3; G.sfx('dash'); fx.puff(m.x - 16, m.y - 8, '#e6cc78', 12, 40); this.now([M('짚 인형을 세웠다. 저쪽의 눈이 그리로 간다.', 0.8)]); return; }
        this.attacked = true;
        const pre = [M(a.name + '.', 0.45)];
        if (act.id === 'hitotsu') pre.push(A(0.5, () => { G.sfx('focus'); fx.ring(m.x, m.y - 8, 16, GOLD, 0.5); }));
        if (a.all) { this.now(pre.concat(this.sweep(m, a))); return; }
        let seq = pre;
        for (let i = 0; i < (a.hits || 1); i++) seq = seq.concat(this.strike(m, act.target, { pow: a.pow * (i ? 1.15 : 1), post: a.post, heavy: a.heavy || (a.sure && i > 0), far: a.far, art: act.id, air: a.air, gold: true }));
        this.now(seq);
        return;
      }
      if (act.type === 'skill') {
        const k = this.skillDef(m, act.id);
        if (s.ki < k.cost) { this.now([M(this.who(m, '기가 모자라 망설였다.'), 0.6)]); return; }
        s.ki -= k.cost;
        if (act.id === 'feed') {
          G.sfx('eat');
          for (const o of this.up()) { const v = Math.min(o.mhp - o.hp, Math.round(o.mhp * 0.3)); o.hp += v; if (v > 0) this.pop(o.x + o.ox, o.y - 24, '+' + v, GREEN); }
          this.now([M('이소가 망사리를 풀어 갯것을 나눈다. 모두 기운이 난다.', 0.9)]);
          return;
        }
        if (act.id === 'mend') {
          // 고른 이가 그새 쓰러졌으면 가장 다친 산 사람에게
          let t = act.mate && !act.mate.down ? act.mate : null;
          if (!t) t = this.up().slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
          if (!t) return;
          const tx = t === m ? 0 : t.x + 12 - m.x, ty = t === m ? 0 : t.y - m.y;
          this.now([
            A(0.14, null, q => { m.ox = tx * q; m.oy = ty * q; }),
            A(0.36, () => {
              const v = Math.min(t.mhp - t.hp, Math.round(t.mhp * k.pow * (1 + G.party.bond('chiyo') * 0.04)));
              t.hp += v; G.sfx('heal');
              this.pop(t.x + t.ox, t.y - 24, '+' + v, GREEN); this.glow(t);
            }, q => { m.sw = q < 0.5 ? q : 1 - q; }),
            A(0.14, null, q => { m.ox = tx * (1 - q); m.oy = ty * (1 - q); m.sw = -1; }),
            M(t === m ? '치요가 제 상처에 약초를 붙였다.' : '치요가 ' + (t.hero ? '내' : t.name + '의') + ' 상처에 약초를 붙이고 쓸어 준다.', 0.6)
          ]);
          return;
        }
        if (act.id === 'kagura') {
          const U = this.up();
          for (const o of U) o.regen = 3;
          this.now([
            A(0.7, () => G.sfx('suzu'), q => { m.oy = -Math.abs(Math.sin(q * 12.6)) * 3; m.sw = (q * 3) % 1; if (Math.floor(q * 7) !== Math.floor((q - 0.02) * 7)) fx.parts.push({ x: m.x - 6 + Math.random() * 12, y: m.y - 22, vx: (Math.random() - 0.5) * 30, vy: -20, life: 0.5, col: GOLD, s: 1 }); }),
            A(0.25, () => { G.sfx('heal'); for (const o of U) this.glow(o); }, () => { m.oy = 0; m.sw = -1; }),
            M('치요가 방울을 흔들며 돈다. 맑은 소리가 모두를 감싼다. 세 차례 동안 상처가 아문다.', 0.9)
          ]);
          return;
        }
        if (act.id === 'call') {
          const t = act.mate && act.mate.down ? act.mate : this.P.find(o => o.down);
          if (!t) { s.ki = Math.min(s.maxki, s.ki + k.cost); this.now([M('치요가 방울을 쥐었다가 내려놓았다. 부를 사람이 없다.', 0.6)]); return; }
          this.now([
            M('치요가 ' + (t.hero ? '나를' : J(t.name, '을', '를')) + ' 부르며 방울을 흔든다.', 0.6),
            A(0.6, () => G.sfx('suzu'), q => { m.sw = (q * 4) % 1; }),
            A(0.3, () => {
              t.down = false; t.stunned = false; t.hp = Math.round(t.mhp * 0.5); t.flash = 0.2;
              G.sfx('heal'); this.glow(t); this.pop(t.x, t.y - 24, '+' + t.hp, GREEN); m.sw = -1;
            }),
            M((t.hero ? '' : J(t.name, '이', '가') + ' ') + '눈을 떴다. 일어난다.', 0.7)
          ]);
          return;
        }
        if (act.id === 'sweep') { this.attacked = true; this.now([M('도모에의 휘두르기.', 0.45)].concat(this.sweep(m, { pow: k.pow, post: k.post }))); return; }
        if (act.id === 'grab') {
          const f = act.target && !act.target.dead && !act.target.gone ? act.target : this.live()[0];
          if (!f) return;
          const tx = f.x + (f.big ? 26 : 18) - m.x, ty = f.y - m.y, after = [];
          this.now([
            A(0.18, () => G.sfx('dash'), q => { m.ox = tx * q; m.oy = ty * q; }),
            A(0.25, () => {
              G.sfx('thud'); G.game.shake(3); fx.dust(f.x, f.y, 8);
              if (f.fake) { f.dead = true; fx.puff(f.x, f.y - 9, '#e6cc78', 14, 50); after.push(M('붙잡고 보니 짚이다. 구겨서 던졌다.', 0.7)); return; }
              const keep = f.boss ? f.ints.filter(it => it.mv.k !== 'r') : [];
              const cut = f.ints.length - keep.length;
              f.post += f.boss ? 30 : 20;
              if (cut) { f.ints = keep; f.intent = keep[0] ? keep[0].mv : null; after.push(M('아사히나가 ' + J(f.name, '을', '를') + ' 붙잡았다. 수가 끊겼다.', 0.8)); }
              else after.push(M(f.boss ? '아사히나가 붙잡았지만 ' + J(f.name, '이', '가') + ' 빠져나간다. 힘으로 오는 수가 아니다.' : '아사히나가 ' + J(f.name, '을', '를') + ' 흔들어 놓았다.', 0.8));
              this.checkBreak(f, after);
            }),
            A(0.18, null, q => { m.ox = tx * (1 - q); m.oy = ty * (1 - q); }),
            { call: () => this.now(after) }
          ]);
        }
        return;
      }
      if (act.type === 'item') {
        const d = G.ITEMS[act.id], t = act.mate || m;
        if (!(s.inv[act.id] > 0)) { this.now([M('봇짐이 비었다.', 0.6)]); return; }
        s.inv[act.id]--;
        if (d.ki) { s.ki = Math.min(s.maxki, s.ki + d.ki + 1); G.sfx('tea'); this.now([M(this.who(m, J(d.name, '을', '를') + ' 마셨다. 기가 찬다.'), 0.7)]); return; }
        const rise = t.down;
        if (rise) { t.down = false; t.hp = 0; }
        const v = Math.min(t.mhp - t.hp, Math.round(d.heal * (m.key === 'chiyo' ? 1.5 : 1)));
        t.hp += v; G.sfx('eat'); this.pop(t.x + t.ox, t.y - 22, '+' + v, GREEN);
        this.now([M(rise ? J(t.name, '이', '가') + ' ' + J(d.name, '을', '를') + ' 받아먹고 일어났다.' : t === m ? this.who(m, J(d.name, '을', '를') + ' 먹었다.') : t.name + '에게 ' + J(d.name, '을', '를') + ' 먹였다.', 0.7)]);
        return;
      }
      if (act.type === 'spare') {
        const k = this.kappa();
        if (k && !this.canSpare()) {
          k.yielding = true; k.bowed = true; k.ints = []; k.intent = null; G.sfx('splash');
          this.now([M('절을 했다. 갓파가 맞절을 한다.', 0.9), M('머리 접시의 물이 쏟아졌다. 갓파의 기가 꺾였다.', 0.9)]);
          return;
        }
        const ys = this.live().filter(f => f.yielding);
        if (!ys.length) return;
        for (const f of ys) { f.gone = true; f.spared = true; fx.dust(f.x, f.y, 6); }
        G.sfx('dash');
        this.now([M(ys.length > 1 ? '보내 주었다. 뒤돌아보지 않고 간다.' : J(ys[0].name, '을', '를') + ' 보내 주었다.', 0.8)]);
        return;
      }
      if (act.type === 'flee') {
        const top = Math.max.apply(null, this.live().map(f => f.spd));
        if (Math.random() < G.clamp(0.62 + (m.spd - top) * 0.03, 0.35, 0.95)) { this.over = 'fled'; G.sfx('dash'); this.now([M('물러났다.', 0.6)]); }
        else this.now([M('등을 보일 틈이 없다.', 0.7)]);
      }
    },
    // 한 칼. 달려가서 베고 돌아온다.
    strike(m, f, o) {
      const after = [];
      if (!f || f.dead || f.gone) f = this.live()[0];
      if (!f) return [];
      const tx = f.x + (f.big ? 26 : 18) - m.x, ty = f.y - m.y;
      return [
        A(0.15, () => G.sfx('dash'), k => { m.ox = tx * k; m.oy = ty * k - (o.air ? Math.sin(k * 3.14) * 26 : 0); }),
        A(0.16, () => {
          G.sfx(o.art === 'hitotsu' || o.art === 'iai' ? 'cut' : m.key === 'asahina' ? 'hit' : m.key === 'chiyo' ? 'suzu' : 'swing');
          fx.arc(f.x + 4, f.y - 10, 3.14, o.art === 'hitotsu' ? 20 : 13, 2.8, -1, o.gold ? GOLD : LIGHT, 0.2);
          this.hurtFoe(f, m.atk * o.pow, o, after, m);
        }, k => { m.sw = k; }),
        A(0.15, null, k => { m.ox = tx * (1 - k); m.oy = ty * (1 - k); m.sw = -1; }),
        { call: () => this.now(after) }
      ];
    },
    // 앞의 것을 모두(수레걸이, 휘두르기)
    sweep(m, a) {
      const after = [], L = this.live();
      return [
        A(0.15, () => G.sfx('dash'), k => { m.ox = (72 - m.x) * k; m.oy = (60 - m.y) * k; }),
        A(0.34, () => { G.sfx('swing2'); fx.arc(60, 54, 0, 24, 6.2, 1, GOLD, 0.34); G.game.shake(3); for (const f of L) this.hurtFoe(f, m.atk * a.pow, { post: a.post, heavy: true, far: true }, after, m); }, k => { m.sw = (k * 3) % 1; }),
        A(0.15, null, k => { m.ox = (72 - m.x) * (1 - k); m.oy = (60 - m.y) * (1 - k); m.sw = -1; }),
        { call: () => this.now(after) }
      ];
    },
    // 저쪽이 맞는다. m은 친 쪽.
    hurtFoe(f, raw, o, after, m) {
      const s = G.s, sm = this.stanceOf(f), st = sm ? sm.k : 'n';
      if (f.fake) { f.dead = true; fx.puff(f.x, f.y - 9, '#e6cc78', 14, 50); G.sfx('hit'); after.push(M('짚이다.', 0.5)); return; }
      if (st === 'e' && !o.far && !o.counter) { this.pop(f.x, f.y - 26, '닿지 않는다', DIM); return; }
      if (st === 'c' && !o.counter && (sm.void || !o.heavy) && m) {
        // 받아칠 자세에 걸려들었다
        const dmg = Math.max(1, Math.round((f.atk * 1.15 - m.def) * (0.9 + Math.random() * 0.2)));
        fx.spark((f.x + m.x + m.ox) / 2, f.y - 10, 10); G.sfx('parry'); f.struck = true;
        if (!m.air) { this.hurtMember(m, dmg, after); after.unshift(M(J(f.name, '이', '가') + ' 받아넘기고 되친다.', 0.7)); }
        else after.push(M(J(f.name, '이', '가') + ' 받아넘긴다. 칼이 허공을 갈랐다.', 0.7));
        return;
      }
      if (m && m.key === 'tomoe' && f.mounted) raw *= 1.3;
      let dmg = Math.max(1, raw - f.def) * (0.9 + Math.random() * 0.2), post = o.post || 8;
      if (st === 'g' && !o.heavy) { dmg *= 0.45; post += 10; fx.spark(f.x + 6, f.y - 10, 5); G.sfx('clang'); }
      if (st === 'n') post += 8;
      if (f.broken) dmg *= o.art === 'hitotsu' ? 2 : 1.5;
      dmg = Math.round(dmg);
      // 산 것은 한 칼에 죽지 않는다. 기가 꺾일 뿐이다. 꺾인 것을 한 번 더 베면 죽는다.
      const living = !f.boss && !f.d.ghost && !f.d.straw;
      if (living && !f.yielding && dmg >= f.hp) dmg = f.hp - 1;
      f.hp -= dmg; f.flash = 0.18; f.post += post;
      this.pop(f.x + f.ox, f.y + f.oy - (f.big ? 34 : 24), '' + dmg, f.broken ? GOLD : LIGHT);
      fx.puff(f.x, f.y - 9, f.d.ghost ? '#b9d2cc' : LIGHT, 4, 40); G.sfx('hit'); G.game.shake(o.heavy ? 3 : 1.5);
      if (o.basic) s.ki = Math.min(s.maxki, s.ki + (m && !m.hero ? 0.34 : 0.5));
      if (f.boss && f.hp <= 0) { f.hp = 0; this.over = 'win'; f.beaten = true; G.sfx('cut'); fx.flash = 0.2; return; }
      if (f.hp <= 0) {
        f.dead = true; f.killed = living; fx.puff(f.x, f.y - 9, '#8e8f8c', 12, 50); G.sfx('kill');
        after.push(M(f.d.ghost || f.d.straw ? J(f.name, '이', '가') + ' 흩어졌다.' : (m && !m.hero ? J(m.name, '이', '가') + ' ' : '') + J(f.name, '을', '를') + ' 벴다.', 0.6));
        return;
      }
      if (living && !f.yielding && f.hp <= Math.max(1, f.mhp * 0.34)) {
        f.yielding = true; f.ints = []; f.intent = null; G.sfx('stone');
        after.push(M(f.d.human ? J(f.name, '이', '가') + ' 칼을 버렸다. 보내 줄 수도 있다.' : f.name + '의 기가 꺾였다. 보내 줄 수도 있다.', 0.8));
        return;
      }
      if (f.boss && f.phase === 1 && f.hp <= f.mhp * 0.5) {
        f.phase = 2; G.sfx('taiko');
        const t = typeof f.d.onPhase === 'function' ? f.d.onPhase(this, f) : f.d.onPhase;
        if (t) after.push(M(t, 1.1));
      }
      this.checkBreak(f, after);
    },
    checkBreak(f, after) {
      if (!f.mpost || f.broken || f.post < f.mpost || f.dead || f.yielding) return;
      f.broken = 2; f.post = 0; f.ints = []; f.intent = null; G.sfx('brk'); G.game.shake(3); fx.spark(f.x, f.y - 12, 10, GOLD);
      after.push(M(f.name + '의 자세가 무너졌다. 지금이다.', 0.8));
      if (f.d.onBreak) f.d.onBreak({ say: t => after.push(M(t, 0.9)) }, f);
    },
    hurtMember(m, dmg, after) {
      const s = G.s;
      dmg = Math.round(dmg);
      if (dmg <= 0 || m.down) return;
      if (this.practice) { m.flash = 0.2; G.sfx('hit'); this.pop(m.x + m.ox, m.y + m.oy - 24, '(' + dmg + ')', DIM); after.push(M('맞았다. 진짜였으면 ' + dmg + '만큼 아팠다.', 0.8)); return; }
      m.hp -= dmg; m.flash = 0.2; this.pop(m.x + m.ox, m.y + m.oy - 24, '' + dmg, RED); G.sfx('hurt'); G.game.shake(3);
      if (m.hp <= 0) {
        if (m.hero && s.flags.benkei && !this.used.stand) { this.used.stand = 1; m.hp = 1; after.push(M('무릎이 꺾이지 않는다. 벤케이에게서 본 대로 버틴다.', 1)); }
        else {
          m.hp = 0; m.down = true; m.stance = null;
          after.push(M(J(m.name, '이', '가') + ' 쓰러졌다.', 0.8));
          if (!this.up().length) this.over = 'lose';
        }
      }
    },
    // 수를 맞을 사람: 문짝, 감싸기, 쓰러진 사람을 따진다
    victims(it) {
      if (it.tgt === 'all') return this.up();
      let m = this.P[it.tgt];
      if (this.taunt && !this.taunt.down) m = this.taunt;
      else if (m && m.cover && !m.cover.down) m = m.cover;
      if (!m || m.down) { const U = this.up(); m = U.length ? G.pick(U) : null; }
      return m ? [m] : [];
    },
    // 한 사람이 한 수를 받는다
    takeHit(m, f, mv, all, after) {
      const s = G.s;
      const base = Math.max(1, f.atk * mv.pow - m.def) * (0.9 + Math.random() * 0.2) * (all ? 0.8 : 1);
      let dmg = base, line = null;
      const red = mv.k === 'r';
      if (m.air) { dmg = 0; line = '뛰어오른 발밑으로 지나간다.'; }
      else if (this.decoy > 0 && !all) {
        dmg = 0; this.decoyHp--; fx.puff(m.x - 18, m.y - 8, '#e6cc78', 8, 40); G.sfx('hit');
        line = this.decoyHp <= 0 ? '짚 인형이 대신 맞고 흩어졌다.' : '짚 인형이 대신 맞았다.';
        if (this.decoyHp <= 0) this.decoy = 0;
      } else if (m.stance === 'dive') {
        dmg = 0; s.ki = Math.min(s.maxki, s.ki + 0.5); G.sfx('splash'); line = this.who(m, '물에 들듯 비켰다.');
        fx.after(this.mimg(m), m.x - 8, m.y - 17, '#b9d2cc', 0.35);
      } else if (m.stance === 'cover' || m.stance === 'door') {
        dmg = base * (m.stance === 'cover' ? 0.5 : 0.6); fx.spark(m.x - 12, m.y - 10, 5); G.sfx('clang');
        line = this.who(m, m.stance === 'cover' ? '감싸 막았다.' : '문짝으로 받았다.');
      } else if (!red) {
        if (m.stance === 'parry') {
          if (mv.parry === 'first') { dmg = base * (1 - 1 / mv.hits); line = this.who(m, '첫 칼은 쳐냈다. 나머지가 들어온다.'); fx.spark(m.x - 12, m.y - 10, 8); G.sfx('parry'); }
          else if (m.parried) { dmg = base * 0.5; line = '한꺼번에 둘은 쳐내지 못한다.'; G.sfx('clang'); }
          else {
            dmg = 0; m.parried = true; fx.spark(m.x - 12, m.y - 10, 14); fx.ring(m.x - 12, m.y - 10, 9, GOLD, 0.2); G.sfx('parry'); G.game.shake(2);
            s.ki = Math.min(s.maxki, s.ki + 1); if (m.hero) s.parries = (s.parries || 0) + 1;
            line = this.who(m, '쳐냈다. 되받아친다.');
            const ca = [];
            this.hurtFoe(f, m.atk * 1.15, { post: 35 + (mv.reflect || 0), counter: true }, ca, m);
            for (const c of ca) after.push(c);
          }
        } else if (m.stance === 'guard') { dmg = base * (m.hero && s.flags.benkei ? 0.25 : 0.35); fx.spark(m.x - 12, m.y - 10, 5); G.sfx('clang'); line = this.who(m, '막았다.'); }
        else if (m.stance === 'evade') { dmg = base * 0.6; line = this.who(m, '비키려 했지만 스쳤다.'); }
      } else {
        if (m.stance === 'evade') {
          dmg = 0; G.sfx('dash'); f.post += 25; s.ki = Math.min(s.maxki, s.ki + 1); line = this.who(m, '비켰다. 헛친 쪽이 휘청인다.');
          fx.after(this.mimg(m), m.x - 8, m.y - 17, '#b9d2cc', 0.35);
        } else if (m.stance === 'guard') { dmg = base * 0.75; line = '막기에는 무거운 수다.'; G.sfx('clang'); }
        else if (m.stance === 'parry') { dmg = base * 1.1; line = '쳐낼 수 없는 수다.'; }
      }
      if (line) after.push(M(line, 0.55));
      if (dmg > 0) {
        this.hurtMember(m, dmg, after);
        if (mv.stun && !m.down && !this.over) { m.stunned = true; after.push(M(J(m.name, '이', '가') + ' 내던져져 숨이 막힌다.', 0.7)); }
      }
      return dmg > 0;
    },
    // 저쪽의 차례. k는 몇째 수인가.
    foeTurn(f, k) {
      const s = G.s;
      if (this.over || f.dead || f.gone || f.fake) return;
      if (f.broken) { if (k === 0) this.now([M(J(f.name, '은', '는') + ' 아직 몸을 가누지 못한다.', 0.5)]); return; }
      const it = f.ints[k];
      if (!it || f.yielding) return;
      const mv = it.mv;
      if (mv.k === 'c' && mv.void) {
        // 빈 자세 앞에서 아무도 치지 않고 기다렸다
        if (!this.attacked) {
          const after = [M('아무도 치지 않고 기다렸다. 무사시가 한 걸음 물러선다.', 0.9)];
          f.post += 45; s.ki = Math.min(s.maxki, s.ki + 1); fx.ring(f.x, f.y - 8, 14, GOLD, 0.4); G.sfx('chg');
          this.checkBreak(f, after); this.now(after);
        }
        return;
      }
      if (mv.k === 'g' || mv.k === 'c' || mv.k === 'e') return;
      if (mv.k === 'n') { if (mv.act) { this.now([M(J(f.name, '이', '가') + ' ' + mv.tell.split('.')[0] + '.', 0.6), A(0.4, () => mv.act(this, f))]); } return; }
      // 흰 수와 붉은 수
      const V = this.victims(it);
      if (!V.length) return;
      const all = it.tgt === 'all', after = [], red = mv.k === 'r';
      const aimX = all ? 150 : V[0].x, aimY = all ? 60 : V[0].y;
      const tx = aimX - 18 - f.x, ty = aimY - f.y, leap = mv.fx === 'leap', shot = mv.fx === 'shot' || mv.fx === 'gun' || mv.fx === 'log';
      const hit = () => {
        let any = false;
        for (const m of V) if (this.takeHit(m, f, mv, all, after)) any = true;
        if (mv.after) mv.after(this, f, any);
        this.checkBreak(f, after);
      };
      const pre = M(J(f.name, '의', '의') + ' ' + mv.name + (all ? '. 모두를 노린다.' : this.P.length > 1 ? ' → ' + V[0].short + '.' : '.'), 0.4);
      if (shot) {
        this.now([pre, A(0.22, () => G.sfx(mv.fx === 'gun' ? 'gun' : mv.fx === 'log' ? 'thud' : 'bow'), q => { f.sw = q; if (q > 0.4) fx.parts.push({ x: f.x + 10 + (aimX - f.x - 20) * ((q - 0.4) / 0.6), y: f.y - 10 + (aimY - f.y) * ((q - 0.4) / 0.6), vx: 0, vy: 0, life: 0.06, col: red ? HOT : LIGHT, s: 2 }); }),
          A(0.12, hit, null), A(0.1, null, () => { f.sw = -1; }), { call: () => this.now(after) }]);
        return;
      }
      const n = Math.min(3, mv.hits || 1);
      const seq = [pre, A(leap ? 0.3 : 0.16, () => G.sfx(leap ? 'leap' : 'dash'), q => { f.ox = tx * q; f.oy = ty * q - (leap ? Math.sin(q * 3.14) * 30 : 0); })];
      for (let i = 0; i < n; i++) seq.push(A(0.12, i === n - 1 ? () => { G.sfx(red ? 'swing2' : 'swing'); fx.arc(aimX - 6, aimY - 10, 0, all ? 22 : 13, all ? 4 : 2.6, i % 2 ? -1 : 1, red ? HOT : LIGHT, 0.18); hit(); } : () => { G.sfx('swing'); fx.arc(aimX - 6, aimY - 10, 0, 12, 2.4, i % 2 ? -1 : 1, LIGHT, 0.14); }, q => { f.sw = q; }));
      seq.push(A(0.16, null, q => { f.ox = tx * (1 - q); f.oy = ty * (1 - q); f.sw = -1; }), { call: () => this.now(after) });
      this.now(seq);
    },
    endRound() {
      if (this.over) return;
      for (const f of this.foes) {
        if (f.broken > 0) f.broken--;
        if (f.fake && !f.dead && --f.life <= 0) { f.dead = true; fx.puff(f.x, f.y - 9, '#e6cc78', 10, 40); }
        if (f.mpost && !f.broken) f.post = Math.max(0, f.post - 4);
      }
      if (this.decoy > 0 && --this.decoy <= 0) this.now([M('짚 인형이 쓰러졌다.', 0.5)]);
      let rg = false;
      for (const m of this.P) {
        if (!(m.regen > 0)) continue;
        m.regen--;
        if (m.down) continue;
        const v = Math.min(m.mhp - m.hp, Math.round(m.mhp * 0.1));
        if (v > 0) { m.hp += v; this.pop(m.x + m.ox, m.y - 24, '+' + v, GREEN); rg = true; }
      }
      if (rg) { G.sfx('suzu'); this.now([M('방울 소리가 남아 상처가 아문다.', 0.45)]); }
      this.free = false;
    },
    // 줄이 비면 다음으로
    idle() {
      const s = G.s;
      if (this.state === 'done') { this.finish(); return; }
      if (this.over === 'lose') { this.state = 'done'; this.push(M('눈앞이 어두워진다.', 1.1, true)); return; }
      if (this.over === 'fled') { this.state = 'done'; return; }
      if (this.over === 'win' || !this.live().filter(f => !f.fake).length) {
        // 이겼다
        this.over = 'win'; this.state = 'done';
        const b = this.boss;
        let exp = 0, money = 0;
        const drops = [], K = G.FOEK[G.world.cur.id] || [1, 1, 1, 1];
        for (const f of this.foes) {
          if (f.fake) continue;
          exp += f.exp;
          if (f.killed) { if (f.d.money) money += Math.round((f.d.money[0] + Math.random() * (f.d.money[1] - f.d.money[0])) * (0.6 + K[3] * 0.4)); if (f.d.drop && Math.random() < f.d.drop[1]) drops.push(f.d.drop[0]); }
        }
        if (this.practice) { G.sfx('ok'); this.push(M('덴구가 막대를 내려놓는다. "그만하면 됐다."', 1.0, true)); return; }
        G.sfx('win');
        this.push(M(b ? '칼끝이 한 치 앞에서 멎었다. 승부가 났다.' : this.foes.some(f => f.killed) ? '싸움이 끝났다.' : '칼을 거두었다.', 1.0, true));
        let line = '수련 +' + exp;
        if (money) { s.money += money; line += '   돈 +' + money + '문'; }
        for (const id of drops) { s.inv[id] = (s.inv[id] || 0) + 1; line += '   ' + G.ITEMS[id].name; }
        this.push(M(line, 0.9, true));
        if (this.P.some(m => m.key === 'chiyo' && !m.down)) {
          let rose = false;
          for (const m of this.P) { if (m.down) { m.down = false; m.hp = 0; rose = true; } m.hp = Math.min(m.mhp, m.hp + Math.round(m.mhp * 0.12)); }
          this.push(A(0.01, () => G.sfx('suzu')), M('치요가 모두의 상처를 매만졌다.' + (rose ? ' 쓰러졌던 이도 일어난다.' : ''), 0.8, true));
        }
        for (const t of hero.gain(s, exp)) this.push(A(0.01, () => G.sfx('learn')), M(t + ' 체력과 힘이 붙는다.' + (this.P.length > 1 ? ' 동료들도 함께 단련된다.' : ''), 1.0, true));
        return;
      }
      if (this.state === 'intro' || this.state === 'run') this.plan();
    },
    finish() {
      const o = this.o, res = this.over, s = G.s;
      this.active = false; fx.reset();
      // 체력을 돌려 적는다. 쓰러진 이는 겨우 일어난다.
      for (const m of this.P) {
        const hp = m.down ? 1 : Math.max(1, Math.round(m.hp));
        if (m.hero) s.hp = Math.min(s.maxhp, hp);
        else if (s.allies[m.key]) s.allies[m.key].hp = Math.min(G.party.stats(m.key).maxhp, hp);
      }
      o.onEnd(res, this.foes.filter(f => !f.fake));
    },
    pop(x, y, str, col) { this.pops.push({ x: x * 2, y: y * 2, str, col, t: 0 }); },

    // ---------- 한 틱 ----------
    // 화면을 눌렀다(게임 좌표)
    press(x, y) { if (this.active) this.tap = { x, y }; },
    update(dt) {
      const I = G.input, s = G.s;
      this.t += dt;
      fx.update(dt);
      for (const f of this.foes) { f.t += dt; if (f.flash > 0) f.flash -= dt; }
      for (const m of this.P) { m.t += dt; if (m.flash > 0) m.flash -= dt; }
      for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) > 0.9) this.pops.splice(i, 1);
      if (this.cur) {
        const c = this.cur, k = (I.down('a') || I.down('b')) && !c.hold ? 2.4 : 1;
        c.t += dt * k;
        if (c.tick) c.tick(Math.min(1, c.t / c.d));
        if (c.t >= c.d && (!c.hold || c.t > c.d + 2.5 || I.ok() || this.tap)) this.cur = null;
        this.tap = null;
        return;
      }
      if (this.q.length) {
        const c = this.q.shift();
        if (c.call) { c.call(); return; }
        c.t = 0; this.cur = c;
        if (c.msg !== undefined) this.msg = c.msg;
        if (c.on) c.on();
        return;
      }
      if (this.state !== 'cmd') { this.idle(); return; }
      this.input(I, s);
    },
    input(I, s) {
      const m = this.P[this.mi];
      if (!m) return;
      const move = cols => {
        if (I.hit('up')) return -cols; if (I.hit('down')) return cols; if (I.hit('left')) return -1; if (I.hit('right')) return 1; return 0;
      };
      let ok = I.hit('a') || I.hit('b'), back = I.hit('c') || I.hit('d') || I.hit('menu');
      // 손가락으로 누른 자리
      const tp = this.tap; this.tap = null;
      if (tp) {
        const row = Math.floor((tp.y - 152) / 14);
        if (this.sub === 'target' || this.sub === 'mate') {
          const L = this.sub === 'target' ? this.targets() : this.P;
          let bi = -1, bd = 60;
          L.forEach((f, i) => { const im = this.sub === 'target' ? this.sprite(f) : this.mimg(f), d = Math.hypot(tp.x - f.x * 2, tp.y - (f.y * 2 - im.height)); if (d < bd) { bd = d; bi = i; } });
          if (bi >= 0) { if (this.sub === 'target') this.tsel = bi; else this.msel = bi; ok = true; } else back = true;
        } else if (tp.x < 184 && tp.y > 150 && row >= 0 && row < 4) {
          if (!this.sub) { const i = row * 2 + (tp.x > 92 ? 1 : 0); if (i < this.cmds(m).length) { this.sel = i; ok = true; } }
          else { const list = this.subList(m), top = G.clamp(this.ssel - 3, 0, Math.max(0, list.length - 4)); if (top + row < list.length) { this.ssel = top + row; ok = true; } }
        } else if (this.sub) back = true;
        else if (tp.y < 150 && tp.x > 260) back = true;
      }
      if (this.sub === 'target') {
        const L = this.targets(), d = move(1);
        if (d) { this.tsel = (this.tsel + (d > 0 ? 1 : -1) + L.length) % L.length; G.sfx('move'); }
        this.tsel = G.clamp(this.tsel, 0, L.length - 1);
        if (ok) { G.sfx('ok'); const a = this.pick; a.target = L[this.tsel]; this.choose(a); }
        else if (back) { this.sub = this.pick.from || null; G.sfx('move'); }
        return;
      }
      if (this.sub === 'mate') {
        const L = this.P, d = move(1);
        if (d) { this.msel = (this.msel + (d > 0 ? 1 : -1) + L.length) % L.length; G.sfx('move'); }
        const t = L[this.msel], a = this.pick;
        if (ok) {
          if (a.type === 'skill' && !this.mateOk(this.skillDef(m, a.id), m, t)) { G.sfx('deny'); return; }
          if (a.type === 'item' && !t.down && t.hp >= t.mhp) { G.sfx('deny'); return; }
          G.sfx('ok'); a.mate = t; this.choose(a);
        } else if (back) { this.sub = this.pick.from || null; G.sfx('move'); }
        return;
      }
      if (this.sub === 'art' || this.sub === 'skill' || this.sub === 'item') {
        const list = this.subList(m), d = move(1);
        if (d) { this.ssel = (this.ssel + (d > 0 ? 1 : -1) + list.length) % list.length; G.sfx('move'); }
        this.ssel = G.clamp(this.ssel, 0, Math.max(0, list.length - 1));
        if (back) { this.sub = null; G.sfx('move'); return; }
        if (ok && list.length) {
          const id = list[this.ssel];
          if (this.sub === 'item') {
            G.sfx('ok');
            if (G.ITEMS[id].ki) this.choose({ type: 'item', id });
            else this.needMate({ type: 'item', id, from: 'item' }, m);
          } else if (this.sub === 'art') {
            const a = G.ARTS[id];
            if (s.ki < a.cost) { G.sfx('deny'); return; }
            G.sfx('ok');
            if (id === 'decoy' || a.all) this.choose({ type: 'art', id });
            else this.needTarget({ type: 'art', id, from: 'art' });
          } else {
            const k = this.skillDef(m, id);
            if (s.ki < k.cost) { G.sfx('deny'); return; }
            if (!this.skillOk(m, k)) { G.sfx('deny'); return; }
            G.sfx('ok');
            if (k.tgt === 'foe') this.needTarget({ type: 'skill', id, from: 'skill' });
            else if (k.tgt === 'mate') this.needMate({ type: 'skill', id, from: 'skill' }, m);
            else this.choose({ type: 'skill', id });
          }
        }
        return;
      }
      if (back) { this.prevMember(); return; }
      const C = this.cmds(m), d = move(2);
      if (d) { this.sel = (this.sel + d + C.length) % C.length; G.sfx('move'); }
      if (ok) {
        const i = this.sel;
        if (!this.cmdOk(m, i)) { G.sfx('deny'); return; }
        G.sfx('ok');
        if (i === 0) this.needTarget({ type: 'attack' });
        else if (i === 1) { this.sub = m.hero ? 'art' : 'skill'; this.ssel = 0; }
        else if (i === 2) this.choose({ type: 'parry' });
        else if (i === 3) this.choose({ type: 'evade' });
        else if (i === 4) this.choose({ type: 'guard' });
        else if (i === 5) { this.sub = 'item'; this.ssel = 0; }
        else if (i === 6) this.choose({ type: 'spare' });
        else this.choose({ type: 'flee' });
      }
    },
    subList(m) { return this.sub === 'art' ? this.arts() : this.sub === 'skill' ? this.skills(m).map(k => k.id) : this.items(); },
    needTarget(a) {
      const L = this.targets();
      if (L.length === 1) { a.target = L[0]; this.choose(a); return; }
      this.pick = a; this.sub = 'target'; this.tsel = G.clamp(this.tsel, 0, L.length - 1);
    },
    needMate(a, m) {
      if (this.P.length === 1) { a.mate = m; this.choose(a); return; }
      this.pick = a; this.sub = 'mate';
      // 쓰러졌거나 가장 다친 동료를 먼저 가리킨다
      const order = this.P.map((o, i) => [i, o.down ? -1 : o.hp / o.mhp]).sort((x, y) => x[1] - y[1]);
      if (a.type === 'skill') { const k = this.skillDef(m, a.id), f = order.find(([i]) => this.mateOk(k, m, this.P[i])); this.msel = f ? f[0] : 0; }
      else this.msel = order[0][0];
    },

    // ---------- 그리기 ----------
    sprite(f) {
      const S = G.spr, key = f.sprKey;
      if (f.d.img) return S[f.d.img];
      const set = key ? S.f[key] : S[f.d.spr];
      const fr = f.broken || f.yielding ? 0 : Math.floor(f.t * (f.d.fly ? 8 : 2.2)) % 2;
      return set.r[fr];
    },
    mimg(m) {
      const S = G.spr;
      if (m.hero) return S.player.left[0];
      return S.f[m.d.spr].l[m.down ? 0 : Math.floor(m.t * 2.2) % 2];
    },
    drawMember(ctx, m) {
      const S = G.spr, x = Math.round(m.x + m.ox), y = Math.round(m.y + m.oy);
      G.E.shadow(ctx, m.x + m.ox, m.y + (m.oy > 0 ? m.oy : m.oy * 0.2) - 1, m.big ? 20 : 12);
      if (m.hero && this.decoy > 0) ctx.drawImage(S.dummy, m.x - 26, m.y - S.dummy.height + 1);
      let img = this.mimg(m);
      if (m.down) { ctx.save(); ctx.translate(x, y - 5); ctx.rotate(-1.5708); ctx.drawImage(img, -(img.width >> 1), -(img.height >> 1) + 2); ctx.restore(); return; }
      if (m.flash > 0) img = G.art.white(img);
      const st = this.state === 'run' ? m.stance : null;
      const wpn = m.hero ? 'kal' : m.d.wpn;
      let a = 3.84, ex = 0;
      if (m.sw >= 0) a = 5.0 - m.sw * 2.8;
      else if (st === 'parry') a = -1.9; else if (st === 'guard' || st === 'cover') a = -1.5708; else if (st === 'evade' || st === 'dive') { a = 2.5; ex = 2; }
      else if (wpn === 'nagi') a = -1.95;
      const hy = y - (m.big ? 12 : 8), hx = x - (m.big ? 8 : 3);
      const back = Math.sin(a) < -0.25;
      if (wpn && back) fx.blade(ctx, hx, hy, a, wpn);
      ctx.drawImage(img, x - (img.width >> 1) + ex, y - img.height + 1 + (st === 'guard' || st === 'dive' ? 1 : 0));
      if (wpn && !back) fx.blade(ctx, hx, hy, a, wpn);
      if (st === 'door') ctx.drawImage(S.door, x - 22, y - 26, 15, 20);
    },
    draw(ctx, time) {
      const S = G.spr;
      ctx.drawImage(this.bg, 0, 0);
      ctx.fillStyle = 'rgba(12,11,15,0.42)'; ctx.fillRect(0, 0, G.W, G.H);
      ctx.fillStyle = 'rgba(232,226,208,0.07)'; ctx.fillRect(0, 84, G.W, 62);
      ctx.fillStyle = 'rgba(12,11,15,0.25)'; ctx.fillRect(0, 84, G.W, 1); ctx.fillRect(0, 146, G.W, 1);
      // 싸움판: 두 배
      ctx.save(); ctx.scale(2, 2);
      fx.drawUnder(ctx, 0, 0);
      const things = this.live().map(f => ({ f, y: f.y + f.oy })).concat(this.P.map(m => ({ m, y: m.y + m.oy })));
      things.sort((a, b) => a.y - b.y);
      for (const o of things) {
        if (o.m) { this.drawMember(ctx, o.m); continue; }
        const f = o.f;
        const x = Math.round(f.x + f.ox + (f.broken ? (Math.floor(time * 24) % 2 ? 1 : -1) : 0)), y = Math.round(f.y + f.oy);
        let img = this.sprite(f);
        if (!f.d.fly) G.E.shadow(ctx, f.x + f.ox, f.y - 1, f.big ? 22 : 12);
        if (f.flash > 0) img = G.art.white(img);
        if (f.d.ghost) ctx.globalAlpha = 0.75;
        const wp = f.d.wpn && !f.yielding ? f.d.wpn : null;
        let a = f.sw >= 0 ? -2.2 + f.sw * 3.2 : f.broken ? 1.9 : -0.9;
        if (f.intent && f.sw < 0 && this.state === 'cmd') a = f.intent.k === 'r' ? -1.9 : f.intent.k === 'g' ? -1.5708 : f.intent.k === 'c' ? 1.2 : a;
        const hx = x + (f.big ? 9 : 4), hy = y - (f.big ? 13 : 8) + (f.d.fly ? -8 : 0);
        const back = Math.sin(a) < -0.25;
        const wdraw = () => { if (!wp) return; if (wp === 'bow') fx.bow(ctx, hx + 2, hy, 0, f.sw >= 0 ? 1 - f.sw : 0); else fx.blade(ctx, hx, hy, wp === 'gun' ? 0.1 : a, wp); };
        if (back) wdraw();
        ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 + (f.d.fly ? -8 + Math.round(Math.sin(f.t * 5) * 2) : 0) + (f.yielding ? 1 : 0));
        if (f.fake) { ctx.globalAlpha = 0.3; ctx.drawImage(G.art.tint(img, '#d7bd6c'), x - (img.width >> 1), y - img.height + 1); ctx.globalAlpha = 1; }
        if (!back) wdraw();
        if (f.d.wpn2 && (f.phase === 2 || f.kind === 'musashiOld')) fx.blade(ctx, x - 4, y - 8, 2.3, f.d.wpn2);
        if (f.d.prop2 && f.phase === 2) ctx.drawImage(S[f.d.prop2], x + 8, y - 34, 15, 20);
        ctx.globalAlpha = 1;
        if (f.yielding) { ctx.fillStyle = '#b9d2cc'; if (Math.floor(time * 5) % 2) { ctx.fillRect(x + 7, y - 20, 1, 2); ctx.fillRect(x + 9, y - 17, 1, 2); } }
        if (f.broken) { ctx.fillStyle = GOLD; for (let i = 0; i < 3; i++) { const an = time * 7 + i * 2.1; ctx.fillRect(Math.round(x + Math.cos(an) * 7), Math.round(y - (f.big ? 32 : 22) + Math.sin(an) * 2), 1, 1); } }
      }
      fx.draw(ctx, 0, 0);
      ctx.restore();

      // 기색과 몸 줄
      for (const f of this.live()) {
        const x = Math.round((f.x + f.ox) * 2), y = Math.round((f.y + f.oy) * 2), top = Math.max((this.topH || 30) + 7, y - this.sprite(f).height * 2 - (f.d.fly ? 24 : 9));
        if (!f.boss && !f.fake) {
          ctx.fillStyle = INK; ctx.fillRect(x - 13, y + 5, 26, 4);
          ctx.fillStyle = f.yielding ? '#7fa9b0' : RED; ctx.fillRect(x - 12, y + 6, Math.max(0, Math.round(24 * f.hp / f.mhp)), 2);
        }
        if (this.state !== 'cmd') continue;
        const src = f.fake ? this.foes.find(o => !o.fake && o.kind === f.kind) : f;
        if (!src || !src.ints.length) continue;
        src.ints.forEach((it, j) => {
          const mv = it.mv, k = f.hid ? '?' : (mv.show || mv.k), xx = x + (src.ints.length > 1 ? (j ? 8 : -8) : 0);
          if (k === 'w' || k === 'r') fx.glint(ctx, xx, top, k === 'r', time);
          else if (k === '?') TX.drawS(ctx, '?', xx, top - 7, DIM, 'big', 1);
          else if (k === 'g' || k === 'c') { ctx.fillStyle = INK; ctx.fillRect(xx - 5, top - 5, 11, 11); ctx.fillStyle = k === 'c' ? GOLD : PAPER; ctx.fillRect(xx - 4, top - 4, 9, 1); ctx.fillRect(xx - 4, top + 4, 9, 1); ctx.fillRect(xx - 4, top - 4, 1, 9); ctx.fillRect(xx + 4, top - 4, 1, 9); if (k === 'c') ctx.fillRect(xx - 1, top - 1, 3, 3); }
          else { ctx.fillStyle = INK; ctx.fillRect(xx - 6, top - 1, 13, 4); ctx.fillStyle = DIM; ctx.fillRect(xx - 5, top, 2, 2); ctx.fillRect(xx - 1, top, 2, 2); ctx.fillRect(xx + 3, top, 2, 2); }
        });
      }
      const arrow = (x, y, col) => { ctx.fillStyle = INK; ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 4, y + 2, 9, 2); ctx.fillRect(x - 2, y + 4, 5, 2); ctx.fillStyle = col; ctx.fillRect(x - 4, y, 9, 2); ctx.fillRect(x - 2, y + 2, 5, 2); ctx.fillRect(x, y + 4, 1, 1); };
      const bob = Math.floor(time * 4) % 2;
      if (this.state === 'cmd') {
        if (this.sub === 'target') { const f = this.targets()[this.tsel]; if (f) arrow(Math.round(f.x * 2), Math.round(f.y * 2) - this.sprite(f).height * 2 - 26 + bob, GOLD); }
        else if (this.sub === 'mate') { const m = this.P[this.msel]; if (m) arrow(Math.round(m.x * 2), Math.round(m.y * 2) - this.mimg(m).height * 2 - 12 + bob, GREEN); }
        else { const m = this.P[this.mi]; if (m && this.P.length > 1) arrow(Math.round(m.x * 2), Math.round(m.y * 2) - this.mimg(m).height * 2 - 12 + bob, GOLD); }
      } else if (this.state === 'run') {
        for (const m of this.P) if (m.stance && !m.down && STANCE_TAG[m.stance]) TX.drawS(ctx, STANCE_TAG[m.stance], Math.round(m.x * 2) + (m.big ? 22 : 16), Math.round(m.y * 2) - 26, GOLD, 'small');
      }
      for (const p of this.pops) {
        if (p.t > 0.7 && Math.floor(p.t * 30) % 2) continue;
        TX.drawS(ctx, p.str, p.x, p.y - Math.min(14, p.t * 40), p.col, 'big', 1);
      }
      this.windows(ctx, time);
    },
    windows(ctx, time) {
      const s = G.s, P = G.ui.panel, b = this.boss, cm = this.state === 'cmd' ? this.P[this.mi] : null;
      // 위: 저쪽의 기색. 지금 고르는 사람을 노린 것에는 표를 단다.
      if (this.state === 'cmd') {
        const L = this.live().filter(f => !f.fake), lines = [], party = this.P.length > 1;
        for (const f of L) {
          const head = L.length > 1 || this.hasFakes() || f.ints.length > 1 ? f.name + ' — ' : '';
          if (f.yielding) { lines.push([head + (f.d.human ? '칼을 버리고 물러서려 한다' : '기가 꺾여 물러서려 한다'), '#7fa9b0']); continue; }
          if (f.broken) { lines.push([head + '몸을 가누지 못한다. 틈이다', GOLD]); continue; }
          if (!f.ints.length) { lines.push([head + '아직 움직이지 않는다', DIM]); continue; }
          if (f.hid) { lines.push([head + '안개 때문에 기색이 보이지 않는다', DIM]); continue; }
          f.ints.forEach(it => {
            const mv = it.mv, k = mv.show || mv.k, col = k === 'r' ? HOT : k === 'w' ? LIGHT : k === 'n' ? GREEN : GOLD;
            const atk = k === 'w' || k === 'r';
            const tgt = atk && party ? (it.tgt === 'all' ? ' → 모두' : ' → ' + this.P[it.tgt].short) : '';
            const mine = atk && party && cm && (it.tgt === 'all' || this.P[it.tgt] === cm);
            for (const ln of TX.wrap(head + mv.tell + tgt, mine ? 356 : 366, 'small')) lines.push([ln, col, mine]);
          });
        }
        const legend = lines.length <= 2, h = lines.length * 11 + (legend ? 19 : 8) + (b ? 13 : 0);
        this.topH = h + 3;
        P(ctx, 4, 3, 376, h);
        if (b) {
          // 맞수의 몸과 자세는 기색 창 맨 아래 줄에
          const y = h - (legend ? 24 : 13);
          TX.draw(ctx, G.duel.DEFS[b.kind].kanji + ' ' + b.name, 10, y, LIGHT, 'small');
          ctx.fillStyle = INK; ctx.fillRect(149, y + 3, 108, 6); ctx.fillStyle = '#7a2a24'; ctx.fillRect(150, y + 4, 106, 4);
          ctx.fillStyle = RED; ctx.fillRect(150, y + 4, Math.max(0, Math.round(106 * b.hp / b.mhp)), 4);
          const pf = b.broken ? 1 : Math.min(1, b.post / b.mpost);
          ctx.fillStyle = INK; ctx.fillRect(289, y + 4, 82, 4); ctx.fillStyle = b.broken ? LIGHT : GOLD; ctx.fillRect(290, y + 5, Math.round(80 * pf), 2);
          TX.draw(ctx, '자세', 286, y, DIM, 'small', 2);
        }
        lines.forEach((l, i) => {
          if (l[2]) { ctx.fillStyle = GOLD; ctx.fillRect(9, 9 + i * 11, 2, 5); ctx.fillRect(11, 10 + i * 11, 1, 3); }
          TX.draw(ctx, l[0], l[2] ? 16 : 10, 6 + i * 11, l[1], 'small');
        });
        if (legend) TX.draw(ctx, '흰 수: 쳐내기·막기    붉은 수: 비키기    틈: 베기', 10, h - 9, DIM, 'small');
      }
      if (b && this.state !== 'cmd') {
        const w = 140, x = 372 - w, y = 18, mid = x + w / 2;
        TX.drawS(ctx, G.duel.DEFS[b.kind].kanji + '  ' + b.name, 372, y - 13, LIGHT, 'small', 2);
        ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.fillStyle = '#7a2a24'; ctx.fillRect(x, y, w, 4);
        ctx.fillStyle = RED; ctx.fillRect(x, y, Math.max(0, Math.round(w * b.hp / b.mhp)), 4);
        const pf = b.broken ? 1 : Math.min(1, b.post / b.mpost), half = Math.round(50 * pf);
        ctx.fillStyle = INK; ctx.fillRect(mid - 51, y + 6, 102, 4); ctx.fillStyle = b.broken ? LIGHT : GOLD; ctx.fillRect(mid - half, y + 7, half * 2, 2);
      }
      // 아래 왼쪽: 고를 것 또는 벌어지는 일
      P(ctx, 4, 150, 178, 62);
      const cur = (x, y, on) => { ctx.fillStyle = GOLD; const o = on ? 0 : 1; ctx.fillRect(x - 6 + o, y + 3, 1, 7); ctx.fillRect(x - 5 + o, y + 4, 1, 5); ctx.fillRect(x - 4 + o, y + 5, 1, 3); ctx.fillRect(x - 3 + o, y + 6, 1, 1); };
      if (cm) {
        if (this.P.length > 1) { const w = TX.width(cm.name, 'small') + 12; P(ctx, 8, 139, w, 15); TX.draw(ctx, cm.name, 14, 141, GOLD, 'small'); }
        if (!this.sub) {
          const C = this.cmds(cm);
          for (let i = 0; i < C.length; i++) {
            const x = 14 + (i % 2) * 84, y = 154 + (i >> 1) * 14, on = this.cmdOk(cm, i);
            let name = C[i];
            if (cm.hero && i === 6 && this.kappa() && !this.canSpare()) name = '절하기';
            if (!cm.hero && i === 0) name = cm.d.atkName;
            if (i === this.sel) cur(x, y, Math.floor(time * 3) % 2 === 0);
            TX.draw(ctx, name, x, y, !on ? MUTE : i === this.sel ? LIGHT : PAPER);
          }
          if (!cm.hero) TX.draw(ctx, G.touch ? '빈 곳을 누르면 앞 사람으로' : 'C: 앞 사람으로', 14, 196, MUTE, 'small');
        } else if (this.sub === 'art' || this.sub === 'skill' || this.sub === 'item') {
          const list = this.subList(cm), top = G.clamp(this.ssel - 3, 0, Math.max(0, list.length - 4));
          for (let i = top; i < Math.min(list.length, top + 4); i++) {
            const id = list[i], y = 154 + (i - top) * 14;
            let nm, r, ok = true;
            if (this.sub === 'art') { nm = G.ARTS[id].name; r = '기 ' + G.ARTS[id].cost; ok = s.ki >= G.ARTS[id].cost; }
            else if (this.sub === 'skill') { const k = this.skillDef(cm, id); nm = k.name; r = k.cost ? '기 ' + k.cost : k.stance ? '자세' : '—'; ok = this.skillOk(cm, k); }
            else { nm = G.ITEMS[id].name; r = '' + s.inv[id]; }
            if (i === this.ssel) cur(14, y, true);
            TX.draw(ctx, nm, 16, y, !ok ? MUTE : i === this.ssel ? LIGHT : PAPER); TX.draw(ctx, r, 174, y, ok ? GOLD : MUTE, 'big', 2);
          }
        } else if (this.sub === 'target') {
          const f = this.targets()[this.tsel];
          TX.draw(ctx, '누구를?', 12, 155, DIM);
          if (f) TX.draw(ctx, f.name, 12, 171, LIGHT);
        } else if (this.sub === 'mate') {
          const t = this.P[this.msel];
          const pk = this.pick.type === 'skill' ? this.skillDef(cm, this.pick.id) : null;
          TX.draw(ctx, !pk ? '누구에게?' : pk.who === 'down' ? '누구를 부를까?' : pk.who === 'any' ? '누구를 돌볼까?' : '누구 앞을?', 12, 155, DIM);
          if (t) TX.draw(ctx, t.name + (t.down ? ' (쓰러짐)' : ''), 12, 171, LIGHT);
        }
      } else {
        const lines = TX.wrap(this.msg || '', 164, 'big');
        for (let i = 0; i < Math.min(4, lines.length); i++) TX.draw(ctx, lines[i], 11, 154 + i * 14, LIGHT);
        if (this.cur && this.cur.hold && this.cur.t >= this.cur.d && Math.floor(time * 2.5) % 2) { ctx.fillStyle = GOLD; ctx.fillRect(168, 203, 7, 1); ctx.fillRect(169, 204, 5, 1); ctx.fillRect(170, 205, 3, 1); ctx.fillRect(171, 206, 1, 1); }
      }
      // 아래 오른쪽: 우리 쪽, 또는 고르는 것의 풀이
      P(ctx, 186, 150, 194, 62);
      const desc = t => TX.wrap(t, 180, 'small').slice(0, 5).forEach((ln, i) => TX.draw(ctx, ln, 194, 154 + i * 11, PAPER, 'small'));
      if (cm && this.sub === 'art') { const a = G.ARTS[this.arts()[this.ssel]]; if (a) desc(a.desc); return; }
      if (cm && this.sub === 'skill') { const k = this.skillDef(cm, this.subList(cm)[this.ssel]); if (k) desc(k.desc); return; }
      if (cm && this.sub === 'item') { const d = G.ITEMS[this.items()[this.ssel]]; if (d) desc(d.ki ? '기가 찬다(싸움 중에는 두 칸).' : '체력이 ' + d.heal + ' 오른다. 쓰러진 동료에게 먹이면 일어난다.'); return; }
      G.ui.kiPips(ctx, 194, 155);
      TX.draw(ctx, '경지 ' + s.lv, 372, 152, PAPER, 'small', 2);
      const rows = this.P.length, rh = rows === 1 ? 20 : rows === 2 ? 17 : 14, y0 = rows === 1 ? 170 : 167;
      this.P.forEach((m, i) => {
        const y = y0 + i * rh;
        TX.draw(ctx, rows === 1 ? '고려 검객' : m.short, 194, y, m.down ? MUTE : m === cm ? GOLD : PAPER, rows === 1 ? 'big' : 'small');
        const bx = rows === 1 ? 262 : 232, bw = rows === 1 ? 64 : 88, by = y + (rows === 1 ? 4 : 2);
        ctx.fillStyle = INK; ctx.fillRect(bx - 1, by, bw + 2, 6); ctx.fillStyle = '#33303a'; ctx.fillRect(bx, by + 1, bw, 4);
        ctx.fillStyle = m.hp <= m.mhp * 0.3 ? RED : GREEN; ctx.fillRect(bx, by + 1, Math.max(0, Math.round(bw * m.hp / m.mhp)), 4);
        TX.draw(ctx, m.down ? '쓰러짐' : Math.max(0, Math.round(m.hp)) + '/' + m.mhp, 372, y, m.down ? RED : LIGHT, 'small', 2);
      });
      if (cm && !this.sub && rows === 1) TX.draw(ctx, this.sel === 7 && b ? '승부에서 등을 보일 수는 없다.' : TIP_H[this.sel], 194, 196, DIM, 'small');
    }
  };
  // 줄에 세우는 것: 한마디, 움직임
  function M(msg, d, hold) { return { msg, d: d || 0.6, hold: !!hold, t: 0 }; }
  function A(d, on, tick) { return { d, on, tick, t: 0 }; }
})();
