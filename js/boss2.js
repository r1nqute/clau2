'use strict';
// 맞수 둘: 아사히나 요시히데(힘), 구스노키 마사시게(꾀), 가시마의 문하생들, 쓰카하라 보쿠덴(받아치기)
(function () {
  const G = window.G, fx = G.fx, E = G.E, combat = G.combat, duel = G.duel, S = duel.S;

  // ======================= 아사히나 요시히데 =======================
  // 맨손이다. 붙잡히면 내던져진다. 헛손질 뒤가 길다. 절반쯤 깎이면 문짝을 든다.
  duel.define('asahina', {
    name: '아사히나', full: '아사히나 요시히데', kanji: '朝比奈義秀', title: '상어를 맨손으로 잡는 자',
    hp: 92, post: 150, spd: 46, r: 11, cy: 13, hx: 10, hy: 12, spr: 'asahina', wpn: null, big: true, armor: true, guard: 0, keep: 30, music: 'duel',
    init(e) { e.wpn = null; e.cdB = 2; const pr = G.world.findProp('asadoor'); if (pr) pr.gone = false; },
    drawWpn(e, ctx, hx, hy, wa) {
      // 문짝을 한 손에 들었다
      const d = G.spr.door;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(wa + 1.5708); ctx.drawImage(d, -15, -44); ctx.restore();
    },
    pick(e, dist) {
      e.cdB -= 1;
      const r = Math.random();
      if (e.phase === 2) {
        if (dist > 74) return r < 0.5 ? 'boulder' : null;
        return e.last !== 'doorSlam' && r < 0.4 ? 'doorSlam' : r < 0.85 ? 'doorSwing' : 'grab';
      }
      if (dist > 78) return e.cdB <= 0 ? (e.cdB = 2, 'boulder') : (r < 0.5 ? 'grab' : null);
      if (e.last !== 'grab' && r < 0.36) return 'grab';
      if (e.last !== 'stomp' && r < 0.6) return 'stomp';
      return 'punch';
    },
    moves: {
      punch: () => [
        S.tele(0.46, 'w', { track: 0.8 }),
        S.act(0.12, { fin: false, on: e => duel.slash(e, { r: 30, half: 1.05, dmg: 1, post: 30, kb: 120 }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.12) }),
        S.tele(0.3, 'w', { track: 0.8 }),
        S.act(0.12, { on: e => duel.slash(e, { r: 30, half: 1.05, dmg: 1, post: 36, kb: 230, rev: true }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.12) }),
        S.rest(0.85)
      ],
      // 붙잡아 내던진다. 막을 수 없다.
      grab: () => [
        S.tele(0.62, 'r', { track: 0.7 }),
        S.act(0.26, {
          on: e => { e.hitOnce = false; G.sfx('dash'); },
          tick: (e, dt) => {
            duel.lunge(e, 62, dt, 0.26);
            if (!e.hitOnce && combat.strike(e, { k: 'circ', x: e.x + Math.cos(e.aa) * 8, y: e.y - 10 + Math.sin(e.aa) * 8, r: 13 }, { dmg: 2, post: 60, kb: 330, unblock: true }) === 'hit') {
              e.hitOnce = true; G.ui.toast('붙잡혀 내던져졌다.'); G.game.shake(5);
            }
          }
        }),
        S.rest(1.2)
      ],
      stomp: () => [
        S.tele(0.72, 'r', { tick: e => { e.zone = { x: e.x, y: e.y, r: 36 }; } }),
        S.act(0.12, { on: e => { duel.blast(e, e.x, e.y, 36, { dmg: 1, kb: 240 }); e.zone = null; } }),
        S.rest(0.9)
      ],
      // 바위를 들어 던진다
      boulder: () => [
        S.tele(0.75, 'w', { track: 1, on: e => { e.carry = 1; G.sfx('thud'); } }),
        S.act(0.12, { on: e => { e.carry = 0; const tg = duel.tg(e); duel.lob(e, 'rock', tg.x, tg.y, 0.85, { dmg: 2, rad: 20 }); G.sfx('swing2'); } }),
        S.rest(0.7)
      ],
      doorSwing: () => [
        S.tele(0.7, 'w', { p: [-1.1, -2.5], track: 0.7 }),
        S.act(0.16, { p: [-2.4, 1.6], on: e => duel.slash(e, { r: 54, half: 1.55, dmg: 2, post: 62, kb: 300 }) }),
        S.rest(1.05, { p: [1.6, 1.8] })
      ],
      doorSlam: () => [
        S.tele(0.82, 'r', { p: [-1.0, -1.7], track: 0.5, tick: e => { e.zone = { x: e.x + Math.cos(e.aa) * 38, y: e.y + Math.sin(e.aa) * 38, r: 30 }; } }),
        S.act(0.14, { p: [-1.7, 0.2], on: e => { const z = e.zone; if (z) duel.blast(e, z.x, z.y, 30, { dmg: 2, kb: 260 }); e.zone = null; } }),
        S.rest(1.1, { p: [0.2, 0.3] })
      ]
    },
    over(e, ctx, x, y) {
      if (!e.carry) return;
      const r = G.spr.rock[2];
      ctx.drawImage(r, x - 11, y - 44);
    },
    onPhase(e) {
      e.wpn = 'door';
      const pr = G.world.findProp('asadoor'); if (pr) pr.gone = true;
      G.ui.toast('아사히나가 세워 둔 문짝을 집어 든다. 내일 부술 문의 연습이라고 한다.');
    }
  });

  // ======================= 구스노키 마사시게 =======================
  // 잘 막고, 잘 속인다. 짚 인형 사이에 섞이고, 통나무를 굴리고, 망루에서 화살을 부른다.
  duel.define('kusunoki', {
    name: '마사시게', full: '구스노키 마사시게', kanji: '楠木正成', title: '지지 않는 자',
    hp: 100, post: 115, spd: 58, r: 6, cy: 9, hx: 4, hy: 8, spr: 'kusunoki', wpn: 'tachi', guard: 0.62, keep: 28, music: 'duel', seesThrough: true,
    init(e) { e.cdT = 1; },
    onHit(e) { if (e.still) { e.still = false; duel.stagger(e, 0.9); fx.text(e.x, e.y - 26, '들켰다', '#e6cc78'); } },
    pick(e, dist) {
      e.cdT -= 1;
      const r = Math.random();
      if (e.cdT <= 0) {
        e.cdT = e.phase === 2 ? 2 : 3;
        const t = e.phase === 2 ? ['dummies', 'logs', 'arrows'] : ['dummies', 'logs'];
        let mv = G.pick(t); if (mv === e.lastTrick) mv = t[(t.indexOf(mv) + 1) % t.length];
        e.lastTrick = mv; return mv;
      }
      if (dist > 60) return r < 0.6 ? 'thrust' : null;
      return r < 0.55 ? 'cut2' : 'thrust';
    },
    moves: {
      cut2: () => [
        S.tele(0.4, 'w', { p: [-0.9, -1.9], track: 0.8 }),
        S.act(0.11, { p: [-1.6, 1.3], fin: false, on: e => duel.slash(e, { r: 28, half: 1.1, dmg: 1, post: 24, pp: 24, kb: 100, sfx: 'swing' }), tick: (e, dt) => duel.lunge(e, 8, dt, 0.11) }),
        S.tele(0.26, 'w', { p: [1.3, 1.9], track: 0.8 }),
        S.act(0.11, { p: [1.6, -1.3], on: e => duel.slash(e, { r: 28, half: 1.1, dmg: 1, post: 28, pp: 28, kb: 190, rev: true, sfx: 'swing' }), tick: (e, dt) => duel.lunge(e, 8, dt, 0.11) }),
        S.rest(0.7, { p: [-1.3, -1.4] })
      ],
      thrust: () => [
        S.tele(0.46, 'w', { p: [0, 0], track: 0.75, tick: (e, dt, k) => { e.wx = -6 * k; } }),
        S.act(0.18, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 50, w: 11, dmg: 1, post: 30 }); }, tick: (e, dt) => duel.lunge(e, 36, dt, 0.18) }),
        S.rest(0.7, { p: [0, 0.3], on: e => { e.wx = 0; } })
      ],
      // 연기 속에서 짚 인형 둘과 섞인다. 짚 빛이 아닌 쪽이 진짜다.
      dummies: () => {
        const a = duel.arena, p = G.p, spots = [], base = Math.random() * 6.283, real = Math.floor(Math.random() * 3);
        for (let i = 0; i < 3; i++) {
          const an = base + i * 2.094;
          spots.push([G.clamp(p.x + Math.cos(an) * 64, a.x0 + 14, a.x1 - 14), G.clamp(p.y + Math.sin(an) * 46, a.y0 + 16, a.y1 - 6)]);
        }
        return [
          S.move(0.45, { on: e => { fx.puff(e.x, e.y - 10, '#e8e2d0', 26, 90); G.sfx('dash'); e.hidden = true; e.inv = 0.5; } }),
          S.move(1.0, {
            on: e => {
              spots.forEach((s, i) => {
                fx.puff(s[0], s[1] - 10, '#e8e2d0', 14, 70);
                if (i === real) { e.x = s[0]; e.y = s[1]; } else E.list.push({ type: 'fake', x: s[0], y: s[1], t: 4.5 });
              });
              e.hidden = false; e.still = true; duel.aim(e);
            }
          }),
          S.tele(0.32, 'w', { p: [0, 0], track: 1, on: e => { e.still = false; }, tick: (e, dt, k) => { e.wx = -6 * k; } }),
          S.act(0.18, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 54, w: 11, dmg: 1, post: 32 }); }, tick: (e, dt) => duel.lunge(e, 40, dt, 0.18) }),
          S.rest(0.8, { on: e => { e.wx = 0; } })
        ];
      },
      // 북을 치면 통나무가 굴러 내려온다. 사이에 서거나 뛰어넘는다.
      logs: () => [
        S.tele(0.7, 'w', { p: [-1.57, -1.57], on: () => { G.sfx('taiko'); G.ui.toast('북소리. 통나무가 굴러온다.'); } }),
        S.act(0.3, {
          on: e => {
            const a = duel.arena, w = (a.x1 - a.x0) / 5, gap = Math.floor(Math.random() * 5), sp = 112;
            for (let i = 0; i < 5; i++) {
              if (i === gap || i === (gap + 2) % 5) continue;
              E.shoot(e, 'log', a.x0 + w * (i + 0.5), a.y0 - 10, 1.5708, sp, { dmg: 1, unblock: true, fly: true, heavy: true, r: 15, t: (a.y1 - a.y0 + 20) / sp, post: 40 });
            }
          }
        }),
        S.rest(0.5)
      ],
      // 망루의 궁수들
      arrows: () => [
        S.tele(0.5, 'w', { p: [-1.57, -1.57], on: () => { G.sfx('taiko'); } }),
        S.act(1.3, {
          on: e => { e.n = 0; e.rainT = 0; },
          tick: (e, dt) => {
            e.rainT -= dt;
            if (e.rainT <= 0 && e.n < 7) {
              e.rainT = 0.17; e.n++;
              const p = G.p, tx = p.x + G.rnd(-28, 28), ty = p.y + G.rnd(-20, 20);
              duel.lob(e, 'arrowrain', tx, ty, 0.8, { dmg: 1, rad: 11, from: [tx - 30, ty - 20] }); G.sfx('bow');
            }
          }
        }),
        S.rest(0.5)
      ]
    },
    onPhase() { G.ui.toast('마사시게가 망루 쪽으로 손을 든다.'); }
  });

  // ======================= 가시마의 문하생 셋 =======================
  // 목검으로 겨룬다. 뒤로 갈수록 잘 막고 빨리 친다.
  const deshi = (n, o) => duel.define('deshi' + n, Object.assign({
    r: 6, cy: 9, hx: 4, hy: 8, wpn: 'bokken', keep: 27, music: 'duel', post: 80, spd: 54, recoil: 0.7,
    pick(e, dist) {
      const r = Math.random();
      if (dist > 56) return r < 0.5 ? 'thrust' : null;
      return this.lvl >= 2 && r < 0.4 ? 'three' : r < 0.7 ? 'cut' : 'thrust';
    },
    moves: {
      cut: e => [
        S.tele(0.5 - e.def.lvl * 0.05, 'w', { p: [-0.9, -2.0], track: 0.8 }),
        S.act(0.11, { p: [-1.6, 1.3], on: en => duel.slash(en, { r: 28, half: 1.1, dmg: 1, post: 24, kb: 160, sfx: 'swing' }), tick: (en, dt) => duel.lunge(en, 8, dt, 0.11) }),
        S.rest(0.8 - e.def.lvl * 0.06, { p: [1.3, 1.4] })
      ],
      thrust: e => [
        S.tele(0.5 - e.def.lvl * 0.05, 'w', { p: [0, 0], track: 0.75, tick: (en, dt, k) => { en.wx = -6 * k; } }),
        S.act(0.18, { p: [0, 0], on: en => { en.wx = 6; duel.thrust(en, { len: 48, w: 10, dmg: 1, post: 26 }); }, tick: (en, dt) => duel.lunge(en, 34, dt, 0.18) }),
        S.rest(0.8 - e.def.lvl * 0.06, { on: en => { en.wx = 0; } })
      ],
      three: () => {
        const hit = (rev, fin) => S.act(0.1, { p: rev ? [1.5, -1.3] : [-1.5, 1.3], fin, on: e => { duel.aim(e); duel.slash(e, { r: 28, half: 1.1, dmg: 1, post: 20, pp: 22, kb: fin ? 180 : 80, rev, sfx: 'swing' }); }, tick: (e, dt) => duel.lunge(e, 8, dt, 0.1) });
        return [S.tele(0.38, 'w', { p: [-0.8, -1.8], track: 0.9 }), hit(false, false), S.tele(0.22, 'w', { p: [1.3, 1.8], track: 0.9 }), hit(true, false),
          S.tele(0.24, 'w', { p: [-1.3, -1.9], track: 0.9 }), hit(false, true), S.rest(0.7, { p: [1.3, 1.5] })];
      }
    }
  }, o));
  deshi(1, { name: '첫째 문하생', full: '가시마의 문하생', kanji: '初伝', title: '신토류 첫 단', hp: 30, guard: 0.35, lvl: 0, spr: 'deshi' });
  deshi(2, { name: '둘째 문하생', full: '가시마의 문하생', kanji: '中伝', title: '신토류 가운데 단', hp: 38, guard: 0.5, lvl: 1, spr: 'deshi2' });
  deshi(3, { name: '맏제자', full: '가시마의 맏제자', kanji: '奥伝', title: '신토류 깊은 단', hp: 48, guard: 0.62, lvl: 2, spr: 'deshi3', spd: 60 });

  // ======================= 쓰카하라 보쿠덴 =======================
  // 먼저 치지 않는다. 치면 막고, 막으면 받아친다. 한 번씩 칼을 내리고 숨을 고른다. 그것이 일지태도다.
  duel.define('bokuden', {
    name: '보쿠덴', full: '쓰카하라 보쿠덴', kanji: '塚原卜伝', title: '검성 · 싸우지 않고 이기는 자',
    hp: 110, post: 105, spd: 42, r: 6, cy: 9, hx: 4, hy: 8, spr: 'bokuden', wpn: 'tachi', guard: 0.9, counter: 0.6, counterMove: 'riposte', keep: 34, music: 'duel',
    seesThrough: true, recoil: 0.55, ready: -0.3,
    init(e) { e.wait = true; e.cdH = 3; },
    pick(e, dist) {
      // 기다린다
      if (e.wait) { e.wait = false; e.cd = (e.phase === 2 ? 0.7 : 1.3) + Math.random() * 0.6; return null; }
      e.wait = true; e.cdH -= 1;
      const r = Math.random();
      if (e.cdH <= 0) { e.cdH = e.phase === 2 ? 3 : 4; return 'hitotsu'; }
      if (dist > 64) return 'tsuki';
      if (e.phase === 2 && r < 0.35) return 'feint';
      return r < 0.55 ? 'kesa' : 'tsuki';
    },
    moves: {
      kesa: () => [
        S.tele(0.42, 'w', { p: [-0.6, -1.9], track: 0.8 }),
        S.act(0.11, { p: [-1.6, 1.3], on: e => duel.slash(e, { r: 29, half: 1.1, dmg: 1, post: 30, kb: 180, sfx: 'swing' }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.11) }),
        S.rest(0.6, { p: [1.3, 1.4] })
      ],
      tsuki: () => [
        S.tele(0.44, 'w', { p: [0, 0], track: 0.8, tick: (e, dt, k) => { e.wx = -6 * k; } }),
        S.act(0.18, { p: [0, 0], on: e => { e.wx = 6; duel.thrust(e, { len: 52, w: 11, dmg: 1, post: 30 }); }, tick: (e, dt) => duel.lunge(e, 38, dt, 0.18) }),
        S.rest(0.65, { on: e => { e.wx = 0; } })
      ],
      // 막은 손이 그대로 되돌아온다
      riposte: () => [
        S.tele(0.24, 'w', { p: [-0.6, -1.5], track: 1 }),
        S.act(0.1, { p: [-1.5, 1.3], on: e => duel.slash(e, { r: 29, half: 1.1, dmg: 1, post: 34, pp: 34, kb: 200, sfx: 'cut' }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.1) }),
        S.rest(0.5, { p: [1.3, 1.4] })
      ],
      // 치는 척하다 반 박자 늦춘다
      feint: () => [
        S.tele(0.36, 'w', { p: [-0.6, -1.9], track: 0.8 }),
        S.move(0.22, { p: [-1.9, -1.2] }),
        S.tele(0.2, 'w', { p: [-1.2, -1.9], track: 1 }),
        S.act(0.11, { p: [-1.6, 1.3], on: e => duel.slash(e, { r: 29, half: 1.1, dmg: 1, post: 34, kb: 200, sfx: 'swing' }), tick: (e, dt) => duel.lunge(e, 10, dt, 0.11) }),
        S.rest(0.65, { p: [1.3, 1.4] })
      ],
      // 일지태도(一之太刀)
      hitotsu: () => [
        S.tele(1.05, 'w', { p: [1.9, 1.9], track: 0.9, on: e => { G.sfx('focus'); fx.ring(e.x, e.y - 6, 28, '#e6cc78', 0.6); e.glow = 1; } }),
        S.act(0.13, {
          p: [-1.2, 0.4], on: e => { e.glow = 0; e.sx0 = e.x; e.sy0 = e.y; G.sfx('cut'); },
          tick: (e, dt) => { duel.lunge(e, 86, dt, 0.13); if (Math.random() < 0.7) fx.after(G.spr.f.bokuden[e.dir][0], e.x - 8, e.y - 17, '#e6cc78', 0.25); }
        }),
        S.act(0.03, {
          on: e => {
            const len = Math.hypot(e.x - e.sx0, e.y - e.sy0);
            fx.line(e.sx0, e.sy0 - 9, e.x + Math.cos(e.aa) * 12, e.y - 9 + Math.sin(e.aa) * 12, '#f6f1e3', 0.32);
            combat.strike(e, { k: 'box', x: e.sx0 - Math.cos(e.aa) * 4, y: e.sy0 - 8 - Math.sin(e.aa) * 4, a: e.aa, len: len + 20, w: 22 }, { dmg: 3, post: 95, pp: 55, kb: 250, sx: e.sx0, sy: e.sy0 });
            G.game.shake(4);
          }
        }),
        S.rest(1.3, { p: [0.4, 0.6] })
      ]
    },
    over(e, ctx, x, y, time) {
      if (!e.glow) return;
      ctx.fillStyle = '#e6cc78';
      for (let i = 0; i < 5; i++) { const an = time * 6 + i * 1.257, rr = 12 - ((time * 12 + i * 3) % 9); ctx.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y - 9 + Math.sin(an) * rr * 0.7), 1, 1); }
    },
    onPhase() { G.ui.toast('보쿠덴의 숨이 고요해진다.'); }
  });
})();
