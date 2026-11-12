'use strict';
// 지도 하나: 고갯마루(때 없는 고개)와 단노우라. 간몬 해협의 바닷가는 후나시마 편에서 한 번 더 쓴다.
(function () {
  const G = window.G, W = G.world, T = W.T;

  // 일곱 때. 고갯마루의 도리이 순서와 같다.
  G.ERAS = [
    { map: 'dan', name: '단노우라', kanji: '壇ノ浦', era: '元暦', year: 1185, sub: '겐페이 합전이 끝난 봄' },
    { map: 'kama', name: '가마쿠라', kanji: '鎌倉', era: '建暦', year: 1213, sub: '와다 합전 전날, 초여름' },
    { map: 'chi', name: '지하야', kanji: '千早', era: '元弘', year: 1333, sub: '농성 석 달째, 늦겨울' },
    { map: 'kashi', name: '가시마', kanji: '鹿島', era: '弘治', year: 1556, sub: '삼나무 숲의 여름' },
    { map: 'kawa', name: '가와나카지마', kanji: '川中島', era: '永禄', year: 1561, sub: '안개 낀 가을 새벽' },
    { map: 'funa', name: '후나시마', kanji: '舟島', era: '慶長', year: 1612, sub: '같은 바다, 사백스물일곱 해 뒤' },
    { map: 'rei', name: '레이간도', kanji: '霊巌洞', era: '寛永', year: 1643, sub: '칼의 시대가 끝난 겨울' }
  ];
  G.HUB = { tx: i => 8 + i * 5, gx: i => (9 + i * 5) * 16, gy: 12 * 16 + 12 };
  // 때마다 고갯마루로 돌아가는 도리이를 세운다
  function homeGate(K, tx, ty, i, o) {
    K.torii(tx, ty, Object.assign({ gate: 'home' }, o || {}));
    for (const x of [tx, tx + 1]) K.warp(x, ty, 'hub', G.HUB.gx(i), G.HUB.gy, 'down', { need: 'feather', deny: '도리이다. 지나가 보았다. 도리이 뒤쪽이 나왔다.' });
    K.m.arrive = { x: (tx + 1) * 16, y: (o && o.north ? ty - 1 : ty + 1) * 16 + 12 };
  }
  G.mapTools = { homeGate };

  // ======================= 고갯마루 =======================
  W.define('hub', function () {
    const K = W.kit('hub', 48, 36, 4242), m = K.m;
    m.theme = 'hub'; m.music = 'hub'; m.weather = 'mist'; m.region = '고갯마루';
    m.title = { kanji: '峠', name: '고갯마루', sub: '어느 때에도 속하지 않는 고개' };
    K.fill((x, y) => {
      const d = Math.pow(Math.abs(x - 24) / 20.5, 4) + Math.pow(Math.abs(y - 17.5) / 8.5, 4) + (G.vnoise(x / 3, y / 3, 5) - 0.5) * 0.28;
      return d < 1 ? T.HIGH : T.CLOUD;
    });
    K.path([[6, 18], [16, 17.5], [28, 18], [41, 18]], 2, T.DIRT, 1.5);
    for (let i = 0; i < 7; i++) {
      const tx = G.HUB.tx(i), e = G.ERAS[i];
      K.rect(tx - 1, 10, 4, 3, T.HIGH); K.rect(tx, 12, 2, 5, T.PAVE);
      K.torii(tx, 11, { gate: i, label: e.era });
      K.block(tx, 10, 2, 1);
      for (const x of [tx, tx + 1]) K.warp(x, 11, e.map, 0, 0, 'down', { need: 'gate' + i, arrive: true, deny: '금줄이 걸려 있다. 아직 지날 때가 아닌 모양이다.' });
    }
    K.blob(24, 20, 5, 2.5, T.DIRT, true);
    K.put('jizo', 21, 16, { use: 'save', id: 'hub' });
    // 찻집
    K.house('chaya', 8, 20, { ground: T.HIGH, doorT: T.DIRT });
    K.prop('bench', 13, 22, { x: 14 * 16, y: 22 * 16 + 14 }); K.block(13, 22, 2, 1, 2); K.reserve(12, 21, 4, 3);
    K.npc('granny', 10, 22);
    K.put('taru', 7, 22, {}, true);
    // 신목과 덴구
    K.prop('goshinboku', 41, 16, { x: 41 * 16 + 8, y: 16 * 16 + 15 }); K.block(41, 16); K.reserve(39, 13, 5, 5);
    K.npc('tengu', 41, 19);
    K.put('toro', 37, 16, { light: 26, ldy: -12 }); K.put('toro', 43, 19, { light: 26, ldy: -12 });
    // 짚단. 쳐 봐도 된다.
    for (const x of [19, 23, 27]) K.spawn('makiwara', x, 23, { fixed: 1 });
    K.reserve(17, 21, 13, 4);
    K.put('sign', 30, 22, { use: 'sign', id: 'hub' });
    K.veg((x, y, t, q, q2) => {
      if (t !== T.HIGH) return;
      if (y > 20 && q < 0.05) K.tree('cedar', x, y, Math.floor(q2 * 3));
      else if (q < 0.03) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
      else if (q < 0.045) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
    });
    // 발아래 구름
    for (let i = 0; i < 26; i++) {
      const x = 2 + Math.floor(K.r() * 44), y = 3 + Math.floor(K.r() * 31);
      if (K.get(x, y) === T.CLOUD && K.get(x, y - 1) === T.CLOUD && K.get(x, y + 1) === T.CLOUD) K.prop('cloud', x, y, { v: i % 3, flat: true, drift: 0.5 + K.r() });
    }
    m.safe.push([24, 18, 30]);
    m.regions.push(['찻집', 10, 21, 6]);
    m.start = { x: G.HUB.gx(0), y: G.HUB.gy };
    return m;
  });

  // ======================= 간몬 해협의 바닷가 =======================
  // 남쪽이 바다. 북쪽 한가운데 언덕에 가메야마 하치만 신사, 동쪽에 내가 흐른다.
  function shore(K) {
    const { W: w, set, get } = K;
    const coast = x => 53 + Math.round(G.fbm(x / 12, 0.5, 5) * 5);
    K.coast = coast;
    K.fill((x, y) => {
      const c = coast(x);
      if (y > c + 1) return T.WATER;
      if (y > c) return T.SHALLOW;
      if (y > c - 3) return T.SAND;
      const e = 2 + G.vnoise(x / 5, y / 5, 13) * 2.5;
      if (x < e || x > w - 1 - e || y < e + 1.5) return T.ROCK;
      return T.GRASS;
    });
    // 신사 언덕과 돌계단
    for (let y = 3; y < 24; y++) for (let x = 38; x < 76; x++) {
      const dx = (x - 56) / 12.5, dy = (y - 11) / 7.5;
      const d = dx * dx + dy * dy + (G.vnoise(x / 3, y / 3, 29) - 0.5) * 0.3;
      if (d < 1) set(x, y, T.HIGH);
      else if (d < 1.42 && y > 8) set(x, y, T.ROCK);
    }
    for (let y = 15; y <= 22; y++) { set(55, y, T.STEP); set(56, y, T.STEP); K.res[K.I(55, y)] = K.res[K.I(56, y)] = 1; }
    K.rect(55, 9, 2, 6, T.PAVE);
    // 내
    K.path([[80, 3], [79, 14], [82, 24], [80, 34], [83, 44], [82, 53], [82, 59]], 2, T.WATER, 2);
    for (let y = 4; y < 54; y++) for (let x = 74; x < 90; x++) if (get(x, y) === T.GRASS && K.nearT(x, y, T.WATER)) K.res[K.I(x, y)] = 0;
    // 큰길과 신사 가는 길
    K.path([[24, 41], [34, 40], [44, 39], [56, 40], [70, 41], [78, 41], [86, 41], [93, 40]], 2, T.DIRT, 2);
    K.path([[55.5, 39], [56, 30], [55.5, 23]], 2, T.DIRT, 1);
    K.m.bridge = { x0: 79, x1: 85, y: 41 };
  }

  W.define('dan', function () {
    const K = W.kit('dan', 112, 72, 1185), m = K.m;
    m.theme = 'spring'; m.music = 'sea'; m.weather = 'petal'; m.region = '단노우라';
    m.title = { kanji: '壇ノ浦', name: '단노우라', sub: '겐랴쿠 2년 봄 · 겐페이 합전이 끝난 뒤', year: 1185 };
    shore(K);
    const coast = K.coast;

    // --- 신사 언덕
    K.hall('shrine', 54, 5);
    K.torii(55, 14);
    K.put('koma', 54, 10, { v: 0 }); K.put('koma', 57, 10, { v: 1 });
    K.put('toro', 53, 12, { light: 24, ldy: -12 }); K.put('toro', 58, 12, { light: 24, ldy: -12 });
    K.blob(48.5, 12, 3, 2, T.HIGH, true, 0);
    homeGate(K, 48, 11, 0, { s: 'toriiStone', id: 'gate_hub' });
    K.put('sign', 58, 23, { use: 'sign', id: 'dan_hill' });

    // --- 아카마 포구
    K.blob(21, 41, 11, 6, T.DIRT, true);
    K.house('minka', 11, 34); K.house('minka', 19, 33); K.house('hut', 27, 35, { light: false });
    K.house('minka', 13, 43); K.house('hut', 23, 44);
    K.put('well', 19, 39); K.put('jar', 17, 36, {}, true); K.put('jar', 25, 35, {}, true);
    K.put('jizo', 30, 41, { use: 'save', id: 'dan_port' });
    K.put('nets', 30, 47, {}, true); K.put('nets', 33, 48, {}, true);
    K.put('hay', 9, 40); K.put('fire', 21, 41, { anim: true, light: 50 });
    K.path([[14, 51], [17, 46], [21, 43]], 2, T.DIRT, 1);
    K.prop('rowboat', 11, coast(11) + 1, { use: 'story', id: 'myboat', reach: 6 }); K.block(10, coast(11) + 1, 2, 1, 2);
    K.prop('boat', 24, coast(24), { x: 24 * 16 }); K.block(23, coast(24), 2, 1, 2);
    K.npc('fisher', 31, 49); K.npc('ama', 38, coast(38) - 1); K.npc('kid', 20, 46); K.npc('monk', 46, coast(46) - 1);
    m.safe.push([21, 41, 12]);

    // --- 버려진 헤이케 진터
    K.blob(24, 18, 6, 4, T.DIRT, true);
    for (const [x, y] of [[20, 16], [23, 15], [27, 16]]) K.put('tate', x, y, {}, true);
    K.put('nb_red', 19, 19, { anim: 2.4 }); K.put('nb_red', 29, 18, { anim: 2 });
    K.prop('arrows', 24, 19, {}); K.prop('arrows', 26, 21, {}); K.prop('arrows', 21, 20, {});
    K.put('chest', 25, 16, { use: 'chest', id: 'c_heike' });
    K.put('sign', 34, 30, { use: 'sign', id: 'dan_road' });

    // --- 바닷가에 흩어진 것
    for (const [x, d] of [[40, 0], [58, 1], [72, 0], [50, 1], [66, 0]]) K.prop('arrows', x, coast(x) - d, {});
    K.put('tate', 44, coast(44) - 1, {}, true); K.put('tate', 68, coast(68) - 2, {}, true);
    K.prop('wreck', 49, coast(49) + 2, { x: 49 * 16 }); K.block(48, coast(49) + 2, 2, 1, 2);
    K.prop('wreck', 71, coast(71) + 2, { x: 71 * 16 }); K.block(70, coast(71) + 2, 2, 1, 2);
    for (let i = 0; i < 16; i++) {
      const x = 16 + Math.floor(K.r() * 62), y = coast(x) + 3 + Math.floor(K.r() * 9);
      if (K.get(x, y) === T.WATER) K.prop(i % 5 ? 'floatR' : 'floatW', x, y, { flat: true, bob: K.r() * 6 });
    }
    // 뛰어야 닿는 모래톱
    K.blob(62, 63, 2.6, 1.9, T.SAND, false, 0.2); K.reserve(59, 61, 7, 5);
    for (let y = coast(62) + 1; y <= 59; y++) for (let x = 60; x <= 64; x++) if (K.get(x, y) === T.WATER) K.set(x, y, T.SHALLOW);
    K.set(61, 60, T.WATER); K.set(62, 60, T.WATER); K.set(63, 60, T.WATER); K.set(60, 60, T.WATER); K.set(64, 60, T.WATER);
    K.put('chest', 62, 63, { use: 'chest', id: 'c_islet' });
    K.put('rock', 64, 63, { v: 0 }, true);

    // --- 겐지 진영
    K.blob(96, 38, 9, 6, T.DIRT, true);
    K.prop('jinmakuG', 92, 31, { x: 92 * 16 }); K.block(90, 31, 4, 1);
    K.prop('jinmakuG', 100, 31, { x: 100 * 16 }); K.block(98, 31, 4, 1);
    K.put('nb_white', 89, 33, { anim: 2.2 }); K.put('nb_white', 103, 33, { anim: 2.6 }); K.put('nb_white', 95, 30, { anim: 2 }); K.put('nb_white', 97, 30, { anim: 2.4 });
    K.put('fire', 96, 37, { anim: true, light: 54 });
    K.put('tate', 91, 36, {}, true); K.put('tate', 101, 37, {}, true); K.put('taiko', 100, 34, {}, true);
    K.put('jizo', 87, 44, { use: 'save', id: 'dan_camp' });
    K.npc('genji', 93, 38, { id2: 'genji1' }); K.npc('genji', 99, 40, { id2: 'genji2' });
    // 부두와 배들
    const py = coast(96);
    K.rect(96, py - 1, 2, 60 - py + 1, T.DECK);
    const boats = [[93, 60, 8, 3], [84, 62, 7, 3], [102, 62, 7, 3], [88, 66, 8, 3], [98, 66, 8, 3]];
    for (const [x, y, w, h] of boats) {
      K.rect(x, y, w, h, T.DECK);
      K.prop('hullL', x, y, { x: x * 16 - 10, y: (y + h) * 16 - 1, flat: true });
      K.prop('hullR', x, y, { x: (x + w) * 16 + 10, y: (y + h) * 16 - 1, flat: true });
    }
    for (const [x, y] of [[91, 62], [92, 62], [101, 62], [89, 65], [94, 63], [94, 64], [94, 65], [104, 65], [96, 67], [97, 67]]) K.rect(x, y, 1, 1, T.DECK);
    K.put('mastW', 93, 60, { x: 93 * 16 + 8 }); K.put('mastW', 84, 62, { x: 84 * 16 + 8 }); K.put('mastW', 108, 62, { x: 108 * 16 + 8 });
    K.put('mastW', 88, 66, { x: 88 * 16 + 8 }); K.put('mastW', 105, 66, { x: 105 * 16 + 8 });
    K.put('nb_white', 100, 60, { anim: 2.4 });
    m.boats = boats.map(b => ({ x: (b[0] + b[2] / 2) * 16, y: (b[1] + b[3] / 2) * 16 + 8 }));
    m.arenas.yoshitsune = { x0: 84 * 16 + 4, y0: 60 * 16 + 6, x1: 109 * 16 - 4, y1: 69 * 16 - 2 };
    m.arenas.benkei = { x0: 66 * 16, y0: 35 * 16, x1: 86 * 16, y1: 47 * 16 };
    K.blob(73, 41, 5, 3.5, T.DIRT, true);

    // --- 논
    for (let oy = 44; oy <= 48; oy += 4) for (let ox = 40; ox <= 62; ox += 7) {
      let ok = true;
      for (let y = oy; y < oy + 3 && ok; y++) for (let x = ox; x < ox + 6; x++) if (K.get(x, y) !== T.GRASS || K.res[K.I(x, y)]) { ok = false; break; }
      if (ok) { K.rect(ox, oy, 6, 3, T.PADDY); if (K.r() < 0.4) K.put('kakashi', ox + 2, oy + 1); }
    }

    // --- 나무와 풀
    K.veg((x, y, t, q, q2, grove) => {
      if (t === T.GRASS) {
        if (K.nearT(x, y, T.WATER) && q < 0.42) return K.soft('reed', x, y);
        const f = x < 46 && y < 31;
        const den = f ? (grove > 0.35 ? 0.3 : 0.12) : (grove > 0.68 ? 0.2 : 0.012);
        if (q < den) K.tree(f ? (q2 < 0.6 ? 'pine' : q2 < 0.85 ? 'oak' : 'sakura') : (q2 < 0.5 ? 'sakura' : q2 < 0.8 ? 'oak' : 'pine'), x, y, Math.floor(q2 * 31) % 3);
        else if (q < den + 0.012) K.tree('bush', x, y, q2 < 0.5 ? 0 : 1, true);
        else if (q < den + 0.02) K.tree('rock', x, y, q2 < 0.6 ? 0 : 1, true);
      } else if (t === T.HIGH) {
        if (q < 0.06) K.tree(q2 < 0.65 ? 'sakura' : 'cedar', x, y, Math.floor(q2 * 31) % 2);
      } else if (t === T.ROCK) {
        if (y > 3 && K.get(x, y + 1) === T.ROCK && K.get(x, y - 1) === T.ROCK && q < 0.07) K.prop('pine', x, y, { v: Math.floor(q2 * 3) });
      } else if (t === T.SAND) {
        if (q < 0.008) K.tree('rock', x, y, 0, true);
      }
    });
    // 길가 벚나무
    for (const x of [38, 47, 62, 68]) if (!m.solid[K.I(x, 37)] && K.get(x, 37) === T.GRASS) K.tree('sakura', x, 37, x % 2);

    // --- 나오는 것들
    K.zone(34, 51, 78, 58, 'heike', 9, [T.SAND]);
    K.zone(5, 6, 44, 30, 'ochi', 7, [T.GRASS, T.DIRT]);
    K.zone(40, 24, 76, 36, 'dog', 3, [T.GRASS]);
    K.zone(30, 55, 80, 62, 'wisp', 6, [T.SHALLOW, T.SAND], { night: 1 });
    K.zone(14, 12, 34, 24, 'ghost', 4, [T.GRASS, T.DIRT], { night: 1 });
    K.zone(60, 6, 76, 30, 'boar', 2, [T.GRASS]);

    m.regions.push(['가메야마 하치만', 56, 11, 11], ['아카마 포구', 21, 41, 13], ['헤이케 진터', 24, 18, 8], ['겐지 진영', 96, 38, 11],
      ['배 위', 84, 59, 110, 70], ['솔숲', 3, 4, 46, 31], ['바닷가', 0, 50, 112, 72]);
    m.start = { x: 13 * 16 + 8, y: (coast(13) - 1) * 16 + 8 };
    return m;
  });

  G.mapShore = shore;
})();
