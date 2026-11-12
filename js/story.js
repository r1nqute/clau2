'use strict';
// 이야기 하나: 틀, 고갯마루, 단노우라(1185). 사람들 말과 맞수와의 앞뒤 사정.
(function () {
  const G = window.G;
  const say = (n, t) => G.ui.say(n, t);
  const me = t => G.ui.say('', t);     // 주인공은 말이 없고, 한 말은 지문으로 적힌다

  const maps = {}, bosses = {}, quests = [];
  const ST = G.STORY = {
    // 지도마다: enter(s) 들어설 때, tick(s, dt) 걷는 동안, spare/kill(e, s)
    add(id, o) { maps[id] = o; },
    // 맞수마다: talk(e, s) 말을 걸면, won(e, s) 이기고 나면
    boss(id, o) { bosses[id] = o; },
    quest(fn) { quests.push(fn); },

    seen(id, lv) { const s = G.s; s.seen[id] = Math.max(s.seen[id] || 0, lv || 1); },
    learn(id) {
      const s = G.s, k = G.SKILLS[id];
      s.skills[id] = 1; s.skill = id; s.ki = s.maxki;
      G.sfx('learn'); G.ui.toast('비기를 얻었다: ' + k.name + ' (싸움의 비기에서 쓴다)');
    },
    grow() { const s = G.s; s.maxhp += 10; s.hp = s.maxhp; G.ui.toast('체력의 끝이 10 늘었다'); },
    openGate(i) {
      const s = G.s;
      if (s.flags['gate' + i]) return;
      s.flags['gate' + i] = 1;
      G.ui.toast('고갯마루의 ' + ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째'][i] + ' 도리이가 열렸다');
    },
    // 지금까지 이긴 맞수 수로 본 진도
    stage(s) {
      const f = (s || G.s).flags;
      return f.musashi2 ? 7 : f.musashi ? 6 : f.kenshin ? 5 : f.bokuden ? 4 : f.kusunoki ? 3 : f.asahina ? 2 : f.yoshitsune ? 1 : 0;
    },

    intro() {
      G.ui.card(['을사년 봄.', '고려에는 더 겨룰 사람이 없었다.', '물 건너에 센 자가 많다고 들었다.', '칼 한 자루 차고 배를 탔다.']);
      me(['배가 닿았다. 바다에 붉은 깃발이 떠 있다.', '큰 싸움이 막 끝난 모양이다.']);
      G.ui.run(() => {
        G.ui.era(G.world.cur.title);
        G.ui.toast(G.touch ? '원판으로 걷는다. 살피기로 말을 건다. 들의 적에 닿으면 싸움이 된다.' : '방향키 걷기   Z·X 말 걸기   Space 달리기   Esc 봇짐');
      });
    },
    onEnter(id) { const m = maps[id]; if (m && m.enter) m.enter(G.s); },
    tick(dt) { const m = maps[G.s.map]; if (m && m.tick) m.tick(G.s, dt); },
    onSpare(e) { const m = maps[G.s.map]; if (m && m.spare) m.spare(e, G.s); },
    onKill(e) { const m = maps[G.s.map]; if (m && m.kill) m.kill(e, G.s); },
    talkBoss(e) { const b = bosses[e.kind]; if (b && b.talk) b.talk(e, G.s); },
    won(id, e) {
      const b = bosses[id], s = G.s;
      s.flags[id] = 1; ST.seen(id, 2);
      if (b && b.won) b.won(e, s);
      for (const a of G.party.active()) { const l = G.ALLY_WON[id] && G.ALLY_WON[id][a]; if (l) say(G.ALLIES[a].name, l); }
      G.ui.run(() => { G.music.play(G.world.cur.music); G.game.save(); });
    },
    use(pr) { const m = maps[G.s.map]; if (m && m.use) m.use(pr, G.s); }
  };

  // 다가가면 저쪽에서 먼저 말을 건다. 물러났다 다시 오면 또 건다.
  const asked = {};
  ST.approach = function (e, r, fn) {
    if (!e || e.dead || G.ui.busy() || G.duel.state) return;
    const d = G.dist(e.x, e.y, G.p.x, G.p.y);
    if (d < r) { if (!asked[e.kind]) { asked[e.kind] = true; fn(); } }
    else if (d > r + 30) asked[e.kind] = false;
  };
  ST.resetAsked = () => { for (const k in asked) delete asked[k]; };

  G.questLog = function (s) {
    const out = [];
    const add = (title, text, done) => out.push({ title, text, done });
    for (const fn of quests) fn(s, add);
    return out;
  };

  // ======================= 고갯마루 =======================
  const NEXT = [
    null,
    ['둘째 문이다. 스물여덟 해 뒤, 겐랴쿠(建暦) 3년의 가마쿠라.', '아사히나 사부로. 상어를 맨손으로 잡고 대문을 뜯어 드는 놈이다. 힘으로는 그때의 으뜸이지.', '그런 놈은 막지 마라. 비켜라.'],
    ['셋째 문이다. 백이십 해 뒤, 겐코(元弘) 3년. 가마쿠라가 무너지는 해다.', '구스노키 마사시게. 산성 하나로 수만을 붙잡아 둔 사내다. 칼보다 꾀가 세다.', '속지 마라. 아니, 속아도 좋다. 구경거리가 되니.'],
    ['넷째 문이다. 이백 해 넘게 뒤, 고지(弘治) 2년의 가시마.', '쓰카하라 보쿠덴. 그때 사람들이 검성이라 부르는 늙은이다. 진검으로 열아홉 번을 겨뤄 한 번도 안 졌다.', '그 영감이 배를 타자고 하거든 잘 생각해라.'],
    ['다섯째 문이다. 고작 다섯 해 뒤, 에이로쿠(永禄) 4년. 시나노의 가와나카지마.', '우에스기 겐신. 제 입으로 비사문천의 화신이라 한다. 안개 속에서 말을 타고 온다.', '칼 한 자루로 군사 만 명을 어찌 상대하나 싶겠지. 가 보면 안다.'],
    ['여섯째 문이다. 쉰 해 뒤, 게이초(慶長) 17년. 네가 처음 닿은 그 바다다.', '미야모토 무사시. 예순 번을 겨뤄 다 이긴 놈이다. 그날 그 섬에서 사사키 고지로와 겨룬다.', '늦게 오는 놈이다. 기다릴 각오를 해라.'],
    ['일곱째 문이다. 서른 해 뒤, 간에이(寛永) 20년. 구마모토의 바위굴.', '같은 놈이다. 늙었을 뿐. 칼의 시대는 끝났고 그놈은 굴에서 글을 쓴다.', '무엇을 썼는지는 네가 가서 읽어라.']
  ];
  const TIPS = [
    '칼을 섞기 전에 상대를 봐라. 무엇을 하려는지 몸이 먼저 말한다. 흰빛이 돌면 쳐낼 수 있고, 붉은빛이 돌면 비켜야 한다.',
    '쳐낸 칼은 그대로 되돌아간다. 쳐낼 때마다 저쪽 자세가 흔들리고, 네 기는 찬다.',
    '막기는 아무 때나 통하지만 반쯤만 막는다. 쳐내기는 흰 수 하나에만 통하지만 다 막고 되친다. 한꺼번에 여럿이 오면 하나만 쳐낼 수 있다.',
    '칼을 내리고 기다리는 놈한테 베어 들어가지 마라. 그건 틈이 아니라 덫이다. 기다리는 놈은 비기로 가르든가, 너도 기다려라.',
    '들에서 놈들 등 뒤로 돌아 먼저 쳐라. 한 차례를 거저 먹고 들어간다.',
    '칼을 버린 놈은 한 번 더 베면 죽는다. 벨지 보낼지는 네가 정해라.'
  ];
  G.NPCS = {
    tengu: {
      name: '덴구', talk(s) {
        const f = s.flags, st = ST.stage(s);
        ST.seen('tengu', 2);
        if (!f.tengu) {
          say('덴구', ['깃털 냄새가 난다 했더니. 우시와카가 보냈구나.', '가장 센 자를 찾는다고? 어느 때의?']);
          me('때가 여럿이냐고 물었다.');
          say('덴구', ['여기는 고갯마루다. 어느 때에도 속하지 않지. 저 도리이를 하나 지날 때마다 백 년쯤은 예사로 건너뛴다.', '서쪽 끝이 네가 온 문이다. 그 옆이 스물여덟 해 뒤 가마쿠라. 거기 상어를 맨손으로 잡는 놈이 있다.', '값? 값은 됐다. 교만한 놈이 꺾이는 걸 보는 게 내 낙이다. 꺾는 쪽이든 꺾이는 쪽이든.']);
          G.ui.run(() => { f.tengu = 1; ST.openGate(1); G.game.save(); });
          return;
        }
        if (st >= 7 && !f.tenguEnd) {
          f.tenguEnd = 1;
          say('덴구', ['다 보았구나. 가장 센 자는 찾았느냐.']);
          me('모르겠다고 했다. 저마다 다른 것이 세었다고.');
          say('덴구', ['그럼 됐다. 그걸 아는 놈은 내가 잡아갈 수가 없다.', '돌아가는 배는 네가 온 문 앞에 그대로 있다. 닿는 곳이 어느 나라일지는 가 봐야 알겠지만.']);
          return;
        }
        if (!f.tenguSaw && (s.kills || 0) + (s.spared || 0) >= 8) {
          f.tenguSaw = 1;
          say('덴구', (s.kills || 0) === 0 ? ['여태 하나도 안 죽였군. 칼은 왜 차고 다니나.', '……그래서 차고 다니는 건가.']
            : s.kills > (s.spared || 0) * 2 ? ['칼에서 비린내가 난다.', '센 놈은 많이 봤다. 그런 놈들이 죽어서 뭐가 되는지 아나. 나 같은 게 된다.']
              : '보낼 놈은 보내고 왔군. 싱겁지만 오래 갈 칼이다.');
          return;
        }
        say('덴구', st === 0 ? '문은 열어 두었다.' : st >= 7 ? '차나 마시고 가라. 할멈 경단은 어느 때 것이든 같은 맛이다.' : '왔느냐.');
        G.ui.choice(['다음 맞수를 묻는다', '칼 쓰는 법을 묻는다', '그만둔다'], i => {
          if (i === 0) {
            if (st >= 7) say('덴구', '없다. 남은 건 너 하나다.');
            else if (!G.world.has(G.ERAS[st + 1 > 6 ? 6 : st + 1].map) && st >= 1) say('덴구', '그 문은 아직 안개가 걷히지 않았다. 다음에 오너라.');
            else say('덴구', NEXT[Math.min(6, st + 1)] || NEXT[1]);
          } else if (i === 1) {
            f.tip = ((f.tip || 0) % TIPS.length) + 1;
            say('덴구', TIPS[f.tip - 1]);
          }
        });
      }
    },
    granny: {
      name: '찻집 할멈', talk(s) {
        const f = s.flags;
        if (!f.metGranny) { f.metGranny = 1; say('찻집 할멈', ['갓 쓴 손님은 처음이네. 앉아.', '경단은 석 문. 어느 때 돈이든 받아. 송나라 돈이든 에이라쿠 돈이든 쇠는 쇠니까.']); }
        else say('찻집 할멈', '왔어.');
        G.ui.choice(['쉬어 간다', '먹을 것을 산다', '이야기를 듣는다', '그만둔다'], i => {
          if (i === 0) { say('찻집 할멈', '평상에 누워. 구름이 이불이야.'); G.ui.run(() => G.game.sleep()); }
          else if (i === 1) G.ui.shop('hub');
          else if (i === 2) {
            const st = ST.stage(s);
            const R = [
              ['저 덴구 영감은 교만한 놈만 보면 잡아다 제 밑에 둬. 손님은 아직 안 잡혀간 걸 보니 덜 교만한가 봐.'],
              ['힘센 놈은 헛손질 한 번에 숨이 차. 붙잡으러 올 때 비켜. 붉게 번쩍이면 막지 말고.', '바닷가 솔개도 조심해. 손에 든 주먹밥을 채 가.'],
              ['꾀 많은 놈은 가짜를 세워 놓고 진짜는 뒤에 숨어. 짚 냄새가 나는 쪽은 가짜야.', '산성 오르는 길에 통나무가 굴러. 소리가 나면 옆으로 붙어.'],
              ['늙은 고수는 먼저 치지 않아. 손님이 칠 때를 기다렸다가 받아쳐. 급한 쪽이 지는 거야.', '가시마 사슴은 건드리지 마. 못가의 갓파한테는 절을 해. 맞절을 하다 접시 물을 쏟거든.'],
              ['말 탄 놈은 지나간 다음이 틈이야. 말머리를 돌리는 사이.', '안개 속에서는 소리를 들어. 말굽 소리가 커지는 쪽이야.'],
              ['긴 칼 쓰는 놈은 한 걸음 물러나 닿지 않을 때가 있어. 그때는 멀리 닿는 비기를 써.', '두 자루 쓰는 놈은 한 자루로 막고 한 자루로 쳐. 쳐낸 다음에도 바로 들어가지 마.'],
              ['늙은 범은 이빨이 빠져도 범이야. 그래도 차 한 잔은 받아 마실걸.']
            ];
            f.rumor = ((f.rumor || 0) + 1) % R[Math.min(6, st)].length;
            say('찻집 할멈', R[Math.min(6, st)][f.rumor]);
          }
        });
      }
    }
  };
  ST.add('hub', {
    enter(s) { if (!s.flags.hubSeen) { s.flags.hubSeen = 1; me(['도리이를 지났다. 바다가 없다. 발아래가 구름이다.', '도리이가 일곱 줄지어 섰고, 찻집에서 김이 오른다.']); } }
  });
  ST.quest((s, add) => {
    const f = s.flags, st = ST.stage(s);
    if (!f.metFisher && st === 0) return;
    const T0 = ['동쪽 겐지 진영의 요시쓰네. 냇물의 다리를 건너야 한다.' + (f.benkei ? ' 다리는 지났다. 부두 끝 배 위에 있다.' : ''),
      f.tengu ? '고갯마루 둘째 도리이. 가마쿠라의 아사히나 요시히데.' : '언덕 위 돌 도리이를 깃털을 쥐고 지난다. 구라마의 덴구가 안다고 한다.',
      '셋째 도리이. 지하야 성의 구스노키 마사시게.', '넷째 도리이. 가시마의 쓰카하라 보쿠덴.', '다섯째 도리이. 가와나카지마의 우에스기 겐신.',
      '여섯째 도리이. 후나시마의 미야모토 무사시.', '일곱째 도리이. 레이간도의 늙은 무사시.', '겨룰 만한 이는 다 만났다. 길은 그대로 열려 있다.'];
    add('가장 센 자', T0[st], st >= 7);
  });

  // ======================= 단노우라 =======================
  Object.assign(G.NPCS, {
    fisher: {
      name: '어부 영감', talk(s) {
        const f = s.flags;
        if (!f.metFisher) {
          f.metFisher = 1;
          say('어부 영감', ['어디서 온 배요? 그 삿갓은 처음 보는 꼴인데.']);
          me('고려에서 왔다고 했다. 삿갓이 아니라 갓이라고도 했다.');
          say('어부 영감', ['고려. 멀리서 오셨구먼. 하필 오늘.', '어제 저 물목에서 겐지와 헤이케가 끝을 봤소. 헤이케가 졌지. 바다가 빨갰소. 깃발 때문에.', '이긴 쪽 대장? 동쪽 냇물 건너에 진을 쳤소. 구로 판관 요시쓰네. 배 여덟 척을 건너뛰었다던가.']);
          G.ui.run(() => G.ui.toast('할 일이 생겼다: 가장 센 자'));
          return;
        }
        if (!f.crabQ) {
          f.crabQ = 1; f.crabN = 0;
          say('어부 영감', ['모래톱에 게가 잔뜩 올라왔소. 등딱지에 성난 얼굴이 있는 놈들이오.', '물에 든 헤이케 무사들이라고들 하오. 그래서 이 바닥에서는 잡혀도 도로 놓아주지.', '성이 나서 덤비거든 한 대만 쥐어박고 보내 주시오. 다섯 마리쯤 보내면 저것들도 좀 가라앉겠지.']);
          return;
        }
        if (f.crabQ === 1) {
          if ((f.crabN || 0) >= 5) {
            say('어부 영감', ['모래톱이 조용해졌소. 고맙소.', '줄 건 밥뿐이오. 그리고 이건 그물에 걸려 올라온 돈이오. 임자가 물속에 있으니 손님이 쓰시오.']);
            G.ui.run(() => { f.crabQ = 2; G.game.give('rice', 3); G.game.earn(40); });
          } else say('어부 영감', (f.crabN || 0) ? '아직 ' + (5 - f.crabN) + '마리쯤 더 보내야겠소.' : (s.flags.crabKilled ? '얼굴 있는 게를 잡았소? ……뭐, 손님이 이 바닥 법을 알 리 없지. 다음엔 보내 주시오.' : '게는 한 대 맞으면 옆걸음으로 달아나오. 그걸 그냥 두면 되오.'));
          return;
        }
        say('어부 영감', G.game.isNight() ? '밤바다에 불이 뜨거든 못 본 척하시오. 저쪽도 그러기를 바라니.' : (f.yoshitsune ? '판관을 이겼다고? 허, 그 삿갓… 갓이 보통 갓이 아니었구먼.' : '판관은 부두 끝 배에 있을 거요. 다리에 큰 중이 하나 서 있다던데.'));
      }
    },
    ama: {
      name: '해녀', talk(s) {
        const f = s.flags;
        if (f.yoshitsune && !f.shell) {
          say('해녀', ['그 칼은 끝내 못 찾았어요. 대신 이게 걸려 올라왔어요.', '칼 찾는 사람 마음을 안다고 하셨으니, 가지세요.']);
          G.ui.run(() => { f.shell = 1; G.game.give('shell', 1); ST.grow(); });
          return;
        }
        if (!f.metAma) {
          f.metAma = 1;
          say('해녀', ['물에 든 것을 건지고 있어요. 어제부터 쉬지 못했어요.', '칼을 찾으라는 분부가 내렸어요. 임금님의 칼이래요. 어린 임금님과 같이 물에 들었대요.']);
          me('칼 잃은 사람 마음은 안다. 임금 잃은 마음은 모른다.');
          return;
        }
        if (!G.party.has('iso') && (f.crabQ === 2 || f.benkei)) {
          say('해녀', f.isoAsk ? '마음이 바뀌었어요? 나는 아직 그대로예요.' : ['또 왔네요. 갓 쓴 사람.', '숨이 닿는 데까지는 다 봤어요. 칼은 없어요.', '……물속에 없으면 물 밖 어딘가에 있겠죠. 데려가 줘요. 사람 많은 데를 돌다 보면 칼 소문 하나쯤은 들리겠죠.', '이소예요. 갯바위 이소. 숨은 길고 말은 짧아요.']);
          f.isoAsk = 1;
          G.ui.choice(['같이 가자고 한다', '아직은'], i => {
            if (i !== 0) { say('이소', '그럼 물에 좀 더 있을게요.'); return; }
            say('이소', ['빗창하고 망사리만 챙길게요.', '아, 그리고 갓은 물에 안 뜨더라도 괜찮아요. 내가 건져 줄게요.']);
            G.ui.run(() => G.party.join('iso'));
          });
          return;
        }
        say('해녀', f.shell ? '바다는 준 만큼 도로 가져가요. 가져간 만큼 도로 주고요.' : '숨이 닿는 데까지는 다 봤어요. 그 밑은 몰라요.');
      }
    },
    kid: {
      name: '아이', talk(s) {
        s.flags.kidN = (s.flags.kidN || 0) + 1;
        if (s.flags.kidN % 2) { say('아이', ['화살 주워. 한 대에 쌀 한 줌 쳐 줘.', '아저씨 칼은 왜 곧아? 여기 칼은 다 휘었는데.']); me('휜 칼도 써 봤다고 했다. 곧은 쪽이 거짓말을 덜 한다.'); }
        else say('아이', '저 숲엔 가지 마. 진 쪽 무사들이 숨어 있어. 배가 고파서 사나워.');
      }
    },
    monk: {
      name: '스님', talk() {
        if (G.game.isNight()) say('스님', ['저 불들은 길을 묻는 겁니다.', '저도 모른다고 해 두었습니다.']);
        else say('스님', ['나무아미타불.', '이긴 쪽도 진 쪽도, 물에 든 이는 다 같은 물에 들었습니다.', '밤에는 물가에 불이 떠다닙니다. 베어도 소용없으니 그냥 지나가시지요.']);
      }
    },
    genji1: {
      name: '겐지 무사', talk(s) {
        if (s.flags.yoshitsune) say('겐지 무사', '판관님이 지셨다고? 쉿. 가마쿠라까지 들리겠소.');
        else say('겐지 무사', ['벤케이 님을 지나왔다고? ……서 계시던가? 그럼 지신 거요.', '판관님은 부두 끝 배에 계시오.']);
      }
    },
    genji2: {
      name: '겐지 무사', talk() {
        say('겐지 무사', ['이겼는데 다들 얼굴이 어둡소.', '가마쿠라의 형님께서 판관님을 달가워하지 않으신다는 말이 돌아서.']);
      }
    }
  });

  ST.boss('benkei', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'stand') {
        f.benkeiN = (f.benkeiN || 0) + 1;
        if (f.benkeiN === 1) say('벤케이', '……');
        else if (f.benkeiN === 2) me('서 있다. 눈을 뜨고 있다. 숨은 쉰다.');
        else say('벤케이', '주군께 무례하면 다시 선다.');
        return;
      }
      ST.seen('benkei');
      if (!f.metBenkei) {
        f.metBenkei = 1;
        say('벤케이', ['멈춰라. 이 다리 너머는 주군의 진이다.', '칼 찬 자는 못 지난다. 칼을 두고 가라.']);
        me('칼은 두고 갈 수 없다고 했다.');
        say('벤케이', ['그럼 내가 받아 두지.', '교토 다리에서 구백아흔아홉 자루를 모았다. 천 자루째에 주군을 만나 그만두었지만, 손은 아직 기억한다.']);
      } else say('벤케이', '또 왔나. 칼을 두고 가든가, 뽑든가.');
      G.ui.choice(['칼을 뽑는다', '돌아선다'], i => {
        if (i === 0) G.ui.run(() => G.duel.start('benkei'));
        else G.ui.run(() => { G.p.x = Math.min(G.p.x, 74 * 16); });
      });
    },
    won(e, s) {
      e.st = 'stand'; e.dir = 'l';
      me(['벤케이는 서 있다. 나기나타를 짚고, 눈을 뜬 채로.', '쓰러지지 않았다. 그래도 승부는 났다.']);
      say('벤케이', ['……지나가라.', '나는 서 있는 것이 일이다. 주군 앞에서는 더 오래 서 있을 것이다.']);
      G.ui.run(() => { e.x = 77 * 16; e.y = 39 * 16 + 10; G.ui.toast('버티는 법을 보았다. 싸움에서 한 번은 쓰러지지 않고 버틴다.'); G.sfx('learn'); });
    }
  });
  ST.boss('yoshitsune', {
    talk(e, s) {
      const f = s.flags;
      if (e.st === 'friend') {
        f.yoshiN = ((f.yoshiN || 0) + 1) % 3;
        say('요시쓰네', [['덴구 영감께 안부 전해 주시오. 피리는 아직 분다고.'], ['나는 곧 교토로 올라가오. 형님 뜻이 어떻든.'], ['벤케이는 아직 서 있소? 저 사람은 설 줄밖에 모르오. 그래서 믿소.']][f.yoshiN]);
        return;
      }
      ST.seen('yoshitsune');
      if (!f.metYoshi) {
        f.metYoshi = 1;
        me('배 위에서 젊은 무사 하나가 피리를 불고 있다. 다 불고 나서야 돌아본다.');
        say('요시쓰네', ['벤케이가 사람을 들여보낸 것은 처음이오.', '고려에서 왔다고? 가장 센 자를 찾아서?', '나는 센 사람이 아니오. 빠른 사람이지. 어제도 적장이 달려들기에 옆 배로 뛰었소. 사람들은 여덟 척을 뛰었다고 하더군. 두 척이었소.', '그래도 좋다면 한 수.']);
      } else say('요시쓰네', '다시 오셨소. 한 수 더?');
      G.ui.choice(['청한다', '다음에'], i => { if (i === 0) G.ui.run(() => G.duel.start('yoshitsune')); });
    },
    won(e, s) {
      e.st = 'friend';
      say('요시쓰네', ['하하, 졌소! 칼이 목에 닿기 전에 멎는군. 고려에서는 다 그렇게 벱니까.']);
      me('아니라고 했다. 나만 그런다고.');
      say('요시쓰네', ['더 센 자를 찾는다면 나는 모르오. 내 스승이라면 알 거요.', '구라마 산의 덴구. 사람이 아니라서 때를 가리지 않소. 이 깃털을 쥐고 언덕 위 돌 도리이를 지나 보시오.', '아, 뛰는 법은 보셨으니 가져가시오. 숨길 것도 못 되오.']);
      G.ui.run(() => { G.game.give('feather', 1); s.flags.feather = 1; s.flags.gate0 = 1; ST.learn('leap'); ST.grow(); });
      say('요시쓰네', '형님께는 말하지 마시오. 내가 졌다는 것 말이오. 요즘 형님은 내 좋은 소식도 달가워하지 않으시니.');
      if (G.party.has('iso') && !s.flags.shell) {
        say('이소', ['……판관님 배 밑에서 이게 걸려 올라왔어요. 칼은 아니고요.', '칼 찾는 사람 마음을 안다고 했죠. 가져요.']);
        G.ui.run(() => { s.flags.shell = 1; G.game.give('shell', 1); ST.grow(); });
      }
    }
  });

  ST.add('dan', {
    enter(s) {
      const f = s.flags;
      if (f.benkei) G.duel.place('benkei', 77 * 16, 39 * 16 + 10, 'stand');
      else G.duel.place('benkei', 78 * 16 + 4, 41 * 16 + 6, 'wait');
      G.duel.place('yoshitsune', 97 * 16, 62 * 16 + 4, f.yoshitsune ? 'friend' : 'wait', { dir: 'l' });
    },
    tick(s) {
      const f = s.flags, p = G.p;
      if (!f.benkei) {
        const b = G.E.find('benkei');
        if (!G.duel.state && p.x > 77 * 16 - 2 && p.y < 52 * 16) p.x = 77 * 16 - 2;
        if (b && b.st === 'wait') ST.approach(b, 34, () => ST.talkBoss(b));
      } else if (!f.yoshitsune) {
        const y = G.E.find('yoshitsune');
        if (y && y.st === 'wait' && p.y > 59 * 16 + 8) ST.approach(y, 40, () => ST.talkBoss(y));
      }
    },
    spare(e, s) {
      if (e.kind === 'heike' && s.flags.crabQ === 1) {
        s.flags.crabN = (s.flags.crabN || 0) + 1;
        if (s.flags.crabN === 5) G.ui.toast('게 다섯 마리를 보냈다. 어부 영감에게 가자.');
      }
    },
    kill(e, s) { if (e.kind === 'heike') s.flags.crabKilled = 1; },
    use(pr, s) {
      if (pr.id !== 'myboat') return;
      const f = s.flags;
      if (f.potter === 1 && !f.soil) {
        me(['타고 온 배다. 밑창에 흙이 한 줌 깔려 있다. 떠나던 날 신에서 떨어진 고려의 흙이다.', '사백 년 뒤의 누군가가 이것을 아쉬워한다. 긁어 담았다.']);
        G.ui.run(() => { f.soil = 1; G.game.give('soil', 1); });
        return;
      }
      const lines = G.LOOKS.rowboat;
      me(lines[Math.min(f.look_myboat || 0, lines.length - 1)]);
      f.look_myboat = (f.look_myboat || 0) + 1;
    }
  });
  ST.quest((s, add) => {
    const f = s.flags;
    if (f.crabQ) add('얼굴 있는 게', f.crabQ === 2 ? '헤이케 게를 놓아주었다.' : '성난 헤이케 게를 한 대만 쥐어박고 보내 준다. (' + Math.min(5, f.crabN || 0) + '/5) 다 보내면 어부 영감에게.', f.crabQ === 2);
  });
})();
