// 연봉·샐러리캡. 금액 단위는 천 달러.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const U = HM.U;

  // 실제 샐러리캡(1984-85 도입 이전은 당시 평균 연봉으로 맞춘 가상 캡)
  const CAP = {
    1978: 1900, 1979: 2100, 1980: 2300, 1981: 2600, 1982: 2900, 1983: 3200, 1984: 3400, 1985: 3600, 1986: 4233, 1987: 4945,
    1988: 6164, 1989: 7232, 1990: 9802, 1991: 11871, 1992: 12500, 1993: 14000, 1994: 15175, 1995: 15964, 1996: 23000, 1997: 24363,
    1998: 26900, 1999: 30000, 2000: 34000, 2001: 35500, 2002: 42500, 2003: 40271, 2004: 43840, 2005: 43870, 2006: 49500, 2007: 53135,
    2008: 55630, 2009: 58680, 2010: 57700, 2011: 58044, 2012: 58044, 2013: 58044, 2014: 58679, 2015: 63065, 2016: 70000, 2017: 94143,
    2018: 99093, 2019: 101869, 2020: 109140, 2021: 109140, 2022: 112414, 2023: 123655, 2024: 136021, 2025: 140588, 2026: 154647, 2027: 165000,
  };
  function cap(y) {
    if (CAP[y]) return CAP[y];
    if (y < 1978) return CAP[1978];
    return Math.round(CAP[2027] * Math.pow(1.05, y - 2027));
  }
  const minSal = y => Math.round(cap(y) * 0.0125 / 5) * 5;
  const taxLine = y => y >= 2002 ? Math.round(cap(y) * 1.215) : Infinity;
  const mle = y => y >= 1999 ? Math.round(cap(y) * 0.09) : Math.round(cap(y) * 0.04);
  function maxSal(y, yrs) {
    const share = yrs >= 10 ? 0.35 : yrs >= 7 ? 0.30 : 0.25;
    return Math.round(cap(y) * share);
  }

  // OVR → 캡 대비 몸값
  const TABLE = [[58, 0.0125], [64, 0.0125], [67, 0.02], [70, 0.033], [72, 0.045], [74, 0.07], [76, 0.11], [78, 0.15], [80, 0.19], [83, 0.26], [86, 0.30], [89, 0.34], [93, 0.35], [99, 0.36]];
  function shareFor(ovr) {
    if (ovr <= TABLE[0][0]) return TABLE[0][1];
    for (let i = 1; i < TABLE.length; i++) {
      if (ovr <= TABLE[i][0]) {
        const [x0, y0] = TABLE[i - 1], [x1, y1] = TABLE[i];
        return y0 + (y1 - y0) * (ovr - x0) / (x1 - x0);
      }
    }
    return 0.36;
  }
  // 시장 가치(연봉 요구액)
  function marketValue(p, y, age) {
    let v = p.ovr;
    if (age <= 24) v += Math.max(0, (p.pa - p.ovr)) * 0.35;
    else if (age >= 31) v -= (age - 30) * 1.2;
    let amt = cap(y) * shareFor(v);
    const yrs = p.yearsPro || 0;
    amt = Math.min(amt, maxSal(y, yrs));
    return Math.max(minSal(y), Math.round(amt / 10) * 10);
  }
  // 신인 계약(지명 순위)
  function rookieScale(pick, y) {
    if (pick > 30) return minSal(y);
    return Math.max(minSal(y), Math.round(cap(y) * (0.055 * Math.pow(0.93, pick - 1) + 0.008) / 10) * 10);
  }

  function payroll(G, tid, season) {
    let s = 0;
    const y = season ?? G.season;
    for (const pid in G.players) {
      const p = G.players[pid];
      if (p.tid === tid && p.contract && p.contract.exp >= y) s += p.contract.amt;
    }
    for (const d of G.dead || []) if (d.tid === tid && d.exp >= y) s += d.amt;
    return s;
  }
  function deadMoney(G, tid, y) {
    let s = 0;
    for (const d of G.dead || []) if (d.tid === tid && d.exp >= y) s += d.amt;
    return s;
  }

  // 트레이드 연봉 맞춤: 캡을 넘는 팀은 받는 연봉이 보내는 연봉의 125%+10만 달러 이하
  function tradeSalaryOk(G, tid, outAmt, inAmt) {
    const y = G.season;
    const after = payroll(G, tid) - outAmt + inAmt;
    if (after <= cap(y)) return true;
    return inAmt <= outAmt * 1.25 + 100 * cap(y) / 109140;
  }

  HM.Fin = { cap, minSal, maxSal, taxLine, mle, shareFor, marketValue, rookieScale, payroll, deadMoney, tradeSalaryOk };
})();
