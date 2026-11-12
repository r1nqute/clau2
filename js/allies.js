'use strict';
// 동료. 셋이 있다. 함께 걷는 것은 둘까지이고, 나머지는 고갯마루 찻집에서 쉰다.
//   이소   단노우라의 해녀. 물에 든 칼을 찾는다. (지어낸 사람)
//   도모에 가마쿠라 서쪽 사당의 늙은 비구니. 한때 말을 타고 싸웠다.
//   아사히나 와다 합전에 지고 배를 탔다가 안개 속에서 고갯마루에 닿았다.
(function () {
  const G = window.G;
  const say = (n, t) => G.ui.say(n, t);
  const me = t => G.ui.say('', t);

  // 재주: tgt foe(적 하나) · foes(적 모두) · mate(우리 하나) · none
  G.ALLIES = {
    iso: {
      name: '이소', full: '해녀 이소', kanji: '磯', spr: 'iso', wpn: 'short', mult: { hp: 0.85, atk: 0.8, def: 0.8, spd: 4 },
      atkName: '빗창 찌르기', role: '갯것으로 동료를 살린다. 자맥질로 무엇이든 비킨다.',
      bio: '단노우라의 해녀. 어린 임금과 함께 물에 든 칼을 찾는다. 숨이 길고 말이 짧다.',
      passive: '물에서 자란 몸: 자맥질로 흰 수도 붉은 수도 비킨다.',
      skills: [
        { id: 'feed', name: '갯것 나누기', cost: 1, tgt: 'none', desc: '망사리의 갯것을 나눈다. 쓰러지지 않은 모두의 체력이 30% 오른다.' },
        { id: 'dive', name: '자맥질', cost: 0, tgt: 'none', stance: 'dive', desc: '물에 들듯 몸을 낮춘다. 흰 수도 붉은 수도 비킨다. 비키면 기가 조금 찬다.' }
      ]
    },
    tomoe: {
      name: '도모에', full: '도모에 고젠', kanji: '巴', spr: 'tomoe', wpn: 'nagi', mult: { hp: 1.0, atk: 1.1, def: 1.0, spd: -1 },
      atkName: '나기나타', role: '적 모두를 벤다. 동료 앞을 막아선다.',
      bio: '기소 요시나카를 따라 싸웠다는 여무사. 지금은 가마쿠라 서쪽 사당 옆에 앉아 있던 늙은 비구니다.',
      passive: '말 탄 싸움을 안다: 말 탄 맞수에게 더 깊이 벤다.',
      skills: [
        { id: 'sweep', name: '휘두르기', cost: 1, tgt: 'foes', pow: 0.85, post: 14, desc: '나기나타를 크게 돌린다. 적 모두를 벤다. 가짜도 쓸어 낸다.' },
        { id: 'cover', name: '감싸기', cost: 0, tgt: 'mate', stance: 'cover', desc: '고른 동료 앞을 막아선다. 그쪽으로 오는 수를 대신 받되 반쯤만 아프다.' }
      ]
    },
    asahina: {
      name: '아사히나', full: '아사히나 요시히데', kanji: '朝比奈', spr: 'asahina', wpn: null, big: 1, mult: { hp: 1.45, atk: 1.2, def: 1.15, spd: -3 },
      atkName: '주먹', role: '붙잡아 수를 끊는다. 문짝으로 모두를 가린다.',
      bio: '와다 요시모리의 셋째 아들. 와다 합전에 지고 배로 달아났다가, 안개 속에서 도리이를 보았다고 한다.',
      passive: '덩치: 체력이 많고, 붙잡기는 누구보다 먼저 한다.',
      skills: [
        { id: 'grab', name: '붙잡기', cost: 1, tgt: 'foe', desc: '가장 먼저 움직여 붙잡는다. 잡것의 수는 끊고, 맞수는 붉은 수(힘으로 오는 수)만 끊는다.' },
        { id: 'door', name: '문짝 들기', cost: 0, tgt: 'none', stance: 'door', desc: '등에 진 문짝을 세운다. 이번 차례 하나를 노린 수는 모두 아사히나에게 온다. 덜 아프다.' }
      ]
    }
  };
  G.ALLY_ORDER = ['iso', 'tomoe', 'asahina'];

  // ---------- 동료 셈 ----------
  const party = G.party = {
    has: id => !!(G.s.allies && G.s.allies[id]),
    recruited: () => G.ALLY_ORDER.filter(id => party.has(id)),
    active: () => (G.s.party || []).filter(id => party.has(id)),
    bond: id => (G.s.allies[id] && G.s.allies[id].bond) || 0,
    stats(id) {
      const s = G.s, d = G.ALLIES[id], m = d.mult, b = 1 + party.bond(id) * 0.03;
      const base = 8 + (s.lv - 1) * 1.2;
      return {
        maxhp: Math.round(s.maxhp * m.hp * b), atk: Math.round(base * m.atk * b),
        def: Math.round((2 + Math.floor((s.lv - 1) * 0.6)) * m.def), spd: 8 + Math.floor((s.lv - 1) * 0.4) + m.spd
      };
    },
    hp(id) { const a = G.s.allies[id], mx = party.stats(id).maxhp; if (a.hp === undefined || a.hp > mx) a.hp = mx; return a.hp; },
    join(id) {
      const s = G.s;
      s.allies = s.allies || {}; s.party = s.party || [];
      if (s.allies[id]) return;
      s.allies[id] = { bond: 0 };
      s.allies[id].hp = party.stats(id).maxhp;
      G.STORY.seen(id, 2);
      if (s.party.length < 2) { s.party.push(id); G.ui.toast(G.josa(G.ALLIES[id].name, '이', '가') + ' 동료가 되었다'); }
      else G.ui.toast(G.josa(G.ALLIES[id].name, '은', '는') + ' 고갯마루 찻집에서 기다린다. 봇짐의 동료 쪽에서 바꿀 수 있다.');
      G.sfx('learn');
      G.followers.reset();
    },
    toggle(id) {
      const s = G.s, i = s.party.indexOf(id);
      if (i >= 0) { s.party.splice(i, 1); G.followers.reset(); return true; }
      if (s.party.length >= 2) return false;
      s.party.push(id); G.followers.reset(); return true;
    },
    healAll() { const s = G.s; for (const id in (s.allies || {})) s.allies[id].hp = party.stats(id).maxhp; }
  };

  // ======================= 함께 걷기 =======================
  const SPACE = 9;
  const F = G.followers = {
    list: [], hist: [], talkT: 30, bubbles: [],
    reset() {
      const p = G.p;
      this.hist = [];
      this.list = party.active().map((id, i) => ({ type: 'follower', id, x: p.x + (i + 1) * 3, y: p.y + 2 + i, dir: 'l', walk: 0, moving: false }));
      this.bubbles = [];
    },
    update(dt) {
      const p = G.p;
      const last = this.hist[0];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) >= 2) { this.hist.unshift({ x: p.x, y: p.y }); if (this.hist.length > SPACE * 3 + 2) this.hist.pop(); }
      this.list.forEach((f, i) => {
        const h = this.hist[Math.min(this.hist.length - 1, (i + 1) * SPACE)];
        if (!h) return;
        const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy);
        if (d > 0.6) {
          const v = Math.min(d, Math.max(70, d * 6) * dt);
          f.x += dx / d * v; f.y += dy / d * v; f.moving = true; f.walk += dt;
          if (Math.abs(dx) > 0.3) f.dir = dx > 0 ? 'r' : 'l';
        } else { f.moving = false; }
        if (d > 120) { f.x = h.x; f.y = h.y; }
      });
      for (let i = this.bubbles.length - 1; i >= 0; i--) if ((this.bubbles[i].t -= dt) <= 0) this.bubbles.splice(i, 1);
      // 걷다 보면 한마디씩
      if (this.list.length && !G.ui.busy() && p.moving) {
        this.talkT -= dt;
        if (this.talkT <= 0) { this.talkT = 40 + Math.random() * 35; this.chatter(); }
      }
    },
    find(id) { return this.list.find(f => f.id === id); },
    bubble(id, text, delay) {
      if (!this.find(id)) return;
      this.bubbles.push({ id, text, t: 3.6 + (delay || 0), delay: delay || 0 });
    },
    // 지도와 때에 맞는 혼잣말, 둘이 함께면 주고받는 말
    chatter() {
      const s = G.s, map = s.map, act = party.active();
      if (act.length === 2 && Math.random() < 0.45) {
        const key = act.slice().sort().join('+'), pool = (PAIR[key] || []).filter(c => !c.when || c.when(s));
        if (pool.length) {
          const c = G.pick(pool);
          c.lines.forEach((l, i) => this.bubble(l[0], l[1], i * 3.2));
          return;
        }
      }
      const id = G.pick(act), B = BANTER[id], pool = (B[map] || []).concat(B.any || []);
      if (pool.length) this.bubble(id, G.pick(pool));
    },
    // 처음 들어선 곳에서는 한마디씩 한다
    arrive(map) {
      const s = G.s;
      s.flags.arrived = s.flags.arrived || {};
      party.active().forEach((id, i) => {
        const k = id + ':' + map, B = BANTER[id];
        if (s.flags.arrived[k] || !B.first || !B.first[map]) return;
        s.flags.arrived[k] = 1;
        this.bubble(id, B.first[map], 1.4 + i * 3.4);
      });
      this.talkT = 25 + Math.random() * 15;
    },
    draw(f, ctx, cx, cy, time) {
      const d = G.ALLIES[f.id], set = G.spr.f[d.spr], x = Math.round(f.x - cx), y = Math.round(f.y - cy);
      G.E.shadow(ctx, x, y - 1, d.big ? 20 : 12);
      const img = set[f.dir][f.moving ? Math.floor(f.walk * 7) % 2 : 0];
      const bob = f.moving && Math.floor(f.walk * 7) % 2 ? 1 : 0;
      if (d.wpn === 'nagi') G.fx.blade(ctx, x + (f.dir === 'r' ? -3 : 3), y - 7, f.dir === 'r' ? -1.25 : -1.89, 'nagi');
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 - bob);
    },
    drawBubbles(ctx, cx, cy) {
      const TX = G.text, P = G.ui.panel;
      for (const b of this.bubbles) {
        if (b.delay > 0 && b.t > 3.6) continue;
        const f = this.find(b.id);
        if (!f) continue;
        const d = G.ALLIES[b.id], lines = TX.wrap(b.text, 150, 'small'), w = Math.max(...lines.map(l => TX.width(l, 'small'))) + 10, h = lines.length * 11 + 6;
        const fy = Math.round(f.y - cy) - (d.big ? 36 : 26), x = G.clamp(Math.round(f.x - cx - w / 2), 2, G.W - w - 2), y = G.clamp(fy - h, 2, G.H - h - 2);
        ctx.fillStyle = 'rgba(27,26,31,0.88)'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
        const tx = G.clamp(Math.round(f.x - cx), x + 3, x + w - 4);
        ctx.fillStyle = 'rgba(27,26,31,0.88)'; ctx.fillRect(tx - 1, y + h, 3, 2); ctx.fillRect(tx, y + h + 2, 1, 1);
        lines.forEach((l, i) => TX.draw(ctx, l, x + 5, y + 3 + i * 11, '#f6f1e3', 'small'));
        TX.drawS(ctx, d.name, x + 3, y - 10, '#e6cc78', 'small');
      }
    }
  };

  // ======================= 걸으며 하는 말 =======================
  const BANTER = {
    iso: {
      first: {
        hub: '구름 위에 땅이 있네요. 물에 들어가면 어디로 떨어질까.',
        kama: '바다 냄새가 달라요. 같은 바다인데.',
        chi: '추워요. 물은 차도 바람은 안 부는데.',
        kashi: '이 나무들, 바닷속 다시마 숲 같아요.',
        kawa: '아무것도 안 보여요. 물속보다 더해요.',
        funa: '……여기, 우리 바다예요. 집이 다 바뀌었어요.',
        isle: '이 섬, 어릴 때 헤엄쳐 왔던 섬이에요.',
        rei: '바다가 안 보이는 데는 처음이에요.'
      },
      dan: ['저 깃발들, 다 건져야 하는데.', '칼 생각만 하면 숨이 길어져요.', '갓은 물에 뜨나요?'],
      kama: ['가마쿠라 해녀들은 전복을 덜 남겨 놓네요.', '저 큰 사람, 상어를 맨손으로 잡는다고요? 해녀 할래요?'],
      chi: ['산에서 물 긷는 애가 있었죠. 숨은 샘. 바다 사람만 물을 아는 게 아니네요.'],
      kashi: ['사슴이 절을 받아 주면 좋겠다.', '갓파한테 절하면 접시 물이 쏟아진대요. 바닷물로 채워 주면 화낼까요?'],
      kawa: ['소금 냄새가 나요. 어디서 오는 거지.', '안개 속에서는 숨소리로 사람을 찾아요. 물속하고 같아요.'],
      funa: ['우리 동네에 기와집이 생겼어요. 사백 년이면 그렇겠죠.', '아미다지에 어린 임금님을 모셨대요. ……다행이에요.'],
      rei: ['눈이 바닷소금 같아요. 맛은 없어요.'],
      any: ['빗창은 전복 따는 쇠예요. 사람한테 쓰려고 만든 건 아닌데.', '숨 참기 내기 할래요?', '고려에도 해녀가 있어요? ……있구나. 언젠가 같이 들어가 보고 싶어요.']
    },
    tomoe: {
      first: {
        hub: '흥. 극락은 아니군. 찻집이 있는 걸 보니.',
        dan: '……단노우라. 이 바다에서 헤이케가 끝났지. 나는 그때 이미 싸움터를 떠났어.',
        chi: '산성이구나. 말이 못 오르는 데서 싸우는 놈은 머리가 좋은 놈이야.',
        kashi: '가시마의 신은 칼의 신이지. 늙은이가 칼 들고 오기 좋은 곳이야.',
        kawa: '말 냄새. 수천이야. 오랜만에 피가 끓는군.',
        funa: '사백 년 뒤라고? 내가 살아 있으면 오백 살이겠군. ……안 세는 게 낫겠다.',
        rei: '굴에서 글을 쓴다고? 나도 말년엔 그럴 걸 그랬나.'
      },
      dan: ['요시나카 님이 살아 계셨으면 이 바다에 왔을까.'],
      kama: ['내 사당이 저기 있지. 비어 있을 테니 신경 쓰지 마.', '저 녀석이 상어를 끼고 걸어 다니는 꼴은 몇 번을 봐도 안 질려.'],
      kawa: ['안개 속에서 말을 몰면 귀로 몬다. 너도 귀를 열어.', '저 흰 말. 좋은 말이다.'],
      any: ['허리가 아프다. 나기나타는 안 아파.', '나를 보고 한 사람이 천을 당한다고들 했지. 천 명이 한꺼번에 오는 일은 없어. 한 명씩 천 번이야.', '갓 쓴 놈. 너는 칼을 왜 늘 한 치 앞에서 멈추냐.', '말이 그립다.']
    },
    asahina: {
      first: {
        hub: '또 왔군! 할멈, 경단 일곱 꼬치!',
        dan: '바다다! 상어 있나 보고 올게.',
        kama: '……저기, 상어 끼고 가는 놈. 어제의 나다. 말 걸지 마라. 헷갈린다.',
        chi: '산성? 문이 있나? 문은 내가 맡는다.',
        kashi: '사슴! 먹으면 안 되겠지?',
        kawa: '말 탄 놈들이 수천이야. 하나만 빌려 타면 안 되나.',
        funa: '여기서 고려까지 배로 며칠이냐? ……궁금해서 묻는 거다.',
        rei: '추워! 문짝이라도 덮고 자자.'
      },
      kama: ['내일 그 싸움에서 우리가 진다는 거, 알고 있다. 그래도 저기 나는 모르는 게 낫다.'],
      kashi: ['저 영감이 배를 타자고 하면 먼저 내리지 마. 내 꾀가 아니고 다들 하는 말이다.'],
      kawa: ['소금을 적한테 보냈다고? 너 같은 놈이 하나 더 있었군.'],
      any: ['배고프다.', '고려는 어떤 곳이냐. 산이 많다고? 문은?', '문짝은 갖고 다닌다. 쓸 데가 꼭 생기거든.', '너는 왜 갓을 안 벗냐. 나는 투구를 벗으면 머리가 시원하던데.']
    }
  };
  const PAIR = {
    'iso+tomoe': [
      { lines: [['iso', '할머니, 물에 들어가 본 적 있어요?'], ['tomoe', '말 타고 강은 건넜지. 물속은 말이 싫어해.'], ['iso', '말도 숨을 참으면 될 텐데.']] },
      { lines: [['tomoe', '해녀야, 너는 무서운 게 없냐.'], ['iso', '숨이 모자랄 때요. 할머니는요?'], ['tomoe', '……혼자 남을 때.']] }
    ],
    'asahina+tomoe': [
      { lines: [['asahina', '어머니!'], ['tomoe', '아니라니까.'], ['asahina', '사람들이 다 그렇다던데.'], ['tomoe', '셈을 해 봐라. 안 맞는다.']] },
      { lines: [['tomoe', '너, 아버지 와다를 닮았구나. 웃을 때.'], ['asahina', '……아버지는 그날 돌아가셨다.'], ['tomoe', '알아. 나도 그런 날이 있었다.']] }
    ],
    'asahina+iso': [
      { lines: [['asahina', '해녀! 상어 잡는 법 가르쳐 줄까?'], ['iso', '상어는 피하는 거예요. 잡는 게 아니라.'], ['asahina', '……그건 몰랐다.']] },
      { lines: [['iso', '그 문짝 물에 뜰까요?'], ['asahina', '뜬다! 그걸 타고 고려까지 갈 생각이다.'], ['iso', '같이 가요. 노는 제가 저을게요.']] }
    ]
  };

  // ======================= 모닥불 이야기 =======================
  // 지장 앞에서 쉬면 함께 걷는 동료와 이야기를 나눈다. 다 듣고 나면 정이 쌓인다.
  const TALKS = {
    iso: [
      { at: 0, lines: [['이소', '칼을 찾아요. 어린 임금님이 할머니 품에 안겨 물에 드실 때, 같이 가라앉은 칼.'], ['', '무슨 칼이냐고 물었다.'], ['이소', '구사나기라고 해요. 임금의 세 가지 보물 가운데 하나. 그게 없으면 임금이 임금이 아니래요.'], ['이소', '……우리 같은 사람한텐 상관없는 일인데, 이상하죠. 어린 임금님 얼굴이 자꾸 떠올라요.']] },
      { at: 1, lines: [['이소', '고려에서는 해녀를 뭐라고 해요?'], ['', '잠녀라고도 한다고 했다. 제주라는 섬에 많다고.'], ['이소', '그 사람들도 빗창을 써요? ……쓴다고요? 하하. 바다는 다 이어져 있네요.']] },
      { at: 3, lines: [['이소', '숨 참는 거, 제일 오래가는 방법 알아요? 아무 생각도 안 하는 거예요.'], ['이소', '근데 칼 생각을 하면 오래 못 참아요. 그래서 요즘 숨이 짧아요.'], ['', '찾으면 숨이 다시 길어지겠냐고 물었다.'], ['이소', '……못 찾아도 길어질지 몰라요. 같이 다니니까.']] },
      { at: 6, need: 'isoSword', lines: [['이소', '절의 스님이 그랬어요. 바다에 든 칼은 가타시로였대요. 진짜는 처음부터 아쓰타 신궁에 있었고.'], ['이소', '사백 년을 찾았는데.'], ['', '아무 말도 하지 않았다.'], ['이소', '……괜찮아요. 덕분에 바다를 다 봤어요. 사백 년 뒤의 바다까지.'], ['이소', '그리고 생각해 보니, 나는 칼을 찾은 게 아니었나 봐요. 그날 물에 든 사람들한테 뭔가 해 주고 싶었던 거지.']] }
    ],
    tomoe: [
      { at: 2, lines: [['도모에', '요시나카 님은 마지막에 나더러 가라고 했다. 여자를 데리고 죽었다는 소리는 듣기 싫다고.'], ['도모에', '그래서 갔지. 가다가 돌아서서 적장 목을 하나 비틀어 놓고 갔어. 화가 나서.'], ['', '그 뒤로는 어떻게 살았냐고 물었다.'], ['도모에', '오래 살았지. 오래 사는 게 제일 어려운 싸움이야.']] },
      { at: 3, lines: [['도모에', '너는 왜 아무도 안 베냐.'], ['', '벤 적도 있다고 했다. 고려에서. 그래서 더는 안 벤다고.'], ['도모에', '……그래. 그것도 싸움이지. 칼 뽑고 안 베는 것.']] },
      { at: 5, lines: [['도모에', '가와나카지마의 그 흰 말 탄 놈. 겐신이라고 했지.'], ['도모에', '말 다루는 걸 보니 요시나카 님 생각이 나더라. 말한테 먼저 묻고 달리는 사람이었어.'], ['도모에', '늙으면 남의 칼에서 옛사람이 보여. 그게 싫지만은 않아.']] },
      { at: 6, lines: [['도모에', '내가 죽으면 사람들이 이야기를 지어낼 거다. 아흔 넘게 살았다느니, 누구 어미라느니.'], ['', '그중에 맞는 게 있냐고 물었다.'], ['도모에', '아흔은 맞을지도 모르지. 이렇게 고개를 넘나들면 셈이 안 되니까.'], ['도모에', '갓 쓴 놈하고 시대를 넘어 다녔다는 이야기는 안 남겠지. 그게 제일 재미있었는데.']] }
    ],
    asahina: [
      { at: 3, lines: [['아사히나', '그날 대문은 부쉈다. 쇼군 저택의 대문. 생각보다 얇더군.'], ['아사히나', '그래도 졌다. 아버지도, 형들도. 나만 배에 탔다.'], ['', '왜 배에 탔냐고 묻지 않았다.'], ['아사히나', '……묻지 않는구나. 좋은 놈이다.']] },
      { at: 4, lines: [['아사히나', '고려로 간다는 소리, 진심이다. 바다 건너에 나를 모르는 땅이 있다는 게 좋다.'], ['아사히나', '거기선 나도 그냥 덩치 큰 놈이겠지. 와다 집안 셋째가 아니라.'], ['', '고려에서는 덩치 큰 놈도 갓을 쓴다고 했다.'], ['아사히나', '하하! 그건 좀 생각해 보자.']] },
      { at: 6, lines: [['아사히나', '너, 그 무사시라는 놈하고 비겼다며.'], ['아사히나', '나는 평생 힘으로 다 이겼다. 그래서 진 날 할 말이 없었어.'], ['아사히나', '너는 비긴 날도 할 말이 있더군. 그게 부럽다.']] }
    ]
  };
  G.camp = {
    // 들을 수 있는 다음 이야기
    next() {
      const s = G.s, st = G.STORY.stage(s);
      for (const id of party.active()) {
        const a = s.allies[id], seen = a.talk || 0, t = TALKS[id][seen];
        if (t && st >= t.at && (!t.need || s.flags[t.need])) return { id, t };
      }
      return null;
    },
    play() {
      const n = this.next();
      if (!n) return false;
      const s = G.s;
      me('지장 앞에 불을 피웠다.');
      for (const [who, line] of n.t.lines) say(who, line);
      G.ui.run(() => {
        const a = s.allies[n.id];
        a.talk = (a.talk || 0) + 1; a.bond = Math.min(5, (a.bond || 0) + 1);
        G.sfx('ok'); G.ui.toast(G.josa(G.ALLIES[n.id].name, '과', '와') + ' 정이 깊어졌다');
      });
      return true;
    }
  };

  // 맞수를 이긴 뒤 한마디
  G.ALLY_WON = {
    benkei: { iso: '저 큰 스님, 서서 졸고 있는 거 아니죠?' },
    yoshitsune: { iso: '판관님이 웃으셨어요. 처음 봐요.' },
    asahina: { iso: '상어 같은 사람이에요. 큰데 순해요.', tomoe: '봐라, 한 번 져 보니 웃잖아.' },
    kusunoki: { iso: '짚 냄새를 맡았어요. 물 냄새 맡는 거랑 비슷해요.', tomoe: '꾀로 싸우는 놈은 지지도 않고 이기지도 않는다. 오래 버티지.', asahina: '저런 놈이 문을 지키면 나도 못 부순다.' },
    bokuden: { iso: '배에서 먼저 안 내리길 잘했죠? ……내렸어요?', tomoe: '저 영감, 나보다 늙었어. 반갑네.', asahina: '배 이야기는 나도 들었다. 진짜였군.' },
    kenshin: { tomoe: '좋은 말이었다. 좋은 사람이고.', asahina: '저 사람이 소금을 보냈다는 이야기, 뒷날 생긴다며? 지금 생긴 것 같은데.', iso: '안개가 걷혔어요.' },
    kojiro: { iso: '제비를 베려면 물속에서 연습해야 해요. 물이 칼을 늦추니까.', tomoe: '긴 칼은 멋있다. 멋있는 칼은 빨리 진다.' },
    musashi: { iso: '……고지로 님은 일어나지 않았어요.', tomoe: '저놈 눈은 이긴 놈 눈이 아니었어.', asahina: '늦게 오는 게 병법이라니. 나도 내일부터 늦게 일어나야겠다.' },
    musashiOld: { iso: '숨을 다 쉬고 오셨네요, 저분.', tomoe: '빈 것이라. 나도 나이 들어서 알았지.', asahina: '나는 아직 모르겠다. 배고픈 건 안다.' }
  };

  // ======================= 사람들 말: 동료가 되는 자리 =======================
  Object.assign(G.NPCS, {
    // 고갯마루 찻집에 나타난 아사히나
    asaHub: {
      name: '아사히나', talk(s) {
        G.STORY.seen('asahina', 2);
        say('아사히나', ['어, 갓 쓴 놈!', '졌다. 그날. 대문은 부쉈는데 졌어. 아버지도 형들도.', '배를 타고 바다로 나왔는데, 안개 속에 붉은 도리이가 보이더라. 노를 저어 지났더니 이 찻집이다.', '할멈 말로는 네가 시대를 넘어 다닌다며. 고려까지 가려면 길잡이가 있어야지.']);
        me('같이 가자고 했다.');
        say('아사히나', '하하! 문짝은 내가 진다.');
        G.ui.run(() => party.join('asahina'));
      }
    }
  });
})();
