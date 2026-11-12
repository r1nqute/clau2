'use strict';
// 맞수와의 승부. 틀 하나에 맞수마다 수(手)를 적어 넣는다.
// 흰 번쩍임은 막거나 쳐낼 수 있고, 붉은 번쩍임과 붉은 자리는 비켜야 한다.
// 자세(노란 줄)를 무너뜨리면 크게 벨 틈이 난다. 누구도 죽지 않는다. 칼은 한 치 앞에서 멎는다.
(function () {
  const G = window.G, fx = G.fx, E = G.E, combat = G.combat;

  // 한 수는 토막(겨눔 → 침 → 틈)으로 이어진다
  const mkStep = (st, d, tk, o) => Object.assign({ st, d, tk: tk || null }, o || {});
  const S = {
    tele: (d, tk, o) => mkStep('tele', d, tk || 'w', o),     // 겨눔. w 흰빛(막을 수 있다), r 붉은빛(못 막는다)
    act: (d, o) => mkStep('act', d, null, o),                // 치는 순간
    rest: (d, o) => mkStep('rest', d, null, o),              // 틈. 이때 맞으면 더 아프다
    move: (d, o) => mkStep('move', d, null, o)               // 자리 옮김
  };

  const duel = G.duel = {
    boss: null, id: null, state: null, t: 0, arena: null, DEFS: {}, S,

    define(id, def) { def.id = id; def.passive = false; this.DEFS[id] = def; },
    clear() { this.boss = null; this.id = null; this.state = null; this.arena = null; },

    // 맞수를 세워 둔다. st: wait(겨루기 전) friend(겨룬 뒤) stand(서서 졌다)
    place(id, x, y, st, o) {
      const d = this.DEFS[id];
      const e = Object.assign({
        type: 'enemy', boss: true, kind: id, def: d, x, y, hx: x, hy: y, z: 0, hp: d.hp, mhp: d.hp, post: 0, st: st || 'wait', t: 0, cd: 0,
        dir: 'l', aa: 0, wa: -1, sg: 1, seq: null, si: 0, phase: 1, flash: 0, inv: 0, anim: 0, kbx: 0, kby: 0, blk: 0, evCd: 0, lastHit: 9, zone: null, mv: false, n: 0
      }, o || {});
      E.list.push(e);
      return e;
    },
    // 겨루기 시작
    start(id, o) {
      const e = E.find(id);
      if (!e) return;
      const d = e.def;
      this.boss = e; this.id = id; this.state = 'intro'; this.t = 0;
      this.arena = (o && o.arena) || G.world.cur.arenas[id] || null;
      e.hp = e.mhp = d.hp * ((o && o.hpk) || 1); e.post = 0; e.phase = 1; e.seq = null; e.st = 'ready'; e.cd = 0.9; e.n = 0;
      if (d.init) d.init(e);
      G.p.drawn = 9;
      G.ui.cutin(d, () => { this.state = 'fight'; e.st = 'idle'; G.music.play(d.music || 'duel'); G.sfx('clap'); });
    },
    run(e, steps) { e.seq = steps; e.si = -1; this.next(e); },
    next(e) {
      e.si++;
      if (!e.seq || e.si >= e.seq.length) { e.seq = null; e.st = 'idle'; e.tk = null; e.zone = null; return; }
      const s = e.seq[e.si];
      e.st = s.st; e.tk = s.tk; e.t = s.d; e.cur = s;
      if (s.on) s.on(e);
    },
    tg(e) { return E.tgt(e); },

    // ---------- 맞수의 생각 ----------
    think(e, dt) {
      const d = e.def;
      e.anim += dt; e.lastHit += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.blk > 0) e.blk -= dt;
      if (e.inv > 0) e.inv -= dt;
      if (e.evCd > 0) e.evCd -= dt;
      e.mv = false;
      if (e.kbx || e.kby) {
        E.move(e, e.kbx * dt, e.kby * dt, 10, 7);
        e.kbx *= 0.8; e.kby *= 0.8;
        if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
      }
      if (e.st === 'wait' || e.st === 'friend' || e.st === 'stand' || e.st === 'ready' || e.st === 'beaten') { if (d.idle) d.idle(e, dt); return; }
      if (this.boss !== e || this.state !== 'fight') return;
      if (e.lastHit > 1.6 && e.post > 0 && e.st !== 'broken') e.post = Math.max(0, e.post - 16 * dt);
      const tg = this.tg(e), dx = tg.x - e.x, dy = tg.y - e.y, dist = Math.hypot(dx, dy) || 1;
      e.fa = Math.atan2(dy, dx);
      if (e.st === 'broken' || e.st === 'recoil') {
        e.t -= dt;
        if (e.t <= 0) { if (e.st === 'broken') e.post = 0; e.st = 'idle'; e.cd = 0.25; }
        return;
      }
      if (e.seq) {
        const s = e.cur;
        e.t -= dt;
        const k = 1 - Math.max(0, e.t) / s.d;
        if (s.track && k < s.track) { e.aa = e.fa; e.dir = dx > 0 ? 'r' : 'l'; e.sg = e.dir === 'r' ? 1 : -1; }
        if (s.p) e.wa = e.aa + e.sg * G.lerp(s.p[0], s.p[1], k * k * (3 - 2 * k));
        if (s.tick) s.tick(e, dt, k);
        if (e.jp) this.jumpTick(e, dt);
        if (e.t <= 0 && e.seq && e.cur === s) this.next(e);
        this.clamp(e);
        return;
      }
      // 틈을 보며 다가온다
      e.cd -= dt;
      e.dir = dx > 0 ? 'r' : 'l'; e.sg = e.dir === 'r' ? 1 : -1;
      const want = d.ready === undefined ? -0.75 : d.ready;
      e.wa = e.fa + e.sg * want;
      if (d.roam) d.roam(e, dt, tg, dist);
      else this.roamDefault(e, dt, tg, dist);
      if (e.cd <= 0) {
        const mv = e.want || d.pick(e, dist, tg);
        e.want = null;
        if (mv && d.moves[mv]) {
          e.aa = e.fa; e.last = mv;
          this.run(e, d.moves[mv](e, tg, dist));
        } else e.cd = 0.25;
      }
      this.clamp(e);
    },
    roamDefault(e, dt, tg, dist) {
      const d = e.def, dx = tg.x - e.x, dy = tg.y - e.y;
      const keep = d.keep || 30, ux = dx / dist, uy = dy / dist;
      const sp = d.spd * (e.phase === 2 ? 1.12 : 1);
      if (dist > keep + 4) { this.go(e, (ux - uy * 0.35 * (e.side || 1)) * sp * dt, (uy + ux * 0.35 * (e.side || 1)) * sp * dt); }
      else if (dist < keep - 10) this.go(e, -ux * sp * 0.6 * dt, -uy * sp * 0.6 * dt);
      else this.go(e, -uy * sp * 0.4 * (e.side || 1) * dt, ux * sp * 0.4 * (e.side || 1) * dt);
      if (Math.random() < 0.008) e.side = -(e.side || 1);
    },
    go(e, dx, dy) { e.mv = true; return E.move(e, dx, dy, 10, 7); },
    clamp(e) {
      const a = this.arena;
      if (!a) return;
      e.x = G.clamp(e.x, a.x0 + 6, a.x1 - 6); e.y = G.clamp(e.y, a.y0 + 8, a.y1 - 2);
    },
    rest(e, t) { e.cd = t; },

    // ---------- 맞수가 쓰는 수의 재료 ----------
    aim(e) { const tg = this.tg(e); e.aa = Math.atan2(tg.y - e.y, tg.x - e.x); e.dir = tg.x > e.x ? 'r' : 'l'; e.sg = e.dir === 'r' ? 1 : -1; return tg; },
    slash(e, o) {
      const y = e.y - e.def.hy - (e.lift || 0);
      fx.arc(e.x, y, e.aa, o.r - 3, o.sweep || o.half * 2, o.rev ? -e.sg : e.sg, o.col || '#f6f1e3', 0.17);
      G.sfx(o.sfx || 'swing2');
      return combat.strike(e, { k: 'arc', x: e.x, y, a: e.aa, half: o.half, r: o.r }, { dmg: o.dmg || 1, post: o.post || 28, pp: o.pp, kb: o.kb, unblock: o.unblock });
    },
    thrust(e, o) {
      const y = e.y - e.def.hy - (e.lift || 0), ca = Math.cos(e.aa), sa = Math.sin(e.aa);
      fx.line(e.x + ca * 8, y + sa * 8, e.x + ca * o.len, y + sa * o.len, o.col || '#f6f1e3', 0.16);
      G.sfx(o.sfx || 'thrust');
      return combat.strike(e, { k: 'box', x: e.x, y, a: e.aa, len: o.len, w: o.w || 10 }, { dmg: o.dmg || 1, post: o.post || 28, pp: o.pp, kb: o.kb, unblock: o.unblock });
    },
    blast(e, x, y, r, o) {
      fx.ring(x, y, r, o.col || '#c4a676', 0.3); fx.dust(x, y, 10); G.sfx(o.sfx || 'thud'); G.game.shake(o.shake || 5);
      return combat.strike(e, { k: 'circ', x, y: y - 6, r }, { dmg: o.dmg || 1, post: o.post || 40, kb: o.kb || 220, unblock: o.unblock !== false, sx: x, sy: y });
    },
    lunge(e, dist, dt, d) { return this.go(e, Math.cos(e.aa) * dist / d * dt, Math.sin(e.aa) * dist / d * dt); },
    // 뛰어오른다. 공중에서는 맞지 않는다(제비 돌리기는 닿는다).
    jump(e, tx, ty, d, h) {
      const a = this.arena;
      if (a) { tx = G.clamp(tx, a.x0 + 8, a.x1 - 8); ty = G.clamp(ty, a.y0 + 10, a.y1 - 4); }
      for (let k = 0; k < 10 && G.world.boxBlocked(tx, ty, 10, 7); k++) { tx = G.lerp(tx, e.x, 0.12); ty = G.lerp(ty, e.y, 0.12); if (k === 9) { tx = e.x; ty = e.y; } }
      e.jp = { sx: e.x, sy: e.y, tx, ty, d, h, t: 0 }; e.inv = d - 0.04; G.sfx('leap'); fx.dust(e.x, e.y, 4);
    },
    jumpTick(e, dt) {
      const j = e.jp;
      j.t += dt;
      const k = Math.min(1, j.t / j.d);
      e.x = G.lerp(j.sx, j.tx, k); e.y = G.lerp(j.sy, j.ty, k); e.z = Math.sin(k * 3.1416) * j.h;
      if (k >= 1) { e.z = 0; e.jp = null; fx.dust(e.x, e.y, 6); }
    },
    shoot(e, kind, spd, o) { return E.shoot(e, kind, e.x + Math.cos(e.aa) * 10, e.y + Math.sin(e.aa) * 10, e.aa, spd, o); },
    // 포물선으로 던진다. 떨어질 자리가 붉게 보인다.
    lob(e, kind, tx, ty, d, o) {
      const f = (o && o.from) || [e.x, e.y];
      const p = E.shoot(e, kind, f[0], f[1], 0, 0, Object.assign({ grav: 520, vz: 520 * d / 2, lx: tx, ly: ty, t: d + 1, unblock: true, rad: 16 }, o || {}));
      p.vx = (tx - f[0]) / d; p.vy = (ty - f[1]) / d;
      return p;
    },

    // ---------- 맞수가 맞았을 때 ----------
    intake(e, dmg, post, fx0, fy0, o) {
      const d = e.def;
      if (this.boss !== e || this.state !== 'fight' || e.st === 'beaten') return false;
      const dx = e.x - fx0, dy = e.y - fy0, l = Math.hypot(dx, dy) || 1;
      const open = e.st === 'rest' || e.st === 'broken' || e.st === 'recoil';
      if (d.evade && e.st === 'idle' && !o.heavy && e.evCd <= 0 && Math.random() < d.evade) {
        // 훌쩍 물러난다
        e.evCd = 1.1; e.aa = Math.atan2(dy, dx);
        this.run(e, [S.move(0.24, { on: en => this.jump(en, en.x + dx / l * 38, en.y + dy / l * 38, 0.24, 9) })]);
        return false;
      }
      if (d.onStrike && d.onStrike(e, o) === false) return false;
      const gd = e.guard !== undefined ? e.guard : d.guard;
      if (!open && !o.heavy && gd && (e.st === 'idle' || (d.guardTele && e.st === 'tele')) && Math.random() < gd) {
        e.post += post * 0.55; e.blk = 0.22; e.lastHit = 0;
        if (!d.armor) { e.kbx = dx / l * 60; e.kby = dy / l * 60; }
        fx.spark(e.x - dx / l * 7, e.y - d.hy - dy / l * 7, 6); G.sfx('clang');
        if (d.counter && Math.random() < d.counter && e.st === 'idle') { e.cd = 0; e.want = d.counterMove; }
        if (e.post >= d.post) this.breakPosture(e);
        return false;
      }
      let m = e.st === 'broken' ? 2 : e.st === 'recoil' ? 1.5 : open ? 1.25 : 1;
      if (d.armor && !open) m *= 0.8;
      e.hp -= dmg * m; e.post += post * (e.st === 'broken' ? 0 : open ? 0.6 : 1); e.flash = 0.12; e.lastHit = 0;
      if (!d.armor || open) { e.kbx = dx / l * 70; e.kby = dy / l * 70; }
      fx.puff(e.x, e.y - d.cy, '#f6f1e3', 5, 70); G.sfx('hit'); fx.hitstop(o.heavy ? 0.08 : 0.04);
      if (m > 1) fx.text(e.x, e.y - d.cy - 14, e.st === 'broken' ? '급소' : '빈틈', '#e6cc78');
      if (e.hp <= 0) { this.win(e); return true; }
      if (d.onHit) d.onHit(e, o);
      if (o.heavy && !d.armor && e.st === 'tele' && !e.jp) { e.seq = null; e.zone = null; e.st = 'recoil'; e.t = 0.35; }
      if (e.post >= d.post && e.st !== 'broken') this.breakPosture(e);
      if (e.phase === 1 && e.hp <= e.mhp * 0.5) { e.phase = 2; G.sfx('taiko'); fx.ring(e.x, e.y - 6, 30, '#e2714a', 0.4); if (d.onPhase) d.onPhase(e); }
      return true;
    },
    // 수를 끊고 비틀거리게 한다
    stagger(e, t) { e.seq = null; e.zone = null; e.jp = null; e.z = 0; e.hidden = false; e.st = 'recoil'; e.t = t; },
    breakPosture(e) {
      e.seq = null; e.zone = null; e.jp = null; e.z = 0; e.inv = 0; e.hidden = false; e.st = 'broken'; e.t = e.def.brk || 2.3; e.post = e.def.post;
      G.sfx('brk'); G.game.shake(4); fx.spark(e.x, e.y - e.def.cy, 12, '#e6cc78'); fx.slow(0.25, 0.4);
      if (e.def.onBreak) e.def.onBreak(e);
      if (!G.s.flags.sawBrk) { G.s.flags.sawBrk = 1; G.ui.toast('맞수의 자세가 무너졌다. 지금이다.'); }
    },
    parried(e, pp) {
      const d = e.def;
      e.post += pp; e.lastHit = 0; e.flash = 0.1;
      if (e.post >= d.post) { this.breakPosture(e); return; }
      // 이어 치는 수는 마지막 한 칼을 쳐내야 틈이 난다
      if (e.cur && e.cur.fin === false) return;
      if (e.jp) return;
      e.seq = null; e.zone = null; e.st = 'recoil'; e.t = d.recoil || 0.6;
      const p = G.p, dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      if (!d.armor) { e.kbx = dx / l * 80; e.kby = dy / l * 80; }
    },
    win(e) {
      this.state = 'won'; this.t = 0;
      e.hp = 0; e.seq = null; e.zone = null; e.jp = null; e.z = 0; e.hidden = false; e.st = 'beaten'; e.kbx = e.kby = 0;
      for (const o of E.list) if (o.type === 'fake') o.dead = true;
      fx.slow(1.0, 0.18); fx.hitstop(0.14); G.game.shake(5); G.sfx('cut'); fx.flash = 0.25;
      for (const o of E.list) if (o.type === 'proj') o.dead = true;
      G.music.play(null);
    },

    update(dt, rdt) {
      const a = this.arena, p = G.p, e = this.boss;
      if (!e) return;
      if (this.state === 'fight' && a) { p.x = G.clamp(p.x, a.x0 + 5, a.x1 - 5); p.y = G.clamp(p.y, a.y0 + 8, a.y1 - 1); }
      if (this.state === 'won') {
        this.t += rdt;
        if (this.t > 1.5) {
          const id = this.id;
          this.state = null; this.boss = null; this.arena = null;
          G.sfx('win');
          G.STORY.won(id, e);
        }
      }
    },

    // ---------- 그리기 ----------
    draw(e, ctx, cx, cy, time) {
      const d = e.def, set = G.spr.f[d.spr], x = Math.round(e.x - cx), y = Math.round(e.y - cy);
      if (e.zone) fx.danger(ctx, Math.round(e.zone.x - cx), Math.round(e.zone.y - cy), e.zone.r, 0.5 + 0.5 * Math.sin(time * 22));
      if (!e.hidden) E.shadow(ctx, x, y - 1, d.big || e.sprSet ? 22 : e.z > 8 ? 8 : 12);
      const sp = e.sprSet ? G.spr.f[e.sprSet] : set;
      let img = sp[e.dir][e.mv ? Math.floor(e.anim * 6) % 2 : 0];
      let ox = 0, oy = 0;
      if (e.st === 'broken') ox = Math.floor(time * 24) % 2 ? 1 : -1;
      if (e.st === 'beaten' && d.beaten !== 'stand') oy = 2;
      const hot = e.st === 'tele' && e.t < 0.28;
      if (e.flash > 0 || (hot && e.tk === 'w' && Math.floor(time * 18) % 2)) img = G.art.white(img);
      else if (hot && e.tk === 'r' && Math.floor(time * 18) % 2) img = G.art.tint(img, '#e2714a');
      const dx = x - (img.width >> 1) + ox, dy = y - img.height + 1 + oy - Math.round(e.z);
      const hx = x + (e.dir === 'r' ? d.hx : -d.hx) + ox, hy = y - d.hy - (e.lift || 0) - Math.round(e.z);
      const quiet = e.st === 'wait' || e.st === 'friend' || e.st === 'stand' || e.st === 'beaten';
      let wa = e.wa;
      if (quiet) wa = d.restPose === undefined ? (e.dir === 'r' ? 1.2 : 1.94) : (e.dir === 'r' ? d.restPose : 3.1416 - d.restPose);
      if (e.st === 'broken') wa = e.dir === 'r' ? 2.0 : 1.14;
      const showW = (e.wpn || d.wpn) && !(quiet && d.sheathed) && !e.noWpn;
      const behind = showW && Math.sin(wa) < -0.2;
      const weapon = () => {
        if (!showW) return;
        const ex = e.wx || 0, bx = hx + Math.round(Math.cos(wa) * ex), by = hy + Math.round(Math.sin(wa) * ex);
        if (d.drawWpn) d.drawWpn(e, ctx, bx, by, wa, time);
        else fx.blade(ctx, bx, by, wa, e.wpn || d.wpn);
        if (d.wpn2 && !quiet) fx.blade(ctx, x - (e.dir === 'r' ? d.hx : -d.hx), hy, wa + (e.dir === 'r' ? -1.1 : 1.1), d.wpn2);
      };
      if (d.under) d.under(e, ctx, x, y, time);
      if (e.hidden) return;
      if (behind) weapon();
      ctx.drawImage(img, dx, dy);
      if (!behind) weapon();
      if (d.over) d.over(e, ctx, x, y - Math.round(e.z), time);
      if (e.st === 'tele' && e.t < 0.3) fx.glint(ctx, hx + Math.round(Math.cos(wa) * 10), hy + Math.round(Math.sin(wa) * 10), e.tk === 'r', time);
      if (e.blk > 0) fx.glint(ctx, x, y - d.cy, false, time);
      if (e.st === 'broken') {
        ctx.fillStyle = '#e6cc78';
        for (let i = 0; i < 3; i++) { const an = time * 7 + i * 2.1; ctx.fillRect(Math.round(x + Math.cos(an) * 8), Math.round(dy - 3 + Math.sin(an) * 3), 2, 2); }
      }
      if (e.st === 'beaten') {
        // 한 치 앞에서 멎은 칼끝
        const p = G.p, a = Math.atan2(y - (p.y - cy), x - (p.x - cx));
        ctx.fillStyle = '#f6f1e3'; ctx.fillRect(Math.round(x - Math.cos(a) * (d.r + 3)), Math.round(y - d.cy - Math.sin(a) * (d.r + 3)), 1, 1);
      }
    }
  };

  // ======================= 무사시보 벤케이 =======================
  // 느리고, 무겁고, 물러서지 않는다. 나기나타가 닿는 거리가 길다.
  duel.define('benkei', {
    name: '벤케이', full: '무사시보 벤케이', kanji: '武蔵坊弁慶', title: '다리를 지키는 자',
    hp: 64, post: 130, spd: 30, r: 11, cy: 14, hx: 9, hy: 13, spr: 'benkei', wpn: 'nagi', big: true, armor: true, guard: 0.4, keep: 42, music: 'duel',
    ready: -1.0, restPose: -1.35, seesThrough: false,
    init(e) { e.cdM = 3; },
    pick(e, dist) {
      e.cdM -= 1;
      if (e.phase === 2 && e.cdM <= 0 && dist > 64) { e.cdM = 3; return 'mallet'; }
      if (e.phase === 2 && dist > 70 && Math.random() < 0.55) return 'rush';
      if (dist > 66) return Math.random() < 0.5 ? 'thrust' : null;
      const r = Math.random();
      if (e.last !== 'slam' && r < 0.3) return 'slam';
      if (e.phase === 2 && r < 0.6) return 'double';
      return r < 0.75 ? 'sweep' : 'thrust';
    },
    moves: {
      sweep: () => [
        S.tele(0.62, 'w', { p: [-1.0, -2.5], track: 0.65 }),
        S.act(0.16, { p: [-2.3, 1.7], on: e => duel.slash(e, { r: 46, half: 1.55, dmg: 1, post: 40, kb: 230 }) }),
        S.rest(0.8, { p: [1.7, 1.9] })
      ],
      double: () => [
        S.tele(0.55, 'w', { p: [-1.0, -2.5], track: 0.65 }),
        S.act(0.16, { p: [-2.3, 1.7], fin: false, on: e => duel.slash(e, { r: 46, half: 1.55, dmg: 1, post: 34, kb: 120 }) }),
        S.tele(0.34, 'w', { p: [1.7, 2.6], track: 0.5 }),
        S.act(0.16, { p: [2.4, -1.6], on: e => duel.slash(e, { r: 46, half: 1.55, dmg: 1, post: 40, kb: 240, rev: true }) }),
        S.rest(0.95, { p: [-1.6, -1.8] })
      ],
      slam: () => [
        S.tele(0.85, 'r', {
          p: [-1.0, -1.9], track: 0.5,
          tick: e => { e.zone = { x: e.x + Math.cos(e.aa) * 34, y: e.y + Math.sin(e.aa) * 34, r: 26 }; }
        }),
        S.act(0.14, { p: [-1.9, 0.2], on: e => { const z = e.zone; if (z) duel.blast(e, z.x, z.y, 26, { dmg: 2, kb: 250 }); e.zone = null; } }),
        S.rest(1.0, { p: [0.2, 0.3] })
      ],
      thrust: () => [
        S.tele(0.5, 'w', { p: [0, 0], track: 0.7, tick: (e, dt, k) => { e.wx = -8 * k; } }),
        S.act(0.2, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 62, w: 12, dmg: 1, post: 34, kb: 200 }); }, tick: (e, dt) => duel.lunge(e, 34, dt, 0.2) }),
        S.rest(0.75, { p: [0, 0.3], on: e => { e.wx = 0; } })
      ],
      // 일곱 연장 가운데 나무 메를 던진다. 쳐내면 되돌아간다.
      mallet: () => [
        S.tele(0.55, 'w', { p: [-1.6, -2.6], track: 0.8 }),
        S.act(0.12, { p: [-2.6, 0.4], on: e => { duel.shoot(e, 'mallet', 175, { dmg: 1, post: 40, r: 8, t: 1.4, heavy: true }); G.sfx('swing2'); } }),
        S.rest(0.6, { p: [0.4, 0.4] })
      ],
      // 어깨로 밀고 들어온다. 비키면 제풀에 멈춘다.
      rush: () => [
        S.tele(0.7, 'r', { p: [-2.0, -2.0], track: 0.85 }),
        S.act(0.62, {
          p: [-2.0, -2.0], on: e => { e.hitOnce = false; G.sfx('dash'); },
          tick: (e, dt) => {
            const hit = duel.lunge(e, 150, dt, 0.62);
            if (Math.random() < 0.6) fx.dust(e.x, e.y, 1);
            if (!e.hitOnce && combat.strike(e, { k: 'circ', x: e.x, y: e.y - 10, r: 13 }, { dmg: 2, post: 50, kb: 280, unblock: true }) === 'hit') e.hitOnce = true;
            if (hit) { e.t = 0; G.sfx('thud'); G.game.shake(4); e.bump = 1; }
          }
        }),
        S.rest(1.15, { p: [0.6, 0.9] })
      ]
    },
    onPhase() { G.ui.toast('벤케이가 등짐을 푼다. 일곱 가지 연장이 들어 있다.'); }
  });

  // ======================= 미나모토노 요시쓰네 =======================
  // 가볍고 빠르다. 베려 하면 물러나고, 쫓으면 건너뛴다.
  duel.define('yoshitsune', {
    name: '요시쓰네', full: '미나모토노 요시쓰네', kanji: '源義経', title: '여덟 척을 건너뛰는 자',
    hp: 50, post: 85, spd: 84, r: 6, cy: 9, hx: 4, hy: 8, spr: 'yoshitsune', wpn: 'tachi', guard: 0.5, evade: 0.45, keep: 25, music: 'duel2', recoil: 0.7,
    init(e) { e.hops = 0; },
    boat(e, far) {
      // 건너뛸 배: 지금 선 배가 아니고, 맞수에게서 먼 쪽
      const bs = G.world.cur.boats || [], p = G.p;
      let best = null, bv = -1;
      for (const b of bs) {
        if (G.dist(b.x, b.y, e.x, e.y) < 40) continue;
        const v = (far ? G.dist(b.x, b.y, p.x, p.y) : 300 - G.dist(b.x, b.y, p.x, p.y)) + Math.random() * 50;
        if (v > bv) { bv = v; best = b; }
      }
      return best;
    },
    pick(e, dist) {
      if (e.want) { const w = e.want; e.want = null; return w; }
      if (dist > 86) return 'dive';
      const r = Math.random();
      if (e.hops < 2 && r < (e.phase === 2 ? 0.42 : 0.3) && e.last !== 'hop') return 'hop';
      if (dist > 44) return r < 0.5 ? 'dive' : null;
      if (e.phase === 2 && r < 0.75) return 'flurry';
      return 'combo';
    },
    moves: {
      combo: () => {
        const hit = (rev, fin) => S.act(0.1, { p: rev ? [1.5, -1.3] : [-1.5, 1.3], fin, on: e => { duel.aim(e); duel.slash(e, { r: 28, half: 1.1, dmg: 1, post: 20, pp: 22, kb: fin ? 190 : 90, rev, sfx: 'swing' }); }, tick: (e, dt) => duel.lunge(e, 8, dt, 0.1) });
        return [
          S.tele(0.34, 'w', { p: [-0.8, -1.7], track: 0.9 }), hit(false, false),
          S.tele(0.19, 'w', { p: [1.3, 1.7], track: 0.9 }), hit(true, false),
          S.tele(0.22, 'w', { p: [-1.3, -1.9], track: 0.9 }), hit(false, true),
          S.rest(0.62, { p: [1.3, 1.5], on: e => { e.hops = 0; } })
        ];
      },
      flurry: () => {
        const hit = (rev, fin) => S.act(0.09, { p: rev ? [1.5, -1.3] : [-1.5, 1.3], fin, on: e => { duel.aim(e); duel.slash(e, { r: 28, half: 1.1, dmg: 1, post: 16, pp: 16, kb: fin ? 200 : 70, rev, sfx: 'swing' }); }, tick: (e, dt) => duel.lunge(e, 9, dt, 0.09) });
        return [
          S.tele(0.3, 'w', { p: [-0.8, -1.7], track: 0.9 }), hit(false, false),
          S.tele(0.15, 'w', { p: [1.3, 1.7], track: 0.9 }), hit(true, false),
          S.tele(0.15, 'w', { p: [-1.3, -1.7], track: 0.9 }), hit(false, false),
          S.tele(0.15, 'w', { p: [1.3, 1.7], track: 0.9 }), hit(true, false),
          S.tele(0.26, 'w', { p: [-1.3, -2.1], track: 0.9 }), hit(false, true),
          S.rest(0.75, { p: [1.3, 1.5], on: e => { e.hops = 0; } })
        ];
      },
      // 뛰어올라 머리 위에서 내려 벤다
      dive: () => [
        S.tele(0.3, 'r', { p: [-1.2, -1.8], track: 1 }),
        S.move(0.5, {
          p: [-1.8, -1.57],
          on: e => { const tg = duel.tg(e); e.zone = { x: tg.x, y: tg.y, r: 19 }; duel.jump(e, tg.x, tg.y, 0.5, 42); }
        }),
        S.act(0.1, { p: [-1.57, 1.2], on: e => { const z = e.zone || e; duel.blast(e, z.x, z.y, 19, { dmg: 1, kb: 200, shake: 3, sfx: 'land' }); e.zone = null; } }),
        S.rest(0.7, { p: [1.2, 1.4], on: e => { e.hops = 0; } })
      ],
      // 배에서 배로
      hop: e => {
        const b = duel.DEFS.yoshitsune.boat(e, true);
        if (!b) return [S.rest(0.1)];
        return [
          S.move(0.55, { p: [-1.0, -1.0], on: en => { en.hops++; duel.jump(en, b.x + G.rnd(-14, 14), b.y + G.rnd(-4, 4), 0.55, 46); } }),
          S.rest(0.22, { on: en => { en.want = 'dive'; } })
        ];
      }
    },
    onPhase() { G.ui.toast('요시쓰네의 발이 더 빨라진다.'); }
  });
})();
