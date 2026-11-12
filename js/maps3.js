'use strict';
// 지도 셋: 가와나카지마(1561), 후나시마(1612)와 그 섬, 레이간도(1643)와 굴
(function () {
  const G = window.G, W = G.world, T = W.T, homeGate = G.mapTools.homeGate;

  // ======================= 가와나카지마 =======================
  // 두 강 사이의 벌판. 새벽안개가 걷히지 않는다.
  W.define('kawa', function () {
    const K = W.kit('kawa', 120, 76, 1561), m = K.m;
    m.theme = 'autumn'; m.music = 'fog'; m.weather = 'leaf'; m.region = '하치만바라'; m.fog = 0.62; m.hour = 5.9;
    m.title = { kanji: '川中島', name: '가와나카지마', sub: '에이로쿠 4년 가을 · 안개 낀 새벽', year: 1561 };
    K.fill((x, y) => {
      const e = 2 + G.vnoise(x / 5, y / 5, 13) * 2;
      if (x < e || x > 119 - e || y < e || y > 75 - e) return T.ROCK;
      return T.GRASS;
    });
    // 사이 강(북)과 지쿠마 강(남)
    K.path([[0, 11], [28, 13], [60, 10], [92, 13], [119, 11]], 3, T.WATER, 3, true);
    K.path([[0, 60], [24, 58], [50, 62], [78, 58], [100, 61], [119, 57]], 3, T.WATER, 3, true);
    for (let y = 4; y < 72; y++) for (let x = 2; x < 118; x++) {
      if (K.get(x, y) === T.WATER) continue;
      if (K.nearT(x, y, T.WATER)) K.set(x, y, K.get(x, y) === T.ROCK ? T.ROCK : T.SAND);
    }
    // 여울: 아메노미야 나루와 동쪽 나루
    for (const fx of [44, 92]) for (let y = 50; y < 70; y++) for (let x = fx - 1; x <= fx + 1; x++) if (K.get(x, y) === T.WATER) { K.set(x, y, T.SHALLOW); K.res[K.I(x, y)] = 1; }
    for (let y = 4; y < 20; y++) for (let x = 19; x <= 21; x++) if (K.get(x, y) === T.WATER) { K.set(x, y, T.SHALLOW); K.res[K.I(x, y)] = 1; }
    // 길
    K.path([[96, 26], [84, 30], [70, 33], [52, 35], [40, 36], [26, 34], [20, 24], [20, 16]], 2, T.DIRT, 2.5);
    K.path([[44, 37], [44, 52], [44, 66], [34, 69]], 2, T.DIRT, 1.5);
    K.path([[92, 30], [92, 52], [94, 64], [99, 68]], 2, T.DIRT, 1.5);
    K.path([[20, 9], [20, 4]], 2, T.DIRT, 0);
    // 하치만 사당과 돌아가는 문
    K.blob(96, 22, 5, 3.5, T.DIRT, true);
    K.put('hokora', 99, 21, {});
    K.put('nb_hachi', 93, 21, { anim: 2.2 });
    homeGate(K, 95, 24, 4, {});
    K.put('jizo', 100, 25, { use: 'save', id: 'kawa_gate' });
    // 다케다 본진
    K.blob(62, 34, 9, 5.5, T.DIRT, true);
    K.prop('jinmakuT', 58, 29, { x: 58 * 16 }); K.block(56, 29, 4, 1);
    K.prop('jinmakuT', 66, 29, { x: 66 * 16 }); K.block(64, 29, 4, 1);
    K.put('nb_furin', 55, 31, { anim: 2 }); K.put('nb_furin', 69, 31, { anim: 2.3 });
    K.put('nb_takeda', 54, 36, { anim: 2.4 }); K.put('nb_takeda', 70, 36, { anim: 2.1 }); K.put('nb_takeda', 60, 28, { anim: 2.6 });
    K.put('fire', 59, 35, { anim: true, light: 54 }); K.put('taiko', 66, 31, {}, true);
    K.put('tate', 56, 38, {}, true); K.put('tate', 68, 38, {}, true); K.put('bale', 65, 36, {}, true);
    K.npc('shingen', 62, 32); K.npc('takeda', 58, 37, { id2: 'takeda1' }); K.npc('takeda', 67, 34, { id2: 'takedaCook' });
    K.put('jizo', 72, 39, { use: 'save', id: 'kawa_camp' });
    m.safe.push([62, 34, 9]);
    // 사이조 산: 우에스기가 진을 쳤던 곳
    K.blob(31, 69.5, 13, 4, T.HIGH, false, 0.3);
    K.blob(31, 69.5, 6, 2.2, T.DIRT, true);
    K.put('nb_bi', 25, 68, { anim: 2.1 }); K.put('nb_ryu', 37, 68, { anim: 2.4 }); K.put('nb_bi', 31, 67, { anim: 2.7 });
    K.put('fire', 33, 70, { anim: true, light: 48 }); K.put('tate', 27, 71, {}, true);
    K.npc('uesugi', 29, 70, { id2: 'uesugi1' });
    m.safe.push([31, 69.5, 7]);
    // 가이즈 성(멀리서만 본다)
    for (let x = 97; x <= 109; x++) if (x < 102 || x > 104) K.put('palisade', x, 69, {});
    K.prop('gate', 103, 69, { x: 103 * 16 + 8, y: 69 * 16 + 15 }); K.block(102, 69, 3, 1);
    K.prop('yagura', 99, 68, { x: 99 * 16 + 8 }); K.block(99, 68);
    K.put('nb_takeda', 106, 68, { anim: 2.2 });
    // 소금 장수: 북쪽 나루 건너에 발이 묶였다
    K.blob(21, 6.5, 4, 2, T.DIRT, true);
    K.put('cart', 23, 6, {}, true); K.put('bale', 18, 6, {}, true); K.put('bale', 19, 7, {}, true);
    K.npc('salter', 21, 7);
    m.safe.push([21, 6.5, 5]);
    m.arenas.kenshin = { x0: 24 * 16, y0: 28 * 16, x1: 52 * 16, y1: 46 * 16 };
    m.field = { x: 38 * 16, y: 37 * 16 };
    K.npc('burier', 78, 46);
    // 떠돌이 무녀가 다친 아시가루를 묶고 있다
    K.npc('chiyo', 82, 47, { face: 'l', when: s => !(s.allies && s.allies.chiyo) });
    K.npc('takeda', 80, 48, { id2: 'wounded', face: 'r' });
    K.put('bale', 84, 48, {}, true);
    K.put('chest', 110, 40, { use: 'chest', id: 'c_kawa' });
    K.put('sign', 46, 38, { use: 'sign', id: 'kawa_ford' });

    K.veg((x, y, t, q, q2, grove) => {
      if (t === T.GRASS) {
        const sus = G.vnoise(x / 7, y / 7, 71);
        if (sus > 0.6 && q < 0.5) return K.soft('susuki', x, y);
        const den = grove > 0.72 ? 0.14 : 0.008;
        if (q < den) K.tree(q2 < 0.45 ? 'maple' : q2 < 0.8 ? 'oakA' : 'pine', x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.01) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
        else if (q < den + 0.016) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
      } else if (t === T.HIGH) {
        if (q < 0.06) K.tree(q2 < 0.6 ? 'pine' : 'maple', x, y, Math.floor(q2 * 31) % 3);
      } else if (t === T.SAND) {
        if (q < 0.16) K.soft('reed', x, y);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.07) K.prop('pine', x, y, { v: Math.floor(q2 * 3) });
      }
    });
    // 벌판에 나뒹구는 것
    for (let i = 0; i < 26; i++) {
      const x = 8 + Math.floor(K.r() * 104), y = 16 + Math.floor(K.r() * 40);
      if (K.get(x, y) === T.GRASS && !K.res[K.I(x, y)] && !m.solid[K.I(x, y)]) K.prop(i % 3 ? 'arrows' : 'tate', x, y, i % 3 ? {} : { use: 'look' });
    }
    K.zone(70, 18, 112, 54, 'ashiT', 6, [T.GRASS]);
    K.zone(6, 16, 34, 54, 'ashiU', 6, [T.GRASS]);
    K.zone(74, 40, 112, 56, 'gunner', 3, [T.GRASS]);
    K.zone(36, 16, 68, 26, 'wolf', 2, [T.GRASS]);
    K.zone(48, 40, 74, 54, 'ashiU', 2, [T.GRASS]);
    m.regions.push(['다케다 본진', 62, 34, 10], ['사이조 산', 31, 70, 12], ['가이즈 성', 103, 68, 7], ['하치만 사당', 96, 22, 6],
      ['아메노미야 나루', 44, 60, 5], ['사이 강', 0, 4, 120, 17], ['지쿠마 강', 0, 55, 120, 66]);
    return m;
  });

  // ======================= 후나시마 편: 같은 바닷가, 사백스물일곱 해 뒤 =======================
  W.define('funa', function () {
    const K = W.kit('funa', 112, 72, 1185), m = K.m;     // 씨앗이 단노우라와 같다. 같은 땅이다.
    m.theme = 'summer'; m.music = 'town'; m.weather = 'firefly'; m.region = '아카마가세키';
    m.title = { kanji: '舟島', name: '후나시마', sub: '게이초 17년 초여름 · 같은 바다', year: 1612 };
    G.mapShore(K);
    const coast = K.coast;
    // 신사 언덕: 그대로다. 기둥에 붉은 칠을 올렸다.
    K.hall('shrineR', 54, 5);
    K.torii(55, 14);
    K.put('koma', 54, 10, { v: 0 }); K.put('koma', 57, 10, { v: 1 });
    K.put('toro', 53, 12, { light: 24, ldy: -12 }); K.put('toro', 58, 12, { light: 24, ldy: -12 });
    K.blob(48.5, 12, 3, 2, T.HIGH, true, 0);
    homeGate(K, 48, 11, 5, { s: 'toriiStone' });
    // 포구가 읍내가 되었다
    K.blob(22, 41, 14, 7, T.DIRT, true);
    K.rect(8, 40, 30, 2, T.PAVE);
    K.house('machiya', 9, 36, { p: { v: 0 } }); K.house('inn', 15, 36); K.house('machiya', 21, 36, { p: { v: 1 } }); K.house('machiya', 27, 36, { p: { v: 2 } });
    K.house('machiya', 10, 43, { p: { v: 2 } }); K.house('machiya', 17, 43, { p: { v: 0 } }); K.house('machiya', 25, 44, { p: { v: 1 } });
    K.house('minka', 33, 33);
    K.prop('stall', 31, 43, { x: 31 * 16 + 8, v: 1 }); K.block(30, 43, 2, 1); K.reserve(30, 42, 3, 2);
    K.put('well', 23, 41); K.put('taru', 14, 39, {}, true); K.put('taru', 20, 39, {}, true); K.put('cart', 34, 45, {}, true);
    K.put('jizo', 36, 41, { use: 'save', id: 'funa_town' });
    K.put('toro', 8, 42, { light: 24, ldy: -12 });
    K.npc('agent', 17, 39); K.npc('townswoman', 32, 44); K.npc('smith', 29, 46, { id2: 'polisher' }); K.npc('kid2', 26, 42); K.npc('official', 13, 41);
    m.safe.push([22, 41, 15]);
    // 나루와 삭은 배
    K.rect(30, coast(30) - 1, 2, 7, T.DECK);
    K.prop('rowboat', 33, coast(30) + 4, { id: 'ferry', flat: false }); K.block(32, coast(30) + 4, 2, 1, 2);
    K.npc('ferry', 31, coast(30) - 2, { id2: 'ferryman' });
    m.pier = { x: 31 * 16, y: (coast(30) + 3) * 16 };
    K.prop('wreck', 11, coast(11) + 1, { use: 'look', id: 'oldboat', reach: 6 }); K.block(10, coast(11) + 1, 2, 1, 2);
    K.put('nets', 38, coast(38) - 2, {}, true);
    // 숲 어귀의 가마: 끌려온 도공
    K.blob(27, 21, 6, 4, T.DIRT, true);
    K.put('kiln', 25, 19, { light: 22, ldy: -4 }); K.house('hut', 28, 17, { light: true });
    K.put('pots', 24, 22, {}, true); K.put('pots', 30, 23, {}, true); K.put('jar', 32, 20, {}, true);
    K.npc('potter', 27, 22);
    K.path([[27, 25], [26, 32], [24, 36]], 2, T.DIRT, 1.5);
    m.safe.push([27, 21, 7]);
    // 냇물 건너: 논과 절. 옛 진터다.
    K.blob(96, 38, 7, 4, T.DIRT, true);
    K.hall('shrine', 94, 31);
    K.put('toro', 92, 36, { light: 24, ldy: -12 }); K.put('toro', 100, 36, { light: 24, ldy: -12 });
    K.put('jizo', 87, 44, { use: 'save', id: 'funa_temple' });
    K.npc('biwa', 96, 37, { when: () => G.game.isNight() });
    K.npc('abbot', 98, 39, { id2: 'templeMonk', when: () => !G.game.isNight() });
    for (let oy = 44; oy <= 48; oy += 4) for (let ox = 40; ox <= 68; ox += 7) {
      let ok = true;
      for (let y = oy; y < oy + 3 && ok; y++) for (let x = ox; x < ox + 6; x++) if (K.get(x, y) !== T.GRASS || K.res[K.I(x, y)]) { ok = false; break; }
      if (ok) { K.rect(ox, oy, 6, 3, T.PADDY); if (K.r() < 0.4) K.put('kakashi', ox + 2, oy + 1); }
    }
    // 고지로가 칼을 익히는 바닷가
    m.kojiro = { x: 92 * 16, y: (coast(92) - 1) * 16 + 4 };
    m.arenas.kojiro = { x0: 84 * 16 + 8, y0: 46 * 16, x1: 106 * 16, y1: (coast(96) + 1) * 16 };
    K.reserve(84, 46, 22, 9);
    K.put('sign', 58, 23, { use: 'sign', id: 'funa_hill' });
    K.put('sign', 34, 30, { use: 'sign', id: 'funa_road' });
    K.blob(62, 63, 2.6, 1.9, T.SAND, false, 0.2); K.reserve(59, 61, 7, 5);
    for (let y = coast(62) + 1; y <= 59; y++) for (let x = 60; x <= 64; x++) if (K.get(x, y) === T.WATER) K.set(x, y, T.SHALLOW);
    for (let x = 60; x <= 64; x++) K.set(x, 60, T.WATER);
    K.put('chest', 62, 63, { use: 'chest', id: 'c_islet2' });

    K.veg((x, y, t, q, q2, grove) => {
      if (t === T.GRASS) {
        if (K.nearT(x, y, T.WATER) && q < 0.42) return K.soft('reed', x, y);
        const f = x < 46 && y < 31;
        const den = f ? (grove > 0.35 ? 0.24 : 0.09) : (grove > 0.68 ? 0.18 : 0.012);
        if (q < den) K.tree(f ? (q2 < 0.55 ? 'pine' : q2 < 0.85 ? 'oak' : 'bamboo') : (q2 < 0.65 ? 'oak' : 'pine'), x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.012) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
        else if (q < den + 0.02) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
      } else if (t === T.HIGH) {
        if (q < 0.06) K.tree(q2 < 0.6 ? 'oak' : 'cedar', x, y, Math.floor(q2 * 31) % 2);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.07) K.prop('pine', x, y, { v: Math.floor(q2 * 3) });
      } else if (t === T.SAND) {
        if (q < 0.008) K.tree('rock', x, y, 0, true);
      }
    });
    K.zone(40, 51, 78, 58, 'heike', 7, [T.SAND]);
    K.zone(5, 6, 44, 16, 'ronin', 3, [T.GRASS]);
    K.zone(40, 24, 76, 36, 'kabuki', 2, [T.GRASS]);
    K.zone(60, 6, 76, 30, 'ronin', 2, [T.GRASS]);
    K.zone(30, 55, 80, 62, 'wisp', 6, [T.SHALLOW, T.SAND], { night: 1 });
    K.zone(86, 30, 104, 44, 'wisp', 3, [T.GRASS, T.DIRT], { night: 1 });
    m.regions.push(['가메야마 하치만', 56, 11, 11], ['아카마가세키', 22, 41, 15], ['가마터', 27, 21, 7], ['아미다지', 96, 36, 8],
      ['솔숲', 3, 4, 46, 31], ['바닷가', 0, 50, 112, 72]);
    return m;
  });

  // 후나시마. 뒷날 간류지마라 불린다.
  W.define('isle', function () {
    const K = W.kit('isle', 48, 34, 1612), m = K.m;
    m.theme = 'summer'; m.music = 'still'; m.weather = null; m.region = '후나시마'; m.hour = 8.5;
    m.title = { kanji: '舟島', name: '후나시마', sub: '4월 13일 아침 · 물때가 바뀌기 전', year: 1612 };
    K.fill(() => T.WATER);
    K.blob(24, 18, 16, 8, T.SHALLOW, false, 0.3);
    K.blob(24, 18, 14, 6.4, T.SAND, false, 0.3);
    K.blob(27, 15, 6, 2.6, T.GRASS, false, 0.4);
    K.rect(13, 9, 2, 5, T.DECK);
    K.prop('rowboat', 15, 10, { x: 16 * 16, use: 'story', id: 'isleboat', reach: 8 }); K.block(15, 10, 2, 1, 2);
    K.prop('jinmakuK', 35, 14, { x: 35 * 16 + 8 }); K.block(34, 14, 3, 1);
    K.put('nb_kuyo', 32, 14, { anim: 2.3 }); K.put('nb_kuyo', 38, 15, { anim: 2.6 });
    K.npc('official', 34, 16, { id2: 'witness1' }); K.npc('official', 37, 17, { id2: 'witness2', face: 'l' });
    for (const [x, y, v] of [[28, 14, 0], [30, 15, 1], [25, 14, 2], [9, 19, 1], [40, 20, 0]]) { K.prop('pine', x, y, { v }); K.block(x, y); }
    K.put('rock', 18, 22, { v: 2 }, true); K.put('rock', 33, 22, { v: 0 }, true);
    m.arenas.musashi = { x0: 11 * 16, y0: 14 * 16, x1: 38 * 16, y1: 24 * 16 };
    m.start = { x: 14 * 16, y: 14 * 16 + 8 };
    m.spot = { k: [28 * 16, 19 * 16], m: [18 * 16, 19 * 16], me: [15 * 16, 16 * 16] };
    K.reserve(8, 12, 32, 12);
    m.safe.push([24, 18, 30]);
    return m;
  });

  // ======================= 레이간도 =======================
  // 긴포 산. 절을 지나 벼랑길 끝에 굴이 있다.
  W.define('rei', function () {
    const K = W.kit('rei', 64, 72, 1643), m = K.m;
    m.theme = 'winter'; m.music = 'still'; m.weather = 'snow'; m.region = '긴포 산';
    m.title = { kanji: '霊巌洞', name: '레이간도', sub: '간에이 20년 겨울 · 칼의 시대가 끝난 뒤', year: 1643 };
    K.fill(() => T.ROCK);
    K.blob(31, 62, 12, 6, T.MOSS, false, 0.3);
    K.path([[31, 64], [30, 56], [26, 50], [30, 44]], 5, T.MOSS, 2, true);
    K.path([[31, 64], [30, 56], [26, 50], [30, 44]], 2, T.DIRT, 2);
    // 운간젠지
    K.blob(31, 40, 11, 5.5, T.HIGH, false, 0.3);
    K.rect(27, 39, 9, 4, T.PAVE);
    K.hall('shrine', 29, 35);
    K.put('toro', 27, 40, { light: 24, ldy: -12 }); K.put('toro', 35, 40, { light: 24, ldy: -12 });
    K.put('jizoS', 24, 42, { use: 'save', id: 'rei_temple' });
    K.npc('abbot', 33, 42);
    K.blob(22, 38, 3, 2, T.SNOW, false); K.blob(40, 42, 3, 2, T.SNOW, false); K.blob(31, 60, 6, 2.5, T.SNOW, false);
    // 돌계단과 벼랑길
    K.rect(40, 30, 2, 9, T.STEP);
    K.path([[41, 30], [46, 26], [44, 20], [48, 16]], 4, T.HIGH, 1, true);
    K.path([[41, 30], [46, 26], [44, 20], [48, 15]], 2, T.DIRT, 1);
    K.blob(48, 14.5, 4, 2.6, T.HIGH, false, 0.2);
    for (let x = 45; x <= 51; x++) { K.set(x, 11, T.ROCK); K.set(x, 12, T.ROCK); }
    K.set(48, 12, T.DIRT);
    K.prop('cavemouth', 48, 12, { y: 12 * 16 + 15, flat: true });
    K.warp(48, 12, 'cave', 16 * 16, 19 * 16 + 8, 'up');
    m.caveOut = { x: 48 * 16 + 8, y: 13 * 16 + 12 };
    K.npc('magonojo', 46, 15);
    K.put('jizoS', 51, 15, { use: 'save', id: 'rei_cave' });
    K.reserve(44, 10, 9, 7);
    homeGate(K, 30, 65, 6, { s: 'toriiS' });
    K.put('sign', 34, 58, { use: 'sign', id: 'rei_road' });
    K.put('chest', 20, 62, { use: 'chest', id: 'c_rei' });
    K.veg((x, y, t, q, q2) => {
      if (t === T.MOSS || t === T.HIGH || t === T.SNOW) {
        const den = t === T.HIGH ? 0.04 : 0.13;
        if (q < den) K.tree(q2 < 0.6 ? 'cedarS' : q2 < 0.85 ? 'bareS' : 'pineS', x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.02) K.tree('rockS', x, y, q2 < 0.6 ? 0 : 1, true);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.05) K.prop(q2 < 0.5 ? 'pineS' : 'cedarS', x, y, { v: Math.floor(q2 * 3) });
      }
    });
    m.safe.push([31, 40, 40]);
    m.regions.push(['운간젠지', 31, 40, 9], ['굴 어귀', 48, 15, 5]);
    return m;
  });

  const CAVE = [
    '################################',
    '################################',
    '##########..........############',
    '########..............##########',
    '#######......K.........#########',
    '######..................########',
    '######..................########',
    '#####......D.............#######',
    '#####....................#######',
    '#####.....................######',
    '######....................######',
    '######....................######',
    '#######..................#######',
    '########................########',
    '#########..............#########',
    '##########............##########',
    '############........############',
    '##############....##############',
    '##############....##############',
    '###############..###############',
    '###############.E###############',
    '################################'
  ];
  W.define('cave', function () {
    const h = CAVE.length, w = CAVE[0].length, K = W.kit('cave', w, h, 1645), m = K.m;
    m.dark = true; m.music = 'still'; m.region = '레이간도'; m.theme = 'winter';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = CAVE[y][x];
      K.set(x, y, ch === '#' ? T.CAVEW : T.CAVEF);
      if (ch === 'K') { K.put('jizo', x, y, { use: 'look', id: 'kannon', light: 30 }); }
      else if (ch === 'D') { K.prop('desk', x, y, { x: x * 16 + 8, light: 58, ldy: -8, anim: false }); K.block(x, y); m.desk = { x: x * 16 + 8, y: y * 16 + 15 }; }
      else if (ch === 'E') K.warp(x, y, 'rei', 0, 0, 'down', { spot: 'caveOut' });
    }
    m.arenas.musashiOld = { x0: 6 * 16, y0: 8 * 16, x1: 25 * 16, y1: 16 * 16 };
    m.safe.push([16, 10, 30]);
    return m;
  });
})();
