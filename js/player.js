'use strict';
// 주인공. 베기 세 수, 모아서 발도, 막기와 쳐내기, 보법, 그리고 맞수들에게 얻은 비기.
(function () {
  const G = window.G, fx = G.fx, E = G.E, combat = G.combat;
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIRA = { up: -1.5708, down: 1.5708, left: 3.1416, right: 0 };

  // 베기 세 수: 내려베기, 가로베기, 찌르기
  const CUTS = [
    { d: 0.22, a0: 0.05, a1: 0.14, sweep: 2.6, dir: 1, r: 27, half: 1.15, dmg: 1, post: 14, step: 5, sfx: 'swing' },
    { d: 0.24, a0: 0.06, a1: 0.15, sweep: 3.0, dir: -1, r: 28, half: 1.4, dmg: 1, post: 16, step: 5, sfx: 'swing2' },
    { d: 0.30, a0: 0.07, a1: 0.16, thrust: true, r: 37, w: 11, dmg: 2, post: 24, step: 13, sfx: 'thrust' }
  ];
  const DASHCUT = { d: 0.26, a0: 0.04, a1: 0.14, sweep: 2.9, dir: 1, r: 30, half: 1.3, dmg: 2, post: 20, step: 20, sfx: 'swing2' };
  const RIPOSTE = { d: 0.24, a0: 0.03, a1: 0.12, thrust: true, r: 38, w: 13, dmg: 3, post: 32, step: 12, sfx: 'cut', heavy: true, gold: true };

  const P = G.p = {
    x: 0, y: 0, z: 0, dir: 'down', aim: 1.5708, st: 'idle', t: 0, walk: 0, moving: false,
    combo: 0, cut: null, buf: null, chain: 0, next: 0, chargeT: 0, chargeLv: 0,
    guardT: 0, guardOff: 9, parryWin: 0.17, whiff: false, bFresh: false, post: 0, postT: 9,
    dashCd: 0, inv: 0, hurtInv: 0, kbx: 0, kby: 0, hitSet: null, eat: 0, drawn: 0, riposte: 0, perfect: false,
    rdx: 0, rdy: 0, sx: 0, sy: 0, tx: 0, ty: 0, lv: 0, ghostT: 0, tick: 0, bowT: 0, lastDeny: 0,

    reset(x, y, dir) {
      this.x = x; this.y = y; this.z = 0; this.dir = dir || 'down'; this.aim = DIRA[this.dir];
      this.st = 'idle'; this.t = 0; this.dashCd = this.inv = this.hurtInv = this.kbx = this.kby = this.post = 0;
      this.drawn = this.riposte = this.chain = this.eat = this.bowT = 0; this.buf = null; this.bFresh = false;
    },
    postMax() { return G.s.flags.benkei ? 140 : 100; },
    gainKi(v) { const s = G.s; s.ki = Math.min(s.maxki, s.ki + v); },
    wmul() { return [1, 1.5, 2][G.s.wlv || 0]; },
    // 자리를 비켜 줘야 하는 이들
    blockedByNpc(nx, ny) {
      for (const e of E.list) {
        const solid = e.type === 'npc' || (e.type === 'enemy' && (e.st === 'wait' || e.st === 'friend' || e.st === 'stand' || e.def.ai === 'post'));
        if (!solid) continue;
        const big = e.def && e.def.r > 9, rx = big ? 14 : 10, ry = big ? 8 : 7;
        if (Math.abs(e.x - nx) < rx && Math.abs(e.y - ny) < ry && !(Math.abs(e.x - this.x) < rx && Math.abs(e.y - this.y) < ry)) return true;
      }
      return false;
    },
    step(dx, dy) {
      let hit = false;
      if (dx) { if (!G.world.boxBlocked(this.x + dx, this.y, 10, 7) && !this.blockedByNpc(this.x + dx, this.y)) this.x += dx; else hit = true; }
      if (dy) { if (!G.world.boxBlocked(this.x, this.y + dy, 10, 7) && !this.blockedByNpc(this.x, this.y + dy)) this.y += dy; else hit = true; }
      return hit;
    },
    setDir(a) {
      const c = Math.cos(a), s = Math.sin(a);
      this.dir = Math.abs(c) >= Math.abs(s) * 0.9 ? (c < 0 ? 'left' : 'right') : (s < 0 ? 'up' : 'down');
    },
    // 가까운 맞수 쪽으로 칼끝이 간다. 칼을 버린 자는 겨누지 않는다.
    pickAim(ix, iy, range) {
      const base = (ix || iy) ? Math.atan2(iy, ix) : null;
      let best = null, bd = range || 62;
      for (const e of E.list) {
        if (e.type !== 'enemy' || e.dead || e.yielded || e.st === 'wait' || e.st === 'friend' || e.st === 'stand' || e.st === 'beaten') continue;
        if (e.def.passive && e.def.ai !== 'post') continue;
        const d = G.dist(e.x, e.y - e.def.cy, this.x, this.y - 7) - e.def.r;
        if (d > bd) continue;
        const a = Math.atan2(e.y - e.def.cy - (this.y - 7), e.x - this.x);
        if (base !== null && Math.abs(G.angDiff(a, base)) > 1.25) continue;
        bd = d; best = a;
      }
      if (best === null) best = base !== null ? base : DIRA[this.dir];
      this.aim = best; this.setDir(best);
      return best;
    },
    threat(range) {
      let best = null, bd = range;
      for (const e of E.list) {
        if (e.dead || e.yielded) continue;
        if (e.type === 'proj' && !e.hitE) { const d = G.dist(e.x, e.y, this.x, this.y); if (d < bd) { bd = d; best = e; } continue; }
        if (e.type !== 'enemy' || e.def.passive || e.st === 'wait' || e.st === 'friend' || e.st === 'stand' || e.st === 'beaten') continue;
        const d = G.dist(e.x, e.y, this.x, this.y) - e.def.r;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },

    // ---------- 맞았을 때 ----------
    struck(src, atk) {
      if (this.st === 'dead' || G.game.frozen()) return 'miss';
      if (this.inv > 0) {
        if (this.st === 'dash' && !this.perfect) {
          // 아슬아슬하게 비켰다
          this.perfect = true; fx.slow(0.22, 0.35); this.gainKi(0.3); G.sfx('chg');
          fx.after(this.img(), this.x - 8, this.y - 17, '#b9d2cc', 0.4);
        }
        return 'dodge';
      }
      if (this.hurtInv > 0) return 'miss';
      const sx = atk.sx === undefined ? (src ? src.x : this.x) : atk.sx, sy = atk.sy === undefined ? (src ? src.y : this.y - 1) : atk.sy;
      if (this.st === 'guard' && !atk.unblock) {
        const a = Math.atan2(sy - this.y, sx - this.x);
        if (Math.abs(G.angDiff(a, this.aim)) < 2.1) {
          const cx = this.x + Math.cos(a) * 9, cy = this.y - 9 + Math.sin(a) * 7;
          this.whiff = false; this.drawn = 5; this.postT = 0;
          if (this.guardT <= this.parryWin) {
            fx.spark(cx, cy, 14); fx.ring(cx, cy, 12, '#e6cc78', 0.2); G.sfx('parry');
            fx.slow(0.16, 0.25); fx.hitstop(0.05); G.game.shake(2);
            this.riposte = 0.75; this.gainKi(0.5); this.guardT = this.parryWin + 0.01; this.parried = 0.25;
            G.s.parries = (G.s.parries || 0) + 1;
            if (!G.s.flags.sawParry) { G.s.flags.sawParry = 1; G.ui.toast('쳐냈다. 곧바로 베면 되받아친다.'); }
            if (src && !atk.proj) E.parried(src, atk.pp || 30);
            return 'parry';
          }
          this.post += atk.post || 25;
          this.kbx = -Math.cos(a) * 70; this.kby = -Math.sin(a) * 70;
          fx.spark(cx, cy, 5); G.sfx('clang'); G.game.shake(1.5);
          if (this.post >= this.postMax()) {
            this.post = 0; this.st = 'stagger'; this.t = 0.85; G.sfx('brk'); G.game.shake(4);
            if (!G.s.flags.sawBreak) { G.s.flags.sawBreak = 1; G.ui.toast('자세가 무너졌다. 막기만 해서는 버티지 못한다.'); }
          }
          return 'block';
        }
      }
      G.game.hurt(atk.dmg, sx, sy, atk.kb);
      return 'hit';
    },

    // ---------- 동작을 여는 것들 ----------
    startCut(c, n) {
      const I = G.input;
      const ix = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0), iy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      this.pickAim(ix, iy);
      this.st = 'atk'; this.t = 0; this.cut = c; this.combo = n; this.buf = null; this.hitSet = new Set(); this.did = false;
      this.drawn = 5; this.chain = 0;
    },
    startDash(ix, iy) {
      const l = Math.hypot(ix, iy);
      if (l) { this.rdx = ix / l; this.rdy = iy / l; }
      else { this.rdx = -Math.cos(this.aim); this.rdy = -Math.sin(this.aim); }   // 가만히 누르면 뒤로 물러난다
      this.st = 'dash'; this.t = 0.17; this.dashCd = 0.42; this.inv = Math.max(this.inv, 0.2); this.perfect = false; this.buf = null; this.ghostT = 0;
      G.sfx('dash'); fx.dust(this.x, this.y, 4);
    },
    useSkill() {
      const s = G.s, id = s.skill, k = id && G.SKILLS[id];
      if (!k || !s.skills[id]) { if (this.lastDeny <= 0) { G.sfx('deny'); G.ui.toast('아직 얻은 비기가 없다.'); this.lastDeny = 2; } return; }
      if (s.ki < k.cost) { if (this.lastDeny <= 0) { G.sfx('deny'); G.ui.toast('기가 모자란다.'); this.lastDeny = 1.5; } return; }
      s.ki -= k.cost; this.drawn = 6;
      const I = G.input;
      const ix = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0), iy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      this.pickAim(ix, iy, 90);
      if (id === 'leap') {
        // 팔척뛰기: 낮은 것과 물은 넘는다. 내려설 자리가 없으면 덜 뛴다.
        const a = (ix || iy) ? Math.atan2(iy, ix) : this.aim;
        let d = 58;
        for (; d >= 0; d -= 4) {
          const nx = this.x + Math.cos(a) * d, ny = this.y + Math.sin(a) * d;
          if (G.world.boxBlocked(nx, ny, 10, 7) || this.blockedByNpc(nx, ny)) continue;
          let ok = true;
          for (let q = 6; q < d; q += 6) if (G.world.tallTile(Math.floor((this.x + Math.cos(a) * q) / 16), Math.floor((this.y - 3 + Math.sin(a) * q) / 16))) { ok = false; break; }
          if (ok) break;
        }
        d = Math.max(0, d);
        this.sx = this.x; this.sy = this.y; this.tx = this.x + Math.cos(a) * d; this.ty = this.y + Math.sin(a) * d;
        this.st = 'leap'; this.t = 0; this.inv = 0.42; this.aim = a; this.setDir(a); G.sfx('leap'); fx.dust(this.x, this.y, 5);
      } else if (id === 'decoy') {
        if (E.decoy) E.decoy.dead = true;
        E.decoy = { type: 'decoy', x: this.x, y: this.y, hp: 3, t: 6 };
        E.list.push(E.decoy);
        fx.puff(this.x, this.y - 8, '#e6cc78', 10, 50); G.sfx('dash');
        this.rdx = -Math.cos(this.aim); this.rdy = -Math.sin(this.aim);
        this.st = 'dash'; this.t = 0.2; this.inv = 0.28; this.perfect = true; this.ghostT = 0;
      } else if (id === 'hitotsu') {
        this.st = 'hitotsu'; this.t = 0; this.did = false; this.hitSet = new Set();
        fx.slow(0.5, 0.3); fx.dark = 0.5; G.sfx('focus');
      } else if (id === 'wheel') {
        this.st = 'wheel'; this.t = 0; this.tick = 0; this.inv = Math.max(this.inv, 0.15); G.sfx('swing2');
      } else if (id === 'swallow') {
        this.st = 'swallow'; this.t = 0; this.did = 0; this.hitSet = new Set(); G.sfx('swing');
      }
    },
    bow() { this.st = 'bow'; this.t = 0.9; this.drawn = 0; },

    // ---------- 한 틱 ----------
    // dt는 느려질 수 있는 시간, rdt는 실제 시간
    update(dt, rdt) {
      const I = G.input, s = G.s;
      if (this.dashCd > 0) this.dashCd -= dt;
      if (this.inv > 0) this.inv -= dt;
      if (this.hurtInv > 0) this.hurtInv -= dt;
      if (this.eat > 0) this.eat -= dt;
      if (this.riposte > 0) this.riposte -= rdt;
      if (this.chain > 0) this.chain -= dt;
      if (this.parried > 0) this.parried -= rdt;
      if (this.lastDeny > 0) this.lastDeny -= rdt;
      if (this.drawn > 0) { this.drawn -= dt; if (this.drawn <= 0 && this.st === 'idle') G.sfx('stone'); }
      this.postT += dt; this.guardOff += rdt;
      if (this.st !== 'guard' && this.postT > 1 && this.post > 0) this.post = Math.max(0, this.post - 45 * dt);
      if (!I.down('b')) this.bFresh = false;
      if (I.hit('b')) this.bFresh = true;
      if (this.kbx || this.kby) {
        this.step(this.kbx * dt, this.kby * dt);
        this.kbx *= 0.82; this.kby *= 0.82;
        if (Math.abs(this.kbx) + Math.abs(this.kby) < 5) this.kbx = this.kby = 0;
      }
      const ix = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0), iy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      const il = Math.hypot(ix, iy);
      this.moving = false;
      const walk = k => {
        if (!il) { this.walk = 0; return; }
        let spd = 70 * k;
        const T = G.world.T, tl = G.world.tile(Math.floor(this.x / 16), Math.floor((this.y - 2) / 16));
        if (tl === T.SHALLOW || tl === T.MUD) spd *= 0.72; else if (tl === T.SNOW) spd *= 0.86;
        this.step(ix / il * spd * dt, iy / il * spd * dt);
        this.walk += dt * (spd / 64); this.moving = true;
        if (tl === T.SHALLOW && Math.random() < 0.15) fx.parts.push({ x: this.x + (Math.random() - 0.5) * 8, y: this.y, vx: 0, vy: -14, life: 0.25, col: '#b9d2cc', s: 1 });
        if (tl === T.SNOW && Math.random() < 0.1) fx.parts.push({ x: this.x + (Math.random() - 0.5) * 6, y: this.y, vx: 0, vy: -6, life: 0.3, col: '#f6f6f2', s: 1 });
      };

      switch (this.st) {
        case 'idle': {
          if (I.hit('d') && this.dashCd <= 0) { this.startDash(ix, iy); return; }
          if (I.hit('a')) {
            if (this.riposte > 0) { this.riposte = 0; this.startCut(RIPOSTE, 0); }
            else if (this.chain > 0 && this.next <= 2) this.startCut(CUTS[this.next], this.next);
            else this.startCut(CUTS[0], 0);
            return;
          }
          if (I.hit('b') && G.game.tryInteract()) { this.bFresh = false; return; }
          if (I.down('b') && this.bFresh) {
            this.st = 'guard'; this.guardT = 0; this.drawn = 5;
            this.parryWin = (this.whiff && this.guardOff < 0.35) ? 0.07 : 0.17; this.whiff = true;
            const th = this.threat(100);
            if (th) { this.aim = Math.atan2(th.y - this.y, th.x - this.x); this.setDir(this.aim); }
            else this.aim = DIRA[this.dir];
            return;
          }
          if (I.hit('c')) { this.useSkill(); return; }
          if (I.hit('e')) G.game.useQuick();
          if (I.hit('q')) G.game.cycleSkill();
          if (il) {
            // 대각선으로 갈 때는 보던 쪽을 되도록 유지
            if (!((this.dir === 'left' && ix < 0) || (this.dir === 'right' && ix > 0) || (this.dir === 'up' && iy < 0) || (this.dir === 'down' && iy > 0)))
              this.dir = Math.abs(ix) >= Math.abs(iy) ? (ix < 0 ? 'left' : 'right') : (iy < 0 ? 'up' : 'down');
            this.aim = DIRA[this.dir];
          }
          walk(1);
          break;
        }
        case 'atk': {
          const c = this.cut, t0 = this.t;
          this.t += dt;
          if (I.hit('a')) this.buf = 'a'; else if (I.hit('d')) this.buf = 'd';
          if (t0 < c.a0 && this.t >= c.a0) {
            G.sfx(c.sfx);
            this.step(Math.cos(this.aim) * c.step, Math.sin(this.aim) * c.step);
            const ox = this.x, oy = this.y - 8;
            if (c.thrust) fx.line(ox + Math.cos(this.aim) * 8, oy + Math.sin(this.aim) * 8, ox + Math.cos(this.aim) * c.r, oy + Math.sin(this.aim) * c.r, c.gold ? '#e6cc78' : '#f6f1e3', 0.16);
            else fx.arc(ox, oy, this.aim, c.r - 3, c.sweep, c.dir, '#f6f1e3', 0.17);
          }
          if (this.t >= c.a0 && t0 <= c.a1) {
            const ox = this.x, oy = this.y - 8, m = this.wmul();
            const shape = c.thrust ? { k: 'box', x: ox, y: oy, a: this.aim, len: c.r, w: c.w } : { k: 'arc', x: ox, y: oy, a: this.aim, half: c.half, r: c.r };
            const n = combat.slash(shape, c.dmg * m, c.post, { heavy: c.heavy, kb: c.thrust ? 170 : 120 });
            if (n) { this.gainKi(0.15 * n); G.game.shake(c.heavy ? 3 : 1.5); }
          }
          if (this.t >= c.a1) {
            if (this.buf === 'd' && this.dashCd <= 0) { this.startDash(ix, iy); return; }
            if (I.down('b') && this.bFresh && this.t >= c.a1 + 0.03) { this.st = 'idle'; this.chain = 0.3; this.next = this.combo + 1; return; }
          }
          if (this.t >= c.d) {
            const nx = c === RIPOSTE || c === DASHCUT ? 1 : this.combo + 1;
            if (this.buf === 'a' && nx <= 2) { this.startCut(CUTS[nx], nx); return; }
            if (I.down('a') && I.time('a') > 0.26) { this.st = 'charge'; this.chargeT = 0; this.chargeLv = 0; return; }
            this.st = 'idle'; this.chain = nx <= 2 ? 0.3 : 0; this.next = nx;
            if (nx > 2) this.dashCd = Math.max(this.dashCd, 0.05);
          }
          break;
        }
        case 'charge': {
          this.chargeT += dt; this.drawn = 5;
          if (il) { this.aim = Math.atan2(iy, ix); this.setDir(this.aim); }
          walk(0.35);
          if (this.chargeLv === 0 && this.chargeT >= 0.35) { this.chargeLv = 1; G.sfx('chg'); fx.spark(this.x, this.y - 9, 4, '#b9d2cc'); }
          if (this.chargeLv === 1 && this.chargeT >= 0.95) { this.chargeLv = 2; G.sfx('chg2'); fx.spark(this.x, this.y - 9, 8, '#e6cc78'); fx.ring(this.x, this.y - 4, 12, '#e6cc78', 0.25); }
          if (I.hit('d') && this.dashCd <= 0) { this.startDash(ix, iy); return; }
          if (!I.down('a')) {
            if (this.chargeLv === 0) { this.st = 'idle'; return; }
            // 발도
            this.pickAim(ix, iy, this.chargeLv === 2 ? 110 : 80);
            this.lv = this.chargeLv; this.st = 'iai'; this.t = 0; this.sx = this.x; this.sy = this.y; this.inv = 0.2; this.ghostT = 0;
            G.sfx('cut');
          }
          break;
        }
        case 'iai': {
          const dur = 0.11, dist = this.lv === 2 ? 92 : 58;
          this.t += dt;
          const hit = this.step(Math.cos(this.aim) * dist / dur * dt, Math.sin(this.aim) * dist / dur * dt);
          this.ghostT -= dt;
          if (this.ghostT <= 0) { this.ghostT = 0.022; fx.after(this.img(), this.x - 8, this.y - 17, this.lv === 2 ? '#e6cc78' : '#b9d2cc', 0.24); }
          if (this.t >= dur || hit) {
            const len = Math.hypot(this.x - this.sx, this.y - this.sy), m = this.wmul();
            this.hitSet = new Set();
            const n = combat.slash({ k: 'box', x: this.sx - Math.cos(this.aim) * 6, y: this.sy - 8 - Math.sin(this.aim) * 6, a: this.aim, len: len + 22, w: 24 },
              (this.lv === 2 ? 5 : 3) * m, this.lv === 2 ? 55 : 32, { heavy: true, kb: 60 });
            fx.line(this.sx, this.sy - 9, this.x + Math.cos(this.aim) * 14, this.y - 9 + Math.sin(this.aim) * 14, '#f6f1e3', 0.3);
            if (n) { fx.hitstop(0.09); G.game.shake(this.lv === 2 ? 5 : 3); this.gainKi(0.2 * n); }
            this.st = 'recover'; this.t = 0.26;
          }
          break;
        }
        case 'guard': {
          this.guardT += rdt; this.drawn = 5;
          const th = this.threat(100);
          if (th) { this.aim = Math.atan2(th.y - this.y, th.x - this.x); this.setDir(this.aim); }
          walk(0.3); this.moving = false;
          if (I.hit('d') && this.dashCd <= 0) { this.guardOff = 0; this.startDash(ix, iy); return; }
          if (I.hit('a')) {
            this.guardOff = 0;
            if (this.riposte > 0) { this.riposte = 0; this.startCut(RIPOSTE, 0); } else this.startCut(CUTS[0], 0);
            return;
          }
          if (I.hit('c')) { this.guardOff = 0; this.st = 'idle'; this.useSkill(); return; }
          if (!I.down('b') && this.guardT > 0.1) { this.st = 'idle'; this.guardOff = 0; }
          break;
        }
        case 'dash': {
          this.t -= dt;
          this.step(this.rdx * 232 * dt, this.rdy * 232 * dt);
          this.ghostT -= dt;
          if (this.ghostT <= 0) { this.ghostT = 0.04; fx.after(this.img(), this.x - 8, this.y - 17, '#b9d2cc', 0.2); }
          if (I.hit('a')) this.buf = 'a';
          if (this.t <= 0) {
            if (this.buf === 'a') { this.aim = Math.atan2(this.rdy, this.rdx); this.startCut(DASHCUT, 0); this.aim = Math.atan2(this.rdy, this.rdx); this.pickAim(this.rdx, this.rdy); }
            else this.st = 'idle';
          }
          break;
        }
        case 'leap': {
          const dur = 0.36;
          this.t += dt;
          const k = Math.min(1, this.t / dur);
          this.x = G.lerp(this.sx, this.tx, k); this.y = G.lerp(this.sy, this.ty, k);
          this.z = Math.sin(k * 3.1416) * 20;
          if (k >= 1) {
            this.z = 0; G.sfx('land'); G.game.shake(3); fx.dust(this.x, this.y, 8); fx.ring(this.x, this.y, 24, '#f6f1e3', 0.25);
            this.hitSet = new Set();
            const n = combat.slash({ k: 'circ', x: this.x, y: this.y - 6, r: 24 }, 2 * this.wmul(), 26, { kb: 150 });
            if (n) this.gainKi(0.1 * n);
            this.st = 'recover'; this.t = 0.14;
          }
          break;
        }
        case 'wheel': {
          // 수레걸이: 돌면서 밀고 들어간다
          this.t += dt; this.tick -= dt;
          this.step(Math.cos(this.aim) * 112 * dt, Math.sin(this.aim) * 112 * dt);
          if (this.tick <= 0) {
            this.tick = 0.13; this.hitSet = new Set(); G.sfx('swing');
            fx.arc(this.x, this.y - 8, this.t * 24, 24, 4.4, 1, '#f6f1e3', 0.14);
            const n = combat.slash({ k: 'circ', x: this.x, y: this.y - 8, r: 26 }, 1 * this.wmul(), 13, { kb: 90 });
            if (n) G.game.shake(1.5);
          }
          if (this.t >= 0.56) { this.st = 'recover'; this.t = 0.18; }
          break;
        }
        case 'swallow': {
          // 제비 돌리기: 내려 벤 칼이 그대로 되돌아 올라온다
          this.t += dt;
          const m = this.wmul(), ox = this.x, oy = this.y - 8;
          if (this.did === 0 && this.t >= 0.04) {
            this.did = 1; fx.arc(ox, oy, this.aim, 28, 2.6, 1, '#f6f1e3', 0.14);
            combat.slash({ k: 'arc', x: ox, y: oy, a: this.aim, half: 1.2, r: 31 }, 2 * m, 18, { kb: 40 });
          }
          if (this.did === 1 && this.t >= 0.15) {
            this.did = 2; this.hitSet = new Set(); G.sfx('cut');
            fx.arc(ox, oy, this.aim, 31, 5.2, -1, '#e6cc78', 0.2);
            const n = combat.slash({ k: 'circ', x: ox, y: oy, r: 33 }, 3 * m, 28, { heavy: true, air: true, kb: 170 });
            if (n) { fx.hitstop(0.06); G.game.shake(3); }
          }
          if (this.t >= 0.36) { this.st = 'recover'; this.t = 0.12; }
          break;
        }
        case 'hitotsu': {
          // 일지태도: 한 번 숨을 고르고, 한 번 벤다. 고르는 동안은 느려진 세상에서 혼자 제 빠르기다.
          this.t += rdt;
          if (!this.did && this.t >= 0.42) {
            this.did = true; fx.dark = 0;
            const m = this.wmul(), ox = this.x, oy = this.y - 8;
            this.step(Math.cos(this.aim) * 10, Math.sin(this.aim) * 10);
            fx.arc(ox, oy, this.aim, 44, 2.2, 1, '#f6f1e3', 0.3); fx.arc(ox, oy, this.aim, 38, 2.0, 1, '#e6cc78', 0.26);
            fx.line(ox, oy, ox + Math.cos(this.aim) * 52, oy + Math.sin(this.aim) * 52, '#f6f1e3', 0.3);
            G.sfx('cut'); G.sfx('thud'); G.game.shake(6);
            const n = combat.slash({ k: 'arc', x: ox, y: oy, a: this.aim, half: 0.95, r: 48 }, 8 * m, 70, { heavy: true, kb: 230 });
            if (n) fx.hitstop(0.13);
          }
          if (this.t >= 0.8) { this.st = 'idle'; fx.dark = 0; }
          break;
        }
        case 'recover': this.t -= dt; if (I.hit('a')) this.buf = 'a'; if (this.t <= 0) { this.st = 'idle'; } break;
        case 'hurt': this.t -= dt; if (this.t <= 0) this.st = 'idle'; break;
        case 'stagger': this.t -= dt; if (this.t <= 0) this.st = 'idle'; break;
        case 'bow': this.t -= dt; if (this.t <= 0) this.st = 'idle'; break;
        case 'sit': if (il || I.ok()) this.st = 'idle'; break;
      }
    },

    // ---------- 그리기 ----------
    img() {
      const frames = G.spr.player[this.dir];
      return frames[this.moving ? Math.floor(this.walk * 7) % 4 : 0];
    },
    draw(ctx, cx, cy, time) {
      const gx = Math.round(this.x - cx), gy = Math.round(this.y - cy);
      E.shadow(ctx, gx, gy - 1, this.z > 6 ? 8 : 12);
      if (this.st === 'sit') { const im = G.spr.player.sit; ctx.drawImage(im, gx - 8, gy - im.height + 3); return; }
      if (this.hurtInv > 0 && this.st !== 'hurt' && this.st !== 'stagger' && Math.floor(this.hurtInv * 14) % 2) return;
      let img = this.img();
      let x = gx - 8, y = gy - 17 - Math.round(this.z);
      const st = this.st, ca = Math.cos(this.aim), sa = Math.sin(this.aim);
      if (st === 'atk') { x += Math.round(ca * 1.4); y += Math.round(sa * 1); }
      if (st === 'charge' || st === 'guard' || st === 'hitotsu') y += 1;
      if (st === 'bow') y += this.t > 0.2 && this.t < 0.75 ? 3 : 1;
      if (st === 'stagger') x += Math.floor(time * 30) % 2 ? 1 : -1;
      if (st === 'hurt' || (st === 'guard' && this.parried > 0)) img = G.art.white(img);
      const bob = this.moving && Math.floor(this.walk * 7) % 2 ? 1 : 0;
      y -= bob; if (this.eat > 0) y += 1;

      // 칼: 각도, 손 위치(겨눈 쪽으로 얼마나 내밀었나), 보이는가
      let a = null, ext = 3, kind = 'kal';
      if (st === 'atk') {
        const c = this.cut, k = G.clamp((this.t - c.a0 + 0.05) / (c.a1 - c.a0 + 0.06), 0, 1), e = k * k * (3 - 2 * k);
        if (c.thrust) { a = this.aim; ext = -2 + e * 10; }
        else { a = this.aim - c.dir * c.sweep / 2 + c.dir * c.sweep * e; ext = 4; }
      } else if (st === 'guard') { a = this.aim + 1.3; ext = 6; }
      else if (st === 'iai' || (st === 'recover' && this.drawn > 0 && this.lv)) { a = this.aim; ext = 7; }
      else if (st === 'wheel') { a = this.t * 26; ext = 4; }
      else if (st === 'swallow') { a = this.t < 0.15 ? this.aim - 1.3 + (this.t / 0.15) * 2.6 : this.aim + 1.3 - ((this.t - 0.15) / 0.2) * 5.2; ext = 4; }
      else if (st === 'hitotsu') { a = this.t < 0.42 ? -1.5708 - ca * 0.5 : this.aim + 0.5; ext = this.t < 0.42 ? 2 : 6; }
      else if (st === 'leap') { a = this.t < 0.2 ? -1.5708 : this.aim + 0.9; ext = 3; }
      else if (st === 'charge' || st === 'bow' || st === 'stagger' || st === 'dash') a = null;
      else if (this.drawn > 0) { a = DIRA[this.dir] + (this.dir === 'left' ? -0.55 : 0.55); ext = 3; }
      const hx = gx, hy = gy - 7 - Math.round(this.z) - bob;
      const sheath = () => {
        // 빈 칼집(또는 꽂힌 칼)
        const o = this.dir === 'right' ? [-2, 2.6] : this.dir === 'left' ? [2, 0.54] : this.dir === 'down' ? [-4, 2.2] : [4, 0.94];
        const sx0 = hx + o[0], sy0 = hy + 2, c2 = Math.cos(o[1]), s2 = Math.sin(o[1]);
        ctx.fillStyle = '#1b1a1f'; for (let i = 0; i <= 9; i++) ctx.fillRect(Math.round(sx0 + c2 * i) - 1, Math.round(sy0 + s2 * i) - 1, 3, 3);
        for (let i = 0; i <= 9; i++) { ctx.fillStyle = i === 2 || i === 9 ? '#cfa64a' : '#33303a'; ctx.fillRect(Math.round(sx0 + c2 * i), Math.round(sy0 + s2 * i), 1, 1); }
        if (a === null) {
          // 자루가 삐져나와 있다
          ctx.fillStyle = '#1b1a1f'; for (let i = 1; i <= 4; i++) ctx.fillRect(Math.round(sx0 - c2 * i) - 1, Math.round(sy0 - s2 * i) - 1, 3, 3);
          for (let i = 1; i <= 4; i++) { ctx.fillStyle = i === 1 ? '#cfa64a' : '#6b4a32'; ctx.fillRect(Math.round(sx0 - c2 * i), Math.round(sy0 - s2 * i), 1, 1); }
        }
      };
      const sword = () => {
        if (a === null) return;
        fx.blade(ctx, hx + Math.round(Math.cos(a) * ext * 0.4 + ca * ext * 0.6), hy + Math.round(Math.sin(a) * ext * 0.4 + sa * ext * 0.6), a, kind);
      };
      const back = a !== null && Math.sin(a) < -0.25;
      if (this.dir === 'up') { if (!back) sheath(); } else sheath();
      if (back) sword();
      ctx.drawImage(img, x, y);
      if (this.dir === 'up' && back) sheath();
      if (!back) sword();

      if (st === 'charge') {
        // 모이는 기운
        const lv = this.chargeLv, n = lv === 2 ? 6 : lv === 1 ? 4 : 2;
        ctx.fillStyle = lv === 2 ? '#e6cc78' : '#b9d2cc';
        for (let i = 0; i < n; i++) {
          const an = time * 9 + i * 6.283 / n, rr = 11 - ((time * 14 + i * 3) % 8);
          ctx.fillRect(Math.round(gx + Math.cos(an) * rr), Math.round(gy - 8 + Math.sin(an) * rr * 0.7), 1, 1);
        }
        if (lv && Math.floor(time * 16) % 2) fx.glint(ctx, gx + (this.dir === 'left' ? 5 : -5), gy - 6, false, time);
      }
      if (st === 'guard' && this.guardT <= this.parryWin) fx.glint(ctx, gx + Math.round(ca * 9), gy - 9 + Math.round(sa * 7), false, time);
      if (this.riposte > 0 && Math.floor(time * 14) % 2) { ctx.fillStyle = '#e6cc78'; ctx.fillRect(gx - 1, gy - 26, 3, 1); ctx.fillRect(gx, gy - 27, 1, 3); }
      // 자세: 흔들릴 때만 발밑에 보인다
      if (this.post > 0) {
        const w = 16, f = Math.min(1, this.post / this.postMax());
        ctx.fillStyle = '#1b1a1f'; ctx.fillRect(gx - w / 2 - 1, gy + 4, w + 2, 4);
        ctx.fillStyle = f > 0.7 ? '#cf6a3d' : '#e6cc78'; ctx.fillRect(gx - w / 2, gy + 5, Math.round(w * f), 2);
      }
    }
  };
})();
