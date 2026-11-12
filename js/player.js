'use strict';
// 들에서의 주인공: 걷고, 달리고, 말을 걸고, 살핀다. 싸움은 battle.js에서 차례로 한다.
// 들에 보이는 것에 닿으면 싸움이 된다. 등 뒤나 옆에서 먼저 치면 한 차례 먼저 움직인다.
(function () {
  const G = window.G, fx = G.fx, E = G.E;
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIRA = { up: -1.5708, down: 1.5708, left: 3.1416, right: 0 };

  const P = G.p = {
    x: 0, y: 0, z: 0, dir: 'down', aim: 1.5708, st: 'idle', t: 0, walk: 0, moving: false, run: false,
    kbx: 0, kby: 0, eat: 0, hurtInv: 0, safeT: 0, leapCd: 0, swing: 0, sx: 0, sy: 0, tx: 0, ty: 0, dust: 0,

    reset(x, y, dir) {
      this.x = x; this.y = y; this.z = 0; this.dir = dir || 'down'; this.aim = DIRA[this.dir];
      this.st = 'idle'; this.t = 0; this.kbx = this.kby = this.eat = this.hurtInv = this.leapCd = this.swing = 0;
      this.safeT = 1.2;
    },
    setDir(a) {
      const c = Math.cos(a), s = Math.sin(a);
      this.dir = Math.abs(c) >= Math.abs(s) * 0.9 ? (c < 0 ? 'left' : 'right') : (s < 0 ? 'up' : 'down');
      this.aim = a;
    },
    bow() { this.st = 'bow'; this.t = 0.9; },
    blockedByNpc(nx, ny) {
      for (const e of E.list) {
        const solid = e.type === 'npc' || (e.boss && (e.st === 'wait' || e.st === 'friend' || e.st === 'stand')) || (e.type === 'enemy' && e.def && e.def.ai === 'post');
        if (!solid || e.dead) continue;
        const big = e.def && e.def.big, rx = big ? 14 : 10, ry = big ? 8 : 7;
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
    // 앞에 있는 들것(싸울 상대)
    foeAhead() {
      const v = DIRV[this.dir], fx0 = this.x + v[0] * 12, fy0 = this.y + v[1] * 10;
      let best = null, bd = 22;
      for (const e of E.list) {
        if (e.type !== 'enemy' || e.dead || e.boss || !e.def || e.def.passive || e.calm > 0) continue;
        const d = G.dist(e.x, e.y, fx0, fy0);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },
    // 팔척뛰기: 물과 낮은 것을 건너뛴다. 싸움 밖에서는 기를 쓰지 않는다.
    leap() {
      const I = G.input, ix = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0), iy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      const a = (ix || iy) ? Math.atan2(iy, ix) : DIRA[this.dir];
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
      this.st = 'leap'; this.t = 0; this.leapCd = 0.5; this.setDir(a);
      G.sfx('leap'); fx.dust(this.x, this.y, 5);
    },

    update(dt) {
      const I = G.input, s = G.s;
      if (this.eat > 0) this.eat -= dt;
      if (this.hurtInv > 0) this.hurtInv -= dt;
      if (this.safeT > 0) this.safeT -= dt;
      if (this.leapCd > 0) this.leapCd -= dt;
      if (this.swing > 0) this.swing -= dt;
      if (this.kbx || this.kby) {
        this.step(this.kbx * dt, this.kby * dt);
        this.kbx *= 0.82; this.kby *= 0.82;
        if (Math.abs(this.kbx) + Math.abs(this.kby) < 5) this.kbx = this.kby = 0;
      }
      const ix = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0), iy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      const il = Math.hypot(ix, iy);
      this.moving = false;
      switch (this.st) {
        case 'sit': if (il || I.ok()) this.st = 'idle'; return;
        case 'bow': case 'hurt': this.t -= dt; if (this.t <= 0) this.st = 'idle'; return;
        case 'dead': return;
        case 'leap': {
          const dur = 0.36;
          this.t += dt;
          const k = Math.min(1, this.t / dur);
          this.x = G.lerp(this.sx, this.tx, k); this.y = G.lerp(this.sy, this.ty, k);
          this.z = Math.sin(k * 3.1416) * 20;
          if (k >= 1) { this.z = 0; this.st = 'idle'; G.sfx('land'); fx.dust(this.x, this.y, 6); }
          return;
        }
      }
      if (I.hit('a') || I.hit('b')) {
        if (G.game.tryInteract()) return;
        const e = I.hit('a') && this.foeAhead();
        if (e) {
          // 먼저 친다
          this.swing = 0.2; G.sfx('swing'); fx.arc(this.x, this.y - 8, DIRA[this.dir], 14, 2.4, 1, '#f6f1e3', 0.16);
          G.game.engage(e, true);
          return;
        }
        if (I.hit('a')) { this.swing = 0.2; G.sfx('swing'); fx.arc(this.x, this.y - 8, DIRA[this.dir], 14, 2.4, 1, '#f6f1e3', 0.16); }
      }
      if (I.hit('c')) {
        if (s.skills.leap) { if (this.leapCd <= 0) { this.leap(); return; } }
        else G.ui.toast('아직 쓸 수 있는 비기가 없다.');
      }
      if (I.hit('e')) G.game.useQuick();
      if (il) {
        // 대각선으로 갈 때는 보던 쪽을 되도록 유지
        if (!((this.dir === 'left' && ix < 0) || (this.dir === 'right' && ix > 0) || (this.dir === 'up' && iy < 0) || (this.dir === 'down' && iy > 0)))
          this.dir = Math.abs(ix) >= Math.abs(iy) ? (ix < 0 ? 'left' : 'right') : (iy < 0 ? 'up' : 'down');
        this.aim = DIRA[this.dir];
        this.run = I.down('d');
        let spd = this.run ? 112 : 70;
        const T = G.world.T, tl = G.world.tile(Math.floor(this.x / 16), Math.floor((this.y - 2) / 16));
        if (tl === T.SHALLOW || tl === T.MUD) spd *= 0.72; else if (tl === T.SNOW) spd *= 0.86;
        this.step(ix / il * spd * dt, iy / il * spd * dt);
        this.walk += dt * (spd / 64); this.moving = true;
        if (this.run && (this.dust -= dt) <= 0) { this.dust = 0.12; fx.dust(this.x, this.y, 1); }
        if (tl === T.SHALLOW && Math.random() < 0.15) fx.parts.push({ x: this.x + (Math.random() - 0.5) * 8, y: this.y, vx: 0, vy: -14, life: 0.25, col: '#b9d2cc', s: 1 });
        if (tl === T.SNOW && Math.random() < 0.1) fx.parts.push({ x: this.x + (Math.random() - 0.5) * 6, y: this.y, vx: 0, vy: -6, life: 0.3, col: '#f6f1e3', s: 1 });
      } else { this.walk = 0; this.run = false; }
    },

    img() {
      const frames = G.spr.player[this.dir];
      return frames[this.moving ? Math.floor(this.walk * 7) % 4 : 0];
    },
    draw(ctx, cx, cy, time) {
      const gx = Math.round(this.x - cx), gy = Math.round(this.y - cy);
      E.shadow(ctx, gx, gy - 1, this.z > 6 ? 8 : 12);
      if (this.st === 'sit') { const im = G.spr.player.sit; ctx.drawImage(im, gx - 8, gy - im.height + 3); return; }
      if (this.hurtInv > 0 && this.st !== 'hurt' && Math.floor(this.hurtInv * 14) % 2) return;
      let img = this.img();
      if (this.st === 'hurt') img = G.art.white(img);
      const bob = this.moving && Math.floor(this.walk * 7) % 2 ? 1 : 0;
      const x = gx - 8, y = gy - 17 - Math.round(this.z) - bob + (this.eat > 0 ? 1 : 0) + (this.st === 'bow' && this.t > 0.2 && this.t < 0.75 ? 3 : 0);
      const hx = gx, hy = gy - 7 - Math.round(this.z) - bob;
      // 칼: 휘두를 때만 뽑는다. 평소에는 칼집에 꽂혀 있다.
      const sw = this.swing > 0 ? DIRA[this.dir] - 1.2 + (1 - this.swing / 0.2) * 2.4 : null;
      const sheath = () => {
        const o = this.dir === 'right' ? [-2, 2.6] : this.dir === 'left' ? [2, 0.54] : this.dir === 'down' ? [-4, 2.2] : [4, 0.94];
        const sx0 = hx + o[0], sy0 = hy + 2, c2 = Math.cos(o[1]), s2 = Math.sin(o[1]);
        ctx.fillStyle = '#1b1a1f'; for (let i = 0; i <= 9; i++) ctx.fillRect(Math.round(sx0 + c2 * i) - 1, Math.round(sy0 + s2 * i) - 1, 3, 3);
        for (let i = 0; i <= 9; i++) { ctx.fillStyle = i === 2 || i === 9 ? '#cfa64a' : '#33303a'; ctx.fillRect(Math.round(sx0 + c2 * i), Math.round(sy0 + s2 * i), 1, 1); }
        if (sw === null) {
          ctx.fillStyle = '#1b1a1f'; for (let i = 1; i <= 4; i++) ctx.fillRect(Math.round(sx0 - c2 * i) - 1, Math.round(sy0 - s2 * i) - 1, 3, 3);
          for (let i = 1; i <= 4; i++) { ctx.fillStyle = i === 1 ? '#cfa64a' : '#6b4a32'; ctx.fillRect(Math.round(sx0 - c2 * i), Math.round(sy0 - s2 * i), 1, 1); }
        }
      };
      const back = sw !== null && Math.sin(sw) < -0.25;
      if (this.dir !== 'up') sheath();
      if (back) fx.blade(ctx, hx + Math.round(Math.cos(sw) * 3), hy + Math.round(Math.sin(sw) * 2), sw, 'kal');
      ctx.drawImage(img, x, y);
      if (this.dir === 'up') sheath();
      if (sw !== null && !back) fx.blade(ctx, hx + Math.round(Math.cos(sw) * 3), hy + Math.round(Math.sin(sw) * 2), sw, 'kal');
    }
  };
})();
