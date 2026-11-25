// 공용 도구
(function () {
  const HM = globalThis.HM = globalThis.HM || {};

  const U = {};
  U.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  U.rand = () => Math.random();
  U.randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  U.gauss = (mu = 0, sd = 1) => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.wpick = (items, weights) => {
    let tot = 0;
    for (const w of weights) tot += w > 0 ? w : 0;
    if (tot <= 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return items[i];
      r -= w;
    }
    return items[items.length - 1];
  };
  U.shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  U.sum = arr => arr.reduce((a, b) => a + b, 0);
  U.avg = arr => arr.length ? U.sum(arr) / arr.length : 0;
  U.sigmoid = x => 1 / (1 + Math.exp(-x));
  U.logit = p => Math.log(p / (1 - p));
  U.hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.hrand = s => (U.hash(s) % 100000) / 100000;

  // 날짜: 'YYYY-MM-DD' 문자열
  U.addDays = (d, n) => {
    const t = new Date(d + 'T12:00:00Z');
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  };
  U.dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
  U.fmtDate = d => {
    const [y, m, dd] = d.split('-').map(Number);
    const wd = '일월화수목금토'[new Date(d + 'T12:00:00Z').getUTCDay()];
    return `${y}년 ${m}월 ${dd}일 (${wd})`;
  };
  U.fmtDateShort = d => { const [, m, dd] = d.split('-').map(Number); return `${m}/${dd}`; };
  U.seasonLabel = y => `${y - 1}-${String(y % 100).padStart(2, '0')}`;

  // 금액: 내부 단위는 천 달러
  U.money = k => {
    if (k === undefined || k === null || isNaN(k)) return '-';
    const neg = k < 0; k = Math.abs(k);
    let s;
    if (k >= 1000) s = '$' + (k / 1000).toFixed(k >= 100000 ? 0 : k >= 10000 ? 1 : 2) + 'M';
    else s = '$' + Math.round(k) + 'K';
    return neg ? '-' + s : s;
  };

  U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.pct = (a, b, d = 1) => b ? (a / b * 100).toFixed(d) : '-';
  U.fix = (x, d = 1) => (x === undefined || isNaN(x)) ? '-' : Number(x).toFixed(d);
  U.ord = n => n + '위';

  // 받침에 맞는 조사(한글이 아니면 '(이)가' 꼴)
  U.josa = (word, pair) => {
    const [a, b] = pair.split('/');
    const ch = String(word).trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const jong = (code - 0xac00) % 28;
      if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? '로' : '으로');
      return word + (jong ? a : b);
    }
    if (/[0-9]$/.test(ch)) return word + ('013678'.includes(ch) ? a : b);
    if (pair === '으로/로') return word + '(으)로';
    return word + '(' + a + ')' + b;
  };

  U.uid = () => Math.random().toString(36).slice(2, 10);
  U.deepCopy = o => JSON.parse(JSON.stringify(o));

  HM.U = U;
})();
