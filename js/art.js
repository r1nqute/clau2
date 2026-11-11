'use strict';
// 그림 하나. 사람·짐승은 글자 격자로 한 점씩 찍었다. 칼과 칼자국은 fx.js에서 코드로 긋는다.
(function () {
  const G = window.G;
  const PAL = {
    k: '#1b1a1f', K: '#33303a', g: '#5a5c63', G: '#8e8f8c', w: '#e8e2d0', W: '#f6f1e3',
    s: '#e0b088', S: '#b97f5e', h: '#2a211e',
    r: '#a63c2e', R: '#cf6a3d', d: '#7a2a24',
    y: '#cfa64a', Y: '#e6cc78',
    b: '#6b4a32', B: '#46301f', t: '#93714a', T: '#b99a6b',
    n: '#3f5a3a', N: '#5f7d42', l: '#8fa253', L: '#b8b56a',
    u: '#2f4a66', U: '#47708c', c: '#7fa9b0', C: '#b9d2cc',
    p: '#5b3d5c', P: '#8a5a7a', i: '#314b5a', I: '#4c6f7f',
    v: '#c8452f', V: '#e2714a', f: '#c9788f', F: '#e9b4c0',
    e: '#9aa3a8', E: '#dfe6e8', m: '#232a3a', M: '#3a4660',
    o: '#e0672a', O: '#f09a4a', z: '#4a3d32'
  };
  G.PAL = PAL;

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function mk(rows, over) {
    let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    const c = cv(w, rows.length), x = c.getContext('2d');
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        const col = (over && over[ch]) || PAL[ch];
        if (!col) continue;
        x.fillStyle = col; x.fillRect(i, j, 1, 1);
      }
    }
    return c;
  }
  function flip(src) {
    const c = cv(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    if (src.ax !== undefined) c.ax = src.width - src.ax;
    return c;
  }
  function shiftY(src, dy) {
    const c = cv(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, dy);
    return c;
  }
  // 한 가지 빛깔로 칠한 그림자본. 맞았을 때 번쩍, 잔상, 원령에 쓴다.
  const tints = new Map();
  function tint(src, color) {
    let m = tints.get(src);
    if (!m) tints.set(src, m = {});
    let c = m[color];
    if (c) return c;
    c = cv(src.width, src.height);
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    m[color] = c;
    return c;
  }
  const white = src => tint(src, '#f6f1e3');

  // ================= 주인공: 갓 쓰고 흰 도포 입은 고려 검객 =================
  const GAT = [
    '......kkkk......',
    '.....kKKKKk.....',
    '.....kKgKKk.....',
    '.kkkkkKKKKkkkkk.',
    'kKKKgKKKKKKKKKKk',
    '.kkkkkkkkkkkkkk.'
  ];
  const P_DOWN = GAT.concat([
    '...khsssssshk...',
    '...kskssssksk...',
    '...kssssssssk...',
    '....kshhhhsk....',
    '...kkwwwgwwkk...',
    '..kwwwwgwwwwwk..',
    '..kswwgwwwwwsk..',
    '..kkUUuUUUUUkk..',
    '...kwwwwGwwwk...'
  ]);
  const P_UP = GAT.concat([
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '....khhhhhhk....',
    '.....kssssk.....',
    '...kkwwwwwwkk...',
    '..kwwwwwwwwwwk..',
    '..kswwwwwwwwsk..',
    '..kkUUUUUuUUkk..',
    '...kwwwwwUwwk...'
  ]);
  const P_SIDE = GAT.concat([
    '....khhssssk....',
    '....khsssksk....',
    '....khssssssk...',
    '.....kssshhk....',
    '....kkwwwwkk....',
    '...kwwwwwwwk....',
    '...kwwwwswwk....',
    '...kkUUUUUkk....',
    '....kwwwGwk.....'
  ]);
  const LEGS_F = ['...kwwwkkwwwk...', '...kKKk..kKKk...', '....kk....kk....'];
  const LEGS_F2 = ['...kwwwkkwwwk...', '...kKKk..kkk....', '....kk..........'];
  const LEGS_F3 = ['...kwwwkkwwwk...', '....kkk..kKKk...', '..........kk....'];
  const LEGS_S = ['....kwwkwwk.....', '....kKKkKKk.....', '.....kk.kk......'];
  const LEGS_S2 = ['...kwwwkkwwk....', '..kKKk...kKKk...', '...kk.....kk....'];
  // 앉은 꼴(쉴 때, 먹을 갈 때)
  const P_SIT = GAT.concat([
    '...khsssssshk...',
    '...kskssssksk...',
    '...kssssssssk...',
    '....kshhhhsk....',
    '...kkwwwgwwkk...',
    '..kwwwwgwwwwwk..',
    '.kswwwgwwwwwwsk.',
    '.kkwwUUuUUUwwkk.',
    'kwwwwwwwwwwwwwwk',
    'kwwwGwwwwwwGwwwk',
    '.kkkkkkkkkkkkkk.'
  ]);

  // ================= 사람들 =================
  // 머리 10줄 + 몸 8줄. 2 윗옷, 3 윗옷 그늘·갑옷 끈, 4 아랫도리, 5 띠, 6 턱, 7 아랫도리 그늘
  const HEAD = {
    mage: [
      '................',
      '.......kk.......',
      '......khhk......',
      '.....kkhhkk.....',
      '....khhhhhhk....',
      '...khhsssshhk...',
      '...khsssssshk...',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    hachi: [
      '................',
      '.......kk.......',
      '......khhk......',
      '.....kkhhkk.....',
      '....khhhhhhk....',
      '...kwwwwwwwwk...',
      '...khsssssshk...',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    eboshi: [
      '.......kkk......',
      '......kKKKk.....',
      '.....kKKKKk.....',
      '.....kKKKKKk....',
      '....kKKKKKKk....',
      '...kkkkkkkkkk...',
      '...khsssssshk...',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    jingasa: [
      '................',
      '......kkkk......',
      '....kkKKKKkk....',
      '..kkKKKyyKKKkk..',
      '.kKKKKKKKKKKKKk.',
      '.kkkkkkkkkkkkkk.',
      '..kkhsssssshkk..',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    kasa: [
      '......kkkk......',
      '.....kYYYYk.....',
      '....kYYYYYYk....',
      '..kkyYYYYYYykk..',
      '.kYYYYYYYYYYYYk.',
      '.kyyyyyyyyyyyyk.',
      '..kkhsssssshkk..',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    kabuto: [
      '...k........k...',
      '...yk..kk..ky...',
      '....yk.kk.ky....',
      '....kykKKkyk....',
      '....kKKKKKKk....',
      '...kKKgKKKKKk...',
      '..kKkkkkkkkkKk..',
      '..kKskssssksKk..',
      '..kKssssssssKk..',
      '...kkss66sskk...'
    ],
    cowl: [
      '................',
      '.....kkkkkk.....',
      '....kwwwwwwk....',
      '...kwwwwwwwwk...',
      '...kwwGwwwwwk...',
      '..kwwkkkkkkwwk..',
      '..kwwsksskswwk..',
      '..kwwwsssswwwk..',
      '..kwwwwwwwwwwk..',
      '...kwwwwwwwwk...'
    ],
    hood: [
      '................',
      '.....kkkkkk.....',
      '....kwwwwwwk....',
      '...kwwwwwwwwk...',
      '..kwwwGwwwwwwk..',
      '..kwwkkkkkkwwk..',
      '..kwksssssskwk..',
      '..kwksksskskwk..',
      '..kwwksssskwwk..',
      '...kwwkkkkwwk...'
    ],
    bald: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....kssssssk....',
      '...kssssssssk...',
      '...kssssssssk...',
      '...kssssssssk...',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kssSSssk....'
    ],
    woman: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khhhhhhhhk...',
      '...khhsssshhk...',
      '...kskssssksk...',
      '..khkssssssskhk.',
      '..khhkssSSskhhk.'
    ],
    old: [
      '................',
      '.......kk.......',
      '......kwwk......',
      '.....kkwwkk.....',
      '....kwwwwwwk....',
      '...kwwsssswwk...',
      '...kwsssssswk...',
      '...kskssssksk...',
      '...kswwwwwwsk...',
      '....kwwwwwwk....'
    ],
    pony: [
      '................',
      '.........kkk....',
      '.....kkkkhhhk...',
      '....khhhhhhkhk..',
      '...khhhhhhhkkhk.',
      '...khhsssshhkhk.',
      '...khsssssshkk..',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ],
    yoshi: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk.k..',
      '...khhhhhhhhkhk.',
      '...kwwwwwwwwkhk.',
      '...khhsssshhkhk.',
      '...khsssssshkk..',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kssSSssk....'
    ],
    wild: [
      '................',
      '....k.kkkk.k....',
      '...khkhhhhkhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kwwwwwwwwwwk..',
      '..khhsssssshhk..',
      '...kskssssksk...',
      '...kssssssssk...',
      '....kss66ssk....'
    ]
  };
  const BODY = {
    kimono: [
      '...kk222222kk...',
      '..k2223223222k..',
      '..ks22322322sk..',
      '..kk55555555kk..',
      '...k44444444k...',
      '...k447kk744k...',
      '...kyyk..kyyk...',
      '....kk....kk....'
    ],
    armor: [
      '..kkk222222kkk..',
      '.k22k333333k22k.',
      '.k22k222222k22k.',
      '..ksk333333ksk..',
      '...k22322322k...',
      '...k22k22k22k...',
      '...k44k..k44k...',
      '....kk....kk....'
    ],
    robe: [
      '...kk222222kk...',
      '..k2225222222k..',
      '..ks22252222sk..',
      '...k22225222k...',
      '...k22222522k...',
      '...k22222222k...',
      '...k23222232k...',
      '...kkkkkkkkkk...'
    ],
    woman: [
      '...kk222222kk...',
      '..k2222552222k..',
      '..ks22255222sk..',
      '...k44444444k...',
      '..k4444444444k..',
      '..k4447444744k..',
      '.k444744447444k.',
      '.kkkkkkkkkkkkkk.'
    ],
    bare: [
      '...kksssssskk...',
      '..kssssssssssk..',
      '..ksssSssSsssk..',
      '..kk55555555kk..',
      '...k44444444k...',
      '...k444kk444k...',
      '...kssk..kssk...',
      '....kk....kk....'
    ]
  };
  // 걸을 때 바뀌는 아래 두 줄
  const STEP = {
    kimono: ['...kyyk..kkk....', '....kk..........'],
    armor: ['...k44k..kkk....', '....kk..........'],
    bare: ['...kssk..kkk....', '....kk..........']
  };
  const CHILD = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khsssssshk...',
    '...kskssssksk...',
    '...kssssssssk...',
    '....kssssssk....',
    '....k222222k....',
    '...ks222222sk...',
    '....k222222k....',
    '....k44kk44k....',
    '....kyykkyyk....',
    '.....kk..kk.....'
  ];
  function colors(c) {
    const P = k => PAL[k] || k;
    const over = {
      '2': P(c.top), '3': P(c.shade || c.top), '4': P(c.bot), '5': P(c.acc || 'r'),
      '6': P(c.chin || 'S'), '7': P(c.bshade || c.bot)
    };
    if (c.hair) over.h = P(c.hair);
    if (c.hat) { over.K = P(c.hat); over.g = P(c.hat2 || c.hat); }
    if (c.crest) over.y = P(c.crest);
    if (c.wrap) { over.w = P(c.wrap); over.G = P(c.wrap2 || c.wrap); }
    if (c.skin) { over.s = P(c.skin); over.S = P(c.skin2 || c.skin); }
    return over;
  }
  function person(head, body, c) {
    return mk(HEAD[head].concat(BODY[body]), colors(c));
  }
  // 걷는 두 장, 좌우
  function walker(head, body, c) {
    const over = colors(c);
    const rows = HEAD[head].concat(BODY[body]);
    const A = mk(rows, over);
    let B;
    if (STEP[body]) B = mk(rows.slice(0, rows.length - 2).concat(STEP[body]), over);
    else B = shiftY(A, 1);
    return { r: [A, B], l: [flip(A), flip(B)] };
  }

  // ================= 짐승과 잡것 =================
  const CRAB = [
    '..kk........kk..',
    '.kRRk......kRRk.',
    '.kRk..kkkk..kRk.',
    '..kRkkRRRRkkRk..',
    '...kRRkRRkRRk...',
    '..kRRRRRRRRRRk..',
    '..kRrRRRRRRrRk..',
    '...krrRRRRrrk...',
    '..kkkrrrrrrkkk..'
  ];
  // 헤이케 게. 등딱지에 성난 얼굴이 있다.
  const HEIKE = [
    '..kk........kk..',
    '.kddk......kddk.',
    '.kdk..kkkk..kdk.',
    '..kdkkrrrrkkdk..',
    '...krkkrrkkrk...',
    '..krrwkrrkwrrk..',
    '..krrrrkkrrrrk..',
    '...krkkkkkkrk...',
    '..kkkrrddrrkkk..'
  ];
  const CRAB_L1 = ['.kRkkRkkkkRkkRk.', '.kk.kk....kk.kk.'];
  const CRAB_L2 = ['..kRkkRkkRkkRk..', '..kk.kk..kk.kk..'];

  const BOAR = [
    '......kkkkkkkkk',
    '....kkBBBBBBBBBkkk',
    '...kBBBbbBBBBBBBBBkk',
    '..kBBbbbbBBBBBBBBBBBk',
    '..kBBbbBBBBBBBBBBkBBBk',
    '.kkBBBBBBBBBBBBBBBBBBBkk',
    '.kBBBBBBBBBBBBBBBBBBwBSk',
    '..kBBBBBBBBBBBBBBBBBwkk',
    '..kBBBBBBBBBBBBBBBBkk'
  ];
  const BOAR_L1 = ['..kBBkkBBBBBBkBBBkk', '..kBk.kBk...kBkBk', '..kBk.kBk...kBkBk', '..kkk.kkk...kkkkk'];
  const BOAR_L2 = ['..kBBkkBBBBBBkBBBkk', '.kBk..kBk..kBk.kBk', '.kkk..kBk..kkk.kBk', '......kkk......kkk'];

  const DOG = [
    '..............k..k',
    '.............kTkkTk',
    'kk...........kTTTTTk',
    'kTk.........kTTkTTTkk',
    '.kTkkkkkkkkkkTTTTTTTk',
    '.kTTTTTTTTTTTTTTTkkk',
    '..kTTTTTTTTTTTTTTk',
    '..kTTtTTTTTTTtTTk',
    '..kTTkkkkkkkTTTk'
  ];
  const DOG_L1 = ['..kTk.kTk..kTkTk', '..kTk.kTk..kTkTk', '..kkk.kkk..kkkkk'];
  const DOG_L2 = ['.kTk..kTk.kTk.kTk', '.kkk..kTk.kkk.kTk', '......kkk.....kkk'];

  const DEER = [
    '...............k.k',
    '..............kTkTk',
    '.k............kTTTk',
    'kwk..........kTTkTTk',
    '.kTkkkkkkkkkkkTTTTTk',
    '.kTTTwTTTwTTTTTTkkk',
    '..kTTTTwTTTwTTTTk',
    '..kTTwTTTTTTTTTk',
    '..kTTkkkkkkkkTTk'
  ];
  const DEER_L1 = ['..kTk.kTk...kTkTk', '..kTk.kTk...kTkTk', '..kBk.kBk...kBkBk', '..kkk.kkk...kkkkk'];
  const DEER_L2 = ['.kTk..kTk..kTk.kTk', '.kTk..kTk..kTk.kTk', '.kBk..kBk..kBk.kBk', '.kkk..kkk..kkk.kkk'];

  const BAT1 = [
    'kk............kk',
    'kpk...k..k...kpk',
    'kppk.kkkkkk.kppk',
    'kpppkkprrpkkpppk',
    '.kppppppppppppk.',
    '..kkpkkppkkpkk..',
    '.....kkkkkk.....'
  ];
  const BAT2 = [
    '......k..k......',
    '.....kkkkkk.....',
    '..kkkkprrpkkkk..',
    '.kppppppppppppk.',
    'kpppkkppppkkpppk',
    'kppk..kkkk..kppk',
    'kkk..........kkk'
  ];
  // 솔개. 주먹밥을 노린다.
  const KITE1 = [
    'kk...........kk',
    'kBk....k....kBk',
    'kBBkk.kTk.kkBBk',
    '.kBBBkkTkkBBBk.',
    '..kkBBBTBBBkk..',
    '....kkBTBkk....',
    '......kTk......',
    '......kkk......'
  ];
  const KITE2 = [
    '...............',
    '.......k.......',
    '..kkk.kTk.kkk..',
    'kkBBBkkTkkBBBkk',
    'kBBkBBBTBBBkBBk',
    'kk..kkBTBkk..kk',
    '......kTk......',
    '......kkk......'
  ];

  const WISP = [
    '.....U',
    '....UcU',
    '....UcCU',
    '...UcCCU',
    '..UcCCCcU',
    '.UcCCWCCcU',
    '.UcCWWWCcU',
    'UcCCWWWCCcU',
    'UcCCWWWCCcU',
    'UcCCCWCCCcU',
    '.UcCCCCCcU',
    '..UcccccU',
    '...UUUUU'
  ];

  const KAPPA = [
    '.....kkkkkk.....',
    '....kCCcCCCk....',
    '...kNkkkkkkNk...',
    '...kNNNNNNNNk...',
    '...kNkNNNNkNk...',
    '...kNNyYYyNNk...',
    '....kNNyyNNk....',
    '...kkNNNNNNkk...',
    '..kNNkLLLLkNNk..',
    '..kNNkLLLLkNNk..',
    '..kkNkLLLLkNkk..',
    '...kNNkkkkNNk...',
    '...kNNk..kNNk...',
    '...kkk....kkk...'
  ];

  // 말. 오른쪽을 본다.
  const HORSE = [
    '......................kk......',
    '.....................kTTk.k...',
    '....................kBTTkkTk..',
    '...................kBTTTTTTk..',
    '..................kBBTTTTkTTk.',
    '..kk.............kBBTTTTTTTTTk',
    '.kBBk...........kBBTTTTTTkkTTk',
    'kBBkkkkkkkkkkkkkkBTTTTTTk..kkk',
    'kBkTTTTTTTTTTTTTTTTTTTTTk.....',
    'kBkTTTTTTTTTTTTTTTTTTTTk......',
    '.kkTTTTTTTTTTTTTTTTTTTTk......',
    '..kTTTTTTTTTTTTTTTTTTTk.......',
    '..kTTTtTTTTTTTTTTtTTTTk.......',
    '..kTTTTkkkkkkkkkkTTTTk........'
  ];
  const HORSE_L1 = [
    '..kTTk.kTk.....kTk.kTTk.......',
    '..kTk..kTk.....kTk..kTk.......',
    '..kTk..kTk.....kTk..kTk.......',
    '..kBk..kBk.....kBk..kBk.......',
    '..kkk..kkk.....kkk..kkk.......'
  ];
  const HORSE_L2 = [
    '.kTTk...kTk...kTk...kTTk......',
    'kTTk.....kTk.kTk.....kTTk.....',
    'kTk......kTkkTk.......kTk.....',
    'kBk......kBkkBk.......kBk.....',
    'kkk......kkkkkk.......kkk.....'
  ];

  // ================= 맞수들 가운데 몸집이 다른 이들 =================
  // 벤케이. 흰 두건, 검은 옷, 큰 염주.
  const BENKEI = [
    '........kkkkkkkk........',
    '.......kwwwwwwwwk.......',
    '......kwwwwwwwwwwk......',
    '.....kwwwwwwwwwwwwk.....',
    '.....kwwGwwwwwwwwwk.....',
    '....kwwwkkkkkkkkwwwk....',
    '....kwwksksssskskwwk....',
    '....kwwksssSSssskwwk....',
    '.....kwwkshhhhskwwk.....',
    '......kwwwkkkkwwwk......',
    '....kkkwwwwwwwwwwkkk....',
    '...kKKKkwwwwwwwwkKKKk...',
    '..kKKKKyKKKKKKKKyKKKKk..',
    '..kKKKKKyKKKKKKyKKKKKk..',
    '..ksKKKKKyyKKyyKKKKKsk..',
    '..kkKKKKKKKyyKKKKKKKkk..',
    '...kKKKnnnnnnnnnnKKKk...',
    '...kKKKNnNnNnNnNnKKKk...',
    '...kKKKnnnnnnnnnnKKKk...',
    '...kKKwwwwwwwwwwwwKKk...',
    '...kKKKKKKKKKKKKKKKKk...',
    '...kKKKKKKKgKKKKKKKKk...',
    '...kKKKKKKKgKKKKKKKKk...',
    '....kKKKKKKkkKKKKKKk....',
    '....kwwwwwk..kwwwwwk....',
    '....kwwwwwk..kwwwwwk....',
    '...kkbbbbbk..kbbbbbkk...',
    '...kkkkkkkk..kkkkkkkk...'
  ];
  // 아사히나. 맨팔, 붉은 머리띠, 새끼 띠.
  const ASAHINA = [
    '.........kkkkkkkk.........',
    '........khhhhhhhhk........',
    '.......khhhhhhhhhhk.......',
    '......khhhhhhhhhhhhk......',
    '......kRRRRRRRRRRRRk......',
    '......khsssssssssshk......',
    '......ksskksssskkssk......',
    '......ksssssSSsssssk......',
    '.......ksskkkkkkssk.......',
    '........kkssssssskk.......',
    '....kkkkkuussssuukkkkk....',
    '...ksssskuuussuuukssssk...',
    '..kssssskuuuuuuuuksssssk..',
    '..ksssSskuuuuuuuuksSsssk..',
    '..kssssskuuuuuuuuksssssk..',
    '..ksssskkyyYyyYyykkssssk..',
    '..ksssskkiiiiiiiikkssssk..',
    '...ksskkiiiiiiiiiikkssk...',
    '....kkkiiiiiiiiiiiikkk....',
    '......kiiiiiIiiIiiiik.....',
    '......kiiiiiiiiiiiik......',
    '......kiiiiikkiiiiik......',
    '......kiiiik..kiiiik......',
    '......kiiiik..kiiiik......',
    '.....kkssssk..ksssskk.....',
    '.....kkkkkkk..kkkkkkk.....'
  ];
  // 구라마의 덴구. 코가 길다.
  const TENGU = [
    '....kk........kk....',
    '...kKKk.kkkk.kKKk...',
    '..kKKKkkwwwwkkKKKk..',
    '..kKKKkwwkkwwkKKKk..',
    '.kKKKKkRRRRRRkKKKKk.',
    '.kKKKKkRkRRkRkkkkk..',
    '.kKKKKkRRRRRRRRRRk..',
    '.kKKKkwRRRRRRkkkkk..',
    '..kKKkwwRRRRwwkKKk..',
    '..kKkkwwwwwwwwkkKk..',
    '...kkkkwwwwwwkkkk...',
    '..kkwwwwwwwwwwwwkk..',
    '.kwwwwOwwwwwwOwwwwk.',
    '.kwwwwOwwwwwwOwwwwk.',
    '.kswwwwOwwwwOwwwwsk.',
    '.kkwwwwwOwwOwwwwwkk.',
    '..kwwwwwwOOwwwwwwk..',
    '..kKKKKKKKKKKKKKKk..',
    '..kwwwwwwwwwwwwwwk..',
    '..kwwwwwwkkwwwwwwk..',
    '...kwwwwk..kwwwwk...',
    '...kwwwwk..kwwwwk...',
    '...kkbbkk..kkbbkk...',
    '....kbbk....kbbk....',
    '....kkkk....kkkk....'
  ];

  // ================= 놓인 것들 =================
  // 지장. 붉은 턱받이를 둘렀다. 여기서 기록한다.
  const JIZO = [
    '....kkkkkk',
    '...kGGGGGGk',
    '..kGGGGGGGGk',
    '..kGgGGGGgGk',
    '..kGGGGGGGGk',
    '..kGGgggGGGk',
    '...kGGGGGGk',
    '..kkrrrrrrkk',
    '.kGrrRrrRrrGk',
    '.kGGrrrrrrGGk',
    '.kGGGrrrrGGGk',
    '.kGgGGGGGGgGk',
    '.kGgGGGGGGgGk',
    '.kGGGGGGGGGGk',
    '.kGGGGggGGGGk',
    '..kGGGGGGGGk',
    '.kkggggggggkk',
    'kggGGGGGGGGggk',
    'kkkkkkkkkkkkkk'
  ];
  // 석등
  const TORO = [
    '.....kk',
    '....kGGk',
    '..kkkkkkkk',
    '.kGGGGGGGGk',
    'kkkkkkkkkkkk',
    '..kGkYYkGk',
    '..kGkYYkGk',
    '..kkkkkkkk',
    '.kkGGGGGGkk',
    '...kkGGkk',
    '....kGGk',
    '....kGgk',
    '....kGGk',
    '....kGgk',
    '...kkGGkk',
    '..kGGGGGGk',
    '.kkkkkkkkkk'
  ];
  // 고마이누(돌사자)
  const KOMA = [
    '..kkkk.....',
    '.kGGGGkk...',
    'kGkGGGGGk..',
    'kGGGGgGGk..',
    '.kkGGGGGkk.',
    '..kGGGGGGGk',
    '..kGgGGGgGk',
    '..kGgGGGgGk',
    '..kGGkkkGGk',
    '.kkkkkkkkkk',
    '.kggggggggk',
    '.kkkkkkkkkk'
  ];
  const SIGN = [
    '.kkkkkkkkkkkkk',
    'kTTTTTTTTTTTTTk',
    'kTkkTkkkTkkTTTk',
    'kTTTTTTTTTTTTTk',
    'kTkkkTkkTTkkTTk',
    'kTTTTTTTTTTTTTk',
    '.kkkkkkbkkkkkk',
    '......kbk',
    '......kbk',
    '......kbk',
    '......kbk',
    '.....kkbkk'
  ];
  const CHEST = [
    '.kkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbbk',
    'kbTTTTTTTTTTTTbk',
    'kbbbbbbbbbbbbbbk',
    'kkkkkkkYYkkkkkkk',
    'kbbbbbkYYkbbbbbk',
    'kbTTTTbkkbTTTTbk',
    'kbTTTTTTTTTTTTbk',
    'kbTTTTTTTTTTTTbk',
    'kbbbbbbbbbbbbbbk',
    '.kkkkkkkkkkkkkk.'
  ];
  const CHEST_OPEN = [
    '.kkkkkkkkkkkkkk.',
    'kBBBBBBBBBBBBBBk',
    'kBkkkkkkkkkkkkBk',
    'kBkkkkkkkkkkkkBk',
    'kkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbk',
    'kbTTTTTTTTTTTTbk',
    'kbTTTTTTTTTTTTbk',
    'kbTTTTTTTTTTTTbk',
    'kbbbbbbbbbbbbbbk',
    '.kkkkkkkkkkkkkk.'
  ];
  const FIRE = [
    '................',
    '.......R........',
    '......RR........',
    '......RYR.......',
    '.....RYYR..R....',
    '.....RYYRR.R....',
    '....RRYWYR......',
    '....RYYWYYR.....',
    '....RYWWWYR.....',
    '...kRYWWWYRk....',
    '..kbkRYYYRkbk...',
    '.kbbbkkRkkbbbk..',
    '.kBbbbbkbbbbBk..',
    '..kkBBbbbBBkk...',
    '....kkkkkkk.....'
  ];
  // 허수아비. 삿갓을 썼다.
  const KAKASHI = [
    '.....kkkkkk',
    '....kyYYYYyk',
    '...kkyyyyyykk',
    '..kYYYYYYYYYYk',
    '...kkTTTTTTkk',
    '....kTkTTkTk',
    '....kTTTTTTk',
    '.....kTrrTk',
    'kkkkkkiiiikkkkkk',
    'kbbbkiiiiiikbbbk',
    'kkkkkiiIiiikkkkk',
    '....kiiiIiik',
    '....kiIiiiik',
    '....kiiiiIik',
    '.....kyiiyk',
    '....kyykkyyk',
    '.....k.bb.k',
    '.......bb',
    '.......bb',
    '.......bb',
    '.......bb',
    '......kbbk'
  ];
  // 짚 인형 병사. 멀리서 보면 사람이다.
  const DUMMY = [
    '....kkkkkk',
    '...kKKKKKKk',
    '..kkKKyyKKkk',
    '.kKKKKKKKKKKk',
    '..kkYYYYYYkk',
    '...kYkYYkYk',
    '...kYYYYYYk',
    '.kkkkYYYYkkkk',
    'kyyykKKKKkyyyk',
    'kkkkkKnKnKkkkk',
    '...kKKKKKKk',
    '...kKnKnKnk',
    '...kkYYYYkk',
    '....kYyYYk',
    '....kYYyYk',
    '....kyyyyk',
    '.....kbbk',
    '.....kbbk',
    '....kkbbkk'
  ];
  // 짚단 과녁
  const MAKIWARA = [
    '...kkkkkk',
    '..kYYyYYYk',
    '..kYyYYyYk',
    '..kkkkkkkk',
    '..kYYYyYYk',
    '..kyYYYYyk',
    '..kYYyYYYk',
    '..kkkkkkkk',
    '..kYyYYyYk',
    '..kYYYyYYk',
    '..kkkkkkkk',
    '....kbbk',
    '....kbbk',
    '....kbbk',
    '...kkbbkk'
  ];
  const JAR = [
    '...kkkkkk',
    '..kBBBBBBk',
    '...kkkkkk',
    '..kBBbBBBk',
    '.kBBbbBBBBk',
    'kBBbbBBBBBBk',
    'kBBbBBBBBBBk',
    'kBBBBBBBBBBk',
    'kBBBBBBBBBBk',
    '.kBBBBBBBBk',
    '.kBBBBBBBBk',
    '..kBBBBBBk',
    '...kkkkkk'
  ];
  // 술통
  const TARU = [
    '..kkkkkkkk',
    '.kTTTTTTTTk',
    'kTTtTTTTtTTk',
    'kyyyyyyyyyyk',
    'kTtTTwwTTtTk',
    'kTtTwkkwTtTk',
    'kTtTwkkwTtTk',
    'kTtTTwwTTtTk',
    'kyyyyyyyyyyk',
    'kTTtTTTTtTTk',
    '.kkkkkkkkkk'
  ];
  // 섬(가마니)
  const BALE = [
    '..kkkkkkkkkk',
    '.kYYyYYYYyYYk',
    'kYkyYYkkYYykYk',
    'kYkYYYkkYYYkYk',
    'kYkyYYkkYYykYk',
    '.kYYyYYYYyYYk',
    '..kkkkkkkkkk'
  ];
  const HAY = [
    '.........kk',
    '........kYYk',
    '.......kYyYYk',
    '......kYYyYYYk',
    '.....kYyYYYyYYk',
    '.....kYYYyYYYYk',
    '....kYYyYYYYyYYk',
    '....kYyYYYyYYYYk',
    '...kYYYYyYYYYyYYk',
    '...kYyYYYYYyYYYYk',
    '..kYYYyYYyYYYYyYYk',
    '..kYyYYYYYYYyYYYYk',
    '.kyYYYyYYyYYYYYyYyk',
    '.kyyYYYYYYYyYYYYyyk',
    '.kyyyYYyYYYYYyYyyyk',
    '..kkyyyyyyyyyyyykk',
    '....kkkkkkkkkkkk'
  ];
  const REED = [
    '...C.....C...C..',
    '..CLC...CLC.CLC.',
    '..CLC...CLC.CLC.',
    '...L..C..L...L..',
    '...L.CLC.L...L..',
    '...y.CLC.y..Ly..',
    '...y..L..y..y...',
    '..ly..L.ly..y...',
    '..ly..y.ly.ly...',
    '..ly..y.ly.ly...',
    '..ly.ly.ly.ly...',
    '.llyllyllyllyl..'
  ];
  // 억새
  const SUSUKI = [
    '..W......W....W.',
    '.WW.....WW...WW.',
    '.Ww..W..Ww...Ww.',
    '..w.WW...w....w.',
    '..L.Ww...L...wL.',
    '..L..w...L...L..',
    '..L..L..LL...L..',
    '.LL..L..Ly..LL..',
    '.Ly.LL..Ly..Ly..',
    '.Ly.Ly.LLy.LLy..',
    '.LyLLy.LyL.LyL..',
    'LLyLyLLLyLLLyLL.'
  ];
  const STUMP = [
    '..kkkkkkkk',
    '.kTTTTTTTTk',
    'kTTtTTTtTTTk',
    'kTtTTtTTTtTk',
    'kbTTTTTTTTbk',
    'kbbbbbbbbbbk',
    'kBbbBbbbBbbk',
    '.kkBbbBbbkk',
    '...kkkkkk'
  ];
  const PERSIMMON = [
    '...kNk...',
    '..kkNkk..',
    '.kRRRRRk.',
    'kRRYRRRRk',
    'kRYRRRRRk',
    'kRRRRRRrk',
    'kRRRRRrrk',
    '.krRRrrk.',
    '..kkkkk..'
  ];
  const COIN = [
    '.kkkkk.',
    'kYYYYyk',
    'kYkkkyk',
    'kYkKkyk',
    'kYkkkyk',
    'kyyyyyk',
    '.kkkkk.'
  ];
  const POUCH = [
    '...kk....',
    '..kwwk...',
    '.kkiikk..',
    'kIIIIIIk.',
    'kIIiIIIk.',
    'kIIIIiIk.',
    '.kiiiik..',
    '..kkkk...'
  ];
  // 방패(다테). 화살이 꽂혀 있다.
  const TATE = [
    '....k....k',
    '...kTk..kwk',
    'kkkkbkkkkbkkk',
    'kTTTbTTTTbTTk',
    'kTtTbTTtTbTTk',
    'kTTTTTTTTTTTk',
    'kkkkkkkkkkkkk',
    'kTTtTTTTTTtTk',
    'kTTTTTtTTTTTk',
    'kTtTTTTTTTTTk',
    'kTTTTTTTtTTTk',
    'kkkkkkkkkkkkk',
    'kTTTtTTTTTTTk',
    'kTTTTTTTTtTTk',
    'kkkkkkkkkkkkk'
  ];
  // 땅에 박힌 화살
  const ARROWS = [
    'w....w',
    'kw...kw..w',
    '.k....k.wk',
    '.k....k..k',
    '..k...k..k',
    '..k....k.k',
    '..k....k.k'
  ];
  // 큰북
  const TAIKO = [
    '...kkkkkkkk',
    '..kbbbbbbbbk',
    '.kbwwwwwwwwbk',
    '.kbwwwwWwwwbk',
    '.kbwwWvWWwwbk',
    '.kbwwwWWwwwbk',
    '.kbwwwwwwwwbk',
    '..kbbbbbbbbk',
    '..kkkkkkkkkk',
    '..kbk....kbk',
    '.kbk......kbk',
    '.kkk......kkk'
  ];
  // 붉은 모전 깐 평상
  const BENCH = [
    'kkkkkkkkkkkkkkkkkkkk',
    'kvvvvvvvvvvvvvvvvvvk',
    'kvVvvvvvvvvvvvvvVvvk',
    'krrrrrrrrrrrrrrrrrrk',
    'kkkkkkkkkkkkkkkkkkkk',
    '.kbk............kbk',
    '.kbk............kbk',
    '.kkk............kkk'
  ];
  // 책상과 두루마리(굴 안)
  const DESK = [
    '.....kk.........',
    '....kYYk....kk..',
    '....kRYk...kwwk.',
    '.kkkkkkkkkkkwwkk',
    'kbbbwwwwwwbbkkbbk',
    'kbbbwkkwkwbbbbbbk',
    'kkkkkkkkkkkkkkkkk',
    '.kbk.........kbk',
    '.kkk.........kkk'
  ];
  // 목검 걸이
  const RACK = [
    'kk..........kk',
    'kbkkkkkkkkkkbk',
    'kbkTTTTTTTTkbk',
    'kbkkkkkkkkkkbk',
    'kbkTTTTTTTTkbk',
    'kbkkkkkkkkkkbk',
    'kbkTTTTTTTTkbk',
    'kbkkkkkkkkkkbk',
    'kbk........kbk',
    'kkk........kkk'
  ];
  // 수레
  const CART = [
    '....kkkkkkkkkkkkkk',
    '...kYYyYYYYyYYYYYk',
    '..kYYYYYyYYYYYyYYk',
    'kkkkkkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbbbbbk',
    'kkkkkkkkkkkkkkkkkkkk',
    '..kkkk.......kkkk',
    '.kbkkbk.....kbkkbk',
    '.kkbbkk.....kkbbkk',
    '.kbkkbk.....kbkkbk',
    '..kkkk.......kkkk'
  ];
  // 그물 말리는 덕
  const NETS = [
    'k..............k',
    'bkkkkkkkkkkkkkkb',
    'bGkGkGkGkGkGkGkb',
    'bkGkGkGkGkGkGkGb',
    'bGkGkGkGkGkGkGkb',
    'bkGkGkGkGkGkGkGb',
    'b.kGkGkGkGkGkG.b',
    'b..............b',
    'b..............b',
    'k..............k'
  ];
  // 물 위에 뜬 깃발
  const FLOATR = ['.kkkkkkkk...', 'krrrRrrrrkk.', 'krRrrrrRrrrk', '.kkrrrrrrkk.', '...kkkkkk...'];
  // 그릇 말리는 판
  const POTS = [
    '..kk...kk...kk..',
    '.kwwk.kTTk.kwwk.',
    '.kwck.kTtk.kwuk.',
    '.kkkk.kkkk.kkkk.',
    'kbbbbbbbbbbbbbbk',
    'kkkkkkkkkkkkkkkk',
    '.kk..........kk.'
  ];
  // 요석. 금줄을 쳤다.
  const KANAME = [
    'k.k........k.k',
    'kbkkkkkkkkkkbk',
    'kbwkwkwwkwkwbk',
    'kbk........kbk',
    'kbk.kkkkkk.kbk',
    'kbkkGGGGGGkkbk',
    'kbkGGgGGGGGkbk',
    'kkkkkkkkkkkkkk'
  ];
  // 경단
  const DANGO = ['....k', '...kFk', '..kkkk', '..kwwk', '.kkkk', '.kLLk', 'kkkk', 'kbk'];

  // 바깥(art2.js)에서 이어 쓴다
  G.art = { cv, mk, flip, shiftY, tint, white, person, walker, PAL };
  G.art.grids = {
    GAT, P_DOWN, P_UP, P_SIDE, P_SIT, LEGS_F, LEGS_F2, LEGS_F3, LEGS_S, LEGS_S2, HEAD, BODY, CHILD,
    CRAB, HEIKE, CRAB_L1, CRAB_L2, BOAR, BOAR_L1, BOAR_L2, DOG, DOG_L1, DOG_L2, DEER, DEER_L1, DEER_L2,
    BAT1, BAT2, KITE1, KITE2, WISP, KAPPA, HORSE, HORSE_L1, HORSE_L2, BENKEI, ASAHINA, TENGU,
    JIZO, TORO, KOMA, SIGN, CHEST, CHEST_OPEN, FIRE, KAKASHI, DUMMY, MAKIWARA, JAR, TARU, BALE, HAY, REED, SUSUKI, STUMP,
    PERSIMMON, COIN, POUCH, TATE, ARROWS, TAIKO, BENCH, DESK, RACK, CART, NETS, FLOATR, POTS, KANAME, DANGO
  };
})();
