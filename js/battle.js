'use strict';
// 싸움. 차례를 주고받는다. 저쪽이 무엇을 하려는지 기색이 먼저 보이고, 거기에 맞춰 한 수를 고른다.
//   흰 수는 쳐내거나 막는다. 붉은 수는 비킨다. 틈이 보이면 벤다.
// 싸움판은 192x108 칸을 두 배로 그리고, 창과 글자는 그 위에 제 크기로 얹는다.
(function () {
  const G = window.G, TX = G.text, fx = G.fx;
  const INK = '#1b1a1f', PAPER = '#e8e2d0', LIGHT = '#f6f1e3', DIM = '#8e8f8c', GOLD = '#e6cc78', RED = '#cf6a3d', HOT = '#e2714a';

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
  const HX = 152, HY = 64;
  const SLOTS = [null, [[56, 62]], [[64, 52], [46, 68]], [[68, 46], [46, 58], [66, 70]]];
  const SUF = ['갑', '을', '병'];
  const CMD = ['베기', '비기', '쳐내기', '비키기', '막기', '도구', '보내기', '물러나기'];

  const B = G.battle = {
    active: false, state: '', foes: [], q: [], cur: null, msg: '', sel: 0, sub: null, ssel: 0, tsel: 0, pick: null, pops: [], round: 0, t: 0,

    start(o) {
      const s = G.s, m = G.world.cur, K = G.FOEK[m.id] || [1, 1, 1, 1];
      Object.assign(this, { active: true, o, state: 'intro', q: [], cur: null, msg: '', sel: 0, sub: null, pops: [], round: 0, t: 0, decoy: 0, decoyHp: 0, used: {}, over: null, free: !!o.first, fog: (m.fog || 0) > 0.5 });
      const kinds = o.boss ? [o.boss] : o.group, n = kinds.length, cnt = {};
      for (const k of kinds) cnt[k] = (cnt[k] || 0) + 1;
      const seen = {};
      this.foes = kinds.map((kind, i) => {
        const d = G.FOES[kind], sc = d.boss ? [1, 1, 1, 1] : K, p = SLOTS[n][i];
        const hp = Math.round(d.hp * sc[0]);
        seen[kind] = (seen[kind] || 0) + 1;
        const f = {
          kind, d, boss: !!d.boss, name: d.name + (cnt[kind] > 1 ? ' ' + SUF[seen[kind] - 1] : ''), hp, mhp: hp, atk: d.atk * sc[1], def: d.def * sc[2], spd: d.spd,
          post: 0, mpost: d.post || 0, exp: Math.round(d.exp * sc[3]), x: p[0], y: p[1], ox: 0, oy: 0, sw: -1, flash: 0, big: d.big, sprKey: d.f || null,
          dead: false, gone: false, yielding: false, broken: 0, intent: null, last: null, next: null, phase: 1, t: Math.random() * 3
        };
        if (d.init) d.init(f);
        return f;
      });
      this.boss = o.boss ? this.foes[0] : null;
      this.practice = this.foes.some(f => f.d.practice);
      this.H = { x: HX, y: HY, ox: 0, oy: 0, sw: -1, flash: 0, stance: null, air: false, stunned: false };
      fx.reset();
      this.bg = o.bg || G.art.cv(G.W, G.H);
      G.music.play(o.boss ? (G.duel.DEFS[o.boss].music || 'duel') : 'duel');
      const names = this.boss ? null : Object.keys(cnt).map(k => G.FOES[k].name + (cnt[k] > 1 ? ' ' + ['', '', '둘', '셋'][cnt[k]] : '')).join(', ');
      this.push(M(this.boss ? this.boss.d.intro : J(names, '이', '가') + ' 길을 막는다.', 0.9, true));
      if (o.first) this.push(M('먼저 쳤다. 한 차례 먼저 움직인다.', 0.8, true));
      if (!s.flags.sawBattle) { s.flags.sawBattle = 1; this.push(M('저쪽의 기색이 위에 먼저 보인다. 흰 수는 쳐내고, 붉은 수는 비키고, 틈이 보이면 벤다.', 2.2, true)); }
    },
    // ---------- 차례 줄 세우기 ----------
    push() { for (const a of arguments) if (a) this.q.push(a); },
    now(arr) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i]) this.q.unshift(arr[i]); },
    say(t, d) { this.q.unshift(M(t, d)); },
    live() { return this.foes.filter(f => !f.dead && !f.gone); },
    hasFakes() { return this.foes.some(f => f.fake && !f.dead); },
    // 구스노키의 짚 인형: 진짜와 섞인다
    fakes(src, n) {
      const sl = SLOTS[3].slice().sort(() => Math.random() - 0.5);
      src.x = sl[0][0]; src.y = sl[0][1];
      for (let i = 0; i < n; i++) this.foes.push(Object.assign({}, src, { fake: true, hp: 1, mhp: 1, x: sl[i + 1][0], y: sl[i + 1][1], life: 3, intent: null, t: Math.random() * 3 }));
      this.foes.sort((a, b) => a.y - b.y);
      fx.puff(56, 56, '#e8e2d0', 40, 60); G.sfx('dash');
    },

    // 저쪽이 이번 차례에 무엇을 할지 정한다
    plan() {
      this.round++;
      const H = this.H;
      H.stance = null; H.air = false; this.parried = false; this.attacked = false;
      for (const f of this.live()) {
        f.hid = false;
        if (f.fake) { f.intent = null; continue; }
        if (f.broken || f.yielding || (this.free && this.round === 1)) { f.intent = null; continue; }
        let id = f.next || f.d.ai(f, this);
        f.next = null;
        if (!f.d.moves[id]) id = Object.keys(f.d.moves)[0];
        f.intent = f.d.moves[id]; f.last = id;
        if (this.fog && !f.boss && Math.random() < 0.5) f.hid = true;
      }
      this.state = 'cmd'; this.sub = null; this.msg = '';
      if (H.stunned) { H.stunned = false; this.pickAct({ type: 'none' }); }
    },
    canSpare() { return this.live().some(f => f.yielding); },
    kappa() { return this.live().find(f => f.d.bow && !f.yielding); },
    cmdOk(i) {
      const s = G.s;
      if (i === 6) return !!(this.canSpare() || this.kappa());
      if (i === 7) return !this.boss;
      if (i === 5) return Object.keys(s.inv).some(id => s.inv[id] > 0 && (G.ITEMS[id].heal || G.ITEMS[id].ki));
      return true;
    },
    arts() { return G.ART_ORDER.filter(id => id === 'iai' || G.s.skills[id]); },
    items() { const s = G.s; return Object.keys(s.inv).filter(id => s.inv[id] > 0 && (G.ITEMS[id].heal || G.ITEMS[id].ki)); },
    targets() { return this.live(); },

    // ---------- 고른 수를 푼다 ----------
    pickAct(act) {
      const s = G.s, H = this.H, L = this.live().filter(f => !f.fake);
      this.state = 'run'; this.sub = null; this.act = act;
      if (act.type === 'parry' || act.type === 'guard' || act.type === 'evade') H.stance = act.type;
      if (act.type === 'art' && G.ARTS[act.id].air) H.air = true;
      const hs = hero.spd(s);
      const fast = L.filter(f => f.spd > hs).sort((a, b) => b.spd - a.spd), slow = L.filter(f => f.spd <= hs).sort((a, b) => b.spd - a.spd);
      if (H.stance) this.push(M({ parry: '칼을 비스듬히 세운다. 오는 칼을 기다린다.', guard: '칼을 세워 몸을 가린다.', evade: '발을 가볍게 한다.' }[H.stance], 0.5));
      for (const f of fast) this.push({ call: () => this.foeTurn(f) });
      this.push({ call: () => this.heroTurn(act) });
      for (const f of slow) this.push({ call: () => this.foeTurn(f) });
      this.push({ call: () => this.endRound() });
    },
    heroTurn(act) {
      const s = G.s, H = this.H;
      if (this.over) return;
      if (act.type === 'none') { this.now([M('숨이 막혀 움직이지 못한다.', 0.7)]); return; }
      if (act.type === 'attack') { this.attacked = true; this.now(this.strike(act.target, { pow: 1, post: 8, basic: true })); return; }
      if (act.type === 'art') {
        const a = G.ARTS[act.id];
        s.ki -= a.cost;
        if (act.id === 'decoy') { this.decoy = 2; this.decoyHp = 3; G.sfx('dash'); fx.puff(HX - 16, HY - 8, '#e6cc78', 12, 40); this.now([M('짚 인형을 세웠다. 저쪽의 눈이 그리로 간다.', 0.8)]); return; }
        this.attacked = true;
        const pre = [M(a.name + '.', 0.45)];
        if (act.id === 'hitotsu') pre.push(A(0.5, () => { G.sfx('focus'); fx.ring(HX, HY - 8, 16, GOLD, 0.5); }));
        if (a.all) { this.now(pre.concat(this.sweep(a))); return; }
        let seq = pre;
        for (let i = 0; i < (a.hits || 1); i++) seq = seq.concat(this.strike(act.target, { pow: a.pow * (i ? 1.15 : 1), post: a.post, heavy: a.heavy || (a.sure && i > 0), far: a.far, art: act.id, air: a.air, gold: true }));
        this.now(seq);
        return;
      }
      if (act.type === 'item') {
        const d = G.ITEMS[act.id];
        s.inv[act.id]--;
        if (d.ki) { s.ki = Math.min(s.maxki, s.ki + d.ki + 1); G.sfx('tea'); this.now([M(d.name + '를 마셨다. 기가 찬다.', 0.7)]); }
        else { const v = Math.min(s.maxhp - s.hp, d.heal); s.hp += v; G.sfx('eat'); this.pop(HX, HY - 22, '+' + v, '#b8d48a'); this.now([M(J(d.name, '을', '를') + ' 먹었다.', 0.7)]); }
        return;
      }
      if (act.type === 'spare') {
        const k = this.kappa();
        if (k && !this.canSpare()) {
          k.yielding = true; k.bowed = true; k.intent = null; G.sfx('splash');
          this.now([M('절을 했다. 갓파가 맞절을 한다.', 0.9), M('머리 접시의 물이 쏟아졌다. 갓파의 기가 꺾였다.', 0.9)]);
          return;
        }
        const ys = this.live().filter(f => f.yielding);
        for (const f of ys) { f.gone = true; f.spared = true; fx.dust(f.x, f.y, 6); }
        G.sfx('dash');
        this.now([M(ys.length > 1 ? '보내 주었다. 뒤돌아보지 않고 간다.' : J(ys[0].name, '을', '를') + ' 보내 주었다.', 0.8)]);
        return;
      }
      if (act.type === 'flee') {
        const top = Math.max.apply(null, this.live().map(f => f.spd));
        if (Math.random() < G.clamp(0.62 + (hero.spd(s) - top) * 0.03, 0.35, 0.95)) { this.over = 'fled'; G.sfx('dash'); this.now([M('물러났다.', 0.6)]); }
        else this.now([M('등을 보일 틈이 없다.', 0.7)]);
      }
    },
    // 한 칼. 달려가서 베고 돌아온다.
    strike(f, o) {
      const H = this.H, after = [];
      if (!f || f.dead || f.gone) f = this.live()[0];
      if (!f) return [];
      const tx = f.x + (f.big ? 26 : 18) - HX, ty = f.y - HY;
      return [
        A(0.15, () => G.sfx('dash'), k => { H.ox = tx * k; H.oy = ty * k - (o.air ? Math.sin(k * 3.14) * 26 : 0); }),
        A(0.16, () => {
          G.sfx(o.art === 'hitotsu' || o.art === 'iai' ? 'cut' : 'swing');
          fx.arc(f.x + 4, f.y - 10, 3.14, o.art === 'hitotsu' ? 20 : 13, 2.8, -1, o.gold ? GOLD : LIGHT, 0.2);
          this.hurtFoe(f, hero.atk(G.s) * o.pow, o, after);
        }, k => { H.sw = k; }),
        A(0.15, null, k => { H.ox = tx * (1 - k); H.oy = ty * (1 - k); H.sw = -1; }),
        { call: () => this.now(after) }
      ];
    },
    // 수레걸이: 앞의 것을 모두
    sweep(a) {
      const H = this.H, after = [], L = this.live();
      return [
        A(0.15, () => G.sfx('dash'), k => { H.ox = (72 - HX) * k; H.oy = (60 - HY) * k; }),
        A(0.34, () => { G.sfx('swing2'); fx.arc(60, 54, 0, 24, 6.2, 1, GOLD, 0.34); G.game.shake(3); for (const f of L) this.hurtFoe(f, hero.atk(G.s) * a.pow, { post: a.post, heavy: true, far: true }, after); }, k => { H.sw = (k * 3) % 1; }),
        A(0.15, null, k => { H.ox = (72 - HX) * (1 - k); H.oy = (60 - HY) * (1 - k); H.sw = -1; }),
        { call: () => this.now(after) }
      ];
    },
    // 저쪽이 맞는다
    hurtFoe(f, raw, o, after) {
      const s = G.s, H = this.H, st = f.intent && !f.broken && !f.yielding ? f.intent.k : 'n';
      if (f.fake) { f.dead = true; fx.puff(f.x, f.y - 9, '#e6cc78', 14, 50); G.sfx('hit'); after.push(M('짚이다.', 0.5)); return; }
      if (st === 'e' && !o.far && !o.counter) { this.pop(f.x, f.y - 26, '닿지 않는다', DIM); return; }
      if (st === 'c' && !o.counter && (f.intent.void || !o.heavy)) {
        // 받아칠 자세에 걸려들었다
        const dmg = Math.max(1, Math.round((f.atk * 1.15 - hero.def(s)) * (0.9 + Math.random() * 0.2)));
        fx.spark((f.x + HX + H.ox) / 2, f.y - 10, 10); G.sfx('parry'); f.struck = true;
        if (!H.air) { this.hurtHero(dmg, after); after.unshift(M(J(f.name, '이', '가') + ' 받아넘기고 되친다.', 0.7)); }
        else after.push(M(J(f.name, '이', '가') + ' 받아넘긴다. 칼이 허공을 갈랐다.', 0.7));
        return;
      }
      let dmg = Math.max(1, raw - f.def) * (0.9 + Math.random() * 0.2), post = o.post || 8;
      if (st === 'g' && !o.heavy) { dmg *= 0.45; post += 10; fx.spark(f.x + 6, f.y - 10, 5); G.sfx('clang'); }
      if (st === 'n') post += 8;
      if (f.broken) dmg *= o.art === 'hitotsu' ? 2 : 1.5;
      dmg = Math.round(dmg);
      // 산 것은 한 칼에 죽지 않는다. 기가 꺾일 뿐이다. 꺾인 것을 한 번 더 베면 죽는다.
      const living = !f.boss && !f.d.ghost && !f.d.straw;
      if (living && !f.yielding && dmg >= f.hp) dmg = f.hp - 1;
      f.hp -= dmg; f.flash = 0.18; f.post += post;
      this.pop(f.x, f.y - (f.big ? 34 : 24), '' + dmg, f.broken ? GOLD : LIGHT);
      fx.puff(f.x, f.y - 9, f.d.ghost ? '#b9d2cc' : LIGHT, 4, 40); G.sfx('hit'); G.game.shake(o.heavy ? 3 : 1.5);
      if (o.basic) s.ki = Math.min(s.maxki, s.ki + 0.5);
      if (f.boss && f.hp <= 0) { f.hp = 0; this.over = 'win'; f.beaten = true; G.sfx('cut'); fx.flash = 0.2; return; }
      if (f.hp <= 0) { f.dead = true; f.killed = living; fx.puff(f.x, f.y - 9, '#8e8f8c', 12, 50); G.sfx('kill'); after.push(M(f.d.ghost || f.d.straw ? J(f.name, '이', '가') + ' 흩어졌다.' : J(f.name, '을', '를') + ' 벴다.', 0.6)); return; }
      if (living && !f.yielding && f.hp <= Math.max(1, f.mhp * 0.34)) {
        f.yielding = true; f.intent = null; G.sfx('stone');
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
      f.broken = 2; f.post = 0; f.intent = null; G.sfx('brk'); G.game.shake(3); fx.spark(f.x, f.y - 12, 10, GOLD);
      after.push(M(f.name + '의 자세가 무너졌다. 지금이다.', 0.8));
      if (f.d.onBreak) f.d.onBreak({ say: t => after.push(M(t, 0.9)) }, f);
    },
    hurtHero(dmg, after) {
      const s = G.s, H = this.H;
      dmg = Math.round(dmg);
      if (dmg <= 0) return;
      if (this.practice) { H.flash = 0.2; G.sfx('hit'); this.pop(HX + H.ox, HY + H.oy - 24, '(' + dmg + ')', DIM); after.push(M('맞았다. 진짜였으면 ' + dmg + '만큼 아팠다.', 0.8)); return; }
      s.hp -= dmg; H.flash = 0.2; this.pop(HX + H.ox, HY + H.oy - 24, '' + dmg, RED); G.sfx('hurt'); G.game.shake(3);
      if (s.hp <= 0) {
        if (s.flags.benkei && !this.used.stand) { this.used.stand = 1; s.hp = 1; after.push(M('무릎이 꺾이지 않는다. 벤케이에게서 본 대로 버틴다.', 1)); }
        else { s.hp = 0; this.over = 'lose'; }
      }
    },
    // 저쪽의 차례
    foeTurn(f) {
      const s = G.s, H = this.H;
      if (this.over || f.dead || f.gone || f.fake) return;
      if (f.broken) { this.now([M(J(f.name, '은', '는') + ' 아직 몸을 가누지 못한다.', 0.5)]); return; }
      const mv = f.intent;
      if (!mv || f.yielding) return;
      if (mv.k === 'c' && mv.void) {
        // 빈 자세 앞에서 치지 않고 기다렸다
        if (!this.attacked) {
          const after = [M('치지 않고 기다렸다. 무사시가 한 걸음 물러선다.', 0.9)];
          f.post += 45; s.ki = Math.min(s.maxki, s.ki + 1); fx.ring(f.x, f.y - 8, 14, GOLD, 0.4); G.sfx('chg');
          this.checkBreak(f, after); this.now(after);
        }
        return;
      }
      if (mv.k === 'g' || mv.k === 'c' || mv.k === 'e') return;
      if (mv.k === 'n') { if (mv.act) { this.now([M(J(f.name, '이', '가') + ' ' + mv.tell.split('.')[0] + '.', 0.6), A(0.4, () => mv.act(this, f))]); } return; }
      // 흰 수와 붉은 수
      const after = [], red = mv.k === 'r', tx = HX - 18 - f.x, ty = HY - f.y, leap = mv.fx === 'leap', shot = mv.fx === 'shot' || mv.fx === 'gun' || mv.fx === 'log';
      const hit = () => {
        let base = Math.max(1, f.atk * mv.pow - hero.def(s)) * (0.9 + Math.random() * 0.2), dmg = base, line = null;
        if (H.air) { dmg = 0; line = '뛰어오른 발밑으로 지나간다.'; }
        else if (this.decoy > 0) {
          dmg = 0; this.decoyHp--; fx.puff(HX - 18, HY - 8, '#e6cc78', 8, 40); G.sfx('hit');
          line = this.decoyHp <= 0 ? '짚 인형이 대신 맞고 흩어졌다.' : '짚 인형이 대신 맞았다.';
          if (this.decoyHp <= 0) this.decoy = 0;
        } else if (!red) {
          if (H.stance === 'parry') {
            if (mv.parry === 'first') { dmg = base * (1 - 1 / mv.hits); line = '첫 칼은 쳐냈다. 나머지가 들어온다.'; fx.spark(HX - 12, HY - 10, 8); G.sfx('parry'); }
            else if (this.parried) { dmg = base * 0.5; line = '한꺼번에 둘은 쳐내지 못한다.'; G.sfx('clang'); }
            else {
              dmg = 0; this.parried = true; fx.spark(HX - 12, HY - 10, 14); fx.ring(HX - 12, HY - 10, 9, GOLD, 0.2); G.sfx('parry'); G.game.shake(2);
              s.ki = Math.min(s.maxki, s.ki + 1); s.parries = (s.parries || 0) + 1;
              line = '쳐냈다. 되받아친다.';
              const ca = [];
              this.hurtFoe(f, hero.atk(s) * 1.15, { post: 35 + (mv.reflect || 0), counter: true }, ca);
              for (const c of ca) after.push(c);
            }
          } else if (H.stance === 'guard') { dmg = base * (s.flags.benkei ? 0.25 : 0.35); fx.spark(HX - 12, HY - 10, 5); G.sfx('clang'); line = '막았다.'; }
          else if (H.stance === 'evade') { dmg = base * 0.6; line = '비키려 했지만 스쳤다.'; }
        } else {
          if (H.stance === 'evade') {
            dmg = 0; G.sfx('dash'); f.post += 25; s.ki = Math.min(s.maxki, s.ki + 1); line = '비켰다. 헛친 쪽이 휘청인다.';
            fx.after(G.spr.player.left[0], HX - 8, HY - 17, '#b9d2cc', 0.35);
          } else if (H.stance === 'guard') { dmg = base * 0.75; line = '막기에는 무거운 수다.'; G.sfx('clang'); }
          else if (H.stance === 'parry') { dmg = base * 1.1; line = '쳐낼 수 없는 수다.'; }
        }
        if (dmg > 0) {
          this.hurtHero(dmg, after);
          if (mv.stun && !this.over) { H.stunned = true; after.push(M('내던져져 숨이 막힌다.', 0.7)); }
        }
        if (line) after.unshift(M(line, 0.6));
        if (mv.after) mv.after(this, f, dmg > 0);
        this.checkBreak(f, after);
      };
      const pre = M(J(f.name, '의', '의') + ' ' + mv.name + '.', 0.35);
      if (shot) {
        this.now([pre, A(0.22, () => G.sfx(mv.fx === 'gun' ? 'gun' : mv.fx === 'log' ? 'thud' : 'bow'), k => { f.sw = k; if (k > 0.4) fx.parts.push({ x: f.x + 10 + (HX - f.x - 20) * ((k - 0.4) / 0.6), y: f.y - 10 + (HY - f.y) * ((k - 0.4) / 0.6), vx: 0, vy: 0, life: 0.06, col: red ? HOT : LIGHT, s: 2 }); }),
          A(0.12, hit, null), A(0.1, null, () => { f.sw = -1; }), { call: () => this.now(after) }]);
        return;
      }
      const n = Math.min(3, mv.hits || 1);
      const seq = [pre, A(leap ? 0.3 : 0.16, () => G.sfx(leap ? 'leap' : 'dash'), k => { f.ox = tx * k; f.oy = ty * k - (leap ? Math.sin(k * 3.14) * 30 : 0); })];
      for (let i = 0; i < n; i++) seq.push(A(0.12, i === n - 1 ? () => { G.sfx(red ? 'swing2' : 'swing'); fx.arc(HX - 6, HY - 10, 0, 13, 2.6, i % 2 ? -1 : 1, red ? HOT : LIGHT, 0.18); hit(); } : () => { G.sfx('swing'); fx.arc(HX - 6, HY - 10, 0, 12, 2.4, i % 2 ? -1 : 1, LIGHT, 0.14); }, k => { f.sw = k; }));
      seq.push(A(0.16, null, k => { f.ox = tx * (1 - k); f.oy = ty * (1 - k); f.sw = -1; }), { call: () => this.now(after) });
      this.now(seq);
    },
    endRound() {
      const s = G.s;
      if (this.over) return;
      for (const f of this.foes) {
        if (f.broken > 0) f.broken--;
        if (f.fake && !f.dead && --f.life <= 0) { f.dead = true; fx.puff(f.x, f.y - 9, '#e6cc78', 10, 40); }
        if (f.mpost && !f.broken) f.post = Math.max(0, f.post - 4);
      }
      if (this.decoy > 0 && --this.decoy <= 0) this.now([M('짚 인형이 쓰러졌다.', 0.5)]);
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
        for (const t of hero.gain(s, exp)) this.push(A(0.01, () => G.sfx('learn')), M(t + ' 체력과 힘이 붙는다.', 1.0, true));
        return;
      }
      if (this.state === 'intro' || this.state === 'run') this.plan();
    },
    finish() {
      const o = this.o, res = this.over;
      this.active = false; fx.reset();
      o.onEnd(res, this.foes.filter(f => !f.fake));
    },
    pop(x, y, str, col) { this.pops.push({ x: x * 2, y: y * 2, str, col, t: 0 }); },

    // ---------- 한 틱 ----------
    update(dt) {
      const I = G.input, s = G.s;
      this.t += dt;
      fx.update(dt);
      for (const f of this.foes) { f.t += dt; if (f.flash > 0) f.flash -= dt; }
      if (this.H.flash > 0) this.H.flash -= dt;
      for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) > 0.9) this.pops.splice(i, 1);
      if (this.cur) {
        const c = this.cur, k = (I.down('a') || I.down('b')) && !c.hold ? 2.4 : 1;
        c.t += dt * k;
        if (c.tick) c.tick(Math.min(1, c.t / c.d));
        if (c.t >= c.d && (!c.hold || c.t > c.d + 2.5 || I.ok())) this.cur = null;
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
      // 수를 고른다
      const move = (n, cols) => {
        if (I.hit('up')) return -cols; if (I.hit('down')) return cols; if (I.hit('left')) return -1; if (I.hit('right')) return 1; return 0;
      };
      const ok = I.hit('a') || I.hit('b'), back = I.hit('c') || I.hit('d') || I.hit('menu');
      if (this.sub === 'target') {
        const L = this.targets(), d = move(L.length, 1);
        if (d) { this.tsel = (this.tsel + (d > 0 ? 1 : -1) + L.length) % L.length; G.sfx('move'); }
        this.tsel = G.clamp(this.tsel, 0, L.length - 1);
        if (ok) { G.sfx('ok'); const a = this.pick; a.target = L[this.tsel]; this.pickAct(a); }
        else if (back) { this.sub = this.pick.type === 'art' ? 'art' : null; G.sfx('move'); }
        return;
      }
      if (this.sub === 'art' || this.sub === 'item') {
        const list = this.sub === 'art' ? this.arts() : this.items(), d = move(list.length, 1);
        if (d) { this.ssel = (this.ssel + (d > 0 ? 1 : -1) + list.length) % list.length; G.sfx('move'); }
        this.ssel = G.clamp(this.ssel, 0, Math.max(0, list.length - 1));
        if (back) { this.sub = null; G.sfx('move'); return; }
        if (ok && list.length) {
          const id = list[this.ssel];
          if (this.sub === 'item') {
            const d2 = G.ITEMS[id];
            if (d2.heal && s.hp >= s.maxhp) { G.sfx('deny'); return; }
            G.sfx('ok'); this.pickAct({ type: 'item', id });
          } else {
            const a = G.ARTS[id];
            if (s.ki < a.cost) { G.sfx('deny'); return; }
            G.sfx('ok');
            if (id === 'decoy' || a.all) this.pickAct({ type: 'art', id });
            else this.needTarget({ type: 'art', id });
          }
        }
        return;
      }
      const d = move(8, 2);
      if (d) { this.sel = (this.sel + d + 8) % 8; G.sfx('move'); }
      if (ok) {
        const i = this.sel;
        if (!this.cmdOk(i)) { G.sfx('deny'); return; }
        G.sfx('ok');
        if (i === 0) this.needTarget({ type: 'attack' });
        else if (i === 1) { this.sub = 'art'; this.ssel = 0; }
        else if (i === 2) this.pickAct({ type: 'parry' });
        else if (i === 3) this.pickAct({ type: 'evade' });
        else if (i === 4) this.pickAct({ type: 'guard' });
        else if (i === 5) { this.sub = 'item'; this.ssel = 0; }
        else if (i === 6) this.pickAct({ type: 'spare' });
        else this.pickAct({ type: 'flee' });
      }
    },
    needTarget(a) {
      const L = this.targets();
      if (L.length === 1) { a.target = L[0]; this.pickAct(a); return; }
      this.pick = a; this.sub = 'target'; this.tsel = G.clamp(this.tsel, 0, L.length - 1);
    },

    // ---------- 그리기 ----------
    sprite(f) {
      const S = G.spr, key = f.sprKey;
      if (f.d.img) return S[f.d.img];
      const set = key ? S.f[key] : S[f.d.spr];
      const fr = f.broken || f.yielding ? 0 : Math.floor(f.t * (f.d.fly ? 8 : 2.2)) % 2;
      return set.r[fr];
    },
    draw(ctx, time) {
      const s = G.s, H = this.H, S = G.spr;
      ctx.drawImage(this.bg, 0, 0);
      ctx.fillStyle = 'rgba(12,11,15,0.34)'; ctx.fillRect(0, 0, G.W, G.H);
      ctx.fillStyle = 'rgba(232,226,208,0.07)'; ctx.fillRect(0, 84, G.W, 62);
      ctx.fillStyle = 'rgba(12,11,15,0.25)'; ctx.fillRect(0, 84, G.W, 1); ctx.fillRect(0, 146, G.W, 1);
      // 싸움판: 두 배
      ctx.save(); ctx.scale(2, 2);
      fx.drawUnder(ctx, 0, 0);
      const list = this.live().slice().sort((a, b) => a.y - b.y);
      const drawHero = () => {
        const x = Math.round(H.x + H.ox), y = Math.round(H.y + H.oy);
        G.E.shadow(ctx, H.x + H.ox, H.y + (H.oy > 0 ? H.oy : H.oy * 0.2) - 1, 12);
        if (this.decoy > 0) ctx.drawImage(S.dummy, HX - 26, HY - S.dummy.height + 1);
        let img = S.player.left[0];
        if (H.flash > 0) img = G.art.white(img);
        if (s.hp <= 0) { ctx.save(); ctx.translate(x, y - 5); ctx.rotate(-1.5708); ctx.drawImage(S.player.left[0], -8, -9); ctx.restore(); return; }
        const st = this.state === 'run' ? H.stance : null;
        let a = 3.84, ex = 0;
        if (H.sw >= 0) a = 5.0 - H.sw * 2.8;
        else if (st === 'parry') a = -1.9; else if (st === 'guard') a = -1.5708; else if (st === 'evade') { a = 2.5; ex = 2; }
        const back = Math.sin(a) < -0.25;
        if (back) fx.blade(ctx, x - 3, y - 8, a, 'kal');
        ctx.drawImage(img, x - 8 + ex, y - 17 + (st === 'guard' ? 1 : 0));
        if (!back) fx.blade(ctx, x - 3, y - 8, a, 'kal');
      };
      let heroDrawn = false;
      for (const f of list) {
        if (!heroDrawn && f.y + f.oy > H.y + H.oy) { drawHero(); heroDrawn = true; }
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
      if (!heroDrawn) drawHero();
      fx.draw(ctx, 0, 0);
      ctx.restore();

      // 기색과 몸 줄
      const L = this.live();
      for (const f of L) {
        const x = Math.round((f.x + f.ox) * 2), y = Math.round((f.y + f.oy) * 2), top = y - this.sprite(f).height * 2 - (f.d.fly ? 24 : 9);
        if (!f.boss && !f.fake) {
          ctx.fillStyle = INK; ctx.fillRect(x - 13, y + 5, 26, 4);
          ctx.fillStyle = f.yielding ? '#7fa9b0' : RED; ctx.fillRect(x - 12, y + 6, Math.max(0, Math.round(24 * f.hp / f.mhp)), 2);
        }
        if (this.state === 'cmd' && (f.intent || f.fake)) {
          const mv = f.fake ? this.foes.find(o => !o.fake && o.kind === f.kind).intent : f.intent;
          if (!mv) continue;
          const k = f.hid ? '?' : (mv.show || mv.k);
          if (k === 'w' || k === 'r') fx.glint(ctx, x, top, k === 'r', time);
          else if (k === '?') TX.drawS(ctx, '?', x, top - 7, DIM, 'big', 1);
          else if (k === 'g' || k === 'c') { ctx.fillStyle = INK; ctx.fillRect(x - 5, top - 5, 11, 11); ctx.fillStyle = k === 'c' ? GOLD : PAPER; ctx.fillRect(x - 4, top - 4, 9, 1); ctx.fillRect(x - 4, top + 4, 9, 1); ctx.fillRect(x - 4, top - 4, 1, 9); ctx.fillRect(x + 4, top - 4, 1, 9); if (k === 'c') ctx.fillRect(x - 1, top - 1, 3, 3); }
          else { ctx.fillStyle = INK; ctx.fillRect(x - 6, top - 1, 13, 4); ctx.fillStyle = DIM; ctx.fillRect(x - 5, top, 2, 2); ctx.fillRect(x - 1, top, 2, 2); ctx.fillRect(x + 3, top, 2, 2); }
        }
      }
      if (this.state === 'cmd' && this.sub === 'target') {
        const f = this.targets()[this.tsel];
        if (f) { const x = Math.round(f.x * 2), y = Math.round(f.y * 2) - this.sprite(f).height * 2 - 26 + (Math.floor(time * 4) % 2); ctx.fillStyle = INK; ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 4, y + 2, 9, 2); ctx.fillRect(x - 2, y + 4, 5, 2); ctx.fillStyle = GOLD; ctx.fillRect(x - 4, y, 9, 2); ctx.fillRect(x - 2, y + 2, 5, 2); ctx.fillRect(x, y + 4, 1, 1); }
      }
      for (const p of this.pops) {
        if (p.t > 0.7 && Math.floor(p.t * 30) % 2) continue;
        TX.drawS(ctx, p.str, p.x, p.y - Math.min(14, p.t * 40), p.col, 'big', 1);
      }
      this.windows(ctx, time);
    },
    windows(ctx, time) {
      const s = G.s, P = G.ui.panel, b = this.boss;
      // 위: 저쪽의 기색
      if (this.state === 'cmd') {
        const L = this.live().filter(f => !f.fake), lines = [];
        for (const f of L) {
          const mv = f.intent;
          let t, col;
          if (f.yielding) { t = f.d.human ? '칼을 버리고 물러서려 한다' : '기가 꺾여 물러서려 한다'; col = '#7fa9b0'; }
          else if (f.broken) { t = '몸을 가누지 못한다. 틈이다'; col = GOLD; }
          else if (!mv) { t = '아직 움직이지 않는다'; col = DIM; }
          else if (f.hid) { t = '안개 때문에 기색이 보이지 않는다'; col = DIM; }
          else { t = mv.tell; const k = mv.show || mv.k; col = k === 'r' ? HOT : k === 'w' ? LIGHT : k === 'n' ? '#b8d48a' : GOLD; }
          for (const ln of TX.wrap((L.length > 1 || this.hasFakes() ? f.name + ' — ' : '') + t, 366, 'small')) lines.push([ln, col]);
        }
        const h = lines.length * 11 + 19;
        P(ctx, 4, 3, 376, h);
        lines.forEach((l, i) => TX.draw(ctx, l[0], 10, 6 + i * 11, l[1], 'small'));
        TX.draw(ctx, '흰 수: 쳐내기·막기    붉은 수: 비키기    틈: 베기', 10, h - 9, DIM, 'small');
      }
      if (b) {
        const w = 150, x = (G.W - w) / 2, y = this.state === 'cmd' ? 50 : 14;
        TX.drawS(ctx, G.duel.DEFS[b.kind].kanji + '  ' + b.name, G.W / 2, y - 13, LIGHT, 'small', 1);
        ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.fillStyle = '#7a2a24'; ctx.fillRect(x, y, w, 4);
        ctx.fillStyle = RED; ctx.fillRect(x, y, Math.max(0, Math.round(w * b.hp / b.mhp)), 4);
        const pf = b.broken ? 1 : Math.min(1, b.post / b.mpost), half = Math.round(50 * pf);
        ctx.fillStyle = INK; ctx.fillRect(G.W / 2 - 51, y + 6, 102, 4); ctx.fillStyle = b.broken ? LIGHT : GOLD; ctx.fillRect(G.W / 2 - half, y + 7, half * 2, 2);
      }
      // 아래 왼쪽: 고를 것 또는 벌어지는 일
      P(ctx, 4, 150, 178, 62);
      if (this.state === 'cmd' && !this.sub) {
        for (let i = 0; i < 8; i++) {
          const x = 14 + (i % 2) * 84, y = 154 + (i >> 1) * 14, on = this.cmdOk(i);
          let name = CMD[i];
          if (i === 6 && this.kappa() && !this.canSpare()) name = '절하기';
          if (i === this.sel && Math.floor(time * 3) % 2 === 0) { ctx.fillStyle = GOLD; ctx.fillRect(x - 6, y + 3, 1, 7); ctx.fillRect(x - 5, y + 4, 1, 5); ctx.fillRect(x - 4, y + 5, 1, 3); ctx.fillRect(x - 3, y + 6, 1, 1); }
          else if (i === this.sel) { ctx.fillStyle = GOLD; ctx.fillRect(x - 5, y + 3, 1, 7); ctx.fillRect(x - 4, y + 4, 1, 5); ctx.fillRect(x - 3, y + 5, 1, 3); ctx.fillRect(x - 2, y + 6, 1, 1); }
          TX.draw(ctx, name, x, y, !on ? '#5a5c63' : i === this.sel ? LIGHT : PAPER);
        }
      } else if (this.state === 'cmd' && (this.sub === 'art' || this.sub === 'item')) {
        const list = this.sub === 'art' ? this.arts() : this.items();
        const top = G.clamp(this.ssel - 3, 0, Math.max(0, list.length - 4));
        for (let i = top; i < Math.min(list.length, top + 4); i++) {
          const id = list[i], y = 154 + (i - top) * 14;
          const nm = this.sub === 'art' ? G.ARTS[id].name : G.ITEMS[id].name, r = this.sub === 'art' ? '기 ' + G.ARTS[id].cost : '' + s.inv[id];
          const ok = this.sub === 'art' ? s.ki >= G.ARTS[id].cost : true;
          if (i === this.ssel) { ctx.fillStyle = GOLD; ctx.fillRect(9, y + 3, 1, 7); ctx.fillRect(10, y + 4, 1, 5); ctx.fillRect(11, y + 5, 1, 3); ctx.fillRect(12, y + 6, 1, 1); }
          TX.draw(ctx, nm, 16, y, !ok ? '#5a5c63' : i === this.ssel ? LIGHT : PAPER); TX.draw(ctx, r, 174, y, ok ? GOLD : '#5a5c63', 'big', 2);
        }
      } else if (this.state === 'cmd' && this.sub === 'target') {
        const f = this.targets()[this.tsel];
        TX.draw(ctx, '누구를?', 12, 155, DIM);
        if (f) TX.draw(ctx, f.name, 12, 171, LIGHT);
      } else {
        const lines = TX.wrap(this.msg || '', 164, 'big');
        for (let i = 0; i < Math.min(4, lines.length); i++) TX.draw(ctx, lines[i], 11, 154 + i * 14, LIGHT);
        if (this.cur && this.cur.hold && this.cur.t >= this.cur.d && Math.floor(time * 2.5) % 2) { ctx.fillStyle = GOLD; ctx.fillRect(168, 203, 7, 1); ctx.fillRect(169, 204, 5, 1); ctx.fillRect(170, 205, 3, 1); ctx.fillRect(171, 206, 1, 1); }
      }
      // 아래 오른쪽: 나
      P(ctx, 186, 150, 194, 62);
      TX.draw(ctx, '고려 검객', 194, 154, GOLD); TX.draw(ctx, '경지 ' + s.lv, 372, 154, PAPER, 'big', 2);
      ctx.drawImage(G.spr.hpFull, 193, 171);
      ctx.fillStyle = INK; ctx.fillRect(205, 172, 92, 8); ctx.fillStyle = '#33303a'; ctx.fillRect(206, 173, 90, 6);
      ctx.fillStyle = s.hp <= s.maxhp * 0.3 ? RED : '#b8d48a'; ctx.fillRect(206, 173, Math.max(0, Math.round(90 * s.hp / s.maxhp)), 6);
      TX.draw(ctx, Math.max(0, s.hp) + '/' + s.maxhp, 372, 169, LIGHT, 'big', 2);
      G.ui.kiPips(ctx, 194, 186);
      const st = this.state === 'run' ? this.H.stance : null;
      const tag = (this.decoy > 0 ? '허수 ' + this.decoy + '  ' : '') + (st ? { parry: '쳐내기', guard: '막기', evade: '비키기' }[st] : '') + (this.H.stunned ? '숨 막힘' : '');
      if (tag) TX.draw(ctx, tag, 372, 185, GOLD, 'small', 2);
      if (this.state === 'cmd' && this.sub === 'art') {
        const a = G.ARTS[this.arts()[this.ssel]];
        if (a) TX.wrap(a.desc, 180, 'small').slice(0, 2).forEach((ln, i) => TX.draw(ctx, ln, 194, 197 - (TX.wrap(a.desc, 180, 'small').length > 1 ? 4 : 0) + i * 10, PAPER, 'small'));
      } else if (this.state === 'cmd' && this.sub === 'item') {
        const d = G.ITEMS[this.items()[this.ssel]];
        if (d) TX.draw(ctx, d.ki ? '기가 찬다' : '체력 +' + d.heal, 194, 198, PAPER, 'small');
      } else if (this.state === 'cmd' && !this.sub) {
        const tip = ['한 칼 벤다. 기가 조금 찬다.', '기를 써서 크게 벤다.', '흰 수 하나를 쳐내고 되받아친다.', '붉은 수를 비킨다. 기가 찬다.', '무엇이든 덜 아프게 받는다.', '먹거나 마신다.', '기가 꺾인 것을 보내 준다.', '싸움에서 물러난다.'][this.sel];
        TX.draw(ctx, this.sel === 7 && b ? '승부에서 등을 보일 수는 없다.' : tip, 194, 198, DIM, 'small');
      }
    }
  };
  // 줄에 세우는 것: 한마디, 움직임
  function M(msg, d, hold) { return { msg, d: d || 0.6, hold: !!hold, t: 0 }; }
  function A(d, on, tick) { return { d, on, tick, t: 0 }; }
})();
