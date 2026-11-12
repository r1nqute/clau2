'use strict';
// 판 돌리기: 상태, 시간, 문 드나들기, 그리기 순서
(function () {
  const G = window.G, fx = G.fx;
  let canvas, ctx, nightCv, nctx;
  let state = 'title', time = 0, shakeAmt = 0, camx = 0, camy = 0;
  let titleSel = 0, hasSave = false, lastRegion = '', emitT = 0, target = null, denyT = 0, noHud = false, transT = 0, pending = null, battleBg = null;
  const fade = { a: 0, dir: 0, cb: null };
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function fresh() {
    const st = G.world.get('dan').start;
    return {
      hp: 40, maxhp: 40, lv: 1, exp: 0, ki: 0, maxki: 3, money: 15, inv: { gotgam: 3, rice: 2 }, quick: 'gotgam', wlv: 0, skills: {}, skill: null,
      flags: {}, seen: {}, allies: {}, party: [], time: 6.5 * 60, day: 1, map: 'dan', x: st.x, y: st.y,
      respawn: { map: 'dan', x: st.x, y: st.y }, kills: 0, spared: 0, deaths: 0, parries: 0
    };
  }
  function fadeTo(cb) { if (fade.dir === 0 && fade.a === 0) { fade.dir = 1; fade.cb = cb; } }

  const game = G.game = {
    count: id => G.s.inv[id] || 0,
    give(id, n) {
      const s = G.s; n = n || 1;
      s.inv[id] = (s.inv[id] || 0) + n;
      const d = G.ITEMS[id];
      if ((d.heal || d.ki) && !(s.inv[s.quick] > 0)) s.quick = id;
      G.sfx('pick'); G.ui.toast(d.name + ' +' + n);
    },
    take(id, n) { G.s.inv[id] = Math.max(0, (G.s.inv[id] || 0) - n); },
    pay(n) { if (G.s.money < n) { G.sfx('deny'); return false; } G.s.money -= n; if (n) G.sfx('coin'); return true; },
    earn(n) { G.s.money += n; G.sfx('coin'); G.ui.toast('돈 +' + n + '문'); },
    toast(t) { G.ui.toast(t); },
    // 지도에 따라 때가 박혀 있는 곳이 있다(안개 낀 새벽 같은)
    hour() { const m = G.world.cur; return m && m.hour !== undefined ? m.hour : (state === 'title' ? 18.6 : G.s.time / 60); },
    isNight() { const h = this.hour(); return h >= 20 || h < 5; },
    clock() { return G.s.day * 1440 + G.s.time; },
    hourName() {
      const h = this.hour();
      return h < 4 ? '한밤' : h < 7 ? '새벽' : h < 11 ? '아침' : h < 14 ? '한낮' : h < 17 ? '낮' : h < 20 ? '해거름' : '밤';
    },
    dayText() { return '물 건넌 지 ' + G.s.day + '일째, ' + this.hourName(); },
    safe() {
      const x = G.p.x / 16, y = G.p.y / 16;
      return G.world.cur.safe.some(v => Math.hypot(v[0] - x, v[1] - y) < v[2]);
    },
    shake(n) { shakeAmt = Math.max(shakeAmt, n); },
    frozen() { return state !== 'play' || fade.dir !== 0; },
    get state() { return state; },
    get target() { return target; },

    hurt(dmg, ex, ey, kb) {
      const p = G.p, s = G.s;
      if (state !== 'play' || fade.dir) return false;
      s.hp -= dmg; p.hurtInv = 0.9; p.st = 'hurt'; p.t = 0.22; p.z = 0; fx.dark = 0;
      const dx = p.x - ex, dy = p.y - ey, l = Math.hypot(dx, dy) || 1;
      p.kbx = dx / l * (kb || 170); p.kby = dy / l * (kb || 170);
      G.sfx('hurt'); this.shake(4); fx.hitstop(0.05);
      fx.puff(p.x, p.y - 8, '#cf6a3d', 6, 60);
      if (s.hp <= 0) this.die();
      return true;
    },
    die(inDuel) {
      const s = G.s;
      s.hp = 0; s.deaths = (s.deaths || 0) + 1; G.sfx('die');
      state = 'dead'; G.p.st = 'dead';
      G.duel.clear(); G.music.play(null);
      setTimeout(() => {
        fade.dir = 1; fade.cb = () => {
          const lost = inDuel ? 0 : Math.floor(s.money * 0.1);
          s.money -= lost; s.hp = s.maxhp; s.ki = Math.max(s.ki, 1); G.p.st = 'idle'; G.party.healAll();
          enter(s.respawn.map, s.respawn.x, s.respawn.y, 'down');
          state = 'play';
          G.ui.say('', inDuel ? ['정신을 차려 보니 지장 앞이다.', '졌다. 목은 붙어 있다. 저쪽도 한 치 앞에서 멈춘 모양이다.']
            : lost ? ['정신을 차려 보니 지장 앞이다.', '누가 업어다 놓았는지는 모르겠다. 돈이 ' + lost + '문 빈다.'] : '정신을 차려 보니 지장 앞이다.');
        };
      }, 900);
    },

    eat(id) {
      const s = G.s, d = G.ITEMS[id];
      if (!(s.inv[id] > 0)) return;
      if (d.ki) {
        if (s.ki >= s.maxki) { G.sfx('deny'); G.ui.toast('기는 이미 찼다.'); return; }
        s.inv[id]--; s.ki = Math.min(s.maxki, s.ki + d.ki); G.p.eat = 0.3; G.sfx('tea');
        fx.puff(G.p.x, G.p.y - 14, '#b9d2cc', 5, 30);
        return;
      }
      if (s.hp >= s.maxhp) { G.sfx('deny'); G.ui.toast('배가 부르다.'); return; }
      const v = Math.min(s.maxhp - s.hp, d.heal);
      s.inv[id]--; s.hp += v;
      G.p.eat = 0.3; G.sfx('eat'); fx.text(G.p.x, G.p.y - 24, '+' + v, '#b8d48a');
      fx.puff(G.p.x, G.p.y - 14, '#e6cc78', 5, 30);
    },
    useQuick() {
      const s = G.s;
      if (!s.quick || !(s.inv[s.quick] > 0)) {
        const ids = Object.keys(s.inv).filter(id => s.inv[id] > 0 && (G.ITEMS[id].heal || G.ITEMS[id].ki));
        if (!ids.length) { G.sfx('deny'); return; }
        s.quick = ids[0];
      }
      this.eat(s.quick);
    },
    // 들것과 맞닥뜨렸다. first면 내가 먼저 쳤다.
    engage(e, first) {
      if (state !== 'play' || fade.dir || G.ui.busy() || G.battle.active || e.dead) return;
      if (e.def.ai === 'post') { G.ui.say('', '짚단이다. 한 수 겨뤄 볼까.'); G.ui.choice(['겨뤄 본다', '그만둔다'], i => { if (i === 0) G.ui.run(() => this.fight(e, ['makiwara'], true)); }); return; }
      const opts = G.GROUPS[e.kind] || [[e.kind]];
      this.fight(e, G.pick(opts).slice(), first);
    },
    fight(e, group, first) {
      const p = G.p;
      G.main.toBattle({
        group, first,
        onEnd: (res, foes) => {
          if (res === 'lose') { this.die(false); return; }
          G.music.play(G.world.cur.music);
          if (res === 'fled') { e.calm = 3; p.safeT = 1.5; return; }
          for (const f of foes) {
            const o = { kind: f.kind, x: e.x, y: e.y, bowed: f.bowed };
            if (f.spared) this.onSpare(o); else if (f.killed) this.onKill(o);
          }
          if (e.def.ai === 'post') { e.dead = true; if (e.sp) { e.sp.ent = null; e.sp.deadUntil = 0; } }
          else G.E.gone(e, true);
          p.safeT = 1.0;
        }
      });
    },

    findTarget() {
      const p = G.p, v = DIRV[p.dir];
      const fx0 = p.x + v[0] * 10, fy0 = p.y - 4 + v[1] * 10;
      let best = null, bd = 19;
      for (const e of G.E.list) {
        if (e.dead) continue;
        const boss = e.boss && (e.st === 'wait' || e.st === 'friend' || e.st === 'stand');
        const kap = false;
        if (e.type !== 'npc' && !boss && !kap) continue;
        const big = boss && e.def.big;
        const d = G.dist(e.x, e.y - 4, fx0, fy0) - (big ? 8 : 0);
        if (d < bd) { bd = d; best = { ent: e, x: e.x, y: e.y - (big ? 36 : 25), quiet: kap }; }
      }
      if (best) return best;
      const pr = G.world.findUse(fx0, fy0, 17);
      if (pr) {
        if (pr.use === 'chest' && G.s.flags[pr.id]) return null;
        if (pr.use === 'look') return { prop: pr, x: pr.x, y: pr.y, quiet: true };
        const sp = propSprite(pr);
        return { prop: pr, x: pr.x, y: pr.y - (sp ? sp.height : 16) - 3 };
      }
      return null;
    },
    tryInteract() {
      const t = this.findTarget();
      if (!t) return false;
      this.interact(t);
      return true;
    },
    interact(t) {
      const s = G.s, f = s.flags, p = G.p;
      p.drawn = 0;
      if (t.ent) {
        const e = t.ent;
        if (e.boss) { G.STORY.talkBoss(e); return; }
        const n = G.NPCS[e.id];
        if (n) n.talk(s, e);
        return;
      }
      const pr = t.prop;
      if (pr.use === 'look') {
        const lines = G.LOOKS[pr.id] || G.LOOKS[pr.s], k = 'look_' + (pr.id || pr.s);
        if (!lines) return;
        G.ui.say('', lines[Math.min(f[k] || 0, lines.length - 1)]);
        f[k] = (f[k] || 0) + 1;
      } else if (pr.use === 'sign') G.ui.say('', G.SIGNS[pr.id]);
      else if (pr.use === 'save') {
        const night = this.isNight(), fixed = G.world.cur.hour !== undefined;
        G.ui.say('', f.sawJizo ? '지장이다. 붉은 턱받이가 바람에 들린다.' : ['돌로 깎은 지장이 서 있다. 붉은 턱받이를 둘렀다.', '고향의 장승보다 순하게 생겼다. 마음이 놓이는 것은 같다.']);
        f.sawJizo = 1;
        const talk = G.camp.next();
        const opts = ['여기까지 새긴다', fixed ? '숨을 고른다' : night ? '날이 샐 때까지 쉰다' : '해가 질 때까지 쉰다'];
        if (talk) opts.push(G.josa(G.ALLIES[talk.id].name, '과', '와') + ' 불가에 앉는다');
        opts.push('그만둔다');
        G.ui.choice(opts, i => {
          if (talk && i === 2) { G.camp.play(); return; }
          if (i === 0) { s.respawn = { map: s.map, x: pr.x, y: pr.y + 12 }; this.save(); G.sfx('save'); G.ui.toast('새겼다.'); }
          else if (i === 1) fadeTo(() => {
            if (!fixed) { if (night) { if (s.time > 6 * 60) s.day++; s.time = 6 * 60; } else s.time = 20 * 60 + 5; }
            s.hp = s.maxhp; s.ki = s.maxki; G.party.healAll();
            s.respawn = { map: s.map, x: pr.x, y: pr.y + 12 }; this.save();
            p.st = 'sit';
            G.ui.toast(fixed ? '숨을 골랐다.' : night ? '날이 밝았다.' : '해가 졌다.');
          });
        });
      } else if (pr.use === 'chest') {
        const c = G.CHESTS[pr.id];
        f[pr.id] = 1; G.sfx('open');
        G.ui.say('', c.text);
        G.ui.run(() => { if (c.money) this.earn(c.money); for (const id in (c.items || {})) this.give(id, c.items[id]); });
      } else if (pr.use === 'story') G.STORY.use(pr);
    },

    sleep() {
      fadeTo(() => {
        const s = G.s;
        if (s.time > 6 * 60) s.day++;
        s.time = 6 * 60; s.hp = s.maxhp; s.ki = s.maxki; G.party.healAll();
        s.respawn = { map: s.map, x: G.p.x, y: G.p.y };
        this.save(); G.sfx('save');
        G.ui.toast('잘 쉬었다. 새겼다.');
      });
    },
    save() {
      const s = G.s;
      s.x = G.p.x; s.y = G.p.y;
      if (!G.store.write(s)) G.ui.toast('이 브라우저에서는 기록이 남지 않는다.');
    },
    onSpare(e) { G.s.spared = (G.s.spared || 0) + 1; G.STORY.onSpare(e); },
    onKill(e) { G.s.kills = (G.s.kills || 0) + 1; G.STORY.onKill(e); },
    // 어둠을 거쳐 다른 곳으로
    go(map, x, y, dir, o) { fadeTo(() => enter(map, x, y, dir, o)); },
    snap() { snapCam(); },
    fadeTo
  };

  function enter(map, x, y, dir, o) {
    const s = G.s;
    s.map = map;
    const m = G.world.use(map);
    if (o && o.arrive && m.arrive) { x = m.arrive.x; y = m.arrive.y; }
    if (o && o.spot && m[o.spot]) { x = m[o.spot].x; y = m[o.spot].y; }
    G.E.reset(); G.duel.clear(); fx.reset(); G.STORY.resetAsked();
    G.p.reset(x, y, dir);
    G.followers.reset();
    G.STORY.onEnter(map);
    G.followers.arrive(map);
    lastRegion = ''; target = null;
    snapCam();
    fx.weather.set(m.weather, camx, camy);
    G.music.play(m.music);
    if (o && o.card && m.title) G.ui.era(m.title);
  }
  function snapCam() {
    const m = G.world.cur;
    camx = G.clamp(G.p.x - G.W / 2, 0, m.w * 16 - G.W);
    camy = G.clamp(G.p.y - 8 - G.H / 2, 0, m.h * 16 - G.H);
  }

  // ---------- 한 틱 ----------
  const DT = 1 / 60;
  function update() {
    time += DT;
    const I = G.input;
    if (I.hit('mute')) G.ui.toast(G.audio.toggle() ? '소리 끔' : '소리 켬');
    if (fade.dir) {
      fade.a += fade.dir * DT * 2.6;
      if (fade.dir > 0 && fade.a >= 1) { fade.a = 1; fade.dir = -1; const cb = fade.cb; fade.cb = null; if (cb) cb(); }
      else if (fade.dir < 0 && fade.a <= 0) { fade.a = 0; fade.dir = 0; }
    }
    if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - DT * 18);
    G.music.tick();

    if (state === 'title') {
      const n = hasSave ? 2 : 1;
      if (I.hit('up') || I.hit('down')) { titleSel = (titleSel + 1) % n; G.sfx('move'); }
      if (I.ok() && fade.dir === 0) {
        G.sfx('ok');
        const cont = hasSave && titleSel === 0;
        fadeTo(() => begin(cont));
      }
      const m = G.world.cur;
      camx = G.clamp((52 + Math.sin(time * 0.05) * 22) * 16 - G.W / 2, 0, m.w * 16 - G.W);
      camy = 44 * 16;
      fx.weather.update(DT, camx, camy);
      G.E.update(DT);
      return;
    }
    if (state === 'dead') { fx.update(DT); return; }
    // 싸움으로 넘어가는 사이
    if (state === 'battleIn') {
      transT += DT;
      if (transT >= 0.7) { state = 'battle'; G.battle.start(pending); document.body.classList.add('inbattle'); }
      return;
    }
    if (state === 'battle') {
      G.ui.update(DT);
      G.battle.update(DT);
      if (!G.battle.active) document.body.classList.remove('inbattle');
      if (!G.battle.active && state === 'battle') { state = 'play'; fade.a = 1; fade.dir = -1; }
      return;
    }

    // 창을 닫은 그 키가 같은 틱에 다시 먹히지 않게, 닫힌 틱은 건너뛴다
    const wasBusy = G.ui.busy();
    G.ui.update(DT);
    if (wasBusy || G.ui.busy() || fade.dir > 0) { target = null; return; }
    if (I.hit('menu')) { G.ui.openMenu(0); return; }
    if (I.hit('map')) { G.ui.openMenu(4); return; }

    // 맞는 순간의 멈춤과 느려짐
    if (fx.stop > 0) { fx.stop -= DT; return; }
    let dt = DT;
    if (fx.slowT > 0) { fx.slowT -= DT; dt = DT * fx.slowK; }

    const s = G.s, p = G.p, m = G.world.cur;
    if (!G.duel.state) {
      s.time += dt * 2.4;
      if (s.time >= 1440) { s.time -= 1440; s.day++; }
    }
    p.update(dt, DT);
    G.followers.update(dt);
    G.STORY.tick(dt);
    G.duel.update(dt, DT);
    G.E.spawner();
    G.E.update(dt);
    fx.update(dt);
    fx.weather.update(DT, camx, camy);
    target = state === 'play' && !G.ui.busy() && !G.duel.state ? game.findTarget() : null;

    // 문 드나들기
    const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
    if (denyT > 0) denyT -= DT;
    for (const w of m.warps) {
      if (w.tx !== tx || w.ty !== ty || fade.dir !== 0 || G.duel.state) continue;
      if (w.need && !s.flags[w.need]) {
        p.y += 8; p.kby = 60;
        if (denyT <= 0) { denyT = 1.5; G.ui.say('', w.deny || '아직 지날 수 없다.'); }
        break;
      }
      if (!G.world.has(w.to)) { p.y += 8; if (denyT <= 0) { denyT = 1.5; G.ui.say('', '도리이 너머가 안개뿐이다. 아직 길이 나지 않았다.'); } break; }
      G.sfx('bell');
      fadeTo(() => { enter(w.to, w.x, w.y, w.dir, { arrive: w.arrive, card: w.arrive || w.card, spot: w.spot }); game.save(); });
      break;
    }
    const reg = G.world.region(p.x, p.y);
    if (reg !== lastRegion) { if (reg && lastRegion !== '') G.ui.banner(reg); lastRegion = reg; }

    // 연기와 불티, 찻집의 김
    emitT -= DT;
    if (emitT <= 0) {
      emitT = 0.12;
      for (const pr of vis) {
        if (pr.s === 'kiln') fx.parts.push({ x: pr.x - 6 + Math.random() * 12, y: pr.y - 28, vx: 4 + Math.random() * 6, vy: -16 - Math.random() * 8, life: 1.4, col: Math.random() < 0.5 ? '#8e8f8c' : '#5a5c63', s: 2, drag: 0.99 });
        else if (pr.s === 'fire' && Math.random() < 0.5) fx.parts.push({ x: pr.x - 3 + Math.random() * 6, y: pr.y - 10, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 14, life: 0.7, col: Math.random() < 0.5 ? '#cf6a3d' : '#e6cc78', s: 1, drag: 0.98 });
        else if (pr.s === 'chaya' && Math.random() < 0.4) fx.parts.push({ x: pr.x + 10 + Math.random() * 6, y: pr.y - 14, vx: 2, vy: -12 - Math.random() * 6, life: 1.1, col: '#e8e2d0', s: 1, drag: 0.99 });
      }
    }
    // 승부 때는 맞수와 나 사이를 본다
    let fxx = p.x, fyy = p.y - 8;
    const gx = G.clamp(fxx - G.W / 2, 0, m.w * 16 - G.W), gy = G.clamp(fyy - G.H / 2, 0, m.h * 16 - G.H);
    camx += (gx - camx) * 0.18; camy += (gy - camy) * 0.18;
  }

  function begin(cont) {
    const saved = cont ? G.store.read() : null;
    G.s = saved || fresh();
    const s = G.s;
    s.flags = s.flags || {}; s.seen = s.seen || {}; s.skills = s.skills || {}; s.inv = s.inv || {}; s.allies = s.allies || {}; s.party = s.party || [];
    // 차례 싸움 이전의 기록이면 체력을 새 셈으로 옮긴다
    if (!s.lv) { s.lv = 1 + Object.keys(s.skills).length * 2; s.exp = 0; s.maxhp = 40 + Math.max(0, s.maxhp - 5) * 10 + (s.lv - 1) * 5; s.hp = s.maxhp; }
    if (!G.world.has(s.map)) { s.map = 'hub'; s.x = G.HUB.gx(0); s.y = G.HUB.gy; }
    G.ui.reset();
    enter(s.map, s.x, s.y, 'down');
    state = 'play';
    if (!saved) G.STORY.intro();
  }

  // ---------- 그리기 ----------
  let vis = [];
  const drawList = [];
  function darkness() {
    const m = G.world.cur;
    if (m.dark) return 0.9;
    const h = game.hour();
    if (h < 4.5 || h >= 20) return 0.72;
    if (h < 6.5) return 0.72 * (1 - (h - 4.5) / 2);
    if (h < 17.5) return 0;
    return 0.72 * (h - 17.5) / 2.5;
  }
  function light(x, y, r) {
    nctx.globalAlpha = 0.3; nctx.beginPath(); nctx.arc(x, y, r, 0, Math.PI * 2); nctx.fill();
    nctx.globalAlpha = 0.4; nctx.beginPath(); nctx.arc(x, y, r * 0.74, 0, Math.PI * 2); nctx.fill();
    nctx.globalAlpha = 0.7; nctx.beginPath(); nctx.arc(x, y, r * 0.48, 0, Math.PI * 2); nctx.fill();
  }
  function propSprite(pr) {
    const f = state === 'title' ? {} : G.s.flags;
    let name = pr.s, v = pr.v || 0;
    if (pr.use === 'chest' && f[pr.id]) name = 'chestOpen';
    let sp = G.spr[name];
    if (!sp) return null;
    if (Array.isArray(sp)) sp = pr.anim ? sp[Math.floor(time * (pr.anim === true ? 7 : pr.anim) + (pr.x % 7)) % sp.length] : sp[v % sp.length];
    return sp;
  }
  function drawProp(pr, cx, cy) {
    const sp = propSprite(pr);
    if (!sp) return;
    let ox = 0, oy = 0;
    if (pr.bob !== undefined) oy = Math.round(Math.sin(time * 1.4 + pr.bob));
    if (pr.drift) ox = Math.round(Math.sin(time * 0.12 * pr.drift + pr.x) * 7);
    const X = Math.round(pr.x - cx - (sp.ax !== undefined ? sp.ax : sp.width / 2)) + ox, Y = Math.round(pr.y - cy - sp.height + 1) + oy;
    ctx.drawImage(sp, X, Y);
    if (pr.gate !== undefined) {
      const f = state === 'title' ? {} : G.s.flags;
      const open = pr.gate === 'home' ? f.feather : f['gate' + pr.gate];
      if (!open) ctx.drawImage(G.spr.rope, Math.round(pr.x - cx) - 21, Math.round(pr.y - cy) - 34);
      if (pr.label) G.text.drawS(ctx, pr.label, Math.round(pr.x - cx), Math.round(pr.y - cy) + 5, open ? '#e6cc78' : '#8e8f8c', 'small', 1);
    }
  }
  // 싸움 배경: 지금 서 있는 들을 HUD 없이 한 장 떠 둔다
  function backdrop() {
    noHud = true; render(); noHud = false;
    const c = G.art.cv(G.W, G.H); c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function render() {
    if (state === 'battle') {
      G.battle.draw(ctx, time);
      if (fade.a > 0) { ctx.fillStyle = 'rgba(12,11,15,' + Math.min(1, fade.a).toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
      return;
    }
    if (state === 'battleIn') {
      // 칼금 하나가 지나가고 화면이 갈라진다
      ctx.drawImage(battleBg, 0, 0);
      const k = Math.min(1, transT / 0.7);
      if (k < 0.3) {
        const t = k / 0.3;
        ctx.fillStyle = '#f6f1e3';
        for (let i = 0; i < 3; i++) ctx.fillRect(0, Math.round(G.H / 2 - 1 + i), Math.round(G.W * t), 1);
      } else {
        const t = (k - 0.3) / 0.7, h = Math.round(G.H / 2 * t * t);
        ctx.fillStyle = '#0c0b0f'; ctx.fillRect(0, 0, G.W, h); ctx.fillRect(0, G.H - h, G.W, h);
        ctx.fillStyle = '#e6cc78'; ctx.fillRect(0, h, G.W, 1); ctx.fillRect(0, G.H - h - 1, G.W, 1);
      }
      return;
    }
    const sx = shakeAmt ? Math.round((Math.random() - 0.5) * shakeAmt) : 0, sy = shakeAmt ? Math.round((Math.random() - 0.5) * shakeAmt) : 0;
    const cx = Math.round(camx) + sx, cy = Math.round(camy) + sy;
    const m = G.world.cur;
    ctx.fillStyle = '#0c0b0f'; ctx.fillRect(0, 0, G.W, G.H);
    G.world.drawGround(ctx, cx, cy, time);

    vis.length = 0; G.world.visibleProps(cx, cy, vis);
    drawList.length = 0;
    for (const pr of vis) { if (pr.flat) drawProp(pr, cx, cy); else drawList.push(pr); }
    fx.drawUnder(ctx, cx, cy);
    if (!noHud) for (const e of G.E.list) if (e.x > cx - 50 && e.x < cx + G.W + 50 && e.y > cy - 30 && e.y < cy + G.H + 90) drawList.push(e);
    if (state !== 'title' && !noHud) { drawList.push(G.p); for (const f of G.followers.list) drawList.push(f); }
    drawList.sort((a, b) => a.y - b.y);
    for (const o of drawList) {
      if (o === G.p) {
        if (state === 'dead') { const img = G.spr.player.down[0]; ctx.save(); ctx.translate(Math.round(o.x - cx), Math.round(o.y - cy) - 5); ctx.rotate(1.5708); ctx.drawImage(img, -8, -9); ctx.restore(); }
        else o.draw(ctx, cx, cy, time);
      } else if (o.type) G.E.draw(o, ctx, cx, cy, time);
      else drawProp(o, cx, cy);
    }
    fx.draw(ctx, cx, cy);
    if (!noHud && state === 'play' && !G.ui.busy()) G.followers.drawBubbles(ctx, cx, cy);

    // 살필 수 있는 것 위에 작은 표시
    if (target && !target.quiet) {
      const bx = Math.round(target.x - cx), by = Math.round(target.y - cy) + (Math.floor(time * 3) % 2);
      ctx.fillStyle = '#1b1a1f'; ctx.fillRect(bx - 4, by - 1, 9, 3); ctx.fillRect(bx - 3, by + 2, 7, 1); ctx.fillRect(bx - 2, by + 3, 5, 1); ctx.fillRect(bx - 1, by + 4, 3, 1);
      ctx.fillStyle = '#e6cc78'; ctx.fillRect(bx - 3, by, 7, 1); ctx.fillRect(bx - 2, by + 1, 5, 1); ctx.fillRect(bx - 1, by + 2, 3, 1); ctx.fillRect(bx, by + 3, 1, 1);
    }
    const h = game.hour(), night = game.isNight();
    fx.weather.draw(ctx, time, night);

    // 어스름과 밤
    if (!m.dark && h > 16 && h < 20 && Math.abs(h - 18.2) < 2.2) {
      ctx.fillStyle = 'rgba(207,106,61,' + (0.16 * (1 - Math.abs(h - 18.2) / 2.2)).toFixed(3) + ')';
      ctx.fillRect(0, 0, G.W, G.H);
    }
    const a = darkness();
    if (a > 0.01) {
      nctx.globalCompositeOperation = 'source-over'; nctx.globalAlpha = 1;
      nctx.clearRect(0, 0, G.W, G.H);
      nctx.fillStyle = m.dark ? 'rgba(8,7,12,' + a + ')' : 'rgba(13,16,42,' + a + ')';
      nctx.fillRect(0, 0, G.W, G.H);
      nctx.globalCompositeOperation = 'destination-out'; nctx.fillStyle = '#fff';
      if (state !== 'title') light(G.p.x - cx, G.p.y - cy - 8, m.dark ? 52 : 40);
      for (const pr of vis) if (pr.light) light(pr.x - cx + (pr.ldx || 0), pr.y - cy + (pr.ldy || -8), pr.light + (pr.anim ? Math.sin(time * 9 + pr.x) * 2 : 0));
      for (const e of G.E.list) if (e.def && e.def.light) light(e.x - cx, e.y - cy - e.def.cy, e.def.light + Math.sin(time * 5 + e.x) * 2);
      ctx.drawImage(nightCv, 0, 0);
    }
    if (m.fog > 0.02) fx.weather.drawFog(ctx, G.p.x - cx, G.p.y - cy - 8, m.fog, 78, time);
    else if (m.weather === 'mist') {
      ctx.fillStyle = 'rgba(232,236,240,0.10)';
      for (let i = 0; i < 6; i++) { const y = (i * 41 + Math.sin(time * 0.15 + i) * 12) % G.H, x = ((time * (4 + i % 3 * 2) + i * 131) % (G.W + 200)) - 200; ctx.fillRect(Math.round(x), Math.round(y), 190, 6); }
    }
    if (fx.dark > 0) { ctx.fillStyle = 'rgba(12,11,15,' + (fx.dark * 0.55).toFixed(2) + ')'; ctx.fillRect(0, 0, G.W, G.H); }

    if (noHud) { /* 싸움 배경으로 뜰 때 */ }
    else if (state === 'title') drawTitle();
    else {
      G.ui.hud(ctx, time);
      G.ui.draw(ctx, time);
    }
    if (fx.flash > 0) { ctx.fillStyle = 'rgba(246,241,227,' + Math.min(0.7, fx.flash * 2.4).toFixed(2) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
    if (fade.a > 0) { ctx.fillStyle = 'rgba(12,11,15,' + Math.min(1, fade.a).toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
  }

  function drawTitle() {
    const TX = G.text;
    ctx.fillStyle = 'rgba(12,11,15,0.38)'; ctx.fillRect(0, 0, G.W, G.H);
    TX.draw(ctx, '칼 너머', G.W / 2 + 2, 46, '#1b1a1f', 'big', 1, 3);
    TX.draw(ctx, '칼 너머', G.W / 2, 44, '#f6f1e3', 'big', 1, 3);
    G.ui.seal(ctx, G.W / 2 + 70, 44, '劍');
    TX.drawS(ctx, '칼 한 자루 차고 물 건넌 이야기', G.W / 2, 96, '#e6cc78', 'big', 1);
    const opts = hasSave ? ['이어서 걷는다', '처음부터'] : ['배를 탄다'];
    for (let i = 0; i < opts.length; i++) {
      const y = 136 + i * 16, sel = i === titleSel;
      TX.drawS(ctx, opts[i], G.W / 2, y, sel ? '#f6f1e3' : '#8e8f8c', 'big', 1);
      if (sel) { const w = TX.width(opts[i]); ctx.fillStyle = '#e6cc78'; ctx.fillRect(G.W / 2 - w / 2 - 9, y + 6, 4, 2); ctx.fillRect(G.W / 2 + w / 2 + 5, y + 6, 4, 2); }
    }
    TX.drawS(ctx, G.touch ? '베기 단추를 누른다' : 'Z / X / Enter', G.W / 2, 196, '#8e8f8c', 'small', 1);
  }

  // ---------- 시작 ----------
  function resize() {
    const host = canvas.parentElement;
    const ww = host.clientWidth || window.innerWidth, wh = host.clientHeight || window.innerHeight;
    let sc = Math.min(ww / G.W, wh / G.H);
    // 딱 떨어지는 배율이 화면을 거의 채울 때만 정수 배율로
    const fl = Math.floor(sc);
    if (fl >= 2 && fl / sc > 0.86) sc = fl;
    canvas.style.width = Math.floor(G.W * sc) + 'px';
    canvas.style.height = Math.floor(G.H * sc) + 'px';
  }
  let acc = 0, last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    acc += Math.min(0.1, (t - last) / 1000); last = t;
    let n = 0;
    while (acc >= DT && n++ < 5) { update(); G.input.endFrame(); acc -= DT; }
    if (n >= 5) acc = 0;
    render();
  }

  G.main = {
    backdrop,
    // 싸움을 연다
    toBattle(o) {
      if (state !== 'play') return;
      G.p.st = 'idle'; G.p.moving = false; G.input.clear();
      battleBg = backdrop(); o.bg = battleBg; pending = o; transT = 0; state = 'battleIn';
      G.sfx('cut'); G.music.play(null);
    },
    start() {
      canvas = document.getElementById('game');
      canvas.width = G.W; canvas.height = G.H;
      ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      nightCv = G.art.cv(G.W, G.H); nctx = nightCv.getContext('2d');
      G.art.build();
      G.world.init();
      G.world.use('dan');
      G.s = fresh();
      G.E.reset();
      fx.weather.set('petal', 0, 0);
      hasSave = !!G.store.read();
      window.addEventListener('resize', resize); resize();
      last = performance.now();
      requestAnimationFrame(frame);
    },
    // 시험용 손잡이
    debug: {
      get state() { return state; }, get time() { return time; }, enter, begin, render,
      tick(n) { for (let i = 0; i < n; i++) { update(); G.input.endFrame(); } render(); },
      cam() { return [camx, camy]; },
      forceBattle() { state = 'battle'; },
      setState(v) { state = v; },
      ticks(n) { for (let i = 0; i < n; i++) { update(); G.input.endFrame(); } }
    }
  };
})();
