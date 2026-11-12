'use strict';
// 화면 위에 얹히는 것: 대화, 고르기, 가게, 봇짐, 검술, 인물록, 지도, 승부 알림, 머리 위 표시
(function () {
  const G = window.G, TX = G.text;
  const INK = '#1b1a1f', PAPER = '#e8e2d0', LIGHT = '#f6f1e3', DIM = '#8e8f8c', GOLD = '#e6cc78', RED = '#cf6a3d', SEAL = '#c8452f', LINE = '#33303a';

  const q = [];
  let cur = null, inCb = false, ins = 0;
  function enq(it) { if (inCb) q.splice(ins++, 0, it); else q.push(it); }
  function call(fn, a) { inCb = true; ins = 0; try { fn(a); } finally { inCb = false; } }
  function next() {
    cur = null;
    while (q.length) {
      const it = q.shift();
      if (it.k === 'run') { call(it.fn); continue; }
      cur = it;
      if (it.k === 'shop') buildShop(it);
      return;
    }
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x + 2, y + 1, w - 4, 1); ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
    ctx.fillRect(x + 1, y + 2, 1, h - 4); ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
  }
  function cursor(ctx, x, y) {
    ctx.fillStyle = GOLD;
    ctx.fillRect(x, y + 3, 1, 7); ctx.fillRect(x + 1, y + 4, 1, 5); ctx.fillRect(x + 2, y + 5, 1, 3); ctx.fillRect(x + 3, y + 6, 1, 1);
  }
  function rule(ctx, x, y, w) { ctx.fillStyle = LINE; ctx.fillRect(x, y, w, 1); }
  // 붉은 낙관
  function seal(ctx, x, y, str) {
    const h = [...str].length * 11 + 3;
    ctx.fillStyle = SEAL; ctx.fillRect(x, y, 14, h);
    ctx.fillStyle = '#a63c2e'; ctx.fillRect(x, y + h - 1, 14, 1); ctx.fillRect(x + 13, y, 1, h);
    TX.vdraw(ctx, str, x + 7, y + 1, LIGHT, 'small', 1, 1);
  }

  // ---------- 가게 ----------
  function buildShop(it) {
    const sh = G.SHOPS[it.id], s = G.s;
    it.buy = sh.sell.map(([id, price]) => ({ id, price, name: G.ITEMS[id].name, desc: G.ITEMS[id].desc }));
    it.sell = [];
    for (const id in s.inv) {
      if (!s.inv[id]) continue;
      const d = G.ITEMS[id], price = sh.buys[id] || d.sell || 0;
      if (price) it.sell.push({ id, price, name: d.name, desc: d.desc });
    }
    if (it.tab === undefined) { it.tab = 0; it.sel = 0; }
    const list = it.tab ? it.sell : it.buy;
    it.sel = G.clamp(it.sel, 0, Math.max(0, list.length - 1));
  }
  function shopUpdate(it) {
    const I = G.input, s = G.s;
    const list = it.tab ? it.sell : it.buy;
    if (I.hit('left') || I.hit('right')) { it.tab = 1 - it.tab; it.sel = 0; G.sfx('move'); return; }
    if (I.hit('up') && list.length) { it.sel = (it.sel + list.length - 1) % list.length; G.sfx('move'); }
    if (I.hit('down') && list.length) { it.sel = (it.sel + 1) % list.length; G.sfx('move'); }
    if (I.back()) { G.sfx('move'); next(); return; }
    if (I.hit('a') || I.hit('b')) {
      const e = list[it.sel];
      if (!e) return;
      if (it.tab === 0) {
        if (s.money < e.price) { G.sfx('deny'); it.msg = '돈이 모자란다.'; return; }
        s.money -= e.price; s.inv[e.id] = (s.inv[e.id] || 0) + 1; G.sfx('coin'); it.msg = '';
        if (!s.quick || !(s.inv[s.quick] > 0)) s.quick = e.id;
      } else { s.inv[e.id]--; s.money += e.price; G.sfx('coin'); it.msg = ''; }
      buildShop(it);
    }
  }
  function shopDraw(ctx, it) {
    const s = G.s, sh = G.SHOPS[it.id];
    panel(ctx, 44, 14, 296, 190);
    TX.draw(ctx, sh.title, 56, 21, GOLD);
    TX.draw(ctx, '산다', 196, 21, it.tab === 0 ? LIGHT : DIM);
    TX.draw(ctx, '판다', 232, 21, it.tab === 1 ? LIGHT : DIM);
    ctx.fillStyle = GOLD; ctx.fillRect(it.tab ? 232 : 196, 35, 22, 1);
    ctx.drawImage(G.spr.coin, 278, 24);
    TX.draw(ctx, s.money + '문', 330, 21, LIGHT, 'big', 2);
    rule(ctx, 52, 40, 280);
    const list = it.tab ? it.sell : it.buy;
    if (!list.length) TX.draw(ctx, it.tab ? '팔 만한 것이 없다.' : '살 것이 없다.', 62, 46, DIM);
    const top = G.clamp(it.sel - 6, 0, Math.max(0, list.length - 8));
    for (let i = top; i < Math.min(list.length, top + 8); i++) {
      const e = list[i], y = 45 + (i - top) * 14;
      if (i === it.sel) cursor(ctx, 53, y);
      TX.draw(ctx, e.name, 62, y, i === it.sel ? LIGHT : PAPER);
      TX.draw(ctx, '가진 것 ' + (s.inv[e.id] || 0), 226, y, DIM, 'big', 2);
      TX.draw(ctx, e.price + '문', 330, y, (it.tab === 0 && s.money < e.price) ? RED : GOLD, 'big', 2);
    }
    rule(ctx, 52, 159, 280);
    const e = list[it.sel];
    const lines = TX.wrap(it.msg || (e ? e.desc : ''), 272, 'small');
    for (let i = 0; i < Math.min(2, lines.length); i++) TX.draw(ctx, lines[i], 56, 163 + i * 11, it.msg ? RED : PAPER, 'small');
    TX.draw(ctx, G.touch ? '◀▶ 사기·팔기   베기: 고르기   비기: 나가기' : '←→ 사기·팔기   Z 고르기   C 나가기', 56, 188, DIM, 'small');
  }

  // ---------- 봇짐 ----------
  const TABS = ['봇짐', '검술', '인물록', '할 일', '지도'];
  const menu = { open: false, tab: 0, sel: 0, minis: {} };
  function invList() {
    const s = G.s, out = [];
    for (const id in s.inv) if (s.inv[id] > 0) out.push(id);
    const rank = id => { const d = G.ITEMS[id]; return d.heal || d.ki ? 0 : d.key ? 2 : 1; };
    out.sort((a, b) => rank(a) - rank(b));
    return out;
  }
  const seenList = () => G.PEOPLE_ORDER.filter(id => G.s.seen[id]);
  function menuUpdate() {
    const I = G.input, s = G.s;
    if (I.back() || I.hit('map')) { menu.open = false; G.sfx('move'); return; }
    if (I.hit('left')) { menu.tab = (menu.tab + TABS.length - 1) % TABS.length; menu.sel = 0; G.sfx('move'); }
    if (I.hit('right')) { menu.tab = (menu.tab + 1) % TABS.length; menu.sel = 0; G.sfx('move'); }
    const list = menu.tab === 0 ? invList() : menu.tab === 1 ? G.SKILL_ORDER : menu.tab === 2 ? seenList() : [];
    if (I.hit('up') && list.length) { menu.sel = (menu.sel + list.length - 1) % list.length; G.sfx('move'); }
    if (I.hit('down') && list.length) { menu.sel = (menu.sel + 1) % list.length; G.sfx('move'); }
    menu.sel = G.clamp(menu.sel, 0, Math.max(0, list.length - 1));
    if (menu.tab === 0 && list.length) {
      const id = list[menu.sel], d = G.ITEMS[id];
      if (I.hit('a')) { if (d.heal || d.ki) G.game.eat(id); else G.sfx('deny'); }
      else if (I.hit('b')) { if (d.heal || d.ki) { s.quick = id; G.sfx('ok'); } else G.sfx('deny'); }
    } else if (menu.tab === 1 && (I.hit('a') || I.hit('b'))) {
      const id = list[menu.sel];
      if (s.skills[id]) { s.skill = id; G.sfx('ok'); } else G.sfx('deny');
    }
  }
  function buildMini(m) {
    const c = G.art.cv(m.w, m.h), x = c.getContext('2d'), T = G.world.T;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      x.fillStyle = G.world.miniColor(m.t[ty * m.w + tx]);
      x.fillRect(tx, ty, 1, 1);
    }
    for (const p of m.props) {
      const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
      if (/^(pine|oak|cedar|maple|sakura|bare|plum|bamboo|goshin)/.test(p.s)) { x.fillStyle = /sakura/.test(p.s) ? '#e3a3b4' : /maple|oakA/.test(p.s) ? '#b8402e' : '#3d6240'; x.fillRect(tx, ty, 1, 1); }
      else if (/^(minka|machiya|chaya|hut|dojo|inn|forge|shrine)/.test(p.s)) { x.fillStyle = '#46301f'; x.fillRect(tx - 1, ty - 1, 3, 2); }
      else if (/^torii/.test(p.s)) { x.fillStyle = '#c8452f'; x.fillRect(tx - 1, ty, 3, 1); }
      else if (p.s === 'jizo') { x.fillStyle = '#f6f1e3'; x.fillRect(tx, ty, 1, 1); }
    }
    return c;
  }
  function menuDraw(ctx, time) {
    const s = G.s;
    panel(ctx, 20, 10, 344, 196);
    let x = 34;
    for (let i = 0; i < TABS.length; i++) {
      TX.draw(ctx, TABS[i], x, 16, i === menu.tab ? LIGHT : DIM);
      if (i === menu.tab) { ctx.fillStyle = GOLD; ctx.fillRect(x, 30, TX.width(TABS[i]), 1); }
      x += TX.width(TABS[i]) + 16;
    }
    ctx.drawImage(G.spr.coin, 300, 19);
    TX.draw(ctx, s.money + '문', 352, 16, LIGHT, 'big', 2);
    rule(ctx, 28, 34, 328);

    if (menu.tab === 0) {
      const list = invList();
      if (!list.length) TX.draw(ctx, '빈 봇짐.', 44, 42, DIM);
      const top = G.clamp(menu.sel - 7, 0, Math.max(0, list.length - 9));
      for (let i = top; i < Math.min(list.length, top + 9); i++) {
        const id = list[i], d = G.ITEMS[id], y = 40 + (i - top) * 14;
        if (i === menu.sel) cursor(ctx, 31, y);
        TX.draw(ctx, d.name, 40, y, i === menu.sel ? LIGHT : PAPER);
        TX.draw(ctx, '' + s.inv[id], 150, y, GOLD, 'big', 2);
        if (id === s.quick) TX.draw(ctx, G.touch ? '쥠' : 'V', 154, y + 2, RED, 'small');
      }
      ctx.fillStyle = LINE; ctx.fillRect(172, 40, 1, 124);
      TX.draw(ctx, '찬 것', 182, 40, DIM, 'small');
      TX.draw(ctx, G.WEAPONS[s.wlv || 0].name, 182, 52, PAPER);
      const wl = TX.wrap(G.WEAPONS[s.wlv || 0].desc, 166, 'small');
      for (let i = 0; i < Math.min(2, wl.length); i++) TX.draw(ctx, wl[i], 182, 67 + i * 11, DIM, 'small');
      TX.draw(ctx, '감 ' + s.hp + '/' + s.maxhp + '   기 ' + Math.floor(s.ki) + '/' + s.maxki, 182, 96, PAPER);
      TX.draw(ctx, '벤 것 ' + (s.kills || 0) + '   보낸 것 ' + (s.spared || 0), 182, 114, DIM, 'small');
      TX.draw(ctx, '쳐낸 칼 ' + (s.parries || 0) + '   쓰러진 횟수 ' + (s.deaths || 0), 182, 126, DIM, 'small');
      TX.draw(ctx, G.game.dayText(), 182, 150, DIM, 'small');
      rule(ctx, 28, 168, 328);
      if (list.length) {
        const d = G.ITEMS[list[menu.sel]];
        const lines = TX.wrap(d.desc, 320, 'small');
        for (let i = 0; i < Math.min(2, lines.length); i++) TX.draw(ctx, lines[i], 32, 171 + i * 10, PAPER, 'small');
        TX.draw(ctx, d.heal || d.ki ? (G.touch ? '베기: 먹는다   막기: 손에 쥔다(먹기 단추로 먹는다)' : 'Z 먹는다   X 손에 쥔다(V로 먹는다)') : '', 32, 192, DIM, 'small');
      }
    } else if (menu.tab === 1) {
      // 비기
      for (let i = 0; i < G.SKILL_ORDER.length; i++) {
        const id = G.SKILL_ORDER[i], k = G.SKILLS[id], has = s.skills[id], y = 40 + i * 14;
        if (i === menu.sel) cursor(ctx, 31, y);
        TX.draw(ctx, has ? k.name : '？？？', 40, y, !has ? DIM : i === menu.sel ? LIGHT : PAPER);
        if (has && id === s.skill) TX.draw(ctx, G.touch ? '씀' : 'C', 110, y + 2, RED, 'small');
      }
      const id = G.SKILL_ORDER[menu.sel], k = G.SKILLS[id];
      ctx.fillStyle = LINE; ctx.fillRect(126, 40, 1, 72);
      if (s.skills[id]) {
        TX.draw(ctx, k.kanji, 136, 40, GOLD);
        TX.draw(ctx, k.from + '에게서 · 기 ' + k.cost + '칸', 348, 42, DIM, 'small', 2);
        const lines = TX.wrap(k.desc, 210, 'small');
        for (let i = 0; i < Math.min(4, lines.length); i++) TX.draw(ctx, lines[i], 136, 58 + i * 11, PAPER, 'small');
        TX.draw(ctx, id === s.skill ? '지금 쓰는 비기' : (G.touch ? '베기: 이 비기를 쓴다' : 'Z 이 비기를 쓴다'), 136, 102, id === s.skill ? GOLD : DIM, 'small');
      } else TX.draw(ctx, '아직 보지 못한 수.', 136, 42, DIM);
      rule(ctx, 28, 116, 328);
      const rows = G.touch ? [['베기', '이어 누르면 세 수'], ['발도', '베기를 꾹 눌렀다 뗀다'], ['막기', '누르고 있는다'], ['쳐내기', '맞는 순간 막기'],
        ['되받아치기', '쳐낸 직후 베기'], ['보법', '뒤이어 베기로 달려 베기'], ['비기', '바꾸기는 바꿈 단추'], ['먹기', '쥔 것을 먹는다']]
        : [['베기', 'Z · 이어 누르면 세 수'], ['발도', 'Z 꾹 눌렀다 뗀다'], ['막기', 'X 누르고 있는다'], ['쳐내기', '맞는 순간 X'],
          ['되받아치기', '쳐낸 직후 Z'], ['보법', 'Space · 뒤이어 Z로 달려 베기'], ['비기', 'C · 바꾸기 Q'], ['먹기', 'V']];
      for (let i = 0; i < rows.length; i++) {
        const cx = i < 4 ? 32 : 196, y = 121 + (i % 4) * 12;
        TX.draw(ctx, rows[i][0], cx, y, GOLD, 'small'); TX.draw(ctx, rows[i][1], cx + 52, y, PAPER, 'small');
      }
      TX.draw(ctx, '흰 번쩍임은 막거나 쳐낸다. 붉은 번쩍임과 붉은 자리는 비킨다.', 32, 174, DIM, 'small');
      TX.draw(ctx, '자세(노란 줄)를 무너뜨리면 틈이 난다. 칼을 버린 자는 보내 줘도 된다.', 32, 186, DIM, 'small');
    } else if (menu.tab === 2) {
      const list = seenList();
      if (!list.length) { TX.draw(ctx, '아직 적힌 이름이 없다.', 34, 42, DIM); return; }
      const top = G.clamp(menu.sel - 9, 0, Math.max(0, list.length - 11));
      for (let i = top; i < Math.min(list.length, top + 11); i++) {
        const p = G.PEOPLE[list[i]], y = 40 + (i - top) * 14;
        if (i === menu.sel) cursor(ctx, 31, y);
        TX.draw(ctx, p.name, 40, y, i === menu.sel ? LIGHT : PAPER, 'small');
      }
      ctx.fillStyle = LINE; ctx.fillRect(138, 40, 1, 158);
      const id = list[menu.sel], p = G.PEOPLE[id];
      TX.draw(ctx, p.kanji, 148, 39, GOLD);
      TX.draw(ctx, p.years, 352, 42, DIM, 'small', 2);
      let y = 57;
      for (const ln of TX.wrap(p.fact, 204, 'small')) { if (y > 190) break; TX.draw(ctx, ln, 148, y, PAPER, 'small'); y += 11; }
      y += 5;
      if (s.seen[id] >= 2) {
        TX.draw(ctx, '전하는 이야기', 148, y, GOLD, 'small'); y += 12;
        for (const ln of TX.wrap(p.lore, 204, 'small')) { if (y > 190) break; TX.draw(ctx, ln, 148, y, DIM, 'small'); y += 11; }
      } else TX.draw(ctx, '겨루고 나면 뒷이야기가 적힌다.', 148, y, DIM, 'small');
    } else if (menu.tab === 3) {
      const log = G.questLog(s);
      if (!log.length) TX.draw(ctx, '아직 할 일이 없다.', 34, 42, DIM);
      let y = 40;
      for (const e of log) {
        if (y > 184) break;
        TX.draw(ctx, (e.done ? '○ ' : '● ') + e.title, 32, y, e.done ? DIM : GOLD);
        y += 14;
        for (const ln of TX.wrap(e.text, 300, 'small')) { TX.draw(ctx, ln, 46, y, e.done ? DIM : PAPER, 'small'); y += 11; }
        y += 4;
      }
    } else {
      const m = G.world.cur;
      if (m.dark) { TX.draw(ctx, '굴 속에서는 어디가 어딘지 알 수 없다.', 34, 42, DIM); return; }
      if (!menu.minis[m.id]) menu.minis[m.id] = buildMini(m);
      const sc = Math.min(2, Math.floor(Math.min(300 / m.w, 144 / m.h) * 2) / 2) || 1;
      const mw = m.w * sc, mh = m.h * sc, ox = Math.round(192 - mw / 2), oy = Math.round(112 - mh / 2);
      ctx.fillStyle = PAPER; ctx.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
      ctx.drawImage(menu.minis[m.id], ox, oy, mw, mh);
      for (const rg of m.regions) {
        if (rg.length !== 4) continue;
        TX.draw(ctx, rg[0], ox + rg[1] * sc + 1, oy + rg[2] * sc - 11, INK, 'small', 1);
        TX.draw(ctx, rg[0], ox + rg[1] * sc, oy + rg[2] * sc - 12, LIGHT, 'small', 1);
      }
      if (Math.floor(time * 3) % 2) {
        const px = ox + Math.floor(G.p.x / 16 * sc), py = oy + Math.floor(G.p.y / 16 * sc);
        ctx.fillStyle = INK; ctx.fillRect(px - 2, py - 2, 5, 5); ctx.fillStyle = RED; ctx.fillRect(px - 1, py - 1, 3, 3);
      }
      if (m.title) TX.draw(ctx, m.title.name + ' · ' + m.title.sub, 192, 190, DIM, 'small', 1);
    }
  }

  // ---------- 바깥에서 부르는 것 ----------
  const toasts = [];
  let banner = null, era = null;
  const ui = G.ui = {
    say(name, text) {
      const arr = Array.isArray(text) ? text : [text];
      for (const t of arr) {
        const lines = TX.wrap(t, 344, 'big');
        for (let i = 0; i < lines.length; i += 3) {
          const pg = lines.slice(i, i + 3);
          enq({ k: 'say', name, lines: pg, n: 0, total: pg.join('').length });
        }
      }
    },
    choice(opts, cb) { enq({ k: 'choice', opts, cb, sel: 0 }); },
    run(fn) { enq({ k: 'run', fn }); },
    shop(id) { enq({ k: 'shop', id }); },
    card(lines, o) { enq(Object.assign({ k: 'card', lines, t: 0 }, o || {})); },
    // 승부 알림. 끝나면 cb
    cutin(def, cb) { enq({ k: 'cutin', def, cb, t: 0 }); },
    // 장면: d초 동안 tick(dt, k)을 돌린다. 그동안 말은 멈추고 세상만 움직인다.
    scene(d, tick, on) { enq({ k: 'scene', d, t: 0, tick, on }); },
    busy() { return cur !== null || q.length > 0 || menu.open; },
    talking() { return cur !== null || q.length > 0; },
    openMenu(tab) { menu.open = true; menu.tab = tab || 0; menu.sel = 0; G.sfx('move'); },
    toast(t) { toasts.push({ t, life: 3.4 }); if (toasts.length > 4) toasts.shift(); },
    banner(t) { banner = { t, life: 3 }; },
    // 새 때에 들어섰을 때 뜨는 글
    era(title) { era = title ? { title, t: 0 } : null; },
    reset() { q.length = 0; cur = null; menu.open = false; toasts.length = 0; banner = null; era = null; },

    update(dt) {
      for (let i = toasts.length - 1; i >= 0; i--) if ((toasts[i].life -= dt) <= 0) toasts.splice(i, 1);
      if (banner && (banner.life -= dt) <= 0) banner = null;
      if (era && (era.t += dt) > 4.6) era = null;
      if (!cur && q.length) next();
      if (cur) {
        const I = G.input;
        if (cur.k === 'say') {
          if (cur.n < cur.total) {
            const before = Math.floor(cur.n);
            cur.n = Math.min(cur.total, cur.n + dt * 42);
            if (Math.floor(cur.n) !== before && Math.floor(cur.n) % 3 === 0) G.sfx('talk');
            if (I.ok()) cur.n = cur.total;
          } else if (I.ok()) next();
        } else if (cur.k === 'choice') {
          const n = cur.opts.length;
          if (I.hit('up')) { cur.sel = (cur.sel + n - 1) % n; G.sfx('move'); }
          if (I.hit('down')) { cur.sel = (cur.sel + 1) % n; G.sfx('move'); }
          if (I.hit('a') || I.hit('b')) {
            const c = cur; cur = null; G.sfx('ok');
            call(c.cb.bind(null), c.sel);
            next();
          }
        } else if (cur.k === 'shop') shopUpdate(cur);
        else if (cur.k === 'card') { cur.t += dt; if (cur.t > 0.8 + cur.lines.length * 0.45 + 0.6 && I.ok()) next(); }
        else if (cur.k === 'scene') {
          const c = cur;
          if (c.t === 0 && c.on) c.on();
          c.t += dt;
          if (c.tick) c.tick(dt, Math.min(1, c.t / c.d));
          G.fx.update(dt);
          if (c.t >= c.d && cur === c) next();
        }
        else if (cur.k === 'cutin') {
          const c = cur;
          if (c.t === 0) { G.sfx('taiko'); G.sfx('clap'); }
          c.t += dt;
          if (c.t > 2.5 || (c.t > 0.7 && I.ok())) { cur = null; if (c.cb) call(c.cb); next(); }
        }
        return;
      }
      if (menu.open) menuUpdate();
    },

    draw(ctx, time) {
      if (era && !cur && !menu.open) this.drawEra(ctx);
      if (cur && cur.k === 'card') {
        ctx.fillStyle = 'rgba(12,11,15,' + Math.min(1, cur.t * 1.2) + ')'; ctx.fillRect(0, 0, G.W, G.H);
        const h = cur.lines.length * 16, y0 = (G.H - h) / 2;
        for (let i = 0; i < cur.lines.length; i++) {
          if (cur.t < 0.8 + i * 0.45) break;
          const big = cur.lines[i] === '칼 너머';
          TX.draw(ctx, cur.lines[i], G.W / 2, y0 + i * 16 - (big ? 6 : 0), big ? GOLD : (cur.dimFrom && i >= cur.dimFrom) ? DIM : LIGHT, 'big', 1, big ? 2 : 1);
        }
        return;
      }
      if (cur && cur.k === 'cutin') { this.drawCutin(ctx, cur); return; }
      if (cur && cur.k === 'shop') { shopDraw(ctx, cur); return; }
      if (menu.open && !cur) { menuDraw(ctx, time); return; }
      if (cur && (cur.k === 'say' || cur.k === 'choice')) {
        if (cur.k === 'say') {
          panel(ctx, 8, 154, 368, 56);
          if (cur.name) {
            const w = TX.width(cur.name) + 14;
            panel(ctx, 14, 141, w, 18);
            TX.draw(ctx, cur.name, 21, 144, GOLD);
          }
          let left = Math.floor(cur.n);
          for (let i = 0; i < cur.lines.length && left > 0; i++) {
            const ln = cur.lines[i];
            TX.draw(ctx, ln.slice(0, left), 20, 162 + i * 15, cur.name ? LIGHT : PAPER);
            left -= ln.length;
          }
          if (cur.n >= cur.total && Math.floor(time * 2.5) % 2) {
            ctx.fillStyle = GOLD; ctx.fillRect(360, 200, 7, 1); ctx.fillRect(361, 201, 5, 1); ctx.fillRect(362, 202, 3, 1); ctx.fillRect(363, 203, 1, 1);
          }
        } else {
          let w = 0;
          for (const o of cur.opts) w = Math.max(w, TX.width(o));
          const h = cur.opts.length * 15 + 12, x = 376 - w - 34, y = 208 - h;
          panel(ctx, x, y, w + 34, h);
          for (let i = 0; i < cur.opts.length; i++) {
            if (i === cur.sel) cursor(ctx, x + 9, y + 6 + i * 15);
            TX.draw(ctx, cur.opts[i], x + 19, y + 6 + i * 15, i === cur.sel ? LIGHT : DIM);
          }
        }
      }
    },
    // 먹 한 줄 긋고 그 위에 땅 이름을 세로로 쓴다
    drawEra(ctx) {
      const e = era, t = e.t, T0 = e.title;
      if (t < 0.4 || t > 4.3) return;
      const n = [...T0.kanji].length, hh = n * 26 + 10;
      const grow = Math.min(1, (t - 0.4) / 0.35), out = t > 3.9 ? (t - 3.9) / 0.4 : 0;
      const y0 = 26, bh = Math.round(hh * grow * (1 - out));
      ctx.fillStyle = 'rgba(12,11,15,0.82)'; ctx.fillRect(22, y0 + (out ? hh - bh : 0), 34, bh);
      if (t > 0.8 && !out) {
        TX.vdraw(ctx, T0.kanji, 39, y0 + 5, LIGHT, 'big', 2, 1);
        if (t > 1.1) {
          TX.drawS(ctx, T0.name, 64, y0 + 6, LIGHT, 'big');
          TX.drawS(ctx, T0.sub, 64, y0 + 23, GOLD, 'small');
          if (T0.year) seal(ctx, 64, y0 + 38, '' + T0.year);
        }
      }
    },
    drawCutin(ctx, c) {
      const d = c.def, t = c.t, k = Math.min(1, t / 0.25);
      ctx.fillStyle = 'rgba(12,11,15,0.6)'; ctx.fillRect(0, 0, G.W, G.H);
      const bh = Math.round(34 * k);
      ctx.fillStyle = '#0c0b0f'; ctx.fillRect(0, 0, G.W, bh); ctx.fillRect(0, G.H - bh, G.W, bh);
      ctx.fillStyle = GOLD; ctx.fillRect(0, bh, G.W, 1); ctx.fillRect(0, G.H - bh - 1, G.W, 1);
      if (t < 0.3) return;
      const n = [...d.kanji].length, sc = n > 5 ? 2 : 2, step = 26, y0 = Math.round(G.H / 2 - n * step / 2) + 2;
      // 붓으로 그은 띠
      const bw = 40, bx = 262, slide = Math.min(1, (t - 0.3) / 0.2);
      ctx.fillStyle = '#0c0b0f'; ctx.fillRect(bx, Math.round(G.H / 2 - (n * step / 2 + 8) * slide), bw, Math.round((n * step + 16) * slide));
      if (t > 0.5) TX.vdraw(ctx, d.kanji, bx + bw / 2, y0, LIGHT, 'big', sc, 1);
      if (t > 0.7) {
        TX.draw(ctx, d.title, 250, G.H / 2 - 22, GOLD, 'small', 2);
        TX.draw(ctx, d.full || d.name, 250, G.H / 2 - 9, LIGHT, 'big', 2);
        if (t > 0.95) seal(ctx, 232, G.H / 2 + 10, '勝負');
        const img = G.spr.f[d.spr] && G.spr.f[d.spr].l[0];
        if (img) {
          const z = d.big ? 3 : 4, w = img.width * z, h = img.height * z;
          ctx.drawImage(G.art.tint(img, '#0c0b0f'), 62 - w / 2 + 3, G.H / 2 - h / 2 + 3, w, h);
          ctx.drawImage(img, 62 - w / 2, G.H / 2 - h / 2, w, h);
        }
      }
    },

    hud(ctx, time) {
      const s = G.s;
      for (let i = 0; i < s.maxhp; i++) ctx.drawImage(i < s.hp ? G.spr.hpFull : G.spr.hpEmpty, 5 + i * 10, 5);
      // 기: 푸른 마름모
      for (let i = 0; i < s.maxki; i++) {
        const x = 6 + i * 9, y = 17, f = G.clamp(s.ki - i, 0, 1);
        ctx.fillStyle = INK; ctx.fillRect(x + 2, y, 3, 7); ctx.fillRect(x + 1, y + 1, 5, 5); ctx.fillRect(x, y + 2, 7, 3);
        ctx.fillStyle = f >= 1 ? '#b9d2cc' : '#33303a'; ctx.fillRect(x + 3, y + 1, 1, 5); ctx.fillRect(x + 2, y + 2, 3, 3); ctx.fillRect(x + 1, y + 3, 5, 1);
        if (f > 0 && f < 1) { ctx.fillStyle = '#7fa9b0'; ctx.fillRect(x + 3, y + 3, 1, 3); if (f > 0.5) ctx.fillRect(x + 2, y + 3, 3, 1); }
        if (f >= 1) { ctx.fillStyle = '#f6f1e3'; ctx.fillRect(x + 3, y + 2, 1, 1); }
      }
      ctx.drawImage(G.spr.coin, 378 - TX.width('' + s.money, 'small') - 10, 5);
      TX.drawS(ctx, '' + s.money, 378, 4, LIGHT, 'small', 2);
      // 해와 달
      const hr = G.game.hour(), night = hr >= 19.5 || hr < 5.5;
      const hn = G.game.hourName(), bx = 378 - TX.width(hn, 'small') - 13, by = 17;
      ctx.fillStyle = INK; ctx.fillRect(bx, by, 9, 9);
      if (night) { ctx.fillStyle = '#b9d2cc'; ctx.fillRect(bx + 2, by + 1, 5, 7); ctx.fillRect(bx + 1, by + 2, 7, 5); ctx.fillStyle = INK; ctx.fillRect(bx + 4, by + 1, 4, 5); }
      else { ctx.fillStyle = hr > 17 ? '#cf6a3d' : '#e6cc78'; ctx.fillRect(bx + 2, by + 1, 5, 7); ctx.fillRect(bx + 1, by + 2, 7, 5); }
      TX.drawS(ctx, hn, 378, 16, PAPER, 'small', 2);
      // 쥔 비기와 먹을 것
      let ry = G.H - 17;
      if (s.quick && s.inv[s.quick] > 0) {
        const t = G.ITEMS[s.quick].name + ' ' + s.inv[s.quick], w = TX.width(t, 'small') + 20;
        ctx.fillStyle = 'rgba(27,26,31,0.75)'; ctx.fillRect(G.W - w - 4, ry, w, 13);
        TX.draw(ctx, G.touch ? '먹' : 'V', G.W - w, ry + 1, RED, 'small'); TX.draw(ctx, t, G.W - 8, ry + 1, LIGHT, 'small', 2);
        ry -= 15;
      }
      if (s.skill && s.skills[s.skill]) {
        const k = G.SKILLS[s.skill], w = TX.width(k.name, 'small') + 20, ok = s.ki >= k.cost;
        ctx.fillStyle = 'rgba(27,26,31,0.75)'; ctx.fillRect(G.W - w - 4, ry, w, 13);
        TX.draw(ctx, G.touch ? '비' : 'C', G.W - w, ry + 1, RED, 'small'); TX.draw(ctx, k.name, G.W - 8, ry + 1, ok ? LIGHT : DIM, 'small', 2);
      }
      let y = G.H - 18;
      for (let i = toasts.length - 1; i >= 0; i--) {
        const t = toasts[i];
        const w = TX.width(t.t, 'small') + 8;
        ctx.fillStyle = 'rgba(27,26,31,' + (t.life < 0.5 ? t.life * 1.5 : 0.75) + ')'; ctx.fillRect(4, y, w, 13);
        if (t.life > 0.25) TX.draw(ctx, t.t, 8, y + 1, LIGHT, 'small');
        y -= 15;
      }
      if (banner && banner.life < 2.7 && banner.life > 0.3 && !era) {
        const w = TX.width(banner.t) + 28;
        ctx.fillStyle = 'rgba(27,26,31,0.7)'; ctx.fillRect((G.W - w) / 2, 34, w, 19);
        ctx.fillStyle = GOLD; ctx.fillRect((G.W - w) / 2 + 4, 36, w - 8, 1); ctx.fillRect((G.W - w) / 2 + 4, 50, w - 8, 1);
        TX.draw(ctx, banner.t, G.W / 2, 37, LIGHT, 'big', 1);
      }
    },
    bossBar(ctx, e) {
      const d = e.def, w = 170, x = (G.W - w) / 2, y = 30;
      const nm = d.kanji + '  ' + d.name;
      TX.drawS(ctx, nm, G.W / 2, y - 14, LIGHT, 'small', 1);
      ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = '#7a2a24'; ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = RED; ctx.fillRect(x, y, Math.max(0, Math.round(w * e.hp / e.mhp)), 4);
      // 자세
      const pf = Math.min(1, e.post / d.post), pw = 110, px = (G.W - pw) / 2;
      ctx.fillStyle = INK; ctx.fillRect(px - 1, y + 6, pw + 2, 4);
      ctx.fillStyle = e.st === 'broken' ? LIGHT : GOLD;
      const half = Math.round(pw * pf / 2);
      ctx.fillRect(G.W / 2 - half, y + 7, half * 2, 2);
    },
    panel, seal
  };
})();
