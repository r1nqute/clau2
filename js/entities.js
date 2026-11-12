'use strict';
// 움직이는 것들: 사람, 짐승, 잡것, 날아가는 것, 떨어진 물건. 그리고 누가 누구를 쳤는지 가리는 셈.
(function () {
  const G = window.G, fx = G.fx;

  // ai: 어떻게 구는가 / human: 기가 꺾이면 칼을 버리고 달아난다 / guard: 평소에 막아 내는 정도
  const DEF = {
    heike: { hp: 2, spd: 36, dmg: 1, r: 6, cy: 5, ai: 'crab', spr: 'heike', drop: ['crab', 0.75], name: '헤이케 게' },
    crab: { hp: 2, spd: 36, dmg: 1, r: 6, cy: 5, ai: 'crab', spr: 'crab', drop: ['crab', 0.75], name: '게' },
    dog: { hp: 3, spd: 60, dmg: 1, r: 7, cy: 6, sight: 88, ai: 'dog', spr: 'dog', name: '들개' },
    wolf: { hp: 6, spd: 68, dmg: 1, r: 7, cy: 6, sight: 112, ai: 'dog', spr: 'wolf', drop: ['pelt', 0.5], name: '늑대' },
    boar: { hp: 7, spd: 26, dmg: 2, r: 9, cy: 7, ai: 'boar', spr: 'boar', drop: ['meat', 0.8], name: '멧돼지' },
    bat: { hp: 1, spd: 52, dmg: 1, r: 5, cy: 10, fly: true, ai: 'bat', spr: 'bat', name: '박쥐' },
    wisp: { hp: 1, spd: 27, dmg: 1, r: 5, cy: 8, fly: true, light: 26, ai: 'wisp', spr: 'wisp', name: '도깨비불' },
    kite: { hp: 1, spd: 84, dmg: 0, r: 6, cy: 12, fly: true, ai: 'kite', spr: 'kite', name: '솔개' },
    deer: { hp: 9, spd: 66, dmg: 0, r: 7, cy: 7, ai: 'deer', spr: 'deer', passive: true, name: '사슴' },
    kappa: { hp: 6, spd: 46, dmg: 1, r: 6, cy: 7, ai: 'kappa', spr: 'kappa', sight: 80, name: '갓파' },
    makiwara: { hp: 9999, spd: 0, dmg: 0, r: 6, cy: 8, ai: 'post', spr: 'makiwara', passive: true, name: '짚단' },
    ochi: { hp: 4, spd: 42, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'ochi', wpn: 'tachi', wind: 0.55, reach: 24, sight: 92, guard: 0.12, drop: ['blade', 0.4], money: [2, 6], name: '패잔병' },
    ghost: { hp: 3, spd: 34, dmg: 1, r: 6, cy: 9, ai: 'melee', f: 'ghost', wpn: 'tachi', wind: 0.7, reach: 24, sight: 100, ghost: true, light: 18, name: '원령' },
    bandit: { hp: 5, spd: 48, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'bandit', wpn: 'kal', wind: 0.45, reach: 23, sight: 96, guard: 0.1, money: [4, 10], name: '도적' },
    roto: { hp: 6, spd: 46, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'roto', wpn: 'tachi', wind: 0.5, reach: 25, sight: 80, guard: 0.28, money: [5, 12], name: '낭당' },
    spear: { hp: 6, spd: 38, dmg: 1, r: 6, cy: 9, ai: 'spear', human: true, f: 'spear', wpn: 'yari', wind: 0.6, reach: 38, sight: 100, guard: 0.15, money: [3, 9], name: '창병' },
    archer: { hp: 4, spd: 40, dmg: 1, r: 6, cy: 9, ai: 'archer', human: true, f: 'archer', wpn: 'bow', range: 132, money: [3, 8], name: '궁병' },
    akuto: { hp: 5, spd: 56, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'akuto', wpn: 'stick', wind: 0.4, reach: 22, sight: 100, money: [4, 9], name: '악당' },
    ashiT: { hp: 7, spd: 40, dmg: 1, r: 6, cy: 9, ai: 'spear', human: true, f: 'ashiT', wpn: 'yari', wind: 0.55, reach: 40, sight: 84, guard: 0.2, money: [5, 12], name: '다케다 아시가루' },
    ashiU: { hp: 7, spd: 40, dmg: 1, r: 6, cy: 9, ai: 'spear', human: true, f: 'ashiU', wpn: 'yari', wind: 0.55, reach: 40, sight: 84, guard: 0.2, money: [5, 12], name: '우에스기 아시가루' },
    gunner: { hp: 5, spd: 34, dmg: 2, r: 6, cy: 9, ai: 'gunner', human: true, f: 'gunner', wpn: 'gun', range: 150, money: [6, 14], name: '철포 아시가루' },
    ronin: { hp: 9, spd: 50, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'ronin', wpn: 'tachi', wind: 0.42, reach: 25, sight: 90, guard: 0.4, combo: 2, money: [8, 18], name: '낭인' },
    kabuki: { hp: 8, spd: 54, dmg: 1, r: 6, cy: 9, ai: 'melee', human: true, f: 'kabuki', wpn: 'nodachi', wind: 0.6, reach: 31, sight: 90, guard: 0.2, money: [10, 20], name: '가부키모노' }
  };

  function inArc(sx, sy, a, half, r, tx, ty, tr) {
    const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
    if (d > r + tr) return false;
    if (d < tr + 3) return true;
    return Math.abs(G.angDiff(Math.atan2(dy, dx), a)) <= half + Math.asin(Math.min(1, tr / d));
  }
  function inBox(sx, sy, a, len, w, tx, ty, tr) {
    const dx = tx - sx, dy = ty - sy, ca = Math.cos(a), sa = Math.sin(a);
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    return u > -tr && u < len + tr && Math.abs(v) < w / 2 + tr;
  }
  // 모양: {k:'arc',x,y,a,half,r} {k:'box',x,y,a,len,w} {k:'circ',x,y,r}
  const combat = G.combat = {
    test(s, tx, ty, tr) {
      if (s.k === 'arc') return inArc(s.x, s.y, s.a, s.half, s.r, tx, ty, tr);
      if (s.k === 'box') return inBox(s.x, s.y, s.a, s.len, s.w, tx, ty, tr);
      return Math.hypot(tx - s.x, ty - s.y) < s.r + tr;
    },
    // 누가 주인공(이나 허수)을 친다. 돌아오는 말: miss dodge parry block hit
    strike(src, shape, atk) {
      const p = G.p, d = E.decoy;
      if (d && !d.dead && this.test(shape, d.x, d.y - 8, 6)) {
        d.hp--; fx.puff(d.x, d.y - 8, '#e6cc78', 6, 50); G.sfx('hit');
        if (d.hp <= 0) { d.dead = true; fx.puff(d.x, d.y - 8, '#cfa64a', 12, 70); }
      }
      if (p.z > 10 || !this.test(shape, p.x, p.y - 7, 5)) return 'miss';
      if (atk.sx === undefined) { atk.sx = src ? src.x : shape.x; atk.sy = src ? src.y : shape.y; }
      return p.struck(src, atk);
    },
    // 주인공이 친다. 맞은 수를 돌려준다.
    slash(shape, dmg, post, o) {
      const p = G.p;
      let n = 0;
      for (const e of E.list) {
        if (e.type !== 'enemy' || e.dead || (p.hitSet && p.hitSet.has(e))) continue;
        if (!this.test(shape, e.x, e.y - e.def.cy - (e.z > 14 && !(o && o.air) ? 99 : 0), e.def.r)) continue;
        if (p.hitSet) p.hitSet.add(e);
        if (E.hurtEnemy(e, dmg, post, p.x, p.y, o)) n++;
      }
      for (const e of E.list) {
        if (e.type !== 'fake' || e.dead || !this.test(shape, e.x, e.y - 9, 6)) continue;
        e.dead = true; fx.puff(e.x, e.y - 9, '#e6cc78', 12, 70); G.sfx('hit');
        if (!G.s.flags.sawFake) { G.s.flags.sawFake = 1; G.ui.toast('짚이다.'); }
      }
      // 날아오는 화살은 벤다
      for (const e of E.list) {
        if (e.type !== 'proj' || e.dead || e.hitE || e.kind === 'bullet' || e.heavy || e.grav) continue;
        if (this.test(shape, e.x, e.y - 8, 3)) { e.dead = true; fx.spark(e.x, e.y - 8, 5); G.sfx('clang'); p.gainKi(0.12); }
      }
      return n;
    }
  };

  const E = G.E = {
    list: [], decoy: null, DEF,

    reset() {
      this.list.length = 0; this.decoy = null;
      const m = G.world.cur, s = G.s;
      for (const sp of m.spawns) sp.ent = null;
      for (const n of m.npcs) {
        if (n.when && !n.when(s)) continue;
        this.addNpc(n.id2 || n.id, n.tx, n.ty, n);
      }
    },
    addNpc(id, tx, ty, o) {
      o = o || {};
      const e = { type: 'npc', id, spr: o.spr || o.id || id, x: tx * 16 + 8, y: ty * 16 + 13, t: G.hash2(tx, ty, 3) * 9, face: o.face || 'r', sit: o.sit };
      this.list.push(e);
      return e;
    },
    find(id) { for (const e of this.list) if (!e.dead && (e.id === id || e.kind === id)) return e; return null; },
    remove(id) { const e = this.find(id); if (e) e.dead = true; },

    move(e, dx, dy, w, h) {
      let hit = false;
      if (dx) { if (!G.world.boxBlocked(e.x + dx, e.y, w, h)) e.x += dx; else hit = true; }
      if (dy) { if (!G.world.boxBlocked(e.x, e.y + dy, w, h)) e.y += dy; else hit = true; }
      return hit;
    },
    drop(x, y, item, n) { this.list.push({ type: 'pickup', item, n: n || 1, x, y, t: 0, vy: -50, z: 0 }); },
    tgt(e) {
      const d = this.decoy;
      if (d && !d.dead && G.dist(d.x, d.y, e.x, e.y) < 140 && !(e.def && e.def.seesThrough)) return d;
      return G.p;
    },

    spawn(kind, x, y, sp) {
      const d = DEF[kind];
      const e = {
        type: 'enemy', kind, x, y, hx: x, hy: y, hp: d.hp, def: d, st: 'idle', t: Math.random() * 2, cd: 0, dir: Math.random() < 0.5 ? 'l' : 'r',
        flash: 0, stun: 0, kbx: 0, kby: 0, vx: 0, vy: 0, anim: Math.random() * 3, z: 0, sp: sp || null, aa: 0, n: 0, side: Math.random() < 0.5 ? 1 : -1
      };
      this.list.push(e);
      return e;
    },
    // 날아가는 것: 화살, 총알, 던진 것
    shoot(src, kind, x, y, ang, spd, o) {
      const e = Object.assign({ type: 'proj', kind, src, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, t: 1.6, dmg: 1, a: ang, z: 0 }, o || {});
      this.list.push(e);
      return e;
    },

    // 주인공 둘레 밖에서 조용히 채워 넣고, 멀어지면 치운다
    spawner() {
      const m = G.world.cur, p = G.p, night = G.game.isNight(), now = G.game.clock();
      for (const sp of m.spawns) {
        const d = G.dist(sp.x, sp.y, p.x, p.y);
        if (sp.ent) {
          if (sp.ent.dead) sp.ent = null;
          else if (!sp.fixed && (d > 520 || (sp.night && !night))) {
            if (sp.night && d < 300) fx.puff(sp.ent.x, sp.ent.y - 6, '#b9d2cc', 6);
            sp.ent.dead = true; sp.ent = null;
          }
          continue;
        }
        if ((sp.deadUntil || 0) > now) continue;
        if (sp.night && !night) continue;
        if (sp.when && !sp.when(G.s)) continue;
        if (!sp.fixed && (d < (m.dark ? 150 : 235) || d > 430)) continue;
        sp.ent = this.spawn(sp.type, sp.x, sp.y, sp);
        if (sp.fixed) sp.ent.dir = 'r';
      }
    },

    hurtEnemy(e, dmg, post, fx0, fy0, o) {
      o = o || {};
      if (e.dead || e.hp <= 0 || e.inv > 0 || e.st === 'wait' || e.st === 'beaten' || e.st === 'friend' || e.st === 'stand') return false;
      const d = e.def;
      if (e.boss) return G.duel.intake(e, dmg, post, fx0, fy0, o);
      const dx = e.x - fx0, dy = e.y - fy0, l = Math.hypot(dx, dy) || 1;
      if (d.ai === 'post') {
        e.flash = 0.1; e.anim = 0; G.sfx('hit'); fx.puff(e.x, e.y - 8, '#e6cc78', 4, 50);
        fx.text(e.x, e.y - 22, '' + (Math.round(dmg * 10) / 10), o.heavy ? '#e6cc78' : '#f6f1e3');
        return true;
      }
      if (d.ai === 'deer') {
        e.st = 'flee'; e.t = 3; e.flash = 0.1; G.sfx('hit');
        if (!G.s.flags.deerHit) { G.s.flags.deerHit = 1; G.ui.toast('사슴은 신의 심부름꾼이라고 한다. 칼등으로 쳤다.'); }
        return true;
      }
      if (d.guard && !o.heavy && e.stun <= 0 && (e.st === 'idle' || e.st === 'chase') && Math.random() < d.guard) {
        e.kbx = dx / l * 60; e.kby = dy / l * 60; e.cd = Math.max(e.cd, 0.25); e.blk = 0.2;
        fx.spark(e.x - dx / l * 6, e.y - 10 - dy / l * 6, 6); G.sfx('clang');
        return false;
      }
      e.hp -= dmg; e.flash = 0.13;
      e.kbx = dx / l * (o.kb || 130); e.kby = dy / l * (o.kb || 130); e.stun = Math.max(e.stun, 0.22);
      if (e.st === 'aim' || e.st === 'lunge' || e.st === 'slash' || e.st === 'charge') { e.st = d.human || d.ghost ? 'chase' : 'idle'; e.cd = 0.6; }
      fx.puff(e.x, e.y - d.cy, d.ghost ? '#b9d2cc' : '#f6f1e3', 4, 60);
      G.sfx('hit'); fx.hitstop(o.heavy ? 0.07 : 0.035);
      if (e.hp <= 0) this.kill(e);
      else if (!e.yielded && !d.ghost && !d.passive && d.hp >= 2 && e.hp <= Math.ceil(d.hp * 0.34)) this.yield(e);
      return true;
    },
    // 쳐냈을 때
    parried(e, pp) {
      if (e.boss) { G.duel.parried(e, pp); return; }
      e.stun = 1.25; e.st = e.def.human || e.def.ghost ? 'chase' : 'idle'; e.cd = 0.5; e.flash = 0.12; e.reel = 1.25;
      const p = G.p, dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      e.kbx = dx / l * 90; e.kby = dy / l * 90;
    },

    // 기가 꺾이면 덤비지 않고 달아난다. 보내 줄지는 치는 쪽이 정한다.
    yield(e) {
      e.yielded = true; e.st = 'yield'; e.t = 7; e.z = 0;
      if (e.def.human) { fx.puff(e.x, e.y - 4, '#dfe6e8', 3, 30); G.sfx('stone'); }
      if (!G.s.flags.sawYield) { G.s.flags.sawYield = 1; G.ui.toast(e.def.human ? '칼을 버리고 물러선다. 보내 줄 수도 있다.' : '기가 꺾였다. 보내 줄 수도 있다.'); }
    },
    leave(e) {
      e.dead = true;
      if (e.sp) { e.sp.deadUntil = G.game.clock() + 700; e.sp.ent = null; }
      if (!e.counted) { e.counted = true; G.game.onSpare(e); }
    },
    kill(e) {
      e.dead = true;
      G.sfx('kill');
      const d = e.def;
      fx.puff(e.x, e.y - d.cy, d.ghost || e.kind === 'wisp' ? '#b9d2cc' : '#8e8f8c', 10, 50);
      if (e.sp) { e.sp.deadUntil = G.game.clock() + 700; e.sp.ent = null; }
      if (d.drop && Math.random() < d.drop[1]) this.drop(e.x, e.y, d.drop[0], 1);
      if (d.money) this.drop(e.x + 6, e.y, '$', d.money[0] + Math.floor(Math.random() * (d.money[1] - d.money[0] + 1)));
      G.game.onKill(e);
    },

    update(dt) {
      const p = G.p, safe = G.game.safe();
      for (const e of this.list) {
        if (e.dead) continue;
        if (e.type === 'npc') { e.t += dt; continue; }
        if (e.type === 'pickup') {
          e.t += dt;
          if (e.z < 0 || e.vy < 0) { e.vy += 400 * dt; e.z += e.vy * dt; if (e.z > 0) { e.z = 0; e.vy = 0; } }
          if (e.t > 0.3 && G.dist(e.x, e.y, p.x, p.y) < 13) {
            e.dead = true;
            if (e.item === '$') G.game.earn(e.n); else G.game.give(e.item, e.n);
          } else if (e.t > 90) e.dead = true;
          continue;
        }
        if (e.type === 'decoy' || e.type === 'fake') { e.t -= dt; if (e.t <= 0) { e.dead = true; fx.puff(e.x, e.y - 8, '#cfa64a', 8, 40); } continue; }
        if (e.type === 'actor') { e.t = (e.t || 0) + dt; if (e.think) e.think(e, dt); continue; }
        if (e.type === 'proj') { this.proj(e, dt, p); continue; }
        if (e.boss) { G.duel.think(e, dt); continue; }
        this.ai(e, dt, p, safe);
      }
      for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead) { if (this.list[i] === this.decoy) this.decoy = null; this.list.splice(i, 1); }
    },

    proj(e, dt, p) {
      e.t -= dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.grav) {
        // 포물선으로 던진 것: 땅에 닿는 자리에서만 맞는다
        e.vz -= e.grav * dt; e.z += e.vz * dt;
        if (e.z <= 0) {
          e.dead = true; G.sfx('thud'); G.game.shake(3); fx.dust(e.x, e.y, 8); fx.ring(e.x, e.y, e.rad || 16, '#c4a676');
          combat.strike(e.src, { k: 'circ', x: e.x, y: e.y - 6, r: e.rad || 16 }, { dmg: e.dmg, post: 40, unblock: e.unblock, sx: e.x, sy: e.y });
        }
        return;
      }
      const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16);
      if (e.t <= 0 || (!e.fly && G.world.tallTile(tx, ty))) { e.dead = true; fx.puff(e.x, e.y - 8, '#c4a676', 3, 30); return; }
      if (e.kind === 'log' && Math.random() < 0.3) fx.dust(e.x + (Math.random() - 0.5) * 20, e.y, 1);
      if (e.hitE) {
        for (const o of this.list) {
          if (o.type !== 'enemy' || o.dead) continue;
          if (Math.hypot(o.x - e.x, o.y - o.def.cy - (e.y - 8)) < o.def.r + 4) {
            e.dead = true; this.hurtEnemy(o, e.dmg + 1, 30, e.x - e.vx, e.y - e.vy, { heavy: true });
            break;
          }
        }
        return;
      }
      const d = this.decoy;
      if (d && !d.dead && Math.hypot(d.x - e.x, d.y - e.y) < 9) { e.dead = true; d.hp--; fx.puff(d.x, d.y - 8, '#e6cc78', 5, 40); if (d.hp <= 0) d.dead = true; return; }
      if (p.z < 10 && Math.hypot(p.x - e.x, p.y - 7 - (e.y - 8)) < (e.r || 6)) {
        const res = p.struck(e.src, { dmg: e.dmg, post: e.post || 14, pp: 10, unblock: e.unblock, sx: e.x - e.vx, sy: e.y - e.vy, proj: e, kb: 110 });
        if (res === 'parry' && !e.unblock) {
          // 쳐낸 화살은 쏜 자에게 돌아간다
          const s = e.src, a = s && !s.dead ? Math.atan2(s.y - 8 - e.y, s.x - e.x) : e.a + 3.1416, v = Math.hypot(e.vx, e.vy) * 1.25;
          e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; e.a = a; e.hitE = true; e.t = 1.2;
        } else if (res === 'hit' || res === 'block') e.dead = true;
        else if (res === 'dodge' || res === 'miss') e.passed = true;
      }
    },

    ai(e, dt, p, safe) {
      const d = e.def;
      e.anim += dt; e.t -= dt; e.cd -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.blk > 0) e.blk -= dt;
      if (e.reel > 0) e.reel -= dt;
      if (e.kbx || e.kby) {
        this.move(e, e.kbx * dt, e.kby * dt, 10, 7);
        e.kbx *= 0.8; e.kby *= 0.8;
        if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
      }
      if (e.stun > 0) { e.stun -= dt; return; }
      if (d.ai === 'post') return;
      const tg = this.tgt(e);
      const dx = tg.x - e.x, dy = tg.y - e.y;
      let dist = Math.hypot(dx, dy) || 1;
      const real = dist, rx = dx / real, ry = dy / real, fa = Math.atan2(dy, dx);
      if (safe && tg === p) dist = 9999;
      const ux = dx / dist, uy = dy / dist;
      const go = (vx, vy) => {
        if (vx > 0.1) e.dir = 'r'; else if (vx < -0.1) e.dir = 'l';
        e.mv = true;
        if (d.fly) { e.x += vx * dt; e.y += vy * dt; return false; }
        return this.move(e, vx * dt, vy * dt, 10, 7);
      };
      const wander = spd => {
        if (e.t <= 0) {
          e.t = 0.8 + Math.random() * 2;
          if (Math.random() < 0.45 || G.dist(e.x, e.y, e.hx, e.hy) > 70) {
            const a = G.dist(e.x, e.y, e.hx, e.hy) > 70 ? Math.atan2(e.hy - e.y, e.hx - e.x) : Math.random() * 6.283;
            e.vx = Math.cos(a) * spd; e.vy = Math.sin(a) * spd;
          } else e.vx = e.vy = 0;
        }
        if (e.vx || e.vy) { if (go(e.vx, e.vy)) e.vx = e.vy = 0; }
      };
      e.mv = false;

      if (e.st === 'yield' || e.st === 'fed') {
        const v = e.st === 'fed' ? 22 : Math.max(d.spd, 44) * 1.15;
        if (e.st === 'yield' || e.t < 5.2) go(-rx * v, -ry * v);
        if (real > 170 || e.t <= 0) { fx.puff(e.x, e.y - d.cy, '#c4a676', 4, 30); this.leave(e); }
        return;
      }
      let touch = true;
      switch (d.ai) {
        case 'crab':
          if (dist < 60) go(Math.sign(dx) * d.spd * 1.3, Math.sign(dy) * d.spd * (Math.abs(dy) > 6 ? 0.5 : 0));
          else {
            if (e.t <= 0) { e.t = 1 + Math.random() * 2; e.vx = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1) * d.spd; }
            if (e.vx && go(e.vx, 0)) e.vx = -e.vx;
          }
          break;
        case 'dog':
          if (e.st === 'back') { go(-ux * d.spd * 0.8, -uy * d.spd * 0.8); if (e.t <= 0) e.st = 'idle'; }
          else if (dist < d.sight || (e.st === 'chase' && dist < d.sight + 50)) {
            e.st = 'chase';
            // 살짝 돌아 들어온다
            const k = dist > 40 ? 0.45 : 0;
            go((ux - uy * k * e.side) * d.spd, (uy + ux * k * e.side) * d.spd);
          } else { e.st = 'idle'; wander(d.spd * 0.4); }
          break;
        case 'boar':
          if (e.st === 'idle') {
            wander(d.spd);
            if (dist < 104 && e.cd <= 0) { e.st = 'aim'; e.t = 0.6; e.dir = dx > 0 ? 'r' : 'l'; }
          } else if (e.st === 'aim') {
            if (e.t <= 0) { e.st = 'charge'; e.t = 1.1; e.vx = ux * 178; e.vy = uy * 178; G.sfx('dash'); }
          } else if (e.st === 'charge') {
            const hit = go(e.vx, e.vy);
            if (Math.random() < 0.5) fx.parts.push({ x: e.x, y: e.y, vx: 0, vy: -8, life: 0.3, col: '#c4a676', s: 2 });
            if (hit) { e.st = 'rest'; e.t = 1.0; e.stun = 0; G.sfx('thud'); G.game.shake(3); fx.puff(e.x, e.y - 6, '#c4a676', 8); }
            else if (e.t <= 0) { e.st = 'rest'; e.t = 0.5; }
          } else if (e.t <= 0) { e.st = 'idle'; e.cd = 0.8; e.t = 0; }
          break;
        case 'bat':
          if (dist < 120) go(ux * d.spd + Math.sin(e.anim * 7) * 34, uy * d.spd + Math.cos(e.anim * 5) * 34);
          else go(Math.sin(e.anim * 2) * 14 + (e.hx - e.x) * 0.5, Math.cos(e.anim * 3) * 10 + (e.hy - e.y) * 0.5);
          break;
        case 'wisp':
          if (dist < 110) go(ux * d.spd + Math.sin(e.anim * 2.2) * 14, uy * d.spd + Math.cos(e.anim * 1.7) * 10);
          else go(Math.sin(e.anim * 0.9) * 10 + (e.hx - e.x) * 0.3, Math.cos(e.anim * 1.3) * 8 + (e.hy - e.y) * 0.3);
          break;
        case 'kite': {
          // 높이 돌다가 주먹밥을 보고 내리꽂는다
          touch = false;
          if (e.st === 'idle') {
            e.z = 26; go(Math.cos(e.anim * 0.8) * 40 + (e.hx - e.x) * 0.4, Math.sin(e.anim * 0.8) * 26 + (e.hy - e.y) * 0.4);
            if (tg === p && real < 130 && e.cd <= 0 && G.game.count('rice') > 0 && !safe) { e.st = 'swoop'; e.t = 1.4; G.sfx('wind'); }
          } else if (e.st === 'swoop') {
            e.z = Math.max(4, e.z - 60 * dt); go(rx * 120, ry * 120);
            if (real < 10 && e.z < 12) {
              if (p.inv <= 0 && p.st !== 'guard') { G.game.take('rice', 1); G.ui.toast('솔개가 주먹밥을 채 갔다.'); G.sfx('deny'); e.loot = 1; G.s.flags.kiteStole = 1; }
              e.st = 'away'; e.t = 4; e.vx = -rx * 90 + 40; e.vy = -70;
            } else if (e.t <= 0) { e.st = 'idle'; e.cd = 5; }
          } else { e.z = Math.min(40, e.z + 50 * dt); go(e.vx, e.vy); if (e.t <= 0) { e.st = 'idle'; e.cd = 9; e.hx = e.x; e.hy = e.y; } }
          break;
        }
        case 'deer':
          touch = false;
          if (e.st === 'flee') { go(-rx * d.spd * 1.5, -ry * d.spd * 1.5); if (e.t <= 0) e.st = 'idle'; }
          else if (real < 26 && tg === p && p.st !== 'idle') { e.st = 'flee'; e.t = 1.2; }
          else wander(d.spd * 0.25);
          break;
        case 'kappa':
          // 절을 받으면 맞절을 하고, 접시의 물이 쏟아진다
          if (e.st === 'bowback') { touch = false; if (e.t <= 0) { fx.puff(e.x, e.y - 14, '#b9d2cc', 10, 50); G.sfx('splash'); this.yield(e); e.bowed = true; } }
          else if (dist < d.sight || e.hp < d.hp) {
            e.st = 'chase';
            const ph = e.anim % 0.6;
            if (ph < 0.3) go(ux * d.spd * 1.5, uy * d.spd * 1.5);
          } else { e.st = 'idle'; wander(d.spd * 0.4); }
          break;
        case 'melee': case 'spear': {
          touch = false;
          const reach = d.reach || 24;
          if (e.st === 'idle' || e.st === 'chase') {
            if (dist < (d.sight || 90) || (e.st === 'chase' && dist < (d.sight || 90) + 50) || (e.hp < d.hp && dist < 200)) {
              e.st = 'chase';
              if (dist > reach - 3) { const k = dist > 46 ? 0.4 : 0; go((ux - uy * k * e.side) * d.spd, (uy + ux * k * e.side) * d.spd); }
              else if (dist < reach - 13) go(-ux * d.spd * 0.6, -uy * d.spd * 0.6);
              else e.dir = dx > 0 ? 'r' : 'l';
              if (dist < reach + 1 && e.cd <= 0) { e.st = 'aim'; e.t = d.wind || 0.5; e.aa = fa; e.n = d.combo || 1; e.dir = dx > 0 ? 'r' : 'l'; }
            } else { e.st = 'idle'; wander(d.spd * 0.4); }
          } else if (e.st === 'aim') {
            if (e.t > (d.wind || 0.5) * 0.35) { e.aa = fa; e.dir = dx > 0 ? 'r' : 'l'; }
            if (e.t <= 0) {
              e.st = 'slash'; e.t = 0.16; G.sfx(d.ai === 'spear' ? 'thrust' : 'swing');
              const ox = e.x, oy = e.y - 9;
              if (d.ai === 'spear') {
                this.move(e, Math.cos(e.aa) * 6, Math.sin(e.aa) * 6, 10, 7);
                fx.line(ox + Math.cos(e.aa) * 10, oy + Math.sin(e.aa) * 10, ox + Math.cos(e.aa) * (reach + 8), oy + Math.sin(e.aa) * (reach + 8), '#f6f1e3', 0.14);
                combat.strike(e, { k: 'box', x: ox, y: oy, a: e.aa, len: reach + 8, w: 9 }, { dmg: d.dmg, post: 24 });
              } else {
                fx.arc(ox, oy, e.aa, reach, 2.0, e.side, d.ghost ? '#b9d2cc' : '#f6f1e3', 0.15);
                combat.strike(e, { k: 'arc', x: ox, y: oy, a: e.aa, half: 1.0, r: reach + 2 }, { dmg: d.dmg, post: 26 });
              }
            }
          } else if (e.st === 'slash') {
            if (e.t <= 0) { if (--e.n > 0) { e.st = 'aim'; e.t = 0.3; e.aa = fa; e.side = -e.side; } else { e.st = 'rest'; e.t = d.rest || 0.7; } }
          } else if (e.st === 'rest') { if (e.t <= 0) { e.st = 'chase'; e.cd = 0.3 + Math.random() * 0.6; } }
          break;
        }
        case 'archer': case 'gunner': {
          touch = false;
          const range = d.range || 130, gun = d.ai === 'gunner';
          if (e.st === 'idle') { if (dist < range + 10) e.st = 'chase'; else wander(d.spd * 0.4); }
          else if (e.st === 'chase') {
            if (dist < 54) go(-ux * d.spd, -uy * d.spd);
            else if (dist > range - 16) go(ux * d.spd * 0.8, uy * d.spd * 0.8);
            else { go(-uy * d.spd * 0.3 * e.side, ux * d.spd * 0.3 * e.side); if (Math.random() < 0.01) e.side = -e.side; }
            e.dir = dx > 0 ? 'r' : 'l';
            if (e.cd <= 0 && dist < range && dist > 30) { e.st = 'aim'; e.t = gun ? 1.35 : 0.85; e.aa = fa; if (gun) G.sfx('fuse'); }
            if (dist > range + 70) e.st = 'idle';
          } else if (e.st === 'aim') {
            if (e.t > (gun ? 0.3 : 0.12)) e.aa = fa;
            e.dir = Math.cos(e.aa) > 0 ? 'r' : 'l';
            if (e.t <= 0) {
              const ox = e.x + Math.cos(e.aa) * 8, oy = e.y + Math.sin(e.aa) * 8;
              if (gun) { this.shoot(e, 'bullet', ox, oy, e.aa, 460, { dmg: d.dmg, unblock: true, t: 0.6, r: 5 }); G.sfx('gun'); G.game.shake(2); fx.puff(ox, oy - 9, '#e8e2d0', 8, 50); }
              else { this.shoot(e, 'arrow', ox, oy, e.aa, 185, { dmg: d.dmg }); G.sfx('bow'); }
              e.st = 'rest'; e.t = gun ? 0.9 : 0.5; e.cd = gun ? 2.6 : 1.3 + Math.random();
            }
          } else if (e.st === 'rest') { if (e.t <= 0) e.st = 'chase'; }
          break;
        }
      }
      // 닿으면 다친다(짐승과 잡것)
      if (touch && tg === p && e.st !== 'rest' && d.dmg && Math.abs(p.x - e.x) < d.r + 4 && Math.abs((p.y - 6) - (e.y - d.cy)) < d.r + 3) {
        const res = p.struck(e, { dmg: d.dmg, post: 20, sx: e.x, sy: e.y, body: true });
        if (res === 'hit' || res === 'block' || res === 'parry') {
          if (e.kind === 'wisp') { e.hp = 0; this.kill(e); }
          else if (d.ai === 'dog' || d.ai === 'kappa') { e.st = 'back'; e.t = 0.55; if (d.ai === 'kappa') { e.st = 'chase'; e.stun = 0.5; } }
          else if (d.ai === 'boar' && e.st === 'charge') { e.st = 'rest'; e.t = 0.8; }
          else if (d.ai === 'crab' || d.ai === 'bat') e.stun = 0.4;
        }
      }
    }
  };

  // ======================= 그리기 =======================
  E.shadow = function (ctx, x, y, w) {
    ctx.fillStyle = 'rgba(20,18,26,0.28)';
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y) - 1, w - 2, 1);
    ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y) + 2, w - 2, 1);
  };
  const flips = new Map();
  function flipped(img) { let f = flips.get(img); if (!f) flips.set(img, f = G.art.flip(img)); return f; }
  // 든 것의 각도: 겨눌 때 뒤로 젖히고, 칠 때 앞으로 돈다
  function wang(e) {
    const d = e.def, sg = e.side || 1;
    if (d.ai === 'spear') {
      if (e.st === 'aim') return [e.aa, -6 * (1 - Math.max(0, e.t) / (d.wind || 0.5))];
      if (e.st === 'slash') return [e.aa, 8];
      return [e.dir === 'r' ? -0.5 : 3.64, 0];
    }
    if (e.st === 'aim') return [e.aa - sg * (1.5 + 0.9 * (1 - Math.max(0, e.t) / (d.wind || 0.5))), 0];
    if (e.st === 'slash') return [e.aa - sg * 1.4 + sg * 2.6 * (1 - Math.max(0, e.t) / 0.16), 0];
    if (e.st === 'rest') return [e.aa + sg * 1.3, 0];
    if (e.st === 'yield') return null;
    if (e.reel > 0) return [e.dir === 'r' ? -2.2 : -0.94, 0];
    return [e.dir === 'r' ? -0.9 : -2.24, 0];
  }
  E.draw = function (e, ctx, cx, cy, time) {
    const S = G.spr, x = Math.round(e.x - cx), y = Math.round(e.y - cy);
    if (e.type === 'npc') {
      let img = S.npc[e.spr] || (S.f[e.spr] && S.f[e.spr].r[0]);
      if (!img) return;
      if (e.face === 'l') img = flipped(img);
      this.shadow(ctx, x, y - 1, img.width > 18 ? 18 : 12);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 + (Math.floor(e.t * 1.3) % 4 === 0 ? 1 : 0));
      return;
    }
    if (e.type === 'pickup') {
      const img = e.item === '$' ? S.coin : S.pouch;
      this.shadow(ctx, x, y, 8);
      if (e.t > 75 && Math.floor(e.t * 6) % 2) return;
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + Math.round(e.z) - (Math.floor(e.t * 3) % 2));
      return;
    }
    if (e.type === 'decoy' || e.type === 'fake') {
      this.shadow(ctx, x, y - 1, 12);
      if (e.t < 1.2 && Math.floor(e.t * 10) % 2) return;
      ctx.drawImage(S.dummy, x - 7, y - S.dummy.height + 1);
      return;
    }
    if (e.type === 'actor') {
      let img = e.img || (S.f[e.spr] ? S.f[e.spr][e.dir || 'r'][e.walk ? Math.floor(e.t * 6) % 2 : 0] : S.npc[e.spr] || S[e.spr]);
      if (Array.isArray(img)) img = img[Math.floor(e.t * 5) % img.length];
      if (!img) return;
      if (!e.flat) this.shadow(ctx, x, y - 1, img.width > 20 ? 20 : 12);
      if (e.lie) { ctx.save(); ctx.translate(x, y - 5); ctx.rotate(1.5708); ctx.drawImage(img, -8, -9); ctx.restore(); return; }
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 - Math.round(e.z || 0));
      if (e.wpn && e.wa !== undefined) fx.blade(ctx, x + (e.dir === 'l' ? -4 : 4), y - 8, e.wa, e.wpn);
      return;
    }
    if (e.type === 'proj') {
      const yy = y - 8 - Math.round(e.z || 0);
      if (e.grav) fx.danger(ctx, Math.round(e.lx - cx), Math.round(e.ly - cy), e.rad || 16, 0.5 + 0.5 * Math.sin(time * 20));
      if (e.kind === 'log') {
        // 굴러오는 길이 붉게 보인다
        const l = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / l, uy = e.vy / l;
        ctx.fillStyle = 'rgba(200,69,47,0.16)';
        for (let i = 14; i < Math.min(150, e.t * l); i += 6) ctx.fillRect(Math.round(x + ux * i - Math.abs(uy) * 14 - 3), Math.round(y - 6 + uy * i - Math.abs(ux) * 5), Math.round(6 + Math.abs(uy) * 28), Math.round(6 + Math.abs(ux) * 8));
        this.shadow(ctx, x, y, 26);
        const lg = S.log[Math.floor(time * 10) % 2];
        ctx.drawImage(lg, x - 15, y - 12);
        return;
      }
      if (e.kind === 'arrowrain') { fx.arrow(ctx, x, yy, 1.5708); return; }
      if (e.kind === 'arrow') fx.arrow(ctx, x, yy, e.a);
      else if (e.kind === 'bullet') { ctx.fillStyle = '#1b1a1f'; ctx.fillRect(x - 2, yy - 2, 4, 4); ctx.fillStyle = '#e6cc78'; ctx.fillRect(x - 1, yy - 1, 2, 2); }
      else if (e.kind === 'mallet') { this.shadow(ctx, x, y, 8); fx.blade(ctx, x, yy, time * 14, 'mallet'); }
      else if (e.kind === 'rock') { this.shadow(ctx, x, y, 12); const r = S.rock[2]; ctx.drawImage(r, x - 11, yy - 8); }
      else if (e.kind === 'wave') { ctx.fillStyle = '#f6f1e3'; for (let i = -5; i <= 5; i++) ctx.fillRect(Math.round(x - Math.sin(e.a) * i - Math.cos(e.a) * Math.abs(i) * 0.5), Math.round(yy + Math.cos(e.a) * i - Math.sin(e.a) * Math.abs(i) * 0.5), 2, 2); }
      return;
    }
    const d = e.def;
    if (e.boss) { G.duel.draw(e, ctx, cx, cy, time); return; }
    const set = (d.f ? S.f[d.f] : S[d.spr]);
    let img;
    if (d.ai === 'post') img = S.makiwara;
    else {
      let fr = Math.floor(e.anim * 5) % 2;
      if (d.human || d.ghost) fr = e.mv ? Math.floor(e.anim * 6) % 2 : 0;
      if (d.ai === 'boar' && e.st !== 'charge') fr = (e.vx || e.vy) ? fr : 0;
      if (d.ai === 'bat' || d.ai === 'kite') fr = Math.floor(e.anim * 9) % 2;
      img = set[e.dir][fr];
    }
    let ox = 0, oy = 0;
    if (d.ai === 'boar' && e.st === 'aim') ox = Math.floor(e.anim * 30) % 2 ? 1 : -1;
    if (d.ai === 'post' && e.flash > 0) ox = Math.floor(e.flash * 60) % 2 ? 1 : -1;
    if (d.ai === 'bat') oy = -8 + Math.round(Math.sin(e.anim * 6) * 2);
    if (d.ai === 'wisp') oy = -4 + Math.round(Math.sin(e.anim * 3) * 2);
    if (d.ai === 'kappa' && e.st === 'bowback') oy = 3;
    if (e.kind !== 'wisp') this.shadow(ctx, x, y - 1, d.ai === 'boar' ? 20 : d.fly ? 8 : 12);
    const tele = e.st === 'aim' && Math.floor(e.anim * 16) % 2 && e.t < 0.3;
    if (e.flash > 0 || tele) img = G.art.white(img);
    const dx = x - (img.width >> 1) + ox, dy = y - img.height + 1 + oy - Math.round(e.z || 0);
    if (e.st === 'yield' && Math.floor(e.anim * 6) % 2) {
      // 진땀
      ctx.fillStyle = '#b9d2cc'; ctx.fillRect(dx + img.width - 2, dy - 2, 1, 2); ctx.fillRect(dx + img.width + 1, dy + 1, 1, 2);
    }
    if (e.reel > 0) { ctx.fillStyle = '#e6cc78'; const k = Math.floor(time * 8) % 3; ctx.fillRect(x - 5 + k * 4, dy - 4, 2, 2); ctx.fillRect(x + 3 - k * 3, dy - 6, 1, 1); }
    if (d.ghost) ctx.globalAlpha = 0.72;
    const w = (d.wpn && d.ai !== 'post') ? wang(e) : null;
    const behind = w && Math.sin(w[0]) < -0.2;
    const hand = () => {
      if (!w) return;
      const hx = x + (e.dir === 'r' ? 4 : -4) + Math.round(Math.cos(w[0]) * w[1]), hy = y - 8 + Math.round(Math.sin(w[0]) * w[1]);
      if (d.wpn === 'bow') { const pull = e.st === 'aim' ? 1 - Math.max(0, e.t) / 0.85 : 0; fx.bow(ctx, x + Math.round(Math.cos(e.st === 'aim' ? e.aa : (e.dir === 'r' ? 0 : 3.14)) * 5), y - 9, e.st === 'aim' ? e.aa : (e.dir === 'r' ? 0 : 3.14), pull); }
      else if (d.wpn === 'gun') fx.blade(ctx, x + (e.dir === 'r' ? 2 : -2), y - 9, e.st === 'aim' || e.st === 'rest' ? e.aa : (e.dir === 'r' ? 0.5 : 2.64), 'gun');
      else fx.blade(ctx, hx, hy, w[0], d.wpn);
    };
    if (behind) hand();
    ctx.drawImage(img, dx, dy);
    if (!behind) hand();
    if (d.ghost) ctx.globalAlpha = 1;
    if (d.ai === 'gunner' && e.st === 'aim') {
      // 겨누는 줄
      ctx.fillStyle = e.t < 0.3 ? '#e2714a' : 'rgba(226,113,74,0.5)';
      for (let i = 20; i < 150; i += e.t < 0.3 ? 3 : 6) ctx.fillRect(Math.round(x + Math.cos(e.aa) * i), Math.round(y - 9 + Math.sin(e.aa) * i), 1, 1);
    }
    if ((d.ai === 'melee' || d.ai === 'spear') && e.st === 'aim' && e.t < 0.26) fx.glint(ctx, x + Math.round(Math.cos(e.aa) * 8), y - 20, false, time);
    if (e.blk > 0) fx.glint(ctx, x, y - 12, false, time);
  };
})();
