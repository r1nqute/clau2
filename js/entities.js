'use strict';
// 들에서 움직이는 것들: 사람, 짐승, 잡것, 떨어진 물건, 굴러오는 통나무, 장면용 배우.
// 들에 보이는 적에 닿으면 싸움(battle.js)이 된다.
(function () {
  const G = window.G, fx = G.fx;

  // 들에서의 생김새와 움직임. f는 사람 그림, spr는 짐승 그림.
  // ai: chase 보면 쫓아온다 · wander 돌아다니기만 한다 · post 서 있다 · kite 주먹밥을 노린다 · deer 사람을 피한다
  const DEF = {
    heike: { spr: 'heike', spd: 30, sight: 56, r: 6, cy: 5, ai: 'chase' },
    crab: { spr: 'crab', spd: 30, sight: 56, r: 6, cy: 5, ai: 'chase' },
    dog: { spr: 'dog', spd: 66, sight: 88, r: 7, cy: 6, ai: 'chase' },
    wolf: { spr: 'wolf', spd: 72, sight: 104, r: 7, cy: 6, ai: 'chase' },
    boar: { spr: 'boar', spd: 54, sight: 80, r: 9, cy: 7, ai: 'chase', big: 1 },
    bat: { spr: 'bat', spd: 56, sight: 96, r: 5, cy: 10, ai: 'chase', fly: 1 },
    wisp: { spr: 'wisp', spd: 30, sight: 100, r: 5, cy: 8, ai: 'chase', fly: 1, light: 26 },
    ghost: { f: 'ghost', wpn: 'tachi', spd: 34, sight: 96, r: 6, cy: 9, ai: 'chase', ghost: 1, light: 18 },
    kappa: { spr: 'kappa', spd: 44, sight: 72, r: 6, cy: 7, ai: 'chase' },
    ochi: { f: 'ochi', wpn: 'tachi', spd: 44, sight: 92, r: 6, cy: 9, ai: 'chase', human: 1 },
    bandit: { f: 'bandit', wpn: 'kal', spd: 50, sight: 96, r: 6, cy: 9, ai: 'chase', human: 1 },
    roto: { f: 'roto', wpn: 'tachi', spd: 48, sight: 84, r: 6, cy: 9, ai: 'chase', human: 1 },
    akuto: { f: 'akuto', wpn: 'stick', spd: 56, sight: 100, r: 6, cy: 9, ai: 'chase', human: 1 },
    archer: { f: 'archer', wpn: 'bow', spd: 40, sight: 110, r: 6, cy: 9, ai: 'chase', human: 1 },
    ashiT: { f: 'ashiT', wpn: 'yari', spd: 44, sight: 90, r: 6, cy: 9, ai: 'chase', human: 1 },
    ashiU: { f: 'ashiU', wpn: 'yari', spd: 44, sight: 90, r: 6, cy: 9, ai: 'chase', human: 1 },
    gunner: { f: 'gunner', wpn: 'gun', spd: 36, sight: 120, r: 6, cy: 9, ai: 'chase', human: 1 },
    ronin: { f: 'ronin', wpn: 'tachi', spd: 52, sight: 92, r: 6, cy: 9, ai: 'chase', human: 1 },
    kabuki: { f: 'kabuki', wpn: 'nodachi', spd: 54, sight: 92, r: 6, cy: 9, ai: 'chase', human: 1 },
    kite: { spr: 'kite', spd: 84, r: 6, cy: 12, ai: 'kite', fly: 1, passive: 1 },
    deer: { spr: 'deer', spd: 66, r: 7, cy: 7, ai: 'deer', passive: 1 },
    makiwara: { img: 'makiwara', spd: 0, r: 6, cy: 8, ai: 'post' }
  };

  const E = G.E = {
    list: [], DEF,

    reset() {
      this.list.length = 0;
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
    remove(id) { for (const e of this.list) if (e.id === id || e.kind === id) e.dead = true; },
    move(e, dx, dy, w, h) {
      let hit = false;
      if (dx) { if (!G.world.boxBlocked(e.x + dx, e.y, w, h)) e.x += dx; else hit = true; }
      if (dy) { if (!G.world.boxBlocked(e.x, e.y + dy, w, h)) e.y += dy; else hit = true; }
      return hit;
    },
    drop(x, y, item, n) { this.list.push({ type: 'pickup', item, n: n || 1, x, y, t: 0, vy: -50, z: 0 }); },
    spawn(kind, x, y, sp) {
      const d = DEF[kind];
      const e = { type: 'enemy', kind, def: d, x, y, hx: x, hy: y, st: 'idle', t: Math.random() * 2, dir: Math.random() < 0.5 ? 'l' : 'r', vx: 0, vy: 0, anim: Math.random() * 3, z: 0, sp: sp || null, calm: 0, alert: 0, cd: 0 };
      this.list.push(e);
      return e;
    },
    // 굴러오는 통나무(지하야)
    shoot(src, kind, x, y, ang, spd, o) {
      const e = Object.assign({ type: 'proj', kind, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, t: 1.6, a: ang, r: 12 }, o || {});
      this.list.push(e);
      return e;
    },
    // 들것을 치운다. 싸움에서 이겼거나 보냈으면 한참 뒤에야 다시 나온다.
    gone(e, long) {
      e.dead = true;
      if (e.sp) { e.sp.deadUntil = G.game.clock() + (long ? 700 : 2); e.sp.ent = null; }
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
        if (e.type === 'actor') { e.t = (e.t || 0) + dt; if (e.think) e.think(e, dt); continue; }
        if (e.type === 'proj') { this.proj(e, dt, p); continue; }
        if (e.boss) { e.anim += dt; continue; }
        this.ai(e, dt, p, safe);
      }
      for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead) this.list.splice(i, 1);
    },

    proj(e, dt, p) {
      e.t -= dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (Math.random() < 0.3) fx.dust(e.x + (Math.random() - 0.5) * 20, e.y, 1);
      if (e.t <= 0) { e.dead = true; fx.puff(e.x, e.y - 6, '#c4a676', 6, 30); return; }
      if (p.z < 10 && p.hurtInv <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < e.r) {
        // 통나무에 치였다. 쓰러지지는 않는다.
        const s = G.s, dmg = Math.max(1, Math.min(s.hp - 1, Math.ceil(s.maxhp * 0.12)));
        if (dmg > 0) s.hp -= dmg;
        G.fx.text(p.x, p.y - 24, '-' + dmg, '#cf6a3d');
        p.hurtInv = 1; p.st = 'hurt'; p.t = 0.25;
        const l = Math.hypot(e.vx, e.vy) || 1;
        p.kbx = -e.vy / l * 160 * (Math.random() < 0.5 ? 1 : -1); p.kby = e.vy / l * 60;
        G.sfx('hurt'); G.game.shake(4);
      }
    },

    ai(e, dt, p, safe) {
      const d = e.def;
      e.anim += dt; e.t -= dt;
      if (e.calm > 0) e.calm -= dt;
      if (e.alert > 0) e.alert -= dt;
      if (e.cd > 0) e.cd -= dt;
      if (d.ai === 'post') return;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
      const busy = G.ui.busy() || G.game.frozen();
      e.mv = false;
      const go = (vx, vy) => {
        if (vx > 0.1) e.dir = 'r'; else if (vx < -0.1) e.dir = 'l';
        e.mv = true;
        if (d.fly) { e.x += vx * dt; e.y += vy * dt; return false; }
        return this.move(e, vx * dt, vy * dt, 10, 7);
      };
      const wander = spd => {
        if (e.t <= 0) {
          e.t = 0.8 + Math.random() * 2;
          const far = G.dist(e.x, e.y, e.hx, e.hy) > 70;
          if (Math.random() < 0.45 || far) {
            const a = far ? Math.atan2(e.hy - e.y, e.hx - e.x) : Math.random() * 6.283;
            e.vx = Math.cos(a) * spd; e.vy = Math.sin(a) * spd;
          } else e.vx = e.vy = 0;
        }
        if (e.vx || e.vy) { if (go(e.vx, e.vy)) e.vx = e.vy = 0; }
      };
      if (d.ai === 'kite') {
        // 높이 돌다가 주먹밥을 보고 내리꽂는다
        if (e.st === 'idle') {
          e.z = 26; go(Math.cos(e.anim * 0.8) * 40 + (e.hx - e.x) * 0.4, Math.sin(e.anim * 0.8) * 26 + (e.hy - e.y) * 0.4);
          if (!busy && dist < 130 && e.cd <= 0 && G.game.count('rice') > 0 && !safe) { e.st = 'swoop'; e.t = 1.4; G.sfx('wind'); }
        } else if (e.st === 'swoop') {
          e.z = Math.max(4, e.z - 60 * dt); go(ux * 120, uy * 120);
          if (dist < 10 && e.z < 12) {
            if (G.game.count('rice') > 0) { G.game.take('rice', 1); G.ui.toast('솔개가 주먹밥을 채 갔다.'); G.sfx('deny'); G.s.flags.kiteStole = 1; }
            e.st = 'away'; e.t = 4; e.vx = -ux * 90 + 40; e.vy = -70;
          } else if (e.t <= 0) { e.st = 'idle'; e.cd = 5; }
        } else { e.z = Math.min(40, e.z + 50 * dt); go(e.vx, e.vy); if (e.t <= 0) { e.st = 'idle'; e.cd = 9; e.hx = e.x; e.hy = e.y; } }
        return;
      }
      if (d.ai === 'deer') {
        if (e.st === 'flee') { go(-ux * d.spd * 1.4, -uy * d.spd * 1.4); if (e.t <= 0) e.st = 'idle'; }
        else if (dist < 34 && p.run) { e.st = 'flee'; e.t = 1.2; }
        else wander(d.spd * 0.25);
        return;
      }
      // 쫓아오는 것들
      if (e.calm > 0) { if (dist < 60) go(-ux * d.spd * 0.8, -uy * d.spd * 0.8); else wander(d.spd * 0.3); return; }
      const sees = !safe && !busy && p.safeT <= 0 && dist < d.sight;
      if (e.st === 'chase') {
        if (!sees && dist > d.sight + 60 || safe) { e.st = 'idle'; }
        else if (e.alert <= 0 && !busy) {
          const k = dist > 40 ? 0.35 : 0, side = (e.hx + e.hy) % 2 ? 1 : -1;
          go((ux - uy * k * side) * d.spd, (uy + ux * k * side) * d.spd);
        }
      } else {
        wander(d.spd * 0.35);
        if (sees) { e.st = 'chase'; e.alert = 0.45; e.dir = dx > 0 ? 'r' : 'l'; G.sfx('move'); }
      }
      // 닿으면 싸움이 된다
      if (!busy && p.safeT <= 0 && p.z < 8 && Math.abs(dx) < d.r + 6 && Math.abs(dy) < d.r + 4) G.game.engage(e, false);
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
      // 굴러오는 길이 붉게 보인다
      const l = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / l, uy = e.vy / l;
      ctx.fillStyle = 'rgba(200,69,47,0.16)';
      for (let i = 14; i < Math.min(150, e.t * l); i += 6) ctx.fillRect(Math.round(x + ux * i - Math.abs(uy) * 14 - 3), Math.round(y - 6 + uy * i - Math.abs(ux) * 5), Math.round(6 + Math.abs(uy) * 28), Math.round(6 + Math.abs(ux) * 8));
      this.shadow(ctx, x, y, 26);
      ctx.drawImage(S.log[Math.floor(time * 10) % 2], x - 15, y - 12);
      return;
    }
    if (e.boss) { G.duel.draw(e, ctx, cx, cy, time); return; }
    const d = e.def;
    let img;
    if (d.img) img = S[d.img];
    else {
      const set = d.f ? S.f[d.f] : S[d.spr];
      let fr = Math.floor(e.anim * 5) % 2;
      if (d.f) fr = e.mv ? Math.floor(e.anim * 6) % 2 : 0;
      if (d.fly) fr = Math.floor(e.anim * 9) % 2;
      img = set[e.dir][fr];
    }
    let oy = 0;
    if (d.spr === 'bat') oy = -8 + Math.round(Math.sin(e.anim * 6) * 2);
    if (d.spr === 'wisp') oy = -4 + Math.round(Math.sin(e.anim * 3) * 2);
    if (d.spr !== 'wisp') this.shadow(ctx, x, y - 1, d.big ? 20 : d.fly ? 8 : 12);
    if (e.calm > 0 && Math.floor(e.calm * 8) % 2) return;
    if (d.ghost) ctx.globalAlpha = 0.72;
    const dx = x - (img.width >> 1), dy = y - img.height + 1 + oy - Math.round(e.z || 0);
    const wa = e.st === 'chase' ? (e.dir === 'r' ? -0.5 : -2.64) : (e.dir === 'r' ? 1.1 : 2.04);
    const hand = () => {
      if (!d.wpn) return;
      if (d.wpn === 'bow') fx.bow(ctx, x + (e.dir === 'r' ? 5 : -5), y - 9, e.dir === 'r' ? 0 : 3.14, 0);
      else if (d.wpn === 'gun') fx.blade(ctx, x + (e.dir === 'r' ? 2 : -2), y - 9, e.dir === 'r' ? 0.5 : 2.64, 'gun');
      else fx.blade(ctx, x + (e.dir === 'r' ? 4 : -4), y - 8, wa, d.wpn);
    };
    if (Math.sin(wa) < -0.2) hand();
    ctx.drawImage(img, dx, dy);
    if (Math.sin(wa) >= -0.2) hand();
    if (d.ghost) ctx.globalAlpha = 1;
    // 알아챘다
    if (e.alert > 0) {
      const by = dy - 10 - Math.round(Math.sin((0.45 - e.alert) * 14) * 2);
      ctx.fillStyle = '#1b1a1f'; ctx.fillRect(x - 2, by - 1, 5, 11);
      ctx.fillStyle = '#e2714a'; ctx.fillRect(x - 1, by, 3, 6); ctx.fillRect(x - 1, by + 7, 3, 2);
    }
  };
})();
