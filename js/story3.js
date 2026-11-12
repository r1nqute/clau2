'use strict';
// 이야기 셋: 가와나카지마(1561), 후나시마(1612), 레이간도(1643), 그리고 끝
(function () {
  const G = window.G, ST = G.STORY;
  const say = (n, t) => G.ui.say(n, t);
  const me = t => G.ui.say('', t);

  Object.assign(G.SIGNS, {
    kawa_ford: '남 — 아메노미야 나루, 사이조 산\n동 — 다케다 본진, 가이즈 성\n북서 — 에치고 가는 길',
    funa_hill: '가메야마 하치만구.\n사백 년 전 겐페이의 싸움을 지켜본 신사.',
    funa_road: '동 — 아미다지\n서 — 아카마가세키\n남 — 나루. 후나시마는 물 건너.',
    rei_road: '운간젠지.\n굴은 절 뒤 돌계단을 올라 벼랑길 끝.\n칼 찬 이는 조용히 오를 것.'
  });
  Object.assign(G.LOOKS, {
    oldboat: ['삭은 배 한 척이 모래에 반쯤 묻혀 있다.', '밑창의 옹이 자리가 낯익다. 내 배다. 사백 년을 기다린 모양이다.'],
    kannon: ['바위에 새긴 관음이다. 등잔 불빛에 웃는 것 같다.', '웃는 것이 아니라 그냥 돌이다. 그래도 웃는 것 같다.'],
    desk: ['책상이다. 두루마리가 넷, 쓰다 만 것이 하나.']
  });
  Object.assign(G.CHESTS, {
    c_kawa: { money: 80, items: { tea: 1 }, text: '억새밭에 버려진 궤짝. 군자금이었던 모양이다.' },
    c_islet2: { money: 100, text: '모래톱에 반쯤 묻힌 궤짝. 꿰미의 돈이 죄다 송나라 돈이다. 사백 년 전 것이다.' },
    c_rei: { money: 120, items: { mochi: 2 }, text: '눈 속의 궤짝. 절에 시주하려던 것을 누가 잊고 갔다.' }
  });

  // ======================= 가와나카지마 =======================
  Object.assign(G.NPCS, {
    shingen: {
      name: '신겐', talk(s) {
        const f = s.flags;
        ST.seen('shingen', 2);
        if (f.kenshin) {
          say('신겐', ['그자를 말에서 내렸다고.', '……조금 전에 그자가 이 진막 안까지 들어왔소. 세 번 내리치더군. 이 부채로 받았소.', '부채에 칼자국이 일곱 줄 났소. 세 번 쳤는데.']);
          return;
        }
        if (!f.shinMet) {
          f.shinMet = 1;
          say('신겐', ['……고려 사람? 이 안개 속을 걸어서 왔다고.', '가장 센 자를 찾는다면 내가 아니오. 나는 움직이지 않는 사람이오. 산처럼.']);
          me('그는 걸상에 앉아 있었다. 정말로 움직이지 않았다.');
        }
        say('신겐', ['센 자는 저 안개 속에 있소. 에치고의 용. 제 입으로 비사문천이라 하는 자.', '서쪽 벌판 한가운데 서 있어 보시오. 그자는 온다. 늘 온다.']);
      }
    },
    takeda1: {
      name: '다케다 무사', talk() { say('다케다 무사', ['본진이오. 수상한 자는…… 갓이 수상하긴 한데, 칼끝이 얌전하군.', '지나가시오. 주군 앞에서는 뛰지 마시오. 산이 놀라오.']); }
    },
    takedaCook: {
      name: '취사병', talk(s) {
        const f = s.flags;
        if (G.game.count('salt') > 0) {
          say('취사병', ['소금? 어디서 났소. ……에치고 소금이군.', '적의 소금이라도 국은 끓여야지. 값은 여기 있소. 이건 덤이오.']);
          G.ui.run(() => { G.game.take('salt', 1); f.salt = 2; G.game.earn(60); G.game.give('mochi', 2); });
        } else say('취사병', f.salt === 2 ? '덕분에 오늘 국은 간이 맞았소. 싸움은 싸움이고 국은 국이오.' : '소금이 떨어진 지 열흘이오. 가이는 바다가 없는 땅이라. 맹물에 된장만 풀고 있소.');
      }
    },
    uesugi1: {
      name: '우에스기 무사', talk(s) {
        say('우에스기 무사', s.flags.kenshin ? '주군께서 그대 이야기를 하셨소. 사람을 살려 두는 칼이라고.' : ['주군께서는 새벽에 산을 내려가셨소. 안개 속으로.', '우리는 빈 진을 지키고 있소. 화톳불만 피워 놓고. 저쪽이 속았으면 좋겠는데.']);
      }
    },
    salter: {
      name: '소금 장수', talk(s) {
        const f = s.flags;
        if (!f.salt) {
          say('소금 장수', ['에치고 소금이오. 고개 넘어 가이까지 가던 길인데 싸움이 터져서 발이 묶였소.', '저쪽 다케다 진에는 소금이 떨어졌답디다. 팔러 가자니 적진이고.', '손님은 어느 편도 아니라 했소? 한 섬만 져다 주시오. 값은 저쪽에서 받고.']);
          G.ui.choice(['소금을 진다', '그만둔다'], i => {
            if (i !== 0) { G.ui.shop('kawa'); return; }
            f.salt = 1;
            G.ui.run(() => G.game.give('salt', 1));
            me('소금 한 섬을 졌다. 어디선가 져 본 것 같은 무게다. 그럴 리가 없는데.');
          });
          return;
        }
        say('소금 장수', f.salt === 2 ? '전했다고? 고맙소. 고개 너머에 소금 끊긴 마을이 어떤지는 겪어 본 사람만 아오.' : '다케다 본진은 동남쪽 벌판 한가운데요. 풍림화산 깃발을 찾으시오.');
        G.ui.shop('kawa');
      }
    },
    burier: {
      name: '스님', talk(s) {
        say('스님', s.flags.kenshin ? ['안개가 걷혔습니다. 이제 제 일이 시작됩니다.', '수천입니다. 어느 깃발 아래 섰든 묻는 구덩이는 같습니다.'] : ['싸움이 끝나면 묻을 사람이 수천일 겁니다. 미리 와 있는 것입니다.', '오늘 같은 안개에는 누가 누구를 베는지도 모릅니다.']);
      }
    }
  });
  ST.boss('kenshin', {
    talk(e, s) {
      if (e.st === 'friend') { say('겐신', '본진이 기다리오. 그대도 그대의 길을 가시오.'); return; }
      ST.seen('kenshin');
      const f = s.flags;
      if (!f.kenMet) {
        f.kenMet = 1;
        say('겐신', ['비켜라.', '……비키지 않는군. 다케다의 사람은 아닌 듯한데.']);
        me('가장 센 자를 찾는다고 했다.');
        say('겐신', ['이 벌판에서 가장 센 것은 사람이 아니오. 비사문천이시지. 나는 그분의 칼일 뿐.', '좋소. 본진은 잠깐 기다리게 하지.']);
      } else say('겐신', '또 섰군. 좋소.');
      G.ui.run(() => G.duel.start('kenshin'));
    },
    won(e, s) {
      const f = s.flags, m = G.world.cur;
      e.st = 'friend';
      say('겐신', '……이것은 싸움터의 칼이 아니군. 사람을 살려 두는 칼이오.');
      if (f.salt === 2) say('겐신', ['적진에 소금을 져다 준 갓 쓴 자가 있다고 들었소. 그대로군.', '벌하지 않겠소. 싸움은 칼로 하는 것이오. 소금으로 하는 것이 아니오.', '……기억해 두겠소.']);
      else say('겐신', '이 싸움이 끝나면 또 다음 싸움이오. 나는 그렇게 살 것이오. 그대는 다르게 사시오.');
      say('겐신', '수레걸이를 보았을 거요. 군사 만 명의 진법이지만 한 사람이 써도 되오. 가져가시오.');
      G.ui.run(() => { ST.learn('wheel'); ST.grow(); ST.openGate(5); });
      me(['겐신은 말에 올라 안개 속으로 갔다.', '잠시 뒤 다케다 본진 쪽에서 쇳소리가 세 번 났다.', '안개가 걷히기 시작한다.']);
      G.ui.run(() => {
        e.dead = true; G.fx.puff(e.x, e.y - 10, '#e8e2d0', 16, 60);
        for (const o of G.E.list) if (o.type === 'actor') o.dead = true;
        m.fog = 0.14; m.hour = 8.6; G.sfx('clang');
      });
    }
  });
  ST.add('kawa', {
    enter(s) {
      const f = s.flags, m = G.world.cur;
      m.fog = f.kenshin ? 0.14 : 0.62; m.hour = f.kenshin ? 8.6 : 5.9;
      if (!f.kenshin && f.kenMet) G.duel.place('kenshin', m.field.x - 50, m.field.y, 'wait', { dir: 'r', sprSet: 'kenshinH', lift: 12 });
      if (!f.kawaSeen) { f.kawaSeen = 1; me(['안개다. 열 걸음 앞이 보이지 않는다.', '멀리서 말 우는 소리와 쇠 부딪는 소리가 난다. 싸움이 막 벌어지려는 벌판이다.']); }
    },
    tick(s) {
      const f = s.flags, p = G.p, m = G.world.cur;
      if (f.kenshin || G.duel.state || G.ui.busy()) return;
      if (!f.kenMet) {
        if (G.dist(p.x, p.y, m.field.x, m.field.y) < 70) {
          me('안개 속에서 말굽 소리가 커진다.');
          G.ui.run(() => {
            G.sfx('hoof');
            const e = G.duel.place('kenshin', G.clamp(p.x - 90, m.arenas.kenshin.x0 + 20, m.arenas.kenshin.x1 - 20), p.y, 'wait', { dir: 'r', sprSet: 'kenshinH', lift: 12 });
            G.fx.dust(e.x, e.y, 10);
            ST.talkBoss(e);
          });
        }
      } else { const b = G.E.find('kenshin'); if (b && b.st === 'wait') ST.approach(b, 60, () => ST.talkBoss(b)); }
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.salt) add('적에게 소금을', f.salt === 2 ? '에치고 소금 한 섬을 다케다 진영에 전했다.' : '에치고 소금 한 섬을 다케다 본진의 취사병에게.', f.salt === 2);
  });

  // ======================= 후나시마 =======================
  Object.assign(G.NPCS, {
    agent: {
      name: '뱃집 주인', talk(s) {
        const f = s.flags;
        say('뱃집 주인', f.musashi ? '이층 손님은 그날로 떠났소. 방값은 노 한 자루 값을 빼고 받았소. 내 노를 깎아 갔거든.'
          : ['어서 오시오. 묵어 가시려오?', '이층 손님은 깨우지 마시오. 후나시마에서 큰 승부가 있는 분이오. 해가 중천인데 아직 주무시오.']);
        G.ui.choice(['하룻밤 묵는다 (10문)', '먹을 것을 산다', '그만둔다'], i => {
          if (i === 0) {
            if (!G.game.pay(10)) { say('뱃집 주인', '외상은 이층 손님 하나로 족하오.'); return; }
            G.ui.run(() => { f.funaDay = 1; G.game.sleep(); });
            if (!f.musashi) me('새벽에 눈을 떴다. 이층 손님은 아직 잔다. 약속은 진시라고 들었다.');
          } else if (i === 1) G.ui.shop('funa');
        });
      }
    },
    official: {
      name: '호소카와 가신', talk(s) {
        say('호소카와 가신', s.flags.musashi ? '……그날 섬에 갓 쓴 자가 있었다는 말이 도는데, 입회 장부에는 없소. 없는 것으로 하겠소.'
          : ['내일 진시에 후나시마에서 승부가 있소. 사사키 고지로 님과 미야모토 무사시라는 자요.', '구경은 금하오. ……나루의 사공이 몰래 태워 준다는 말은 못 들은 것으로 하겠소.']);
      }
    },
    townswoman: {
      name: '읍내 아낙', talk(s) {
        say('읍내 아낙', s.flags.musashi ? '고지로 님이 지셨대요. 한 합에요. 믿어지지 않아요.' : ['내일 승부 얘기로 온 읍내가 들썩여요.', '고지로 님은 호소카와 가문의 사범이시고, 상대는 떠돌이래요. 예순 번을 이겼다나요.']);
      }
    },
    polisher: {
      name: '칼갈이', talk() {
        ST.sharpen('칼갈이', 2, 200, ['칼 좀 봅시다. ……오래된 쇠요. 사백 년은 묵은 것 같은데 녹은 어제 슨 것 같소. 이상한 칼이오.', '갈아 드리리다. 또 한 뼘 줄 거요.'], '더 갈면 단도가 되오. 그만 가시오.');
      }
    },
    ferryman: {
      name: '사공', talk(s) {
        const f = s.flags;
        if (f.musashi) { say('사공', '그날 일은 아무한테도 말 안 했소. 손님도 그러시오.'); return; }
        if (!f.funaDay) { say('사공', ['승부는 내일 아침이오. 오늘은 물때가 안 맞소.', '뱃집에서 하룻밤 자고 새벽에 오시오. 구경은 금한다지만 나는 고기 잡으러 가는 거요.']); return; }
        say('사공', '타시오. 섬 그늘에 대 놓을 테니 조용히 내리시오.');
        G.ui.choice(['섬으로 건너간다', '그만둔다'], i => {
          if (i === 0) G.ui.run(() => { const m = G.world.get('isle'); G.game.go('isle', m.start.x, m.start.y, 'down', { card: true }); });
        });
      }
    },
    potter: {
      name: '도공', talk(s) {
        const f = s.flags;
        ST.seen('potters', 2);
        if (!f.potter) {
          f.potter = 1;
          say('도공', ['……그 갓.', '고향 말을 하시오? 한 마디만 해 보시오.']);
          me('무슨 말을 하랴 싶어, 밥은 먹었느냐고 물었다.');
          say('도공', ['……', '먹었소. 끌려온 지 열다섯 해요. 그 말을 열다섯 해 만에 듣소.', '조선 사람이오?']);
          me('고려 사람이라고 했다. 그는 웃지 않았다. 묻지도 않았다.');
          say('도공', ['이 땅 흙은 그릇이 잘 나오오. 그래도 고향 흙 한 줌만 섞으면 빛이 다를 텐데.', '쓸데없는 소리요. 잊으시오.']);
          return;
        }
        if (G.game.count('soil') > 0) {
          say('도공', ['……이 흙.', '어디서 났는지 묻지 않겠소. 물어도 믿지 못할 것 같으니.', '하룻밤만 주시오.']);
          G.ui.run(() => { G.game.take('soil', 1); f.soil = 2; f.bowlDay = s.day; });
          return;
        }
        if (f.soil === 2) {
          if (s.day > f.bowlDay) {
            say('도공', ['구웠소. 고향 빛이 나오. 한 줌으로도 나더이다.', '가지시오. 나는 하나 더 구울 흙을 남겨 두었소.']);
            G.ui.run(() => { f.soil = 3; G.game.give('bowl', 1); ST.grow(); });
          } else say('도공', '가마가 식어야 꺼내오. 내일 오시오.');
          return;
        }
        say('도공', f.soil === 3 ? '그 그릇에 밥을 담아 드시오. 물 건너에서도.' : '고향 흙 얘기는 잊으시오. 가져올 수 있는 것이 아니니.');
      }
    },
    templeMonk: {
      name: '스님', talk() { say('스님', ['아미다지입니다. 물에 드신 어린 임금님을 모십니다. 사백 년이 넘었습니다.', '밤에는 비파 법사가 와서 그때 이야기를 탑니다. 듣는 이가 누구인지는 묻지 마십시오.']); }
    },
    biwa: {
      name: '비파 법사', talk(s) {
        if (!s.flags.biwa) {
          s.flags.biwa = 1;
          say('비파 법사', ['……기원정사의 종소리, 제행무상의 울림이라.', '거기 누구요. 산 사람이오? 드문 일이군.', '사백 년 된 이야기를 타고 있소. 단노우라, 붉은 깃발, 어린 임금.']);
          me('어제 일 같다고 했다.');
          say('비파 법사', ['……그렇게 말하는 손님이 밤마다 많이 오오. 다들 발소리가 없지.', '손님은 발소리가 나는군.']);
        } else say('비파 법사', '교만한 자도 오래가지 못하니, 다만 봄밤의 꿈과 같다. ……다음 대목은 내일 밤에.');
      }
    },
    witness1: {
      name: '입회인', talk(s) { say('입회인', s.flags.musashi ? '……우리는 아무것도 못 보았소. 장부에도 그렇게 적을 거요.' : '승부 전이오. 물러서 계시오.'); }
    },
    witness2: {
      name: '입회인', talk(s) { say('입회인', s.flags.musashi ? '갓 쓴 자가 있었다고 적으면 누가 믿겠소.' : '진시가 지났는데 한쪽이 안 오오. 이런 승부는 처음이오.'); }
    }
  });
  ST.boss('kojiro', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'friend') { say('고지로', f.kojiN++ % 2 ? '내일은 지지 않소. 상대가 늦지만 않으면.' : '무사시라는 자는 약속에 늦는 버릇이 있다더군. 병법이라나.'); return; }
      ST.seen('kojiro');
      if (!f.kojiMet) {
        f.kojiMet = 1; f.kojiN = 0;
        say('고지로', ['무슨 일이오. 내일 승부를 앞둔 사람이오.', '겨루자고? 고려의 검객이? ……좋소. 몸이나 풀지. 진검은 내일 쓸 것이니 목검으로.', '내 칼은 길다는 것만 알아 두시오.']);
      } else say('고지로', '한 번 더? 좋소. 내일까지는 시간이 많소.');
      G.ui.choice(['겨룬다', '다음에'], i => { if (i === 0) G.ui.run(() => G.duel.start('kojiro')); });
    },
    won(e, s) {
      e.st = 'friend';
      say('고지로', ['……졌군. 목검이라 다행이오.', '방금 그 되돌아오는 칼을 보았소? 제비를 베다가 얻은 것이오. 제비는 한 번에 안 베이니까.', '가르치는 것이 아니오. 보았으면 훔쳐 가시오. 나도 제비한테서 훔쳤소.']);
      G.ui.run(() => ST.learn('swallow'));
      say('고지로', '내일은 지지 않소. 상대가 늦지만 않으면.');
    }
  });
  ST.boss('musashi', {
    talk(e, s) {
      say('무사시', s.flags.isleSeen2 ? '다시 왔군. 물때가 바뀌기 전에 끝냅시다.' : '……');
      G.ui.run(() => { s.flags.isleSeen2 = 1; G.duel.start('musashi'); });
    },
    won(e, s) {
      me(['칼이 그의 목 한 치 앞에서 멎었다.', '그의 노는 내 갓끈에 닿아 있었다. 그도 멎은 것이다.']);
      say('무사시', ['……비겼군.', '예순 번을 겨뤄 다 이겼소. 예순한 번째는 이긴 것도 진 것도 아니오. 이런 것은 처음이오.', '오늘 일은 적지 않겠소. 적어도 아무도 믿지 않을 테니.']);
      me('그는 뒷날, 예순 번 넘게 겨뤄 진 적이 없다고만 적었다. 거짓말은 아니다.');
      say('무사시', ['서른 해쯤 뒤에 다시 오시오. 그때는 내가 뭔가 알고 있을 거요.', '사백 년을 왔다면 서른 해는 금방이겠지.']);
      G.ui.run(() => {
        ST.grow(); s.maxki = Math.max(s.maxki, 5); s.ki = s.maxki; ST.openGate(6);
        e.dead = true; G.fx.puff(e.x, e.y - 8, '#e8e2d0', 10, 40);
        G.ui.toast('무사시는 배를 저어 떠났다');
      });
    }
  });
  // 섬에서: 무사시와 고지로의 승부를 본다
  function isleScene(s) {
    const f = s.flags, m = G.world.cur, E = G.E, sp = m.spot;
    const K = { type: 'actor', spr: 'kojiro', dir: 'l', x: sp.k[0], y: sp.k[1], t: 0, wpn: 'nodachi', wa: 1.2 };
    const M = { type: 'actor', spr: 'musashi', dir: 'r', x: 13 * 16 + 8, y: 12 * 16, t: 0, wpn: 'oar', wa: 1.0, hide: true };
    E.list.push(K);
    me(['섬이다. 진막 아래 입회인들이 앉았고, 붉은 옷의 검객이 물가에 서 있다.', '약속한 때가 지났다. 상대는 오지 않는다.']);
    say('고지로', f.kojiro ? '어제의 고려 사람이군. 구경이오? 그러시오. 늦는 자를 같이 기다려야 하겠지만.' : '구경꾼이오? 입 다물고 계시오.');
    me(['한 식경이 지났다. 두 식경이 지났다.', '배 한 척이 온다. 사내 하나가 뱃전에서 노를 깎고 있다.']);
    G.ui.scene(2.2, (dt, k) => { M.x = G.lerp(13 * 16 + 8, sp.m[0], k); M.y = G.lerp(13 * 16, sp.m[1], k); M.walk = k < 1; }, () => { E.list.push(M); G.sfx('splash'); });
    say('고지로', '늦었다, 무사시!');
    me('고지로가 칼을 뽑고 칼집을 물에 던졌다.');
    G.ui.run(() => { G.sfx('splash'); K.wa = -2.2; });
    say('무사시', ['고지로, 졌다.', '이길 사람이 칼집을 버리겠는가.']);
    G.ui.scene(0.5, (dt, k) => { K.x = G.lerp(sp.k[0], sp.k[0] - 50, k); M.x = G.lerp(sp.m[0], sp.m[0] + 56, k); M.z = Math.sin(k * 3.14) * 16; K.walk = M.walk = true; M.wa = -1.57; },
      () => { G.sfx('dash'); });
    G.ui.scene(0.9, null, () => {
      M.z = 0; K.walk = M.walk = false; M.wa = 1.0; K.lie = true; K.wpn = null;
      G.fx.arc(K.x, K.y - 10, 3.14, 26, 2.8, 1, '#f6f1e3', 0.3); G.fx.line(M.x, M.y - 20, K.x, K.y - 8, '#e6cc78', 0.3);
      G.fx.flash = 0.3; G.game.shake(6); G.sfx('cut'); G.sfx('thud'); G.fx.dust(K.x, K.y, 10);
    });
    me(['한 합이었다.', '무사시가 뛰어올라 내리쳤고, 고지로의 긴 칼은 그의 머리띠만 끊었다.', '고지로는 일어나지 않았다.']);
    G.ui.run(() => {
      f.isleSeen = 1;
      M.dead = true;
      const e = G.duel.place('musashi', M.x, M.y, 'wait', { dir: 'l' });
      G.p.aim = Math.atan2(e.y - G.p.y, e.x - G.p.x); G.p.setDir(G.p.aim);
    });
    say('무사시', '……구경꾼인 줄 알았는데. 서 있는 꼴이 구경꾼이 아니군.');
    me('겨루자고 했다. 가장 센 자를 찾아 사백 년을 왔다고.');
    say('무사시', ['사백 년. 농이 지나치군. 하지만 눈은 농하는 눈이 아니오.', '물때가 바뀌기 전에 가야 하오. 그래도 한 번은 보고 가지. 노는 아직 멀쩡하니.']);
    G.ui.run(() => { f.isleSeen2 = 1; G.duel.start('musashi'); });
  }
  ST.add('funa', {
    enter(s) {
      const f = s.flags, m = G.world.cur;
      if (!f.musashi) G.duel.place('kojiro', m.kojiro.x, m.kojiro.y, f.kojiro ? 'friend' : 'wait', { dir: 'l' });
      if (!f.funaSeen) { f.funaSeen = 1; me(['같은 바닷가다. 언덕도, 냇물도, 물목도 그대로다.', '집이 늘었다. 지붕에 기와가 올랐다. 내가 처음 닿은 날로부터 사백스물일곱 해가 지났다고 한다.']); }
    }
  });
  ST.add('isle', {
    enter(s) {
      const f = s.flags, m = G.world.cur;
      if (f.musashi) { me('섬은 비었다. 모래에 발자국 두 줄이 남아 있다. 한 줄은 돌아가지 않았다.'); return; }
      if (f.isleSeen) {
        G.E.list.push({ type: 'actor', spr: 'kojiro', dir: 'l', x: m.spot.k[0] - 50, y: m.spot.k[1], t: 0, lie: true });
        G.duel.place('musashi', m.spot.m[0] + 56, m.spot.m[1], 'wait', { dir: 'l' });
      } else isleScene(s);
    },
    tick(s) {
      const b = G.E.find('musashi');
      if (b && b.st === 'wait' && s.flags.isleSeen2) ST.approach(b, 50, () => ST.talkBoss(b));
    },
    use(pr, s) {
      if (pr.id !== 'isleboat') return;
      if (!s.flags.musashi && !s.flags.isleSeen) return;
      me('사공의 배다. 섬 그늘에 대 놓았다.');
      G.ui.choice(['뭍으로 돌아간다', '그만둔다'], i => { if (i === 0) G.ui.run(() => { const m = G.world.get('funa'); G.game.go('funa', m.pier.x, m.pier.y - 40, 'up'); }); });
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.potter) add('고향 흙', f.soil === 3 ? '고려의 흙 한 줌으로 도공이 사발을 구웠다.' : f.soil === 2 ? '흙을 건넸다. 하룻밤 지나 다시 찾아가자.'
      : f.soil === 1 ? '흙을 얻었다. 게이초의 도공에게.' : '도공은 고향 흙 한 줌이 아쉽다고 했다. 고려의 흙이 남아 있을 만한 곳은 한 군데뿐이다. 내가 타고 온 배.', f.soil === 3);
    if (f.funaSeen && !f.musashi) add('후나시마의 승부', f.funaDay ? '새벽이다. 나루의 사공에게 가면 섬으로 건너갈 수 있다.' : '승부는 내일 아침. 뱃집에서 하룻밤 묵는다. 그 전에 바닷가의 고지로를 볼 수도 있다.', false);
  });

  // ======================= 레이간도 =======================
  Object.assign(G.NPCS, {
    abbot: {
      name: '주지', talk(s) {
        say('주지', s.flags.musashi2 ? '굴에서 내려오셨군요. 얼굴이 편해 보이십니다. 올라갈 때는 칼 찬 얼굴이었는데.'
          : ['운간젠지입니다. 굴에 계신 분을 찾아오셨습니까. 돌계단을 올라 벼랑길 끝입니다.', '그분은 굴에서 글을 쓰십니다. 다섯 권이라던가요. 땅, 물, 불, 바람, 그리고 빈 것.']);
      }
    },
    magonojo: {
      name: '마고노조', talk(s) {
        say('마고노조', s.flags.musashi2 ? '스승님이 다 쓰셨습니다. 제게 맡기신다고 합니다. 저는 아직 첫 권도 다 못 읽었는데.'
          : ['스승님은 안에 계십니다. 요즘은 붓만 잡으십니다.', '칼을 차고 오셨군요. ……스승님이 기다리는 분이 있다고 하셨습니다. 서른 해 전에 비긴 사람이라고. 농인 줄 알았습니다.']);
      }
    }
  });
  function ending(s, ink) {
    const k = s.kills || 0, sp = s.spared || 0;
    const road = k === 0 ? '오는 길에 아무도 베지 않았다.' : sp === 0 ? '오는 길에 ' + k + '을 벴다.' : '오는 길에 ' + k + '을 베고 ' + sp + '을 보냈다.';
    G.ui.card(['그해 겨울, 갓 쓴 사내 하나가 물을 건너 돌아갔다고도 하고', '고갯마루 찻집에 눌러앉았다고도 한다.', road, ink ? '마지막 승부에서는 칼을 뽑지 않았다.' : '마지막 칼도 한 치 앞에서 멎었다.',
      '칼 너머', '', '준비한 이야기는 여기까지입니다.', '길은 그대로 열려 있습니다.'], { dimFrom: 5 });
    G.ui.run(() => { G.game.save(); G.music.play('last'); });
  }
  ST.boss('musashiOld', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'friend') {
        f.oldN = ((f.oldN || 0) + 1) % 3;
        say('무사시', [['먹이 또 떨어지면 오시오.'], ['다섯 권이오. 마고노조에게 줄 생각이오. 읽을지는 모르겠소.'], ['그날 섬에서 고지로를 죽일 것까지는 없었소. 서른 해를 그 생각을 했소.']][f.oldN]);
        return;
      }
      if (!f.oldMet) {
        f.oldMet = 1;
        me('굴 안에 등잔 하나. 늙은 사내가 붓을 놓고 돌아본다.');
        say('무사시', ['……갓이 그대로군. 얼굴도 그대로고. 나만 늙었소.', '그날 뒤로 진검을 잡지 않았소. 예순 번을 이기고도 몰랐던 것을 그날 비기고 알았소. 이긴 것이 내가 세서가 아니었다는 것을.', '지금 다섯째 권을 쓰고 있소. 빈 것에 대해서요. 반쯤 썼는데 먹이 떨어졌소.']);
      } else say('무사시', '다시 왔소. 먹은 아직 안 갈았소.');
      G.ui.choice(['목검을 청한다', '먹을 간다', '다음에'], i => {
        if (i === 0) {
          say('무사시', '좋소. 서른 해 묵은 승부요. 두 자루를 쓰겠소. 늙어서 한 자루로는 모자라오.');
          G.ui.run(() => G.duel.start('musashiOld'));
        } else if (i === 1) {
          G.game.fadeTo(() => {
            G.p.st = 'sit';
            me(['벼루 앞에 앉았다. 먹을 갈았다.', '그는 썼다. 나는 갈았다. 등잔 기름이 반쯤 줄 때까지 아무도 칼 이야기를 하지 않았다.']);
            say('무사시', ['……다 썼소.', '칼을 뽑지 않고 이긴 사람이 여기 있었다고 적을까 했는데, 그만두었소. 그대는 어느 책에도 없는 사람이니.', '가장 센 자는 찾았소?']);
            me('모르겠다고 했다. 찾는 동안 찾을 마음이 닳았다고.');
            say('무사시', '그것이 빈 것이오.');
            G.ui.run(() => { f.musashi2 = 1; f.ink = 1; f.musashiOld = 1; e.st = 'friend'; ST.seen('musashi', 2); G.game.give('inkstone', 1); G.sfx('learn'); });
            G.ui.run(() => ending(s, true));
          });
        }
      });
    },
    won(e, s) {
      e.st = 'friend'; s.flags.musashi2 = 1;
      say('무사시', ['……졌소. 이제야 졌군.', '지고 나니 쓸 말이 생겼소. 빈 것은 없는 것이 아니오. 벨 수 있는데 베지 않는 그 사이요.', '가장 센 자는 찾았소?']);
      me('모르겠다고 했다. 찾는 동안 찾을 마음이 닳았다고.');
      say('무사시', '그것이 빈 것이오. 받아 적겠소.');
      G.ui.run(() => ending(s, false));
    }
  });
  ST.add('rei', {
    enter(s) {
      if (!s.flags.reiSeen) { s.flags.reiSeen = 1; me(['눈이 온다. 산길이다.', '서른 해가 지났다고 한다. 싸움은 다 끝났고, 칼 찬 이들은 이제 장부를 본다고 한다.']); }
    }
  });
  ST.add('cave', {
    enter(s) {
      const m = G.world.cur;
      G.duel.place('musashiOld', m.desk.x + 22, m.desk.y + 8, s.flags.musashi2 ? 'friend' : 'wait', { dir: 'l' });
    },
    tick(s) {
      if (s.flags.musashi2) return;
      const b = G.E.find('musashiOld');
      if (b && b.st === 'wait') ST.approach(b, 46, () => ST.talkBoss(b));
    }
  });
})();
