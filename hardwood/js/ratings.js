// 능력치 모델: 데이터 빌더(Node)와 게임(브라우저)이 함께 쓴다.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};

  // 내부 값은 1~99, 화면에는 FM처럼 1~20으로 보여 준다.
  const ATTRS = [
    ['ins', '골밑 마무리', 'off'], ['mid', '중거리 슛', 'off'], ['tp', '3점 슛', 'off'], ['ft', '자유투', 'off'],
    ['pss', '패스', 'off'], ['hdl', '볼 핸들링', 'off'], ['orb', '공격 리바운드', 'off'],
    ['pdef', '외곽 수비', 'def'], ['idef', '골밑 수비', 'def'], ['stl', '스틸', 'def'], ['blk', '블록', 'def'], ['drb', '수비 리바운드', 'def'],
    ['iq', '농구 IQ', 'men'], ['cmp', '침착성', 'men'], ['ldr', '리더십', 'men'], ['wrk', '성실성', 'men'],
    ['spd', '스피드', 'phy'], ['ath', '운동 능력', 'phy'], ['str', '근력', 'phy'], ['sta', '지구력', 'phy'],
  ];
  const KEYS = ATTRS.map(a => a[0]);
  const LABEL = Object.fromEntries(ATTRS.map(a => [a[0], a[1]]));
  const GROUPS = [['off', '공격'], ['def', '수비'], ['men', '정신'], ['phy', '신체']];

  // 공격·수비 종합치의 가중치. 득점 기술은 슛 분포(성향)에 맞춰 섞는다.
  const OW = { score: .36, pss: .13, hdl: .11, iq: .12, orb: .07, ft: .05, ath: .08, spd: .04, str: .04 };
  const DW = { pdef: .22, idef: .22, stl: .10, blk: .10, drb: .14, iq: .08, ath: .06, spd: .04, str: .04 };
  const O_SCALE = 0.30, D_SCALE = 0.16, CENTER = 55;
  // 실제 기록에 맞출 때 움직이는 능력치(나머지는 실제 비율 기록을 그대로 따른다)
  const O_SHIFT = ['ins', 'mid', 'tp', 'hdl', 'iq'];
  const D_SHIFT = ['pdef', 'idef'];

  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  function scoring(a, t) {
    const r3 = t.r3, rim = t.rim;
    return (1 - r3) * (rim * a.ins + (1 - rim) * a.mid) + r3 * a.tp;
  }
  function oComp(a, t) {
    return OW.score * scoring(a, t) + OW.pss * a.pss + OW.hdl * a.hdl + OW.iq * a.iq + OW.orb * a.orb +
      OW.ft * a.ft + OW.ath * a.ath + OW.spd * a.spd + OW.str * a.str;
  }
  function dComp(a) {
    return DW.pdef * a.pdef + DW.idef * a.idef + DW.stl * a.stl + DW.blk * a.blk + DW.drb * a.drb +
      DW.iq * a.iq + DW.ath * a.ath + DW.spd * a.spd + DW.str * a.str;
  }
  // 100포제션당 득실 기여(BPM과 같은 눈금)
  function obpm(a, t) { return (oComp(a, t) - CENTER) * O_SCALE; }
  function dbpm(a) { return (dComp(a) - CENTER) * D_SCALE; }
  function bpmToOvr(b) {
    const o = b < 6 ? 74 + 2.4 * b : 88.4 + 1.9 * (b - 6);
    return clamp(o, 25, 99);
  }
  function ovrToBpm(o) {
    return o < 88.4 ? (o - 74) / 2.4 : 6 + (o - 88.4) / 1.9;
  }
  function ovr(a, t) { return bpmToOvr(obpm(a, t) + dbpm(a)); }

  // 공격/수비 목표치(BPM)에 맞게 능력치를 옮긴다. 몇 번 되풀이해 끝값 잘림을 메운다.
  function fitTo(a, t, oTarget, dTarget) {
    for (let it = 0; it < 4; it++) {
      const dO = oTarget - obpm(a, t);
      if (Math.abs(dO) > 0.05) {
        const step = dO / O_SCALE / (OW.score + OW.hdl + OW.iq);
        for (const k of O_SHIFT) a[k] = clamp(a[k] + step, 1, 99);
      }
      const dD = dTarget - dbpm(a);
      if (Math.abs(dD) > 0.05) {
        const step = dD / D_SCALE / (DW.pdef + DW.idef);
        for (const k of D_SHIFT) a[k] = clamp(a[k] + step, 1, 99);
      }
    }
    return a;
  }

  // 모든 능력치를 함께 올리고 내린다(성장/노쇠). 신체는 따로 다룬다.
  const SKILL = ['ins', 'mid', 'tp', 'pss', 'hdl', 'orb', 'pdef', 'idef', 'stl', 'blk', 'drb', 'iq'];

  const disp = v => clamp(Math.round(v / 5), 1, 20);
  function attrClass(v20) {
    return v20 >= 17 ? 'a5' : v20 >= 14 ? 'a4' : v20 >= 11 ? 'a3' : v20 >= 7 ? 'a2' : 'a1';
  }

  // 압축된 능력치 문자열(두 자리씩) ↔ 객체
  function decode(str) {
    const a = {};
    for (let i = 0; i < KEYS.length; i++) a[KEYS[i]] = +str.substr(i * 2, 2) || 1;
    return a;
  }
  function encode(a) {
    return KEYS.map(k => String(clamp(Math.round(a[k]), 1, 99)).padStart(2, '0')).join('');
  }

  const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const POS_KO = { PG: '포인트가드', SG: '슈팅가드', SF: '스몰포워드', PF: '파워포워드', C: '센터' };

  HM.Ratings = {
    ATTRS, KEYS, LABEL, GROUPS, OW, DW, O_SHIFT, D_SHIFT, SKILL, POS, POS_KO,
    scoring, oComp, dComp, obpm, dbpm, ovr, bpmToOvr, ovrToBpm, fitTo, disp, attrClass, decode, encode, clamp,
  };
})();
