'use strict';
// 이야기 둘: 가마쿠라(1213), 지하야(1333), 가시마(1556)
(function () {
  const G = window.G, ST = G.STORY;
  const say = (n, t) => G.ui.say(n, t);
  const me = t => G.ui.say('', t);

  Object.assign(G.SIGNS, {
    kama_pass: '아사히나 고갯길.\n아직 파는 중.\n— 사부로',
    chi_road: '이 위는 지하야 성.\n오르는 자는 통나무를 조심할 것.\n내려온 자는 아직 없음.',
    kashi_dojo: '가시마 신토류.\n겨루러 온 이는 목검을 들 것.\n구경하러 온 이는 사슴을 놀라게 하지 말 것.'
  });
  Object.assign(G.LOOKS, {
    ginkgo: ['큰 은행나무다. 돌계단 옆에 서 있다.', '둥치가 굵다. 사람 하나쯤 숨을 만하다.'],
    ferryboat: ['나룻배다. 삿대가 걸쳐 있다.', '섬까지는 금방이다. 돌아오는 것은 사공 마음이다.']
  });
  Object.assign(G.CHESTS, {
    c_kotsubo: { money: 50, text: '갯바위 틈의 궤짝. 돈 꿰미가 들어 있다. 상어도 못 삼킨 모양이다.' },
    c_kamawood: { money: 40, items: { tea: 1 }, text: '숲 속의 궤짝. 도적들이 모아 둔 것이다.' },
    c_spring: { money: 45, items: { tea: 2 }, text: '샘 옆에 묻어 둔 궤짝. 누군가의 비상금이다.' },
    c_cedar: { money: 70, items: { mochi: 1 }, text: '삼나무 뿌리 사이의 궤짝. 이끼가 덮였다.' }
  });

  // 칼을 벼려 주는 이들
  function sharpen(name, lv, cost, first, done) {
    const s = G.s;
    if ((s.wlv || 0) >= lv) { say(name, done); return; }
    if ((s.wlv || 0) < lv - 1) { say(name, '이 칼은 먼저 한 번 벼려야 하오. 내 숫돌에는 아직 이르오.'); return; }
    say(name, first);
    G.ui.choice(['벼린다 (' + cost + '문)', '그만둔다'], i => {
      if (i !== 0) return;
      if (!G.game.pay(cost)) { say(name, '돈이 모자라오. 쇠는 기다려 주오.'); return; }
      G.game.fadeTo(() => { s.wlv = lv; G.sfx('stone'); G.sfx('save'); G.ui.toast('칼을 벼렸다. 베는 힘이 세졌다.'); });
    });
  }
  ST.sharpen = sharpen;

  // ======================= 가마쿠라 =======================
  Object.assign(G.NPCS, {
    priest: {
      name: '신관', talk(s) {
        s.flags.priestN = ((s.flags.priestN || 0) + 1) % 2;
        if (s.flags.asahina) say('신관', '어젯밤 꿈자리가 사나웠습니다. 내일 이 거리에 불이 날 것 같습니다.');
        else if (s.flags.priestN) say('신관', ['쓰루가오카 하치만구입니다. 겐지의 수호신을 모십니다.', '와다 님 댁과 호조 님 댁 사이가 심상치 않습니다. 양쪽 다 여기 와서 빕니다. 같은 것을 빕니다.']);
        else say('신관', '힘센 이를 찾으신다고요. 와다 님 댁 셋째, 아사히나 사부로 님일 겁니다. 갯가 아니면 고갯길에 계시겠지요.');
      }
    },
    wada: {
      name: '와다 집안 무사', talk(s) {
        say('와다 집안 무사', s.flags.asahina ? '사부로 님이 졌다고? ……내일 일에 지장은 없겠지. 그분은 지고도 웃는 분이니.'
          : ['내일이오. 더는 못 참소.', '사부로 님이 앞장설 거요. 쇼군 저택 대문은 그분이 맡기로 했소.']);
      }
    },
    hojo: {
      name: '호조 집안 무사', talk() {
        say('호조 집안 무사', ['와다 집안이 수상하오. 손님은 어느 편이오?', '어느 편도 아니라면 오늘 안에 떠나시오. 내일은 편 없는 사람이 서 있을 자리가 없소.']);
      }
    },
    fishwife: {
      name: '생선 장수', talk(s) {
        say('생선 장수', s.flags.kiteStole ? '손님도 솔개한테 털렸수? 여기선 먹을 걸 손에 들고 걷는 게 아니야.' : '바닷가에선 주먹밥을 조심해. 솔개가 채 가. 막거나 비키면 못 가져가.');
        G.ui.shop('kama');
      }
    },
    peddler: {
      name: '등짐장수', talk(s) {
        s.flags.pedN = ((s.flags.pedN || 0) + 1) % 2;
        say('등짐장수', s.flags.pedN ? ['동쪽 고갯길은 아직 덜 뚫렸소. 와다 집안 셋째가 혼자 파고 있다오. 하룻밤에 팠다는 소문도 도는데, 내가 지나다니며 본 것만 석 달이오.']
          : '서쪽 사당 옆에 늙은 비구니가 앉아 있소. 옛날에 말 타고 싸웠다는 분이오. 힘센 사내 이야기라면 그분이 잘 아오.');
      }
    },
    smith: {
      name: '대장장이', talk() {
        sharpen('대장장이', 1, 80, ['칼 좀 봅시다. ……곧은 칼이군. 이가 세 군데 빠졌소.', '벼려 드리리다. 대신 한 뼘쯤 짧아지오.'], '좋은 쇠요. 이 땅 쇠와는 결이 다르오.');
      }
    },
    kid2: {
      name: '아이', talk(s) {
        const f = s.flags;
        if (s.map === 'funa') { say('아이', f.kojiro ? '고지로 아저씨가 졌어? 목검이라 그런 거야. 진짜 칼이면 안 져.' : '고지로 아저씨는 바닷가에서 제비를 벤대! 진짜로 벤 건 못 봤어.'); return; }
        if (f.kite === 2) { say('아이', '사부로 아저씨는 상어를 겨드랑이에 끼고 다녀. 한 마리씩.'); return; }
        if (!f.kite) { f.kite = 1; say('아이', ['솔개가 내 주먹밥 가져갔어……', '점심이었는데.']); }
        else say('아이', '배고파.');
        if (G.game.count('rice') > 0) {
          G.ui.choice(['주먹밥을 준다', '그만둔다'], i => {
            if (i !== 0) return;
            G.game.take('rice', 1); f.kite = 2;
            say('아이', ['……고마워, 까만 삿갓 아저씨.', '이거 줄게. 갯가에서 주운 거야.']);
            G.ui.run(() => { G.game.earn(25); G.game.give('dango', 2); });
          });
        }
      }
    },
    tomoe: {
      name: '늙은 비구니', talk(s) {
        const f = s.flags;
        ST.seen('tomoe', 2);
        if (f.asahina) { say('늙은 비구니', ['졌다고? 그 애가? ……잘됐네.', '한 번은 져 봐야 오래 살아. 나는 한 번도 안 져서 이 꼴이야.']); return; }
        f.tomoeN = (f.tomoeN || 0) + 1;
        if (f.tomoeN === 1) say('늙은 비구니', ['힘센 사내를 찾는다고? 고쓰보 갯가에 가 봐. 상어를 잡고 있을 거야.', '사람들은 그 애가 내 아들이라고 해. 셈을 해 보면 안 맞아. 그래도 그렇다고 해 두지.', '나도 예전엔 말을 탔어. 한 사람이 천 사람 몫을 한다는 소리도 들었고. 듣기 좋은 소리는 아니었어.']);
        else say('늙은 비구니', ['그 애는 붙잡으러 올 때 팔을 크게 벌려. 그때 옆으로 빠지면 한참 헛돌아.', '내가 가르친 건 아니야. 가르쳤으면 그렇게 안 하지.']);
      }
    }
  });
  ST.boss('asahina', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'friend') {
        f.asaN = ((f.asaN || 0) + 1) % 3;
        if (f.asaN === 1) { say('아사히나', '고려는 어떤 곳이냐. 상어는 있냐.'); me('있다고 했다.'); say('아사히나', '그럼 갈 만하군.'); }
        else say('아사히나', f.asaN === 2 ? '내일은 대문을 부순다. 쇼군 저택 대문이다. 오늘 든 문짝보다 두 배는 크다.' : '상어는 구워야 맛이다. 더 먹어라.');
        return;
      }
      ST.seen('asahina');
      if (!f.asaMet) {
        me('사내 하나가 바다에서 걸어 나온다. 양 겨드랑이에 상어를 한 마리씩 끼고 있다.');
        say('아사히나', ['넷째 놈은 놓쳤다.', '뭐냐, 너는. 삿갓이 까맣군.']);
        me('고려에서 왔다고 했다. 가장 센 자를 찾는다고.');
        say('아사히나', ['하하하! 그럼 잘 찾아왔다. 가마쿠라에서 힘으로 나를 이긴 놈은 없다.', '다만 내일은 바쁘다. 우리 집안에 큰일이 있어서. 오늘 하자.', '동쪽 고갯길로 와라. 내가 파던 길이다. 문짝도 하나 갖다 놨다. 내일 부술 문의 연습이지.']);
        G.ui.choice(['따라간다', '다음에'], i => {
          if (i !== 0) return;
          f.asaMet = 1;
          G.game.fadeTo(() => {
            e.x = 92 * 16; e.y = 20 * 16; e.hx = e.x; e.hy = e.y; e.dir = 'l';
            G.p.reset(89 * 16, 25 * 16, 'up'); G.game.snap();
            me('고갯길이다. 바위를 깎아 낸 자리가 아직 새것이다.');
            G.ui.run(() => G.duel.start('asahina'));
          });
        });
        return;
      }
      say('아사히나', '왔나. 길은 덜 팠지만 싸울 자리는 된다.');
      G.ui.choice(['겨룬다', '다음에'], i => { if (i === 0) G.ui.run(() => G.duel.start('asahina')); });
    },
    won(e, s) {
      e.st = 'friend';
      say('아사히나', ['하하하하! 졌다! 등이 땅에 닿은 건 처음이다.', '바다 건너에는 너 같은 놈이 많으냐.']);
      me('없다고 했다. 그래서 왔다고.');
      say('아사히나', ['그럼 내가 건너가면 내가 제일이겠군.', '내일 일이 틀어지면 배를 탈 생각이다. 아와로 갈지 더 멀리 갈지는 바람 보고 정하지.', '이건 아까 잡은 상어다. 구웠다. 먹고 가라.']);
      G.ui.run(() => { ST.grow(); ST.openGate(2); });
    }
  });
  ST.add('kama', {
    enter(s) {
      const f = s.flags, m = G.world.cur;
      if (f.asahina) G.duel.place('asahina', m.cove.x, m.cove.y, 'friend', { dir: 'l' });
      else if (f.asaMet) G.duel.place('asahina', 92 * 16, 20 * 16, 'wait', { dir: 'l' });
      else G.duel.place('asahina', m.cove.x, m.cove.y, 'wait', { dir: 'l' });
      if (!f.kamaSeen) { f.kamaSeen = 1; me(['도리이를 지나니 다른 바닷가다. 세 쪽이 산이고 한 쪽이 바다다.', '스물여덟 해가 지났다고 한다. 내 칼의 녹은 어제 그대로다.']); }
    },
    tick(s) {
      const f = s.flags;
      if (f.asaMet && !f.asahina) { const b = G.E.find('asahina'); if (b && b.st === 'wait') ST.approach(b, 44, () => ST.talkBoss(b)); }
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.kite) add('솔개가 채 간 점심', f.kite === 2 ? '아이에게 주먹밥을 주었다.' : '가마쿠라 장터의 아이가 주먹밥을 솔개에게 빼앗겼다.', f.kite === 2);
  });

  // ======================= 지하야 =======================
  Object.assign(G.NPCS, {
    captain: {
      name: '막부군 대장', talk(s) {
        if (s.flags.kusunoki) { say('막부군 대장', ['저 위에 올라가서 구스노키를 만나고 내려왔다고?', '……우리는 석 달째 문 앞에도 못 갔소. 그 얘기는 진중에서 하지 마시오.']); return; }
        say('막부군 대장', ['성 하나 떨어뜨리는 데 석 달이오. 군사는 수만인데.', '혼자 오르겠다고? 말리지는 않겠소. 통나무 소리가 나면 길 가장자리로 붙으시오. 우리는 그걸 몰라서 첫 달에 많이 잃었소.']);
      }
    },
    siege1: {
      name: '막부군 병사', talk() { say('막부군 병사', ['진중에서 연가(連歌) 모임을 열었소. 성은 안 떨어지고 노래 실력만 늘었소.', '윗구는 내가 지었소. "눈 녹기 전에 —" 아랫구가 석 달째 안 나오오.']); }
    },
    siege2: {
      name: '막부군 병사', talk() { say('막부군 병사', '차 맛 맞히기 내기도 하오. 진 쪽이 다음 돌격에 앞장서기로 했소. 요즘은 다들 차 맛을 잘 아오.'); }
    },
    veteran: {
      name: '늙은 무사', talk(s) {
        if (!s.flags.vetMet) {
          s.flags.vetMet = 1;
          say('늙은 무사', '고려? 쉰 해 전에 배 타고 쳐들어온 그쪽?');
          me('나는 아니라고 했다. 정말로 아니었다.');
          say('늙은 무사', ['그때 싸운 우리 아버지는 상을 못 받았소. 이긴 싸움인데 빼앗은 땅이 없었거든.', '그래서 막부가 이 꼴이오. 저 위의 구스노키 같은 자가 나오는 것도 그 때문이고.']);
        } else say('늙은 무사', '나는 이 싸움에서도 상을 못 받을 거요. 집안 내력이오.');
      }
    },
    sutler: {
      name: '진중 장사치', talk() { say('진중 장사치', '진중 물가요. 싫으면 성에 올라가 얻어 드시든가.'); G.ui.shop('chi'); }
    },
    bro: {
      name: '막부군 병사', talk(s) {
        const f = s.flags;
        if (f.letter === 2) {
          say('막부군 병사', ['아우가 살아 있소? 글을 읽고 웃었소?', '……그럼 됐소. 받으시오. 내 석 달 치 급료요. 쓸 데도 없소.']);
          G.ui.run(() => { f.letter = 3; G.game.earn(60); });
        } else if (f.letter === 3) say('막부군 병사', '싸움이 끝나면 어머니 계신 집에서 볼 거요. 어느 쪽이 이기든.');
        else if (!f.letter) {
          say('막부군 병사', ['저 위에 아우가 있소. 구스노키 편에 붙었지. 가와치 사람이니 어쩔 수 없소.', '올라갈 거라면 이것 좀 전해 주시오. 성문을 지킨다고 들었소.']);
          G.ui.run(() => { f.letter = 1; G.game.give('letter', 1); });
        } else say('막부군 병사', '아우는 성문에 있을 거요. 나보다 키가 크오.');
      }
    },
    waterboy: {
      name: '물 긷는 아이', talk(s) {
        if (!s.flags.spring) {
          s.flags.spring = 1;
          say('물 긷는 아이', ['이 샘은 우리만 알아요. 성에 물이 안 마르는 까닭이에요.', '아저씨는 막부군 아니죠? 갓이 다르니까.', '한 바가지 마시고 가요.']);
          G.ui.run(() => { s.ki = s.maxki; s.hp = Math.min(s.maxhp, s.hp + 2); G.sfx('tea'); G.ui.toast('샘물을 마셨다. 기가 찼다.'); });
        } else say('물 긷는 아이', '주군은 싸움보다 물을 먼저 챙기셨어요. 성을 쌓기 전에 샘부터 찾으셨대요.');
      }
    },
    kusuGuard: {
      name: '성문지기', talk(s) {
        const f = s.flags;
        if (f.chiGate) { say('성문지기', f.kusunoki ? '주군께서 통나무를 그만 굴리라 하셨소. 내려가는 길은 편할 거요.' : '주군은 안마당에 계시오.'); return; }
        say('성문지기', ['멈추시오. ……혼자요? 통나무를 다 비켜서?', '막부군은 아니군. 갓이 다르오.']);
        if (f.letter === 1) {
          me('아래에서 맡은 글을 내밀었다.');
          say('성문지기', ['형 글씨요.', '……', '형은 연가를 못 하오. 저 아래서 고생이 많겠소.']);
          G.ui.run(() => { G.game.take('letter', 1); f.letter = 2; G.game.give('mochi', 2); });
        }
        say('성문지기', '주군께 여쭙겠소. 들어오시오.');
        G.ui.run(() => { f.chiGate = 1; openGate(); G.sfx('open'); G.E.remove('kusuGuard'); G.E.addNpc('kusuGuard', 46, 21); });
      }
    }
  });
  function openGate() {
    const m = G.world.cur, pr = G.world.findProp('chigate');
    if (pr) pr.s = 'gateOpen';
    G.world.setSolid(m.gate.tx, m.gate.ty, 0);
  }
  ST.boss('kusunoki', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'friend') {
        f.kusuN = ((f.kusuN || 0) + 1) % 2;
        say('마사시게', f.kusuN ? '가마쿠라가 무너졌다는 기별은 아직 없소. 올 거요. 버티면.' : '뒷날 사람들이 나를 뭐라 부를지는 모르겠소. 나는 가와치의 구스노키요. 그뿐이오.');
        return;
      }
      ST.seen('kusunoki');
      if (!f.kusuMet) {
        f.kusuMet = 1;
        say('마사시게', ['성을 치러 온 것이 아니라 나를 보러 왔다. 수만이 못 넘은 목책을 혼자 넘어서.', '가장 센 자를 찾는다면 잘못 왔소. 나는 센 사람이 아니오. 지지 않는 사람이지.', '그래도 겨루겠다면 미리 말해 두오. 나는 칼만 쓰지 않소.']);
      } else say('마사시게', '다시 왔소. 이번에는 무엇에 속을지 나도 궁금하오.');
      G.ui.choice(['겨룬다', '다음에'], i => { if (i === 0) G.ui.run(() => G.duel.start('kusunoki')); });
    },
    won(e, s) {
      e.st = 'friend';
      say('마사시게', ['졌소. 성은 안 졌지만.', '그대는 내 짚 인형을 알아보았소. 수만 가운데 그런 이가 없었는데.']);
      me('고향 들판에도 허수아비가 있다고 했다. 나보다 옷을 잘 입은 놈이었다고.');
      say('마사시게', ['하하. 그럼 하나 가져가시오. 세우는 법은 쉽소. 세워 놓고 믿는 것이 어렵지.', '나는 이 성에서 이기려는 것이 아니오. 버티는 것이오. 버티다 보면 센 쪽이 먼저 지치오.']);
      G.ui.run(() => { ST.learn('decoy'); ST.grow(); ST.openGate(3); });
    }
  });
  let logT = 3;
  ST.add('chi', {
    enter(s) {
      const f = s.flags;
      G.duel.place('kusunoki', 44 * 16 + 8, 13 * 16, f.kusunoki ? 'friend' : 'wait', { dir: 'l' });
      if (f.chiGate) { openGate(); G.E.addNpc('kusuGuard', 46, 21); }
      else { const pr = G.world.findProp('chigate'); if (pr) pr.s = 'gate'; G.world.setSolid(44, 23, 1); }
      logT = 3;
      if (!f.chiSeen) { f.chiSeen = 1; me(['눈이다. 산 아래에 진막이 끝없이 깔렸고, 산 위에 작은 성 하나가 있다.', '백이십 해가 지났다고 한다. 진막의 문장은 본 적 있는 세 비늘이다.']); }
    },
    tick(s, dt) {
      const f = s.flags, p = G.p, m = G.world.cur;
      if (f.kusunoki || G.duel.state) return;
      // 산길에서는 통나무가 굴러 내려온다
      logT -= dt;
      if (logT > 0) return;
      logT = 3.6 + Math.random() * 1.6;
      for (const sl of m.slopes) {
        const dx = sl.bx - sl.ax, dy = sl.by - sl.ay, l2 = dx * dx + dy * dy;
        const k = G.clamp(((p.x - sl.ax) * dx + (p.y - sl.ay) * dy) / l2, 0, 1);
        if (Math.hypot(p.x - (sl.ax + dx * k), p.y - (sl.ay + dy * k)) > 44 || k < 0.12) continue;
        const l = Math.sqrt(l2), sp = 96;
        G.E.shoot(null, 'log', sl.ax, sl.ay, Math.atan2(dy, dx), sp, { dmg: 1, unblock: true, fly: true, heavy: true, r: 14, t: l / sp, post: 40 });
        G.sfx('thud');
        if (!f.sawLog) { f.sawLog = 1; G.ui.toast('통나무가 굴러온다. 길 가장자리로 붙어라.'); }
        break;
      }
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.letter) add('형의 편지', f.letter >= 2 ? '성문지기에게 형의 글을 전했다.' + (f.letter === 2 ? ' 산 아래의 형에게 알려 주자.' : '') : '산 아래 병사의 글을 지하야 성문의 아우에게.', f.letter === 3);
  });

  // ======================= 가시마 =======================
  Object.assign(G.NPCS, {
    miko: {
      name: '무녀', talk(s) {
        if (G.game.isNight()) say('무녀', ['밤에는 미타라시 못에 가지 마세요. 갓파가 씨름을 걸어요.', '꼭 가셔야 한다면 먼저 절을 하세요. 맞절을 하다 머리 접시의 물을 쏟는대요.']);
        else say('무녀', s.flags.deshi3 ? '보쿠덴 님은 못가 초막에 계세요. 낚싯대를 드리우고 계실 거예요. 미끼는 안 다세요.' : ['사슴은 신의 심부름꾼이에요. 놀라게 하지 마세요.', '보쿠덴 님을 뵈려면 도장의 세 분을 먼저 보셔야 할 거예요.']);
      }
    },
    farmer: {
      name: '농부', talk() { say('농부', '오이는 갓파가 좋아하오. 나는 사람한테 파오.'); G.ui.shop('kashi'); }
    },
    kid: {
      name: '아이', talk(s) {
        if (s.map === 'kashi') { say('아이', '사슴한테 절하면 사슴도 절해! ……아닌가, 그냥 고개 숙인 건가.'); return; }
        s.flags.kidN = (s.flags.kidN || 0) + 1;
        if (s.flags.kidN % 2) { say('아이', ['화살 주워. 한 대에 쌀 한 줌 쳐 줘.', '아저씨 칼은 왜 곧아? 여기 칼은 다 휘었는데.']); me('휜 칼도 써 봤다고 했다. 곧은 쪽이 거짓말을 덜 한다.'); }
        else say('아이', '저 숲엔 가지 마. 진 쪽 무사들이 숨어 있어. 배가 고파서 사나워.');
      }
    },
    ferry: {
      name: '사공', talk(s) {
        s.flags.heardTale = 1;
        say('사공', ['보쿠덴 영감님 젊을 적 이야기 아시오?', '비와 호 나룻배에서 웬 허풍쟁이가 겨루자고 덤볐답디다. 영감님은 "배가 좁으니 저 섬에서 합시다" 했지.', '허풍쟁이가 먼저 섬에 뛰어내리자 영감님은 삿대로 배를 밀어 물러났소. "싸우지 않고 이기는 것, 이것이 무수승류요" 하면서.', '그 허풍쟁이가 어찌 돌아왔는지는 아무도 모르오.']);
      }
    }
  });
  const DESHI_AT = [[43, 34], [46, 32], [50, 34]];
  for (let n = 1; n <= 3; n++) {
    ST.boss('deshi' + n, {
      talk(e, s) {
        const f = s.flags, nm = e.def.name;
        if (e.st === 'friend') { say(nm, n === 3 ? '스승님이 배를 타자고 하시거든…… 아닙니다. 가 보시면 압니다.' : '목검 자국이 아직 아픕니다. 좋은 공부였습니다.'); return; }
        if (n > 1 && !f['deshi' + (n - 1)]) { say(nm, '차례가 있습니다. 아우들부터 보시지요.'); return; }
        if (n === 1 && !f.deshiMet) {
          f.deshiMet = 1;
          say(nm, ['스승님을 뵙겠다고요? 그러려면 저희 셋을 지나야 합니다.', '목검으로 합니다. 다치지는 않을 겁니다. 아프기는 할 겁니다.']);
        } else say(nm, n === 3 ? '둘을 지나오셨군요. 제가 마지막입니다.' : '부탁드립니다.');
        G.ui.choice(['겨룬다', '다음에'], i => { if (i === 0) G.ui.run(() => G.duel.start('deshi' + n, { arena: G.world.cur.arenas.deshi })); });
      },
      won(e, s) {
        e.st = 'friend';
        if (n === 1) say(e.def.name, '……졌습니다. 사형, 부탁합니다.');
        else if (n === 2) say(e.def.name, '칼끝이 멎는군요. 스승님이 말씀하시던 그것입니다.');
        else {
          say(e.def.name, ['졌습니다.', '스승님은 못가 초막에 계십니다.']);
          G.ui.run(() => G.ui.toast('보쿠덴을 만날 수 있다'));
        }
        G.ui.run(() => { e.x = (39 + n * 4) * 16; e.y = 31 * 16 + 4; });
      }
    });
  }
  function bokudenDuel() { G.duel.start('bokuden'); }
  ST.boss('bokuden', {
    talk(e, s) {
      const f = s.flags, m = G.world.cur;
      if (e.st === 'friend') {
        f.bokuN = ((f.bokuN || 0) + 1) % 3;
        say('보쿠덴', [['낚시는 고기를 잡으려고 하는 것이 아니오.'], ['교토의 쇼군께 칼을 가르친 적이 있소. 좋은 분이오. 칼을 너무 좋아하셔서 걱정이오.'], ['무수승류라고들 하지. 그날 나는 그저 귀찮았을 뿐이오.']][f.bokuN]);
        return;
      }
      ST.seen('bokuden');
      if (!f.deshi3) { say('보쿠덴', ['도장에 젊은 것들이 셋 있소. 그 애들을 먼저 봐 주시오.', '늙은이는 낚시 중이오.']); return; }
      if (f.bokuMet) {
        say('보쿠덴', '또 왔소. 이번에는 배는 그만둡시다.');
        G.ui.choice(['겨룬다', '다음에'], i => { if (i === 0) G.ui.run(bokudenDuel); });
        return;
      }
      say('보쿠덴', ['셋을 다 지나왔소? 목검으로? 한 놈도 안 다치고?', '고려에서는 그대를 검성이라 부른다고. 여기서는 나를 그렇게 부르오. 부르는 쪽 마음이지.', '겨룹시다. 다만 여기는 좁고 사슴이 놀라오. 저 못 가운데 섬으로 갑시다. 배는 내가 젓지.']);
      G.ui.choice(['배에 오른다', '다음에'], i => {
        if (i !== 0) return;
        f.bokuMet = 1;
        const back = say2 => G.game.fadeTo(() => {
          G.p.reset(m.shore.x + 40, m.shore.y - 20, 'left'); e.x = m.shore.x; e.y = m.shore.y - 24; e.dir = 'r'; G.game.snap();
          say2(); G.ui.run(bokudenDuel);
        });
        G.game.fadeTo(() => {
          G.p.reset(m.isle.x + 14, m.isle.y, 'left'); e.x = m.isle.x - 10; e.y = m.isle.y + 2; e.dir = 'r'; G.game.snap();
          me('배가 섬에 닿았다. 영감은 삿대를 쥔 채 앉아 있다.');
          G.ui.choice(['먼저 뛰어내린다', '영감이 먼저 내리기를 기다린다'], j => {
            if (j === 0) {
              f.tricked = 1;
              me('섬에 내려섰다. 돌아보니 배가 멀어지고 있다.');
              say('보쿠덴', ['싸우지 않고 이기는 것. 이것이 무수승류요!', '헤엄은 치시오?']);
              me(['속았다.', '허리까지 오는 물을 걸어서 건넜다. 갓은 젖지 않았다.']);
              G.ui.run(() => back(() => say('보쿠덴', ['화가 났소? 그럼 아직 멀었소.', '안 났소? ……그럼 겨룰 만하오.'])));
            } else {
              f.tricked = 2;
              me('움직이지 않았다.');
              say('보쿠덴', '……먼저 내리시지.');
              me('영감이 먼저 내리라고 했다.');
              say('보쿠덴', ['그 이야기를 들었군. 소문이 병법을 망쳐.', '좋소. 내릴 것 없소. 물가로 돌아갑시다. 속지 않는 사람과는 땅에서 겨뤄야지.']);
              G.ui.run(() => back(() => say('보쿠덴', '자, 뽑으시오. 나는 기다리는 쪽이 편하오.')));
            }
          });
        });
      });
    },
    won(e, s) {
      e.st = 'friend';
      const k = s.kills || 0, sp = s.spared || 0;
      say('보쿠덴', ['졌소. 이 나이에 처음이오.', '그대의 칼은 목 앞에서 멎더군. 나는 그것을 예순이 넘어서야 배웠소.', '이기는 것은 쉽소. 베지 않고 이기는 것이 어렵지. 그대는 여기까지 오면서 몇을 벴소?']);
      if (k === 0) { me('하나도 베지 않았다고 했다.'); say('보쿠덴', '……그럼 내가 가르칠 것이 없소. 보여 줄 것이 하나 있을 뿐이오.'); }
      else if (k > sp * 2) { me(k + '이라고 했다.'); say('보쿠덴', '많소. 나는 이백을 넘겼소. 자랑이 아니오. 밤마다 세어 보는 수요.'); }
      else { me('벤 것이 ' + k + ', 보낸 것이 ' + sp + '이라고 했다.'); say('보쿠덴', '보낸 쪽도 세고 있으니 됐소.'); }
      say('보쿠덴', ['일지태도. 숨 한 번 고르고 한 번 베는 것이오. 평생 한 번 쓸까 말까 한 칼이지.', '쓸 일이 없기를 바라면서 익히는 것이오.']);
      G.ui.run(() => { ST.learn('hitotsu'); ST.grow(); s.maxki = Math.max(s.maxki, 4); s.ki = s.maxki; ST.openGate(4); });
    }
  });
  ST.add('kashi', {
    enter(s) {
      const f = s.flags, m = G.world.cur;
      for (let n = 1; n <= 3; n++) {
        if (f['deshi' + n]) G.duel.place('deshi' + n, (39 + n * 4) * 16, 31 * 16 + 4, 'friend', { dir: 'r' });
        else G.duel.place('deshi' + n, DESHI_AT[n - 1][0] * 16, DESHI_AT[n - 1][1] * 16, 'wait', { dir: 'l' });
      }
      G.duel.place('bokuden', m.shore.x, m.shore.y - 24, f.bokuden ? 'friend' : 'wait', { dir: 'r' });
      if (!f.kashiSeen) { f.kashiSeen = 1; me(['삼나무 숲이다. 사슴이 길을 비키지 않는다.', '이백 해가 넘게 지났다고 한다. 싸움터가 아닌 곳은 오랜만이다.']); }
    },
    spare(e, s) {
      if (e.kind === 'kappa' && e.bowed && !s.flags.kappa) {
        s.flags.kappa = 1;
        G.ui.toast('갓파가 무언가를 두고 달아났다.');
        G.E.drop(e.x, e.y, '$', 30); G.E.drop(e.x + 8, e.y, 'cucumber', 2);
      }
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.deshiMet && !f.bokuden) {
      const n = (f.deshi1 ? 1 : 0) + (f.deshi2 ? 1 : 0) + (f.deshi3 ? 1 : 0);
      add('가시마의 도장', n >= 3 ? '문하생 셋을 지났다. 보쿠덴은 못가 초막에 있다.' : '보쿠덴을 만나려면 문하생 셋을 목검으로 이겨야 한다. (' + n + '/3)', false);
    }
    if (f.kappa) add('못가의 갓파', '절을 했더니 맞절을 하다 접시 물을 쏟고 달아났다.', true);
  });
})();
