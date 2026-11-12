'use strict';
// 맞수 셋: 우에스기 겐신(말), 사사키 고지로(긴 칼), 미야모토 무사시(노), 늙은 무사시(두 자루)
(function () {
  const G = window.G, fx = G.fx, E = G.E, combat = G.combat, duel = G.duel, S = duel.S;
  fx.WPN.longbok = { len: 21, back: 0, hilt: 4, grip: '#93714a', steel: '#b99a6b', edge: '#93714a', curve: 3 };

  const cut3 = (o) => {
    const hit = (rev, fin) => S.act(0.1, { p: rev ? [1.5, -1.3] : [-1.5, 1.3], fin, on: e => { duel.aim(e); duel.slash(e, { r: o.r || 29, half: 1.1, dmg: 1, post: o.post || 22, pp: o.pp || 20, kb: fin ? 200 : 80, rev, sfx: 'swing' }); }, tick: (e, dt) => duel.lunge(e, 9, dt, 0.1) });
    return [S.tele(o.t0 || 0.34, 'w', { p: [-0.8, -1.8], track: 0.9 }), hit(false, false), S.tele(o.t1 || 0.2, 'w', { p: [1.3, 1.8], track: 0.9 }), hit(true, false),
      S.tele(o.t2 || 0.22, 'w', { p: [-1.3, -1.9], track: 0.9 }), hit(false, true), S.rest(o.rest || 0.65, { p: [1.3, 1.5] })];
  };

  // ======================= 우에스기 겐신 =======================
  // 안개 속을 수레바퀴처럼 돌다가 말을 몰아 지나간다. 말머리를 돌리는 사이가 틈이다. 절반쯤 깎이면 내린다.
  duel.define('kenshin', {
    name: '겐신', full: '우에스기 겐신', kanji: '上杉謙信', title: '군신 · 비사문천의 화신',
    hp: 116, post: 125, spd: 62, r: 7, cy: 10, hx: 5, hy: 9, spr: 'kenshin', wpn: 'tachi', guard: 0.55, keep: 30, music: 'duel2', recoil: 0.6,
    init(e) { e.mounted = true; e.sprSet = 'kenshinH'; e.lift = 12; e.ang = 3.14; e.guard = 0; e.cd = 1.2; },
    dismount(e) {
      if (!e.mounted) return;
      e.mounted = false; e.sprSet = null; e.lift = 0; e.guard = undefined; e.lane = false;
      E.list.push({ type: 'actor', img: G.spr.horseW[e.dir === 'r' ? 'r' : 'l'][0], x: e.x + (e.dir === 'r' ? -20 : 20), y: e.y - 4, t: 0 });
      G.sfx('hoof'); fx.dust(e.x, e.y, 10);
      G.ui.toast('겐신이 말에서 내린다.');
    },
    onBreak(e) { duel.DEFS.kenshin.dismount(e); },
    onPhase(e) { duel.DEFS.kenshin.dismount(e); },
    roam(e, dt, tg, dist) {
      if (!e.mounted) return duel.roamDefault(e, dt, tg, dist);
      // 수레걸이: 싸움터 둘레를 돈다
      const a = duel.arena, cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
      e.ang += dt * 1.25;
      const tx = cx + Math.cos(e.ang) * (a.x1 - a.x0) * 0.43, ty = cy + Math.sin(e.ang) * (a.y1 - a.y0) * 0.4;
      const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1, v = Math.min(l, 150 * dt);
      e.x += dx / l * v; e.y += dy / l * v; e.mv = true; e.dir = dx > 0 ? 'r' : 'l';
      if (Math.random() < 0.12) { fx.dust(e.x, e.y, 1); if (Math.random() < 0.3) G.sfx('hoof'); }
    },
    pick(e, dist) {
      if (e.mounted) { e.cd = 0; return 'charge'; }
      const r = Math.random();
      if (dist > 70) return r < 0.6 ? 'tsuki' : null;
      if (e.last !== 'kuruma' && r < 0.28) return 'kuruma';
      return r < 0.68 ? 'three' : 'tsuki';
    },
    moves: {
      // 말을 몰아 지나가며 벤다
      charge: () => [
        S.tele(0.62, 'r', { p: [-1.3, -1.9], track: 0.92, on: e => { e.lane = true; G.sfx('hoof'); } }),
        S.act(0.8, {
          p: [-1.9, 1.2], on: e => { e.hitOnce = false; e.lane = false; },
          tick: (e, dt) => {
            duel.lunge(e, 250, dt, 0.8); e.dir = Math.cos(e.aa) > 0 ? 'r' : 'l';
            if (Math.random() < 0.5) fx.dust(e.x, e.y, 1);
            if (Math.random() < 0.12) G.sfx('hoof');
            if (!e.hitOnce && combat.strike(e, { k: 'circ', x: e.x, y: e.y - 10, r: 15 }, { dmg: 2, post: 60, kb: 300, unblock: true }) === 'hit') e.hitOnce = true;
          }
        }),
        S.rest(1.0, { p: [1.2, 1.4], on: e => { e.ang = Math.atan2(e.y - (duel.arena.y0 + duel.arena.y1) / 2, e.x - (duel.arena.x0 + duel.arena.x1) / 2); e.cd = 0.7; } })
      ],
      // 세 번 내리친다. 군배로도 겨우 받았다는 칼이다.
      three: () => {
        const hit = fin => S.act(0.11, { p: [-1.9, 1.2], fin, on: e => { duel.aim(e); duel.slash(e, { r: 30, half: 0.95, dmg: 1, post: 42, pp: 24, kb: fin ? 230 : 110 }); }, tick: (e, dt) => duel.lunge(e, 12, dt, 0.11) });
        return [S.tele(0.42, 'w', { p: [-0.9, -1.9], track: 0.9 }), hit(false), S.tele(0.3, 'w', { p: [1.2, -1.9], track: 0.9 }), hit(false),
          S.tele(0.3, 'w', { p: [1.2, -1.9], track: 0.9 }), hit(true), S.rest(0.75, { p: [1.2, 1.4] })];
      },
      tsuki: () => [
        S.tele(0.42, 'w', { p: [0, 0], track: 0.8, tick: (e, dt, k) => { e.wx = -6 * k; } }),
        S.act(0.18, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 54, w: 11, dmg: 1, post: 30 }); }, tick: (e, dt) => duel.lunge(e, 40, dt, 0.18) }),
        S.rest(0.65, { on: e => { e.wx = 0; } })
      ],
      // 수레걸이: 돌면서 밀고 들어온다. 막을 수 없다.
      kuruma: () => [
        S.tele(0.6, 'r', { p: [-1.57, -1.57], track: 1 }),
        S.act(0.85, {
          on: e => { e.tk2 = 0; },
          tick: (e, dt, k) => {
            const tg = duel.tg(e); e.aa = Math.atan2(tg.y - e.y, tg.x - e.x);
            duel.lunge(e, 80, dt, 0.85); e.wa = k * 22;
            e.tk2 -= dt;
            if (e.tk2 <= 0) {
              e.tk2 = 0.17; G.sfx('swing');
              fx.arc(e.x, e.y - 9, k * 22, 24, 4.4, 1, '#f6f1e3', 0.14);
              combat.strike(e, { k: 'circ', x: e.x, y: e.y - 9, r: 25 }, { dmg: 1, post: 40, kb: 200, unblock: true });
            }
          }
        }),
        S.rest(0.95, { p: [1.2, 1.4] })
      ]
    },
    under(e, ctx, x, y, time) {
      if (!e.lane) return;
      // 달려올 길
      ctx.fillStyle = 'rgba(200,69,47,' + (0.14 + 0.1 * Math.sin(time * 22)).toFixed(2) + ')';
      for (let i = 10; i < 250; i += 5) ctx.fillRect(Math.round(x + Math.cos(e.aa) * i - 7), Math.round(y - 4 + Math.sin(e.aa) * i - 5), 14, 10);
    }
  });

  // ======================= 사사키 고지로 =======================
  // 칼이 길다. 멀리서 찌르고 넓게 벤다. 내려 벤 칼이 곧바로 되돌아 올라온다.
  duel.define('kojiro', {
    name: '고지로', full: '사사키 고지로', kanji: '佐々木小次郎', title: '간류 · 제비를 베는 자',
    hp: 94, post: 105, spd: 64, r: 6, cy: 9, hx: 4, hy: 8, spr: 'kojiro', wpn: 'longbok', guard: 0.6, evade: 0.22, keep: 40, music: 'duel2', recoil: 0.6,
    pick(e, dist) {
      const r = Math.random();
      if (dist > 74) return r < 0.7 ? 'reach' : null;
      if (e.last !== 'tsubame' && r < (e.phase === 2 ? 0.5 : 0.36)) return 'tsubame';
      return r < 0.72 ? 'sweep' : 'reach';
    },
    moves: {
      reach: () => [
        S.tele(0.46, 'w', { p: [0, 0], track: 0.8, tick: (e, dt, k) => { e.wx = -7 * k; } }),
        S.act(0.18, { p: [0, 0], on: e => { e.wx = 7; duel.thrust(e, { len: 64, w: 11, dmg: 1, post: 30 }); }, tick: (e, dt) => duel.lunge(e, 30, dt, 0.18) }),
        S.rest(0.72, { on: e => { e.wx = 0; } })
      ],
      sweep: () => [
        S.tele(0.5, 'w', { p: [-0.9, -2.3], track: 0.75 }),
        S.act(0.13, { p: [-2.1, 1.6], on: e => duel.slash(e, { r: 47, half: 1.45, dmg: 1, post: 36, kb: 210 }) }),
        S.rest(0.78, { p: [1.6, 1.8] })
      ],
      // 쓰바메가에시
      tsubame: e => {
        const up = fin => S.act(0.1, { p: [1.8, -1.6], fin, on: en => { duel.aim(en); duel.slash(en, { r: 45, half: 1.3, dmg: fin ? 2 : 1, post: 36, pp: 30, kb: fin ? 240 : 90, rev: true, sfx: 'cut', col: '#e6cc78' }); } });
        const seq = [
          S.tele(0.55, 'w', { p: [-0.7, -2.2], track: 0.85 }),
          S.act(0.1, { p: [-2.0, 1.6], fin: false, on: en => duel.slash(en, { r: 45, half: 0.95, dmg: 1, post: 26, pp: 22, kb: 60 }) }),
          S.tele(0.21, 'w', { p: [1.6, 2.1], track: 1 })
        ];
        if (e.phase === 2) seq.push(up(false), S.tele(0.22, 'w', { p: [-1.6, -2.2], track: 1 }), S.act(0.1, { p: [-2.0, 1.6], on: en => { duel.aim(en); duel.slash(en, { r: 45, half: 1.1, dmg: 1, post: 34, pp: 30, kb: 230, sfx: 'cut' }); } }));
        else seq.push(up(true));
        seq.push(S.rest(0.9, { p: [1.4, 1.6] }));
        return seq;
      }
    },
    onPhase() { G.ui.toast('고지로의 긴 칼이 한 번 더 되돌아온다.'); }
  });

  // ======================= 미야모토 무사시 (1612) =======================
  // 노를 깎은 목검. 잘 막고, 막으면 내리친다. 뛰어올라 내리치는 한 방이 있다. 절반쯤 깎이면 왼손에 한 자루를 더 든다.
  const drawShort = (e, ctx, x, y) => {
    if (e.hidden || e.st === 'wait' || e.st === 'friend') return;
    const a = (e.dir === 'r' ? 3.14 : 0) + (e.dir === 'r' ? 0.9 : -0.9);
    fx.blade(ctx, x - (e.dir === 'r' ? 5 : -5), y - 8, e.st === 'tele' ? e.wa + (e.dir === 'r' ? 1.6 : -1.6) : a, 'short');
  };
  duel.define('musashi', {
    name: '무사시', full: '미야모토 무사시', kanji: '宮本武蔵', title: '예순 번을 겨뤄 진 적 없는 자',
    hp: 136, post: 135, spd: 68, r: 6, cy: 9, hx: 4, hy: 8, spr: 'musashi', wpn: 'oar', guard: 0.7, counter: 0.4, counterMove: 'smash', keep: 32, music: 'duel2',
    seesThrough: true, recoil: 0.5,
    init(e) { e.two = false; e.guard = undefined; },
    pick(e, dist) {
      const r = Math.random();
      if (dist > 82) return r < 0.75 ? 'leap' : null;
      if (e.two && r < 0.34 && e.last !== 'twin') return 'twin';
      if (e.last !== 'shove' && r < 0.5) return dist < 30 ? 'shove' : 'combo';
      if (e.last !== 'feint' && r < 0.72) return 'feint';
      return r < 0.9 ? 'smash' : 'leap';
    },
    moves: {
      smash: () => [
        S.tele(0.4, 'w', { p: [-0.8, -2.2], track: 0.85 }),
        S.act(0.11, { p: [-2.0, 1.3], on: e => duel.slash(e, { r: 34, half: 1.0, dmg: 1, post: 46, kb: 230 }), tick: (e, dt) => duel.lunge(e, 12, dt, 0.11) }),
        S.rest(0.6, { p: [1.3, 1.5] })
      ],
      combo: () => cut3({ r: 32, post: 26, pp: 20, rest: 0.62 }),
      feint: () => [
        S.tele(0.34, 'w', { p: [-0.8, -2.2], track: 0.85 }),
        S.move(0.24, { p: [-2.2, -1.4] }),
        S.tele(0.18, 'w', { p: [-1.4, -2.2], track: 1 }),
        S.act(0.11, { p: [-2.0, 1.3], on: e => duel.slash(e, { r: 34, half: 1.0, dmg: 1, post: 46, kb: 230 }), tick: (e, dt) => duel.lunge(e, 12, dt, 0.11) }),
        S.rest(0.62, { p: [1.3, 1.5] })
      ],
      // 어깨로 밀치고 곧바로 내리친다
      shove: () => [
        S.tele(0.36, 'r', { p: [-0.4, -0.4], track: 1 }),
        S.act(0.16, { on: e => { e.hitOnce = false; }, tick: (e, dt) => { duel.lunge(e, 30, dt, 0.16); if (!e.hitOnce && combat.strike(e, { k: 'circ', x: e.x, y: e.y - 9, r: 12 }, { dmg: 1, post: 40, kb: 260, unblock: true }) === 'hit') e.hitOnce = true; } }),
        S.tele(0.3, 'w', { p: [-0.8, -2.2], track: 1 }),
        S.act(0.11, { p: [-2.0, 1.3], on: e => duel.slash(e, { r: 34, half: 1.0, dmg: 1, post: 46, kb: 230 }), tick: (e, dt) => duel.lunge(e, 14, dt, 0.11) }),
        S.rest(0.7, { p: [1.3, 1.5] })
      ],
      // 뛰어올라 내리친다. 고지로를 쓰러뜨린 한 방.
      leap: () => [
        S.tele(0.32, 'r', { p: [-1.2, -2.0], track: 1 }),
        S.move(0.46, { p: [-2.0, -1.57], on: e => { const tg = duel.tg(e); e.zone = { x: tg.x, y: tg.y, r: 20 }; duel.jump(e, tg.x, tg.y, 0.46, 34); } }),
        S.act(0.1, { p: [-1.57, 1.2], on: e => { const z = e.zone || e; duel.blast(e, z.x, z.y, 20, { dmg: 2, kb: 230, shake: 5 }); e.zone = null; } }),
        S.rest(0.78, { p: [1.2, 1.4] })
      ],
      // 두 자루: 번갈아 네 번, 그리고 한 번
      twin: () => {
        const hit = (rev, fin) => S.act(0.09, { p: rev ? [1.4, -1.2] : [-1.4, 1.2], fin, on: e => { duel.aim(e); duel.slash(e, { r: 30, half: 1.05, dmg: 1, post: fin ? 40 : 15, pp: fin ? 30 : 13, kb: fin ? 220 : 50, rev, sfx: 'swing' }); }, tick: (e, dt) => duel.lunge(e, 8, dt, 0.09) });
        return [S.tele(0.32, 'w', { p: [-0.8, -1.6], track: 0.9 }), hit(false, false), S.tele(0.14, 'w', { p: [1.2, 1.6], track: 0.9 }), hit(true, false),
          S.tele(0.14, 'w', { p: [-1.2, -1.6], track: 0.9 }), hit(false, false), S.tele(0.14, 'w', { p: [1.2, 1.6], track: 0.9 }), hit(true, false),
          S.tele(0.3, 'w', { p: [-1.2, -2.2], track: 0.9 }), hit(false, true), S.rest(0.78, { p: [1.3, 1.5] })];
      }
    },
    over(e, ctx, x, y) { if (e.two) drawShort(e, ctx, x, y); },
    onPhase(e) { e.two = true; e.guard = 0.82; G.ui.toast('무사시가 왼손에 짧은 목검을 뽑아 든다.'); }
  });

  // ======================= 늙은 무사시 (1643) =======================
  // 느리다. 거의 다 막는다. 가끔 두 자루를 다 내리고 선다. 그때 치면 진다. 기다리면 그가 한 걸음 물러선다.
  duel.define('musashiOld', {
    name: '무사시', full: '니텐 무사시', kanji: '二天', title: '빈 것을 쓰는 사람',
    hp: 96, post: 110, spd: 34, r: 6, cy: 9, hx: 4, hy: 8, spr: 'musashiOld', wpn: 'bokken', guard: 0.9, counter: 0.7, counterMove: 'answer', keep: 34, music: 'last',
    seesThrough: true, recoil: 0.6, ready: -0.2,
    init(e) { e.wait = true; e.cdV = 2; e.void = false; },
    // 빈 자세일 때 치면 되받는다
    onStrike(e, o) {
      if (!e.void) return true;
      const p = G.p;
      fx.spark((e.x + p.x) / 2, (e.y + p.y) / 2 - 9, 12); G.sfx('parry'); fx.slow(0.2, 0.3);
      p.st = 'stagger'; p.t = 0.7; p.post = 0;
      e.void = false; e.struck = true;
      duel.run(e, [S.tele(0.2, 'w', { p: [-0.6, -1.5], track: 1 }),
        S.act(0.1, { p: [-1.5, 1.3], on: en => duel.slash(en, { r: 29, half: 1.1, dmg: 1, post: 30, kb: 200, sfx: 'cut' }) }), S.rest(0.5, { p: [1.3, 1.4] })]);
      if (!G.s.flags.sawVoid) { G.s.flags.sawVoid = 1; G.ui.toast('빈틈이 아니었다.'); }
      return false;
    },
    pick(e, dist) {
      if (e.wait) { e.wait = false; e.cd = 1.2 + Math.random() * 0.7; return null; }
      e.wait = true; e.cdV -= 1;
      if (e.cdV <= 0) { e.cdV = 3; return 'void'; }
      const r = Math.random();
      if (dist > 66) return 'tsuki';
      return r < 0.4 ? 'twin' : r < 0.75 ? 'smash' : 'tsuki';
    },
    moves: {
      smash: () => [
        S.tele(0.46, 'w', { p: [-0.6, -2.0], track: 0.85 }),
        S.act(0.11, { p: [-1.8, 1.3], on: e => duel.slash(e, { r: 30, half: 1.05, dmg: 1, post: 38, kb: 200 }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.11) }),
        S.rest(0.7, { p: [1.3, 1.4] })
      ],
      tsuki: () => [
        S.tele(0.46, 'w', { p: [0, 0], track: 0.8, tick: (e, dt, k) => { e.wx = -6 * k; } }),
        S.act(0.18, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 50, w: 11, dmg: 1, post: 30 }); }, tick: (e, dt) => duel.lunge(e, 34, dt, 0.18) }),
        S.rest(0.7, { on: e => { e.wx = 0; } })
      ],
      twin: () => cut3({ r: 29, post: 22, pp: 22, t0: 0.4, t1: 0.26, t2: 0.3, rest: 0.75 }),
      answer: () => [
        S.tele(0.24, 'w', { p: [-0.6, -1.5], track: 1 }),
        S.act(0.1, { p: [-1.5, 1.3], on: e => duel.slash(e, { r: 29, half: 1.1, dmg: 1, post: 34, pp: 34, kb: 200, sfx: 'cut' }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.1) }),
        S.rest(0.55, { p: [1.3, 1.4] })
      ],
      // 빈 자세
      void: () => [
        S.move(1.7, {
          p: [1.9, 1.9], on: e => { e.void = true; e.struck = false; G.sfx('focus'); },
          tick: (e, dt, k) => { if (k > 0.98 && e.void) { e.void = false; if (!e.struck) { e.post += 38; e.lastHit = 0; fx.text(e.x, e.y - 28, '기다렸다', '#e6cc78'); fx.ring(e.x, e.y - 6, 22, '#e6cc78', 0.4); G.p.gainKi(0.5); if (e.post >= e.def.post) duel.breakPosture(e); } } }
        }),
        S.rest(0.3)
      ]
    },
    over(e, ctx, x, y, time) {
      drawShort(e, ctx, x, y);
      if (e.void) { ctx.fillStyle = '#b9d2cc'; for (let i = 0; i < 4; i++) { const an = time * 2 + i * 1.57; ctx.fillRect(Math.round(x + Math.cos(an) * 14), Math.round(y - 9 + Math.sin(an) * 9), 1, 1); } }
    },
    onPhase() { G.ui.toast('무사시가 웃는다. 처음이다.'); }
  });
})();
