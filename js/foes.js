'use strict';
// 싸움 상대. 차례마다 무엇을 할지 기색(tell)이 먼저 보인다.
// 수의 갈래 k: w 흰 수(쳐내거나 막는다) · r 붉은 수(비켜야 한다) · g 막기 · c 받아칠 자세 · e 닿지 않는 곳 · n 틈
(function () {
  const G = window.G;
  const pick = G.pick;
  // 지도(때)마다 잡것들의 세기가 다르다: [몸, 힘, 굳셈, 수련]
  G.FOEK = { dan: [1, 1, 1, 1], hub: [1, 1, 1, 1], kama: [1.9, 1.3, 1.4, 2.2], chi: [2.3, 1.55, 1.8, 3.4], kashi: [2.7, 1.8, 2, 4.6], kawa: [3.1, 2.1, 2.3, 6], funa: [3.8, 2.4, 2.6, 8], isle: [3.8, 2.4, 2.6, 8], rei: [4, 2.5, 2.7, 9], cave: [4, 2.5, 2.7, 9] };
  // 들에서 마주친 것 하나가 싸움에서는 몇이 되는가
  G.GROUPS = {
    heike: [['heike'], ['heike', 'heike'], ['heike', 'heike', 'heike']], crab: [['crab'], ['crab', 'crab'], ['crab', 'crab', 'crab']],
    dog: [['dog'], ['dog', 'dog']], wolf: [['wolf'], ['wolf', 'wolf']], boar: [['boar']], bat: [['bat', 'bat']],
    wisp: [['wisp'], ['wisp', 'wisp']], ghost: [['ghost'], ['ghost', 'wisp'], ['ghost', 'ghost']],
    ochi: [['ochi'], ['ochi'], ['ochi', 'ochi']], bandit: [['bandit'], ['bandit', 'bandit']], roto: [['roto'], ['roto', 'roto']],
    akuto: [['akuto'], ['akuto', 'akuto'], ['akuto', 'archer']], archer: [['archer', 'akuto'], ['archer', 'archer']],
    kappa: [['kappa']], ashiT: [['ashiT', 'ashiT'], ['ashiT', 'gunner'], ['ashiT']], ashiU: [['ashiU', 'ashiU'], ['ashiU']],
    gunner: [['gunner', 'ashiT'], ['gunner']], ronin: [['ronin'], ['ronin', 'ronin']], kabuki: [['kabuki'], ['kabuki', 'ronin']], makiwara: [['makiwara']]
  };

  const W = (id, name, tell, pow, o) => Object.assign({ id, name, tell, k: 'w', pow: pow || 1 }, o || {});
  const R = (id, name, tell, pow, o) => Object.assign({ id, name, tell, k: 'r', pow: pow || 1.3 }, o || {});
  const N = (id, name, tell, o) => Object.assign({ id, name, tell, k: 'n' }, o || {});
  const St = (k, id, name, tell, o) => Object.assign({ id, name, tell, k }, o || {});
  // 정해진 것이 없으면 수 가운데 하나를 고른다(같은 붉은 수를 잇달아 쓰지는 않는다)
  const any = (f, ids) => { let id = pick(ids), n = 0; while (id === f.last && n++ < 4) id = pick(ids); return id; };

  const F = G.FOES = {
    // ---------- 연습 ----------
    // 짚단 뒤에서 덴구가 막대를 든다. 맞아도 다치지 않는다.
    makiwara: {
      name: '짚단', img: 'makiwara', straw: 1, practice: 1, hp: 40, atk: 8, def: 0, spd: 1, exp: 0,
      moves: {
        w: W('w', '흰 수', '짚단 뒤에서 덴구가 막대를 든다. 흰빛이다. 쳐내 보아라'), r: R('r', '붉은 수', '덴구가 막대를 크게 치켜든다. 붉은빛이다. 비켜 보아라'),
        n: N('n', '틈', '덴구가 하품을 한다. 틈이다. 베어 보아라'), g: St('g', 'g', '막는 자세', '덴구가 짚단을 가린다. 베어도 덜 든다. 비기로 뚫어 보아라'),
        c: St('c', 'c', '받아칠 자세', '덴구가 막대를 내리고 기다린다. 베면 받아친다. 기다려 보아라')
      },
      ai: f => ['w', 'r', 'n', 'g', 'w', 'c', 'r', 'n'][(f.n = (f.n || 0) + 1) % 8]
    },
    // ---------- 짐승과 잡것 ----------
    heike: { name: '헤이케 게', spr: 'heike', hp: 12, atk: 6, def: 1, spd: 4, exp: 4, drop: ['crab', 0.6], moves: { pinch: W('pinch', '집게', '집게를 쳐든다'), sidle: N('sidle', '옆걸음', '옆으로 긴다') }, ai: f => Math.random() < 0.7 ? 'pinch' : 'sidle' },
    crab: { name: '게', spr: 'crab', hp: 12, atk: 6, def: 1, spd: 4, exp: 4, drop: ['crab', 0.6], moves: { pinch: W('pinch', '집게', '집게를 쳐든다'), sidle: N('sidle', '옆걸음', '옆으로 긴다') }, ai: f => Math.random() < 0.7 ? 'pinch' : 'sidle' },
    dog: { name: '들개', spr: 'dog', hp: 16, atk: 6, def: 1, spd: 9, exp: 6, moves: { bite: W('bite', '물기', '이를 드러낸다'), lunge: R('lunge', '덮치기', '몸을 낮춘다. 덮칠 모양이다', 1.3), growl: N('growl', '으르렁', '으르렁거리며 맴돈다') }, ai: f => any(f, ['bite', 'bite', 'lunge', 'growl']) },
    wolf: { name: '늑대', spr: 'wolf', hp: 22, atk: 8, def: 1, spd: 12, exp: 9, drop: ['pelt', 0.4], moves: { bite: W('bite', '물기', '이를 드러낸다'), lunge: R('lunge', '덮치기', '몸을 낮춘다. 목을 노린다', 1.4), circle: N('circle', '맴돌기', '거리를 두고 맴돈다') }, ai: f => any(f, ['bite', 'bite', 'lunge', 'circle']) },
    boar: {
      name: '멧돼지', spr: 'boar', hp: 34, atk: 11, def: 3, spd: 5, exp: 12, drop: ['meat', 0.7], big: 1,
      moves: { gore: W('gore', '들이받기', '엄니를 흔든다'), scrape: N('scrape', '땅 긁기', '앞발로 땅을 긁는다. 다음에 달려든다'), charge: R('charge', '돌진', '달려든다', 1.7, { after(B, f, hit) { if (!hit) f.next = 'daze'; } }), daze: N('daze', '어질', '헛달려서 어질어질하다') },
      ai: f => f.last === 'scrape' ? 'charge' : Math.random() < 0.45 ? 'scrape' : 'gore'
    },
    bat: { name: '박쥐', spr: 'bat', hp: 8, atk: 6, def: 0, spd: 13, exp: 4, fly: 1, moves: { swoop: W('swoop', '내리꽂기', '낮게 난다'), flap: St('e', 'flap', '날갯짓', '천장 쪽으로 올라간다') }, ai: f => Math.random() < 0.65 ? 'swoop' : 'flap' },
    wisp: { name: '도깨비불', spr: 'wisp', hp: 9, atk: 7, def: 0, spd: 8, exp: 5, fly: 1, ghost: 1, moves: { touch: R('touch', '닿기', '푸르게 부풀어 다가온다', 1.1), drift: N('drift', '떠돌기', '떠돈다') }, ai: f => Math.random() < 0.6 ? 'touch' : 'drift' },
    ghost: { name: '원령', f: 'ghost', wpn: 'tachi', hp: 22, atk: 8, def: 1, spd: 6, exp: 12, ghost: 1, moves: { slash: W('slash', '베기', '녹슨 칼을 든다'), wail: R('wail', '울부짖음', '입을 벌린다. 소리가 없다', 1.2), stare: N('stare', '바라보기', '바다 쪽을 본다') }, ai: f => any(f, ['slash', 'slash', 'wail', 'stare']) },
    kappa: {
      name: '갓파', spr: 'kappa', hp: 30, atk: 10, def: 2, spd: 9, exp: 14, bow: 1,
      moves: { slap: W('slap', '손바닥', '손바닥을 편다'), sumo: R('sumo', '씨름', '씨름 자세를 잡는다. 붙잡으러 온다', 1.4), dish: N('dish', '접시', '머리 접시의 물을 살핀다') },
      ai: f => any(f, ['slap', 'slap', 'sumo', 'dish'])
    },
    // ---------- 사람 ----------
    ochi: { name: '패잔병', f: 'ochi', wpn: 'tachi', human: 1, hp: 22, atk: 7, def: 2, spd: 6, post: 40, exp: 9, money: [2, 6], drop: ['blade', 0.35], moves: { slash: W('slash', '베기', '칼을 비스듬히 든다'), heavy: R('heavy', '내려치기', '칼을 머리 위로 치켜든다. 눈이 뒤집혔다', 1.4), pant: N('pant', '헐떡임', '어깨로 숨을 쉰다') }, ai: f => any(f, ['slash', 'slash', 'heavy', 'pant']) },
    bandit: { name: '도적', f: 'bandit', wpn: 'kal', human: 1, hp: 26, atk: 8, def: 2, spd: 8, post: 40, exp: 9, money: [4, 10], moves: { slash: W('slash', '베기', '칼을 고쳐 쥔다'), dirt: R('dirt', '흙 뿌리기', '왼손으로 흙을 한 줌 쥔다', 1.2), look: N('look', '눈치', '달아날 길을 살핀다') }, ai: f => any(f, ['slash', 'slash', 'dirt', 'look']) },
    roto: { name: '낭당', f: 'roto', wpn: 'tachi', human: 1, hp: 30, atk: 10, def: 2, spd: 8, post: 50, exp: 10, money: [5, 12], moves: { slash: W('slash', '베기', '한 발 내디딘다'), heavy: R('heavy', '내려치기', '칼을 크게 치켜든다', 1.4), block: St('g', 'block', '막기', '칼을 세워 가린다') }, ai: f => any(f, ['slash', 'slash', 'heavy', 'block']) },
    akuto: { name: '악당', f: 'akuto', wpn: 'stick', human: 1, hp: 26, atk: 9, def: 2, spd: 11, post: 40, exp: 9, money: [4, 9], moves: { stick: W('stick', '작대기', '작대기를 돌린다'), stone: R('stone', '돌팔매', '돌을 집어 든다', 1.2), hop: St('e', 'hop', '물러남', '비탈 위로 물러난다') }, ai: f => any(f, ['stick', 'stick', 'stone', 'hop']) },
    archer: {
      name: '궁병', f: 'archer', wpn: 'bow', human: 1, hp: 20, atk: 9, def: 1, spd: 9, post: 30, exp: 9, money: [3, 8],
      moves: { shoot: W('shoot', '쏘기', '시위를 당긴다', 1, { fx: 'shot' }), nock: N('nock', '메기기', '화살을 메긴다. 숨을 고른다'), snipe: R('snipe', '급소 쏘기', '숨을 멈춘다. 급소를 노린다', 1.7, { fx: 'shot' }) },
      ai: f => f.last === 'nock' ? 'snipe' : Math.random() < 0.3 ? 'nock' : 'shoot'
    },
    ashiT: { name: '다케다 아시가루', f: 'ashiT', wpn: 'yari', human: 1, hp: 30, atk: 10, def: 2, spd: 7, post: 50, exp: 10, money: [5, 12], moves: { thrust: W('thrust', '찌르기', '창끝을 낮춘다', 1, { fx: 'thrust' }), wall: St('g', 'wall', '창 세우기', '창을 세워 가린다'), rush: R('rush', '창 돌격', '창을 겨누고 달려든다', 1.4, { fx: 'thrust' }) }, ai: f => any(f, ['thrust', 'thrust', 'wall', 'rush']) },
    ashiU: { name: '우에스기 아시가루', f: 'ashiU', wpn: 'yari', human: 1, hp: 30, atk: 10, def: 2, spd: 7, post: 50, exp: 10, money: [5, 12], moves: { thrust: W('thrust', '찌르기', '창끝을 낮춘다', 1, { fx: 'thrust' }), wall: St('g', 'wall', '창 세우기', '창을 세워 가린다'), rush: R('rush', '창 돌격', '창을 겨누고 달려든다', 1.4, { fx: 'thrust' }) }, ai: f => any(f, ['thrust', 'thrust', 'wall', 'rush']) },
    gunner: {
      name: '철포 아시가루', f: 'gunner', wpn: 'gun', human: 1, hp: 22, atk: 11, def: 1, spd: 5, post: 30, exp: 11, money: [6, 14],
      moves: { light: N('light', '불 붙이기', '화승에 불을 붙인다. 타는 냄새가 난다'), fire: R('fire', '쏘기', '총구가 이쪽을 본다', 2.1, { fx: 'gun' }), load: N('load', '재기', '화약을 잰다') },
      ai: f => f.last === 'light' ? 'fire' : f.last === 'fire' ? 'load' : 'light'
    },
    ronin: { name: '낭인', f: 'ronin', wpn: 'tachi', human: 1, hp: 34, atk: 11, def: 2, spd: 9, post: 60, exp: 12, money: [8, 18], moves: { slash: W('slash', '베기', '칼자루에 손을 얹는다'), two: W('two', '이어 베기', '칼끝이 두 번 까딱인다', 1.3, { hits: 2 }), wait: St('c', 'wait', '기다림', '칼을 내리고 선다. 치기를 기다린다'), heavy: R('heavy', '내려치기', '칼을 크게 치켜든다', 1.4) }, ai: f => any(f, ['slash', 'two', 'wait', 'heavy']) },
    kabuki: { name: '가부키모노', f: 'kabuki', wpn: 'nodachi', human: 1, hp: 32, atk: 11, def: 2, spd: 8, post: 50, exp: 12, money: [10, 20], moves: { sweep: W('sweep', '휘두르기', '긴 칼을 옆으로 젖힌다', 1.2), boast: N('boast', '허세', '옷자락을 털며 떠든다'), heavy: R('heavy', '내려치기', '긴 칼을 머리 위로 든다', 1.5) }, ai: f => any(f, ['sweep', 'sweep', 'boast', 'heavy']) },

    // ---------- 맞수 ----------
    // 벤케이: 느리고 무겁다. 버틴다.
    benkei: {
      boss: 1, name: '벤케이', f: 'benkei', wpn: 'nagi', big: 1, hp: 150, atk: 12, def: 4, spd: 3, post: 100, exp: 60, intro: '벤케이가 나기나타를 고쳐 쥔다.',
      moves: {
        sweep: W('sweep', '휘두르기', '나기나타를 옆으로 길게 젖힌다', 1.1), thrust: W('thrust', '찌르기', '나기나타 끝이 이쪽을 겨눈다', 0.9, { fx: 'thrust' }),
        slam: R('slam', '내려찍기', '나기나타를 머리 위로 치켜든다. 땅이 울릴 것이다', 1.6), stand: St('g', 'stand', '버티기', '나기나타를 세워 짚고 버틴다'),
        mallet: W('mallet', '나무 메', '등짐에서 나무 메를 꺼내 든다. 던질 모양이다', 1.3, { fx: 'shot', reflect: 50 }),
        rush: R('rush', '어깨 밀기', '어깨를 낮추고 발을 구른다', 1.8, { after(B, f, hit) { if (!hit) f.next = 'pant'; } }), pant: N('pant', '숨 고르기', '헛디뎌서 숨을 몰아쉰다')
      },
      ai(f) { return f.phase === 2 ? any(f, ['mallet', 'rush', 'sweep', 'slam']) : any(f, ['sweep', 'thrust', 'slam', 'stand', 'sweep']); },
      onPhase: '벤케이가 등짐을 푼다. 일곱 가지 연장이 들어 있다.'
    },
    // 요시쓰네: 빠르다. 배에서 배로 건너뛴다.
    yoshitsune: {
      boss: 1, name: '요시쓰네', f: 'yoshitsune', wpn: 'tachi', hp: 125, atk: 14, def: 2, spd: 20, post: 80, exp: 100, intro: '요시쓰네가 피리를 허리에 꽂는다.',
      moves: {
        cut: W('cut', '베기', '한 발 내디딘다'), combo: W('combo', '연달아 베기', '칼끝이 잘게 떨린다. 연달아 올 모양이다', 1.3, { hits: 3 }),
        hop: St('e', 'hop', '건너뛰기', '옆 배로 훌쩍 건너뛴다. 닿지 않는다'), dive: R('dive', '내려 베기', '건너편 뱃전을 차고 몸을 날린다', 1.6, { fx: 'leap' }),
        land: N('land', '내려섬', '내려선 자리에서 숨을 고른다'), flurry: W('flurry', '다섯 칼', '칼이 다섯으로 보인다. 다 쳐낼 수는 없다', 1.7, { hits: 5, parry: 'first' })
      },
      ai(f) {
        if (f.last === 'hop') return 'dive';
        if (f.last === 'dive') return 'land';
        if (f.phase === 2) return any(f, ['hop', 'flurry', 'combo', 'hop']);
        return any(f, ['cut', 'combo', 'hop', 'cut']);
      },
      onPhase: '요시쓰네의 발이 더 빨라진다.'
    },
    // 아사히나: 붙잡으면 내던진다. 헛손질 뒤가 길다.
    asahina: {
      boss: 1, name: '아사히나', f: 'asahina', big: 1, hp: 300, atk: 19, def: 4, spd: 5, post: 120, exp: 240, intro: '아사히나가 손바닥에 침을 뱉는다.',
      moves: {
        punch: W('punch', '주먹', '주먹을 쥔다. 두 번 올 것이다', 1.2, { hits: 2 }),
        grab: R('grab', '붙잡기', '팔을 크게 벌린다. 붙잡으러 온다', 1.7, { stun: 1, after(B, f, hit) { if (!hit) f.next = 'pant'; } }),
        stomp: R('stomp', '발 구르기', '한 발을 높이 든다', 1.3), boulder: R('boulder', '바위 던지기', '바위를 머리 위로 든다', 1.5, { fx: 'shot' }),
        pant: N('pant', '숨 고르기', '헛손질에 숨이 찼다'),
        doorG: St('g', 'doorG', '문짝 가리기', '문짝 뒤로 몸을 가린다'), doorSwing: W('doorSwing', '문짝 휘두르기', '문짝을 옆으로 젖힌다', 1.5), doorSlam: R('doorSlam', '문짝 내려찍기', '문짝을 높이 든다', 1.8)
      },
      ai(f) { return f.phase === 2 ? any(f, ['doorSwing', 'doorSlam', 'doorG', 'grab']) : any(f, ['punch', 'grab', 'stomp', 'boulder', 'punch']); },
      onPhase: '아사히나가 세워 둔 문짝을 집어 든다. 내일 부술 문의 연습이라고 한다.', prop2: 'door'
    },
    // 구스노키: 잘 막고, 잘 속인다.
    kusunoki: {
      boss: 1, name: '마사시게', f: 'kusunoki', wpn: 'tachi', hp: 330, atk: 23, def: 6, spd: 9, post: 110, exp: 420, intro: '마사시게가 망루 쪽을 한 번 본다.',
      moves: {
        cut2: W('cut2', '두 번 베기', '칼을 비스듬히 든다', 1.2, { hits: 2 }), thrust: W('thrust', '찌르기', '칼끝이 곧게 온다', 1, { fx: 'thrust' }),
        guard: St('g', 'guard', '틈 없음', '칼을 세우고 틈을 주지 않는다'),
        smoke: N('smoke', '짚 인형', '연기가 인다. 짚 냄새가 난다', { act(B, f) { B.fakes(f, 2); } }),
        logs: R('logs', '통나무', '북을 친다. 위에서 통나무 구르는 소리가 난다', 1.5, { fx: 'log' }),
        arrows: W('arrows', '망루의 화살', '망루 쪽으로 손을 든다. 화살이 여럿 온다', 1.6, { hits: 4, parry: 'first', fx: 'shot' })
      },
      ai(f, B) {
        f.cd = (f.cd || 0) - 1;
        if (f.cd <= 0 && !B.hasFakes()) { f.cd = 3; return f.phase === 2 ? any(f, ['smoke', 'logs', 'arrows']) : any(f, ['smoke', 'logs']); }
        return any(f, ['cut2', 'thrust', 'guard', 'cut2']);
      },
      onPhase: '마사시게가 망루 쪽으로 손을 든다.'
    },
    deshi1: { boss: 1, name: '첫째 문하생', f: 'deshi', wpn: 'bokken', hp: 150, atk: 23, def: 6, spd: 8, post: 50, exp: 130, intro: '문하생이 목검을 가운데로 겨눈다.', moves: { cut: W('cut', '베기', '목검을 치켜든다'), thrust: W('thrust', '찌르기', '목검 끝이 곧게 온다', 1, { fx: 'thrust' }), block: St('g', 'block', '막기', '목검을 세워 가린다'), wild: R('wild', '마구 치기', '이를 악문다. 마구 칠 모양이다', 1.4) }, ai: f => any(f, ['cut', 'thrust', 'block', 'wild']) },
    deshi2: { boss: 1, name: '둘째 문하생', f: 'deshi2', wpn: 'bokken', hp: 180, atk: 25, def: 7, spd: 10, post: 60, exp: 150, intro: '문하생이 한 발을 뒤로 뺀다.', moves: { cut: W('cut', '베기', '목검을 치켜든다'), two: W('two', '이어 베기', '목검 끝이 두 번 까딱인다', 1.3, { hits: 2 }), block: St('g', 'block', '막기', '목검을 세워 가린다'), wait: St('c', 'wait', '기다림', '목검을 내리고 기다린다'), wild: R('wild', '몸 부딪기', '어깨를 낮춘다', 1.4) }, ai: f => any(f, ['cut', 'two', 'block', 'wait', 'wild']) },
    deshi3: { boss: 1, name: '맏제자', f: 'deshi3', wpn: 'bokken', hp: 220, atk: 27, def: 8, spd: 12, post: 70, exp: 180, intro: '맏제자가 숨을 고른다.', moves: { cut: W('cut', '베기', '어깨가 먼저 움직인다'), three: W('three', '세 번 베기', '목검이 셋으로 보인다', 1.5, { hits: 3 }), wait: St('c', 'wait', '기다림', '목검을 내리고 기다린다. 스승을 닮았다'), feint: R('feint', '속임', '목검 끝이 한 번 멈칫한다. 반 박자 늦다', 1.3, { show: 'w' }) }, ai: f => any(f, ['cut', 'three', 'wait', 'feint']) },
    // 보쿠덴: 먼저 치지 않는다.
    bokuden: {
      boss: 1, name: '보쿠덴', f: 'bokuden', wpn: 'tachi', hp: 380, atk: 29, def: 9, spd: 12, post: 100, exp: 650, intro: '보쿠덴은 칼을 뽑지 않고 서 있다.',
      moves: {
        wait: St('c', 'wait', '기다림', '칼을 내리고 선다. 먼저 치지 않는다'), kesa: W('kesa', '비껴 베기', '어깨가 먼저 움직인다', 1.1), tsuki: W('tsuki', '찌르기', '칼끝이 곧게 온다', 1, { fx: 'thrust' }),
        feint: R('feint', '속임', '칼끝이 한 번 멈칫한다. 반 박자 늦다', 1.3, { show: 'w' }),
        focus: N('focus', '숨 고르기', '칼을 도로 꽂고 숨을 고른다. 다음에 한 칼이 온다'), hitotsu: W('hitotsu', '일지태도', '한 칼이 온다. 쳐내지 못하면 크게 다친다', 2.7, { reflect: 45 })
      },
      ai(f) {
        if (f.last === 'focus') return 'hitotsu';
        f.cd = (f.cd || 3) - 1;
        if (f.cd <= 0) { f.cd = f.phase === 2 ? 3 : 4; return 'focus'; }
        if (f.last !== 'wait' && Math.random() < 0.55) return 'wait';
        return f.phase === 2 ? any(f, ['kesa', 'tsuki', 'feint']) : any(f, ['kesa', 'tsuki']);
      },
      onPhase: '보쿠덴의 숨이 고요해진다.'
    },
    // 겐신: 말을 타고 온다.
    kenshin: {
      boss: 1, name: '겐신', f: 'kenshinH', f2: 'kenshin', wpn: 'tachi', big: 1, hp: 520, atk: 33, def: 10, spd: 14, post: 110, exp: 950, intro: '말이 앞발을 든다. 안개가 갈라진다.',
      moves: {
        circle: St('e', 'circle', '수레걸이', '안개 속을 돈다. 말굽 소리만 들린다'), charge: R('charge', '말 달려 베기', '말머리가 이쪽을 향한다. 온다', 1.7, { fx: 'leap' }), turn: N('turn', '말머리 돌리기', '말머리를 돌린다. 틈이다'),
        three: W('three', '세 번 내리치기', '칼을 높이 든다. 세 번 내리칠 것이다', 1.6, { hits: 3 }), tsuki: W('tsuki', '찌르기', '칼끝이 곧게 온다', 1, { fx: 'thrust' }),
        kuruma: R('kuruma', '수레바퀴', '수레바퀴처럼 돌기 시작한다', 1.5), guard: St('g', 'guard', '틈 없음', '칼을 세운다')
      },
      ai(f) {
        if (f.mounted) return f.last === 'circle' ? 'charge' : f.last === 'charge' ? 'turn' : 'circle';
        return any(f, ['three', 'tsuki', 'kuruma', 'guard', 'three']);
      },
      init(f) { f.mounted = true; },
      // 자세가 무너지거나 절반쯤 깎이면 말에서 내린다
      onBreak(B, f) { if (f.mounted) { f.mounted = false; f.sprKey = 'kenshin'; f.big = 0; B.say('겐신이 말에서 내린다.'); } },
      onPhase(B, f) { if (f.mounted) { f.mounted = false; f.sprKey = 'kenshin'; f.big = 0; return '겐신이 말에서 내린다.'; } return '겐신의 칼끝이 낮아진다.'; }
    },
    // 고지로: 칼이 길어 늘 먼저 닿는다.
    kojiro: {
      boss: 1, name: '고지로', f: 'kojiro', wpn: 'longbok', hp: 480, atk: 35, def: 11, spd: 40, post: 100, exp: 950, intro: '고지로가 긴 목검을 어깨에 걸친다.',
      moves: {
        reach: W('reach', '멀리 찌르기', '긴 칼끝이 멀리서 온다', 1, { fx: 'thrust' }), sweep: W('sweep', '크게 휘두르기', '긴 칼을 옆으로 젖힌다', 1.2),
        tsubame: W('tsubame', '쓰바메가에시', '칼을 높이 든다. 내려왔다가 되돌아올 것이다', 1.7, { hits: 2, parry: 'first' }),
        tsubame3: W('tsubame3', '쓰바메가에시', '칼을 높이 든다. 두 번 되돌아올 것이다', 2.1, { hits: 3, parry: 'first' }),
        step: St('e', 'step', '거리 벌리기', '한 걸음 물러나 거리를 벌린다. 닿지 않는다')
      },
      ai(f) { return any(f, f.phase === 2 ? ['reach', 'sweep', 'tsubame3', 'step', 'tsubame3'] : ['reach', 'sweep', 'tsubame', 'step']); },
      onPhase: '고지로의 긴 칼이 한 번 더 되돌아온다.'
    },
    // 무사시: 잘 보고, 속이고, 뛰어올라 내리친다.
    musashi: {
      boss: 1, name: '무사시', f: 'musashi', wpn: 'oar', hp: 680, atk: 38, def: 12, spd: 15, post: 120, exp: 1600, intro: '무사시가 노를 한 손으로 든다.',
      moves: {
        watch: St('c', 'watch', '지켜봄', '노를 내리고 이쪽을 본다'), smash: W('smash', '내려치기', '노를 머리 위로 든다', 1.2), combo: W('combo', '세 번 치기', '노 끝이 세 번 까딱인다', 1.5, { hits: 3 }),
        feint: R('feint', '속임', '든 노가 한 번 멈칫한다. 반 박자 늦다', 1.4, { show: 'w' }), shove: R('shove', '밀치고 치기', '어깨를 낮춘다. 밀치고 내리칠 것이다', 1.5),
        leap: R('leap', '뛰어 내리치기', '모래를 차고 뛰어오른다', 1.8, { fx: 'leap' }), twin: W('twin', '두 자루', '왼손의 짧은 목검이 먼저 움직인다. 다 쳐낼 수는 없다', 1.9, { hits: 5, parry: 'first' })
      },
      ai(f) { return any(f, f.phase === 2 ? ['twin', 'watch', 'feint', 'leap', 'combo', 'twin'] : ['smash', 'watch', 'combo', 'feint', 'shove', 'leap']); },
      onPhase: '무사시가 왼손에 짧은 목검을 뽑아 든다.', wpn2: 'short'
    },
    // 늙은 무사시: 빈 자세. 치면 지고, 기다리면 그가 물러선다.
    musashiOld: {
      boss: 1, name: '무사시', f: 'musashiOld', wpn: 'bokken', wpn2: 'short', hp: 560, atk: 42, def: 13, spd: 12, post: 100, exp: 2200, intro: '무사시가 두 자루를 느슨하게 든다.',
      moves: {
        empty: St('c', 'empty', '빈 자세', '두 자루를 다 내리고 선다. 빈틈투성이다', { void: 1 }), smash: W('smash', '내려치기', '오른손 목검이 올라간다', 1.1),
        twin: W('twin', '두 자루', '두 자루가 번갈아 움직인다', 1.4, { hits: 3 }), tsuki: W('tsuki', '찌르기', '목검 끝이 곧게 온다', 1, { fx: 'thrust' }), wait: St('c', 'wait', '기다림', '목검을 내리고 기다린다')
      },
      ai(f) { f.cd = (f.cd || 2) - 1; if (f.cd <= 0) { f.cd = 3; return 'empty'; } return any(f, ['smash', 'twin', 'tsuki', 'wait']); },
      onPhase: '무사시가 웃는다. 처음이다.'
    }
  };
  // 싸움에서 쓰는 비기. pow 세기, post 자세 깎기
  G.ARTS = {
    iai: { name: '발도', cost: 1, pow: 1.8, post: 30, heavy: 1, desc: '칼을 꽂았다 뽑으며 벤다. 막아도 뚫고, 받아칠 자세도 가른다.' },
    leap: { name: '팔척뛰기', cost: 1, pow: 1.4, post: 15, air: 1, far: 1, desc: '몸을 날려 벤다. 이번 차례에는 무엇에도 맞지 않는다. 멀리 있는 것에도 닿는다.' },
    decoy: { name: '허수', cost: 1, desc: '짚 인형을 세운다. 두 차례 동안 한 사람을 노린 수는 인형이 대신 맞는다.' },
    hitotsu: { name: '일지태도', cost: 3, pow: 3.3, post: 50, heavy: 1, desc: '숨 한 번 고르고 한 번 벤다. 자세가 무너진 맞수에게는 더 깊이 든다.' },
    wheel: { name: '수레걸이', cost: 2, pow: 1.25, post: 20, heavy: 1, all: 1, desc: '수레바퀴처럼 돌며 벤다. 앞의 것을 모두 벤다. 가짜도 쓸어 낸다.' },
    swallow: { name: '제비 돌리기', cost: 2, pow: 1.0, post: 18, hits: 2, far: 1, sure: 1, desc: '내려 벤 칼이 되돌아 올라온다. 두 번 벤다. 물러난 것에도 닿는다.' }
  };
  G.ART_ORDER = ['iai', 'leap', 'decoy', 'hitotsu', 'wheel', 'swallow'];
})();
