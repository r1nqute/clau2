'use strict';
// 지도 둘: 가마쿠라(1213), 지하야(1333), 가시마(1556)
(function () {
  const G = window.G, W = G.world, T = W.T, homeGate = G.mapTools.homeGate;

  // ======================= 가마쿠라 =======================
  // 세 쪽이 산, 남쪽이 바다. 와카미야 대로가 바닷가에서 하치만구까지 곧게 뻗는다.
  W.define('kama', function () {
    const K = W.kit('kama', 104, 72, 1213), m = K.m;
    m.theme = 'summer'; m.music = 'town'; m.weather = 'firefly'; m.region = '가마쿠라';
    m.title = { kanji: '鎌倉', name: '가마쿠라', sub: '겐랴쿠 3년 초여름 · 와다 합전 전날', year: 1213 };
    const coast = x => 59 + Math.round(G.fbm(x / 13, 0.5, 15) * 4);
    K.fill((x, y) => {
      const c = coast(x);
      if (y > c + 1) return T.WATER;
      if (y > c) return T.SHALLOW;
      if (y > c - 3) return T.SAND;
      const e = 3 + G.vnoise(x / 5, y / 5, 13) * 3;
      if (x < e || x > 103 - e || y < e + 1) return T.ROCK;
      if (x > 77 + G.vnoise(y / 4, 3, 5) * 3 && y < 40 + G.vnoise(x / 4, 7, 5) * 3) return T.ROCK;
      return T.GRASS;
    });
    // 하치만구 경내와 돌계단
    K.rect(38, 5, 29, 9, T.HIGH, false);
    for (let x = 37; x <= 67; x++) { K.set(x, 14, T.ROCK); K.set(x, 15, T.ROCK); }
    K.rect(50, 13, 5, 7, T.STEP);
    K.rect(50, 10, 5, 3, T.PAVE);
    K.hall('shrineR', 50, 6);
    K.put('koma', 49, 11, { v: 0 }); K.put('koma', 55, 11, { v: 1 });
    K.put('toro', 48, 12, { light: 24, ldy: -12 }); K.put('toro', 56, 12, { light: 24, ldy: -12 });
    K.prop('goshinboku', 46, 18, { x: 46 * 16 + 8, y: 18 * 16 + 15, id: 'ginkgo', use: 'look' }); K.block(46, 18); K.reserve(44, 15, 5, 5);
    K.put('nb_hachi', 57, 18, { anim: 2.2 }); K.put('nb_hachi', 47, 21, { anim: 2.5 });
    K.npc('priest', 53, 12);
    // 와카미야 대로
    K.rect(50, 20, 4, 35, T.DIRT); K.rect(51, 20, 2, 35, T.PAVE);
    K.torii(51, 24); K.torii(51, 51);
    // 길
    K.path([[12, 46], [30, 46.5], [50, 46], [70, 46], [84, 47], [89, 52]], 2, T.DIRT, 1.5);
    K.path([[53, 34], [64, 35], [74, 34], [79, 33]], 2, T.DIRT, 1.5);
    K.path([[50, 34], [38, 35], [24, 33], [16, 30]], 2, T.DIRT, 2);
    // 아사히나 고갯길: 바위를 깎아 낸 길
    K.path([[78, 33], [85, 30], [91, 25]], 3, T.DIRT, 0);
    K.blob(92, 21, 7, 5.5, T.DIRT, false, 0.2); K.reserve(84, 14, 17, 14);
    K.path([[92, 16], [94, 9]], 2, T.DIRT, 0);
    for (const [x, y] of [[86, 18], [98, 19], [87, 25], [98, 25]]) { K.prop('boulder', x, y, { x: x * 16 + 8 }); K.block(x, y); }
    m.arenas.asahina = { x0: 85 * 16 + 8, y0: 16 * 16, x1: 99 * 16 + 8, y1: 27 * 16 };
    K.prop('door', 96, 17, { x: 96 * 16, y: 17 * 16 + 12, id: 'asadoor' });
    K.put('jizo', 81, 35, { use: 'save', id: 'kama_pass' });
    K.put('sign', 76, 36, { use: 'sign', id: 'kama_pass' });
    // 와다 저택과 호조 저택
    K.house('minka', 31, 28); K.house('minka', 38, 29);
    K.put('nb_wada', 30, 32, { anim: 2.3 }); K.put('nb_wada', 43, 32, { anim: 2.6 });
    for (let x = 29; x <= 43; x += 2) if (x !== 35 && x !== 37) K.put('fence', x, 26, {}, true);
    K.npc('wada', 36, 32);
    K.house('minka', 60, 26); K.house('minka', 67, 27);
    K.put('nb_hojo', 58, 30, { anim: 2.4 }); K.put('nb_hojo', 72, 30, { anim: 2.1 });
    K.npc('hojo', 64, 30);
    // 장터
    K.blob(51.5, 46, 9, 3.2, T.DIRT, true);
    K.house('minka', 20, 41); K.house('hut', 28, 42, { light: false }); K.house('minka', 36, 41);
    K.house('minka', 60, 41); K.house('forge', 68, 41); K.house('hut', 76, 42, { light: false });
    K.house('hut', 24, 49, { light: false }); K.house('minka', 40, 49); K.house('minka', 62, 49);
    K.prop('stall', 45, 44, { x: 45 * 16 + 8, v: 0 }); K.block(44, 44, 2, 1); K.reserve(44, 43, 3, 2);
    K.prop('stall', 57, 44, { x: 57 * 16 + 8, v: 1 }); K.block(56, 44, 2, 1); K.reserve(56, 43, 3, 2);
    K.npc('fishwife', 46, 45); K.npc('peddler', 58, 45); K.npc('smith', 70, 44); K.npc('kid2', 48, 48);
    K.put('kiln', 73, 43, { light: 22, ldy: -4 }); K.put('taru', 66, 44, {}, true); K.put('jar', 39, 44, {}, true);
    K.put('jizo', 47, 49, { use: 'save', id: 'kama_town' });
    K.put('fire', 55, 48, { anim: true, light: 50 });
    K.put('well', 34, 45);
    m.safe.push([52, 45, 14]);
    // 서쪽: 밭, 사당, 늙은 비구니
    K.rect(10, 36, 7, 3, T.FIELD); K.rect(19, 36, 6, 3, T.FIELD); K.rect(10, 40, 6, 3, T.FIELD);
    K.put('hokora', 14, 28, {}); K.npc('tomoe', 16, 30);
    K.put('kakashi', 13, 37);
    // 바닷가와 고쓰보 갯가
    homeGate(K, 30, 55, 1, { s: 'toriiStone' });
    K.blob(78, 57, 2.2, 3.5, T.ROCK, false, 0.3);
    for (const x of [86, 91, 95]) K.prop('fin', x, coast(x) + 4 + (x % 3), { anim: 1.4, flat: true });
    K.put('nets', 84, coast(84) - 2, {}, true);
    K.prop('boat', 40, coast(40), { x: 40 * 16 }); K.block(39, coast(40), 2, 1, 2);
    K.prop('boat', 64, coast(64), { x: 64 * 16 }); K.block(63, coast(64), 2, 1, 2);
    K.put('chest', 97, 50, { use: 'chest', id: 'c_kotsubo' });
    K.put('chest', 10, 10, { use: 'chest', id: 'c_kamawood' });

    K.veg((x, y, t, q, q2, grove) => {
      if (t === T.GRASS) {
        const f = x < 40 && y < 27;
        const den = f ? (grove > 0.35 ? 0.3 : 0.13) : (grove > 0.7 ? 0.16 : 0.01);
        if (q < den) K.tree(f ? (q2 < 0.45 ? 'oak' : q2 < 0.7 ? 'pine' : q2 < 0.88 ? 'cedar' : 'bamboo') : (q2 < 0.6 ? 'oak' : 'pine'), x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.012) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
        else if (q < den + 0.018) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
      } else if (t === T.HIGH) {
        if (q < 0.07) K.tree(q2 < 0.5 ? 'cedar' : 'oak', x, y, Math.floor(q2 * 31) % 3);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.08) K.prop('pine', x, y, { v: Math.floor(q2 * 3) });
      } else if (t === T.SAND) {
        if (q < 0.008) K.tree('rock', x, y, 0, true);
      }
    });
    K.zone(7, 7, 38, 26, 'bandit', 5, [T.GRASS]);
    K.zone(7, 7, 38, 26, 'boar', 2, [T.GRASS]);
    K.zone(8, 28, 30, 44, 'dog', 3, [T.GRASS]);
    K.zone(8, 56, 76, 62, 'crab', 7, [T.SAND]);
    K.zone(68, 28, 84, 39, 'roto', 3, [T.GRASS, T.DIRT]);
    K.zone(20, 58, 70, 63, 'wisp', 4, [T.SHALLOW, T.SAND], { night: 1 });
    K.spawn('kite', 44, 53); K.spawn('kite', 68, 54); K.spawn('kite', 22, 51);
    m.regions.push(['쓰루가오카 하치만구', 52, 10, 9], ['장터', 52, 46, 9], ['와다 저택', 37, 31, 7], ['호조 저택', 66, 29, 7],
      ['고쓰보 갯가', 89, 56, 8], ['아사히나 고갯길', 80, 12, 101, 39], ['와카미야 대로', 49, 20, 55, 55], ['유이가하마', 0, 55, 104, 72]);
    m.cove = { x: 88 * 16, y: (coast(88) - 2) * 16 + 8 };
    return m;
  });

  // ======================= 지하야 =======================
  // 온통 바위산. 길은 갈지자로 하나뿐이고 꼭대기에 성이 있다.
  W.define('chi', function () {
    const K = W.kit('chi', 88, 104, 1333), m = K.m;
    m.theme = 'winter'; m.music = 'mount'; m.weather = 'snow'; m.region = '곤고 산';
    m.title = { kanji: '千早', name: '지하야', sub: '겐코 3년 늦겨울 · 농성 석 달째', year: 1333 };
    K.fill(() => T.ROCK);
    // 산 아래 진터
    K.blob(44, 93, 31, 7, T.HIGH, false, 0.4);
    K.blob(44, 94, 12, 3.5, T.DIRT, true);
    K.blob(30, 90, 6, 2.5, T.SNOW, false); K.blob(60, 96, 7, 2.5, T.SNOW, false); K.blob(16, 93, 4, 3, T.SNOW, false);
    // 갈지자 길. 굽이마다 조금 넓다.
    const P = [[44, 86], [26, 77], [58, 69], [28, 59], [60, 49], [34, 39], [44, 27]];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      K.path([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (i % 2 ? -1 : 1)], b], 5, T.HIGH, 1.5, true);
      K.path([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (i % 2 ? -1 : 1)], b], 2, T.DIRT, 1.5);
    }
    for (let i = 1; i < P.length - 1; i++) { K.blob(P[i][0], P[i][1], 4, 3.2, T.HIGH, false, 0.3); K.blob(P[i][0] + (i % 2 ? -1 : 1), P[i][1] - 1, 2.5, 1.6, T.SNOW, false, 0.3); }
    K.path([[44, 88], [44, 85]], 3, T.DIRT, 0);
    m.slopes = [];
    for (let i = 1; i < P.length - 1; i++) m.slopes.push({ ax: P[i + 1][0] * 16, ay: P[i + 1][1] * 16, bx: P[i][0] * 16, by: P[i][1] * 16 });
    // 숨은 샘
    K.path([[28, 59], [18, 56], [11, 54]], 3, T.HIGH, 1, true); K.path([[26, 59], [18, 56], [12, 54]], 1, T.DIRT, 1);
    K.blob(9, 52.5, 3.5, 2.6, T.HIGH, false, 0.2); K.blob(8, 52, 1.8, 1.2, T.SHALLOW, false, 0);
    K.reserve(5, 50, 9, 6);
    K.npc('waterboy', 10, 54, { when: s => !s.flags.kusunoki });
    K.put('chest', 12, 51, { use: 'chest', id: 'c_spring' });
    // 성
    K.blob(44, 15, 16, 8.5, T.HIGH, false, 0.25);
    K.blob(44, 15, 9, 4.5, T.DIRT, true, 0.2);
    K.blob(34, 12, 4, 2, T.SNOW, false); K.blob(54, 18, 4, 2, T.SNOW, false);
    K.rect(42, 23, 5, 5, T.DIRT);
    for (let x = 29; x <= 59; x++) {
      if (x >= 43 && x <= 45) continue;
      if (K.get(x, 23) !== T.ROCK) { K.put('palisade', x, 23, {}); }
    }
    K.prop('gate', 44, 23, { x: 44 * 16 + 8, y: 23 * 16 + 15, id: 'chigate' }); K.block(43, 23, 3, 1); K.reserve(42, 21, 5, 5);
    m.gate = { tx: 44, ty: 23 };
    K.prop('yagura', 37, 22, { x: 37 * 16 + 8 }); K.block(37, 22); K.prop('yagura', 51, 22, { x: 51 * 16 + 8 }); K.block(51, 22);
    K.house('minkaS', 32, 9, { ground: T.HIGH }); K.house('minkaS', 52, 9, { ground: T.HIGH });
    for (const [x, y] of [[40, 8], [48, 8], [33, 19], [56, 14]]) K.put('nb_kiku', x, y, { anim: 2 + (x % 3) * 0.3 });
    K.put('taiko', 47, 10, {}, true); K.put('bale', 37, 13, {}, true); K.put('bale', 38, 13, {}, true); K.put('logpile', 53, 20, {});
    for (const [x, y] of [[31, 21], [41, 22], [47, 22], [57, 21]]) K.put('dummy', x, y, {});
    K.put('jizoS', 40, 20, { use: 'save', id: 'chi_top' });
    K.put('fire', 50, 16, { anim: true, light: 50 });
    m.arenas.kusunoki = { x0: 33 * 16, y0: 9 * 16, x1: 56 * 16, y1: 22 * 16 };
    K.npc('kusuGuard', 44, 26, { when: s => !s.flags.chiGate });
    // 산 아래: 포위한 막부군
    K.prop('jinmakuH', 32, 89, { x: 32 * 16 }); K.block(30, 89, 4, 1);
    K.prop('jinmakuH', 54, 89, { x: 54 * 16 }); K.block(52, 89, 4, 1);
    for (const [x, y] of [[28, 91], [37, 90], [50, 90], [59, 91]]) K.put('nb_hojo', x, y, { anim: 2 + (x % 4) * 0.2 });
    K.put('fire', 42, 94, { anim: true, light: 54 }); K.put('fire', 58, 94, { anim: true, light: 48 });
    K.put('tate', 34, 96, {}, true); K.put('tate', 52, 97, {}, true); K.put('cart', 24, 96, {}, true); K.put('bale', 22, 95, {}, true);
    K.put('jizoS', 48, 97, { use: 'save', id: 'chi_camp' });
    K.put('sign', 46, 88, { use: 'sign', id: 'chi_road' });
    K.npc('captain', 44, 91); K.npc('siege1', 37, 94); K.npc('siege2', 39, 94, { face: 'l' }); K.npc('veteran', 57, 93); K.npc('sutler', 25, 94);
    K.npc('siege1', 63, 95, { id2: 'bro' });
    homeGate(K, 14, 95, 2, { s: 'toriiS' });
    K.blob(15, 96.5, 3, 2, T.HIGH, true, 0.2);
    m.safe.push([44, 93, 13]);
    // 굽이의 지장과 덤
    K.put('jizoS', 62, 50, { use: 'save', id: 'chi_mid' });
    K.put('logpile', 57, 67, {}); K.put('logpile', 59, 47, {});
    K.put('dummy', 30, 57, {}); K.put('dummy', 36, 37, {});

    K.veg((x, y, t, q, q2) => {
      if (t === T.HIGH || t === T.SNOW) {
        const top = y < 24, camp = y > 84;
        const den = camp ? 0.05 : top ? 0.03 : 0.09;
        if (q < den) K.tree(top ? (q2 < 0.6 ? 'plum' : 'pineS') : (q2 < 0.4 ? 'bareS' : q2 < 0.75 ? 'pineS' : 'cedarS'), x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.02) K.tree('rockS', x, y, q2 < 0.6 ? 0 : 1, true);
        else if (q < den + 0.035) K.tree('bushS', x, y, q2 < 0.5 ? 0 : 1, true);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.045) K.prop(q2 < 0.6 ? 'pineS' : 'cedarS', x, y, { v: Math.floor(q2 * 3) });
      }
    });
    K.zone(22, 72, 62, 82, 'akuto', 3, [T.HIGH, T.DIRT]);
    K.zone(24, 54, 62, 72, 'akuto', 3, [T.HIGH, T.DIRT]);
    K.zone(30, 44, 64, 54, 'archer', 2, [T.HIGH]);
    K.zone(30, 30, 50, 44, 'archer', 2, [T.HIGH]);
    K.zone(6, 50, 24, 60, 'wolf', 2, [T.HIGH, T.SNOW]);
    K.zone(54, 60, 66, 72, 'wolf', 2, [T.HIGH, T.SNOW]);
    m.regions.push(['지하야 성', 44, 15, 13], ['막부군 진터', 44, 93, 15], ['숨은 샘', 9, 53, 6], ['산길', 0, 26, 88, 86]);
    return m;
  });

  // ======================= 가시마 =======================
  // 서쪽에 기타우라 못, 동북쪽에 신궁의 삼나무 숲.
  W.define('kashi', function () {
    const K = W.kit('kashi', 104, 72, 1556), m = K.m;
    m.theme = 'summer'; m.music = 'shrine'; m.weather = 'firefly'; m.region = '가시마';
    m.title = { kanji: '鹿島', name: '가시마', sub: '고지 2년 여름 · 신궁의 숲', year: 1556 };
    const lake = y => 17 + Math.round(G.fbm(y / 11, 0.5, 21) * 5);
    const wood = (x, y) => x > 55 + G.vnoise(y / 5, 2, 31) * 4 && y < 43 + G.vnoise(x / 5, 4, 31) * 4;
    K.fill((x, y) => {
      const l = lake(y);
      if (x < l - 1) return T.WATER;
      if (x < l) return T.SHALLOW;
      if (x < l + 2) return T.SAND;
      const e = 2 + G.vnoise(x / 5, y / 5, 13) * 2.5;
      if (x > 103 - e || y < e + 1 || y > 71 - e) return T.ROCK;
      if (wood(x, y)) return T.MOSS;
      return T.GRASS;
    });
    // 못 가운데 섬
    K.blob(8, 36, 3.4, 2.6, T.SAND, false, 0.2); K.blob(8, 35.5, 2, 1.4, T.GRASS, false, 0.2);
    K.prop('pine', 8, 35, { v: 1 }); K.block(8, 35);
    K.reserve(3, 32, 11, 8);
    m.isle = { x: 8 * 16 + 8, y: 37 * 16 + 8 };
    // 신궁 참배길
    K.rect(84, 14, 2, 49, T.PAVE);
    K.rect(80, 12, 10, 3, T.PAVE);
    K.hall('shrine', 83, 8);
    K.torii(84, 44); K.torii(84, 20);
    for (const y of [26, 32, 38, 50, 56]) { K.put('toro', 83, y, { light: 22, ldy: -12 }); K.put('toro', 86, y, { light: 22, ldy: -12 }); }
    K.put('koma', 82, 14, { v: 0 }); K.put('koma', 87, 14, { v: 1 });
    K.npc('miko', 88, 13);
    homeGate(K, 84, 63, 3, { north: true });
    K.rect(84, 63, 2, 3, T.PAVE);
    // 요석과 미타라시 못
    K.path([[87, 13], [92, 10], [96, 9]], 2, T.DIRT, 1);
    K.blob(96, 8.5, 2.5, 2, T.MOSS, true, 0.2);
    K.put('kaname', 96, 8, {});
    K.path([[84, 26], [76, 25], [72, 25]], 2, T.DIRT, 1);
    K.blob(69, 24, 3.6, 2.6, T.SHALLOW, false, 0.2); K.blob(69, 24, 2.2, 1.4, T.WATER, false, 0.1); K.reserve(64, 20, 11, 9);
    K.prop('goshinboku', 76, 18, { x: 76 * 16 + 8, y: 18 * 16 + 15 }); K.block(76, 18); K.reserve(74, 14, 5, 6);
    // 길
    K.path([[84, 46], [70, 44], [56, 40], [48, 36]], 2, T.DIRT, 2);
    K.path([[46, 38], [44, 46], [44, 54]], 2, T.DIRT, 1.5);
    K.path([[42, 34], [34, 35], [28, 36], [23, 38]], 2, T.DIRT, 1.5);
    // 도장
    K.rect(40, 30, 13, 8, T.PAVE);
    K.house('dojo', 44, 27, { doorT: T.PAVE });
    K.put('rack', 41, 30, {}, true); K.put('rack', 51, 30, {}, true);
    K.spawn('makiwara', 41, 36, { fixed: 1 }); K.spawn('makiwara', 51, 36, { fixed: 1 });
    K.put('jizo', 54, 37, { use: 'save', id: 'kashi_dojo' });
    K.put('sign', 39, 38, { use: 'sign', id: 'kashi_dojo' });
    m.arenas.deshi = { x0: 40 * 16 + 4, y0: 30 * 16 + 8, x1: 53 * 16 - 4, y1: 38 * 16 };
    m.yard = { x: 46 * 16 + 8, y: 34 * 16 };
    // 보쿠덴의 초막과 나룻배
    K.house('hut', 26, 31, { light: true });
    K.blob(27, 36, 5, 3, T.DIRT, true);
    K.prop('rowboat', 21, 38, { id: 'ferryboat', use: 'look' }); K.block(20, 38, 2, 1, 2);
    K.put('stump', 31, 35, {}, true);
    m.arenas.bokuden = { x0: 21 * 16, y0: 30 * 16, x1: 40 * 16, y1: 44 * 16 };
    m.shore = { x: 26 * 16, y: 38 * 16 };
    // 마을과 논
    K.blob(44, 56, 8, 4, T.DIRT, true);
    K.house('minka', 38, 50); K.house('minka', 46, 51); K.house('minka', 36, 58); K.house('hut', 48, 59, { light: false });
    K.put('well', 43, 56); K.put('hay', 52, 55); K.put('jar', 42, 53, {}, true);
    K.prop('stall', 34, 46, { x: 34 * 16 + 8, v: 0 }); K.block(33, 46, 2, 1); K.reserve(33, 45, 3, 2);
    K.npc('farmer', 35, 47); K.npc('kid', 60, 47); K.npc('ferry', 24, 46);
    K.rect(30, 46, 3, 2, T.FIELD);
    for (let oy = 44; oy <= 62; oy += 5) for (let ox = 56; ox <= 74; ox += 7) {
      let ok = true;
      for (let y = oy; y < oy + 4 && ok; y++) for (let x = ox; x < ox + 6; x++) if (K.get(x, y) !== T.GRASS || K.res[K.I(x, y)]) { ok = false; break; }
      if (ok) { K.rect(ox, oy, 6, 4, T.PADDY); if (K.r() < 0.35) K.put('kakashi', ox + 2, oy + 1); }
    }
    m.safe.push([44, 54, 11], [46, 33, 9]);
    K.put('chest', 98, 36, { use: 'chest', id: 'c_cedar' });

    K.veg((x, y, t, q, q2, grove) => {
      if (t === T.MOSS) {
        const den = grove > 0.3 ? 0.24 : 0.12;
        if (q < den) K.tree('cedar', x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.02) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
        else if (q < den + 0.03) K.tree('stump', x, y, 0, true);
      } else if (t === T.GRASS) {
        if (K.nearT(x, y, T.SAND) && q < 0.3) return K.soft('reed', x, y);
        const den = grove > 0.7 ? 0.18 : 0.012;
        if (q < den) K.tree(q2 < 0.5 ? 'oak' : q2 < 0.8 ? 'pine' : 'bamboo', x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.012) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
      } else if (t === T.SAND) {
        if (q < 0.1) K.soft('reed', x, y);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.07) K.prop('cedar', x, y, { v: Math.floor(q2 * 3) });
      }
    });
    K.zone(58, 6, 100, 42, 'deer', 8, [T.MOSS]);
    K.zone(58, 44, 82, 52, 'deer', 2, [T.GRASS]);
    K.zone(56, 4, 74, 18, 'boar', 3, [T.MOSS]);
    K.zone(64, 20, 75, 29, 'kappa', 3, [T.MOSS, T.SHALLOW], { night: 1 });
    K.zone(18, 12, 26, 60, 'wisp', 4, [T.SAND, T.GRASS], { night: 1 });
    K.zone(24, 6, 52, 22, 'dog', 3, [T.GRASS]);
    m.regions.push(['가시마 신궁', 85, 11, 8], ['요석', 96, 9, 4], ['미타라시 못', 69, 24, 5], ['도장', 46, 33, 8], ['마을', 44, 55, 10],
      ['기타우라', 0, 0, 24, 72], ['삼나무 숲', 56, 0, 104, 44]);
    return m;
  });
})();
