'use strict';
// 맞수. 들에서는 서 있다가, 말을 걸고 승부를 받으면 차례 싸움(battle.js)으로 넘어간다.
// 누구도 죽지 않는다. 칼은 한 치 앞에서 멎는다.
(function () {
  const G = window.G, fx = G.fx, E = G.E;
  fx.WPN.longbok = { len: 21, back: 0, hilt: 4, grip: '#93714a', steel: '#b99a6b', edge: '#93714a', curve: 3 };

  // 들에서 그릴 때 쓰는 것과 승부 알림에 쓰는 것
  const D = (name, full, kanji, title, spr, wpn, o) => Object.assign({ name, full, kanji, title, spr, wpn, r: 6, cy: 9, hx: 4, hy: 8, music: 'duel' }, o || {});
  const DEFS = {
    benkei: D('벤케이', '무사시보 벤케이', '武蔵坊弁慶', '다리를 지키는 자', 'benkei', 'nagi', { big: true, r: 11, cy: 14, hx: 9, hy: 13, restPose: -1.35 }),
    yoshitsune: D('요시쓰네', '미나모토노 요시쓰네', '源義経', '여덟 척을 건너뛰는 자', 'yoshitsune', 'tachi', { music: 'duel2' }),
    asahina: D('아사히나', '아사히나 요시히데', '朝比奈義秀', '상어를 맨손으로 잡는 자', 'asahina', null, { big: true, r: 11, cy: 13, hx: 10, hy: 12 }),
    kusunoki: D('마사시게', '구스노키 마사시게', '楠木正成', '지지 않는 자', 'kusunoki', 'tachi'),
    deshi1: D('첫째 문하생', '가시마의 문하생', '初伝', '신토류 첫 단', 'deshi', 'bokken'),
    deshi2: D('둘째 문하생', '가시마의 문하생', '中伝', '신토류 가운데 단', 'deshi2', 'bokken'),
    deshi3: D('맏제자', '가시마의 맏제자', '奥伝', '신토류 깊은 단', 'deshi3', 'bokken'),
    bokuden: D('보쿠덴', '쓰카하라 보쿠덴', '塚原卜伝', '검성 · 싸우지 않고 이기는 자', 'bokuden', 'tachi', { sheathed: true }),
    kenshin: D('겐신', '우에스기 겐신', '上杉謙信', '군신 · 비사문천의 화신', 'kenshin', 'tachi', { music: 'duel2' }),
    kojiro: D('고지로', '사사키 고지로', '佐々木小次郎', '간류 · 제비를 베는 자', 'kojiro', 'longbok', { music: 'duel2' }),
    musashi: D('무사시', '미야모토 무사시', '宮本武蔵', '예순 번을 겨뤄 진 적 없는 자', 'musashi', 'oar', { music: 'duel2' }),
    musashiOld: D('무사시', '니텐 무사시', '二天', '빈 것을 쓰는 사람', 'musashiOld', 'bokken', { music: 'last' })
  };

  const duel = G.duel = {
    DEFS, id: null, state: null,
    get boss() { return null; },
    clear() { this.id = null; this.state = null; },
    // 맞수를 세워 둔다. st: wait(겨루기 전) friend(겨룬 뒤) stand(서서 졌다)
    place(id, x, y, st, o) {
      const d = DEFS[id];
      E.remove(id);
      const e = Object.assign({ type: 'enemy', boss: true, kind: id, def: d, x, y, hx: x, hy: y, z: 0, st: st || 'wait', t: 0, dir: 'l', anim: Math.random() * 3, flash: 0 }, o || {});
      E.list.push(e);
      return e;
    },
    // 승부를 시작한다: 승부 알림 → 차례 싸움 → 이야기
    start(id) {
      const d = DEFS[id];
      this.id = id; this.state = 'intro';
      G.p.st = 'idle';
      G.ui.cutin(d, () => {
        this.state = 'fight';
        G.main.toBattle({
          boss: id,
          onEnd: res => {
            this.clear();
            const e = E.find(id);
            if (res === 'win') G.STORY.won(id, e);
            else if (res === 'lose') G.game.die(true);
            else G.music.play(G.world.cur.music);
          }
        });
      });
    },
    update() { },
    // 들에 서 있는 모습
    draw(e, ctx, cx, cy, time) {
      const d = e.def, set = G.spr.f[e.sprSet || d.spr], x = Math.round(e.x - cx), y = Math.round(e.y - cy);
      E.shadow(ctx, x, y - 1, d.big || e.sprSet ? 22 : 12);
      const img = set[e.dir][Math.floor(e.anim * 1.3) % 4 === 0 ? 1 : 0] || set[e.dir][0];
      const hx = x + (e.dir === 'r' ? d.hx : -d.hx), hy = y - d.hy - (e.lift || 0);
      const wa = d.restPose === undefined ? (e.dir === 'r' ? 1.2 : 1.94) : (e.dir === 'r' ? d.restPose : 3.1416 - d.restPose);
      const showW = d.wpn && !d.sheathed && e.st !== 'stand';
      const behind = showW && Math.sin(wa) < -0.2;
      if (behind) fx.blade(ctx, hx, hy, wa, d.wpn);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1);
      if (showW && !behind) fx.blade(ctx, hx, hy, wa, d.wpn);
      if (e.st === 'stand') { ctx.save(); fx.blade(ctx, hx, hy, -1.35, d.wpn); ctx.restore(); }
    }
  };
})();
