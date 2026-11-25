// 트레이드·자유계약·드래프트·재정
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, Season = HM.Season, AI = HM.AI, App = HM.App, R = HM.Ratings;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const G_ = () => App.G;

  // ---------- 트레이드 ----------
  function tstate() {
    const G = G_();
    if (!App.ui.trade || App.ui.trade.partner === G.userTid || !G.teams[App.ui.trade.partner]) {
      const other = G.teams.find(t => t.tid !== G.userTid);
      App.ui.trade = { partner: other.tid, mine: [], theirs: [], myPicks: [], theirPicks: [] };
    }
    return App.ui.trade;
  }
  function offerFrom(st) {
    return { a: G_().userTid, b: st.partner, ap: st.mine.slice(), bp: st.theirs.slice(), ak: st.myPicks.slice(), bk: st.theirPicks.slice() };
  }
  const pickLabel = (G, k) => `${k.season} ${k.round}라운드${k.slot ? ` ${k.slot}순위` : ''}${k.orig !== k.tid ? ` (${G.teams[k.orig].abbr})` : ''}`;
  S.trade = () => {
    const G = G_(); const st = tstate();
    // 이미 팀을 떠난 선수는 뺀다
    st.mine = st.mine.filter(id => G.players[id]?.tid === G.userTid);
    st.theirs = st.theirs.filter(id => G.players[id]?.tid === st.partner);
    st.myPicks = st.myPicks.filter(id => G.picks.some(k => k.id === id && k.tid === G.userTid));
    st.theirPicks = st.theirPicks.filter(id => G.picks.some(k => k.id === id && k.tid === st.partner));
    const me = G.teams[G.userTid], them = G.teams[st.partner];
    const allowed = App.tradeAllowed();
    const side = (tid, sel, selK, key, keyK) => {
      const ps = L.roster(G, tid).sort((a, b) => b.ovr - a.ovr);
      const ks = G.picks.filter(k => k.tid === tid && k.season >= G.season).sort((a, b) => a.season - b.season || a.round - b.round);
      return `<div class="tw"><table class="t"><thead><tr><th></th><th>선수</th><th class="c">포지션</th><th class="r">나이</th><th class="c">능력</th><th class="c">잠재</th><th class="r">연봉</th><th class="r">만료</th></tr></thead><tbody>
        ${ps.map(p => `<tr><td><input type="checkbox" data-change="tradeTog" data-key="${key}" data-id="${p.pid}" ${sel.includes(p.pid) ? 'checked' : ''}></td><td>${App.plink(p)} ${App.injTag(p)}</td><td class="c">${p.pos}</td><td class="r">${App.age(p)}</td><td class="c">${App.ovr(p.ovr)}</td><td class="c">${Math.round(P.potShown(p, G))}</td><td class="r">${U.money(p.contract?.amt)}</td><td class="r">${p.contract ? U.seasonLabel(p.contract.exp) : '-'}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="row" style="margin-top:8px">${ks.map(k => `<label class="pill" style="cursor:pointer"><input type="checkbox" data-change="tradeTog" data-key="${keyK}" data-id="${k.id}" ${selK.includes(k.id) ? 'checked' : ''}> ${pickLabel(G, k)}</label>`).join('') || '<span class="muted small">지명권 없음</span>'}</div>`;
    };
    const o = offerFrom(st);
    const sal = ids => ids.reduce((s, id) => s + (G.players[id].contract?.amt || 0), 0);
    let verdict = '';
    const any = o.ap.length + o.bp.length + o.ak.length + o.bk.length;
    if (any) {
      const errs = AI.tradeCheck(G, o);
      const d = AI.tradeDelta(G, o, st.partner);
      const need = d.gives * 1.06 + 0.15;
      const ratio = need > 0 ? Math.min(1.3, d.gets / need) : 1;
      const mood = errs.length ? `<span class="pill bad">${esc(errs[0])}</span>` : ratio >= 1 ? '<span class="pill good">수락할 가능성이 높습니다</span>' : ratio >= 0.85 ? '<span class="pill warn">조금 모자랍니다</span>' : '<span class="pill bad">상대가 관심을 보이지 않습니다</span>';
      verdict = `<div class="row">${mood}</div><div class="small muted" style="margin-top:6px">상대 만족도</div><div class="bar"><i style="width:${Math.round(Math.min(1, ratio) * 100)}%;background:${ratio >= 1 ? 'var(--good)' : ratio >= 0.85 ? 'var(--warn)' : 'var(--bad)'}"></i></div>`;
    }
    const cy = AI.capYear(G);
    const payMe = F.payroll(G, G.userTid, cy), payThem = F.payroll(G, st.partner, cy);
    return `<h1>트레이드</h1>
    ${allowed ? '' : '<div class="note" style="margin-bottom:12px">⛔ 트레이드 마감이 지났거나 포스트시즌 중입니다. 플레이오프가 끝난 뒤(드래프트부터) 다시 트레이드할 수 있습니다.</div>'}
    <div class="row" style="margin-bottom:12px"><span class="muted">상대 팀</span><select data-change="tradePartner">${G.teams.filter(t => t.tid !== G.userTid).map(t => `<option value="${t.tid}" ${t.tid === st.partner ? 'selected' : ''}>${esc(t.ko)} (${L.rec(G, t.tid).w}-${L.rec(G, t.tid).l})</option>`).join('')}</select>
      <span class="pill">${({ contend: '우승 도전', rebuild: '리빌딩', mid: '중위권' })[them.strategy]} 팀</span></div>
    <div class="card" style="margin-bottom:14px">
      <div class="grid g3">
        <div><h3>${esc(me.ko)} → 보냄</h3>${o.ap.map(id => App.plink(G.players[id])).concat(o.ak.map(id => pickLabel(G, G.picks.find(k => k.id === id)))).join(', ') || '<span class="muted">없음</span>'}<div class="small muted">연봉 ${U.money(sal(o.ap))}</div></div>
        <div><h3>${esc(them.ko)} → 받음</h3>${o.bp.map(id => App.plink(G.players[id])).concat(o.bk.map(id => pickLabel(G, G.picks.find(k => k.id === id)))).join(', ') || '<span class="muted">없음</span>'}<div class="small muted">연봉 ${U.money(sal(o.bp))}</div></div>
        <div>${verdict || '<span class="muted small">주고받을 선수나 지명권을 고르세요.</span>'}</div>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-act="tradePropose" ${allowed && any ? '' : 'disabled'}>제안하기</button><button class="btn" data-act="tradeBalance" ${allowed && any ? '' : 'disabled'}>무엇을 원하는지 묻기</button><button class="btn" data-act="tradeReset">비우기</button>
        <span class="sp"></span><span class="small muted">우리 연봉 ${U.money(payMe)} · 상대 ${U.money(payThem)} · 캡 ${U.money(F.cap(cy))}</span></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>${App.tchip(me)} ${esc(me.ko)}</h2>${side(G.userTid, st.mine, st.myPicks, 'mine', 'myPicks')}</div>
      <div class="card"><h2>${App.tchip(them)} ${esc(them.ko)}</h2>${side(st.partner, st.theirs, st.theirPicks, 'theirs', 'theirPicks')}</div>
    </div>
    <p class="note" style="margin-top:12px">샐러리캡을 넘는 팀은 보내는 연봉의 125%까지만 받을 수 있고, 로스터는 15명을 넘을 수 없습니다. 리빌딩 팀은 젊은 선수와 지명권을, 우승 도전 팀은 지금 잘하는 선수를 더 높게 칩니다.</p>`;
  };
  A.tradePartner = el => { App.ui.trade = { partner: +el.value, mine: tstate().mine, theirs: [], myPicks: tstate().myPicks, theirPicks: [] }; App.rerender(); };
  A.tradeTog = el => {
    const st = tstate(); const key = el.dataset.key; const id = key.endsWith('Picks') ? el.dataset.id : +el.dataset.id;
    if (el.checked) { if (!st[key].includes(id)) st[key].push(id); } else st[key] = st[key].filter(x => x !== id);
    App.rerender();
  };
  A.tradeReset = () => { const st = tstate(); App.ui.trade = { partner: st.partner, mine: [], theirs: [], myPicks: [], theirPicks: [] }; App.rerender(); };
  A.tradePropose = () => {
    const G = G_(); const st = tstate(); const o = offerFrom(st);
    const r = AI.aiAccepts(G, o, st.partner);
    if (!r.ok) { App.modal('트레이드 거절', `<p>${esc(G.teams[st.partner].ko)}: ${esc(r.why)}</p>`, '<button class="btn" data-act="closeModal">닫기</button><button class="btn pri" data-act="tradeBalance">무엇을 원하는지 묻기</button>'); return; }
    AI.execTrade(G, o);
    Season.news(G, Season.tradeText(G, o), { type: 'trade' });
    Season.msg(G, `트레이드 성사: ${G.teams[st.partner].ko}`, Season.tradeText(G, o), { type: 'offer', done: '성사' });
    App.ui.trade = { partner: st.partner, mine: [], theirs: [], myPicks: [], theirPicks: [] };
    App.closeModal();
    App.modal('트레이드 성사!', `<p>${Season.tradeText(G, o)}</p><p class="small muted">로테이션이 코치 자동 설정으로 바뀌었습니다. 전술 화면에서 확인하세요.</p>`, '<button class="btn pri" data-act="closeModal">확인</button>');
    App.autosave(); App.rerender();
  };
  A.tradeBalance = () => {
    const G = G_(); const st = tstate(); const o = offerFrom(st);
    App.closeModal();
    const n = AI.balance(G, o, st.partner);
    if (!n) { App.toast('상대가 맞출 수 있는 조합을 찾지 못했습니다', 3000); return; }
    App.ui.trade = { partner: st.partner, mine: n.ap, theirs: n.bp, myPicks: n.ak, theirPicks: n.bk };
    App.toast('상대가 원하는 조건으로 채웠습니다. 확인 후 제안하세요', 3000);
    App.rerender();
  };

  // ---------- 협상(자유계약·재계약) ----------
  A.negotiate = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    const own = p.tid === G.userTid;
    const ask = AI.asking(G, p);
    const cy = AI.capYear(G);
    App.neg = { pid: p.pid, amt: ask.amt, yrs: ask.yrs, own };
    const max = F.maxSal(cy, p.yearsPro || 0), min = F.minSal(cy);
    const room = AI.capRoom(G, G.userTid);
    App.modal(`${own ? '재계약' : '계약'} 협상: ${esc(p.name)}`, `
      <div class="row nowrap"><div class="ovrbig"><b>${Math.round(p.ovr)}</b><span>능력</span></div><div style="flex:1;min-width:0"><b>${esc(p.name)}</b> <span class="muted">${p.pos} · ${P.age(p, cy)}세</span><div class="small muted">요구: <b>${U.money(ask.amt)}</b> × ${ask.yrs}년 · 사기 ${App.moraleTxt(p.morale ?? 60)}</div></div></div>
      <div style="margin-top:14px"><div class="row"><span>연봉</span><span class="sp"></span><b id="negAmt">${U.money(ask.amt)}</b></div>
        <input type="range" min="${min}" max="${max}" step="${Math.max(10, Math.round((max - min) / 200 / 10) * 10)}" value="${ask.amt}" style="width:100%" data-input="negAmt"></div>
      <div class="row" style="margin-top:10px"><span>계약 기간</span><span class="sp"></span>${[1, 2, 3, 4, 5].map(y => `<button class="btn sm ${y === ask.yrs ? 'pri' : ''}" data-act="negYrs" data-y="${y}">${y}년</button>`).join('')}</div>
      <div id="negMood" style="margin-top:12px"></div>
      <div class="note" style="margin-top:12px">${own ? '버드 권리: 우리 선수와의 재계약은 샐러리캡을 넘어도 됩니다.' : `캡 여유 ${U.money(Math.max(0, room))}${cy >= 1999 ? ` · 미드레벨 예외 ${G.teams[G.userTid].mleUsed ? '사용함' : U.money(F.mle(cy)) + ' 사용 가능'}` : ''} · 최저 연봉 ${U.money(min)}은 언제든 가능`}</div>`,
      `<button class="btn" data-act="closeModal">취소</button><button class="btn pri" data-act="negSubmit">제안</button>`);
    negMood();
  };
  function negMood() {
    const G = G_(); const n = App.neg; const p = G.players[n.pid];
    const s = AI.offerScore(G, p, G.userTid, n.amt, n.yrs) - (p.annoy || 0) * 0.03;
    const el = document.getElementById('negMood'); if (!el) return;
    const can = AI.canSign(G, G.userTid, n.amt, n.own);
    el.innerHTML = (s >= 1 ? '<span class="pill good">만족할 만한 조건입니다</span>' : s >= 0.95 ? '<span class="pill warn">조금 더 필요해 보입니다</span>' : '<span class="pill bad">받아들이지 않을 것 같습니다</span>') +
      (can ? '' : ' <span class="pill bad">샐러리캡 여유가 없습니다</span>');
    const a = document.getElementById('negAmt'); if (a) a.textContent = U.money(n.amt);
  }
  A.negAmt = el => { App.neg.amt = +el.value; negMood(); };
  A.negYrs = el => { App.neg.yrs = +el.dataset.y; document.querySelectorAll('[data-act="negYrs"]').forEach(b => b.classList.toggle('pri', b === el)); negMood(); };
  A.negSubmit = () => {
    const G = G_(); const n = App.neg; const p = G.players[n.pid];
    const cy = AI.capYear(G);
    if (!n.own && L.roster(G, G.userTid).length >= 15) { App.toast('로스터가 꽉 찼습니다(15명)', 3000); return; }
    const can = AI.canSign(G, G.userTid, n.amt, n.own);
    if (!can) { App.toast('샐러리캡 여유가 없습니다. 최저 연봉이나 미드레벨 예외 금액으로 제안하세요', 3500); return; }
    const s = AI.offerScore(G, p, G.userTid, n.amt, n.yrs) - (p.annoy || 0) * 0.03;
    if (s >= 1 || (s >= 0.97 && Math.random() < 0.5)) {
      if (n.own) { p.contract = { amt: n.amt, exp: G.season + n.yrs }; p.morale = Math.max(p.morale ?? 60, 65); }
      else AI.sign(G, p, G.userTid, n.amt, n.yrs);
      p.annoy = 0;
      Season.news(G, `${n.own ? '재계약' : 'FA'}: ${p.name} → ${G.teams[G.userTid].ko} (${U.money(n.amt)}×${n.yrs}년)`, { type: 'fa' });
      App.closeModal();
      App.modal('계약 합의!', `<p><b>${esc(p.name)}</b> 선수가 ${U.money(n.amt)} × ${n.yrs}년 계약에 합의했습니다.</p>`, '<button class="btn pri" data-act="closeModal">확인</button>');
      App.autosave(); App.rerender();
    } else {
      p.annoy = (p.annoy || 0) + 1;
      const ask = AI.asking(G, p);
      App.toast(`${p.name}: "${s < 0.85 ? '진지한 제안이 아니군요.' : `${U.money(ask.amt)} 정도는 받아야겠습니다.`}"`, 3500);
      negMood();
    }
    void cy;
  };

  // ---------- 자유계약: 시장 · 예정 FA · 관심 선수 · 알림 조건 ----------
  const FKEYS = ['pos', 'minOvr', 'minPot', 'minAge', 'maxAge', 'maxAsk', 'attr', 'attrMin'];
  function faf() { return App.ui.faf || (App.ui.faf = {}); }
  // 화면의 거르기 값을 알림 조건 모양으로
  function filterAsWatch() {
    const f = faf(), w = {};
    if (f.pos) w.pos = [f.pos];
    for (const k of ['minOvr', 'minPot', 'minAge', 'maxAge', 'maxAsk', 'attrMin']) if (f[k] !== undefined && f[k] !== '' && +f[k] > 0) w[k] = +f[k];
    if (f.attr && w.attrMin) w.attr = f.attr; else delete w.attrMin;
    return w;
  }
  const hasFilter = () => Object.keys(filterAsWatch()).length > 0;
  App.isShort = pid => Season.shortlist(G_()).includes(pid);
  const starBtn = p => `<button class="btn sm" data-act="shortTog" data-pid="${p.pid}" title="관심 선수">${App.isShort(p.pid) ? '★' : '☆'}</button>`;
  const bellOf = p => { const why = Season.watchHits(G_(), p).filter(x => !x.startsWith('★')); return why.length ? `<span class="pill warn" title="${esc(why.join(', '))}">🔔</span>` : ''; };

  function filterBar() {
    const f = faf();
    const num = (k, ph, w = 74) => `<input type="number" id="faf-${k}" inputmode="numeric" placeholder="${ph}" style="width:${w}px" value="${esc(f[k] ?? '')}" data-change="fafSet" data-k="${k}">`;
    return `<div class="card" style="margin-bottom:12px"><div class="row" style="gap:10px">
      <select id="faf-pos" data-change="fafSet" data-k="pos"><option value="">모든 포지션</option>${R.POS.map(x => `<option value="${x}" ${f.pos === x ? 'selected' : ''}>${x} · ${R.POS_KO[x]}</option>`).join('')}</select>
      <label class="row small" style="gap:4px">능력 ${num('minOvr', '최소')}</label>
      <label class="row small" style="gap:4px">잠재력 ${num('minPot', '최소')}</label>
      <label class="row small" style="gap:4px">나이 ${num('minAge', '부터', 64)}~${num('maxAge', '까지', 64)}</label>
      <label class="row small" style="gap:4px">요구 연봉 ${num('maxAsk', '$M 이하', 84)}</label>
      <label class="row small" style="gap:4px"><select id="faf-attr" data-change="fafSet" data-k="attr"><option value="">능력치 조건 없음</option>${R.ATTRS.map(([k, l]) => `<option value="${k}" ${f.attr === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${num('attrMin', '1~20', 64)}이상</label>
      <span class="sp"></span>
      <button class="btn sm" data-act="fafReset">초기화</button>
      <button class="btn sm pri" data-act="watchFromFilter" ${hasFilter() ? '' : 'disabled'}>🔔 이 조건으로 알림 받기</button>
    </div></div>`;
  }
  A.fafSet = el => { faf()[el.dataset.k] = el.value; App.rerender(); };
  A.fafReset = () => { App.ui.faf = {}; App.rerender(); };
  A.watchFromFilter = () => {
    const G = G_(); const w = filterAsWatch();
    if (!Object.keys(w).length) return;
    w.id = Date.now(); w.on = true; w.name = Season.watchSummary(w);
    Season.watchList(G).push(w);
    const now = L.fas(G).filter(p => Season.matchWatch(G, p, w)).length;
    App.toast(`알림 조건을 저장했습니다${now ? ` · 지금 시장에 맞는 선수 ${now}명` : ''}`, 3000);
    App.autosave(); App.rerender();
  };
  A.shortTog = el => {
    const G = G_(); const list = Season.shortlist(G); const pid = +el.dataset.pid;
    const i = list.indexOf(pid);
    if (i >= 0) list.splice(i, 1); else list.push(pid);
    App.toast(i >= 0 ? '관심 선수에서 뺐습니다' : '관심 선수로 등록했습니다. 시장에 나오면 알려 드립니다', 2600);
    App.autosave(); App.rerender();
  };
  A.watchTog = el => { const w = Season.watchList(G_()).find(x => x.id === +el.dataset.id); if (w) w.on = el.checked; App.autosave(); App.rerender(); };
  A.watchDel = el => { const G = G_(); G.watch = Season.watchList(G).filter(x => x.id !== +el.dataset.id); App.autosave(); App.rerender(); };
  A.watchName = el => { const w = Season.watchList(G_()).find(x => x.id === +el.dataset.id); if (w) w.name = el.value.trim() || Season.watchSummary(w); App.autosave(); };
  A.watchShow = el => {
    const w = Season.watchList(G_()).find(x => x.id === +el.dataset.id); if (!w) return;
    App.ui.faf = { pos: w.pos && w.pos[0] || '', minOvr: w.minOvr || '', minPot: w.minPot || '', minAge: w.minAge || '', maxAge: w.maxAge || '', maxAsk: w.maxAsk || '', attr: w.attr || '', attrMin: w.attrMin || '' };
    App.ui.tabs.fa = 'market'; App.rerender();
  };
  A.watchStopTog = el => { Season.autoSet(G_()).watchStop = el.checked; App.autosave(); };

  S.fa = () => {
    const G = G_();
    const cy = AI.capYear(G);
    const room = AI.capRoom(G, G.userTid);
    const n = L.roster(G, G.userTid).length;
    const watch = Season.watchList(G), short = Season.shortlist(G);
    const tab = App.ui.tabs.fa || 'market';
    const fw = filterAsWatch();
    const pass = p => Season.matchWatch(G, p, fw);
    const fas = L.fas(G);
    const soon = Object.values(G.players).filter(p => p.tid >= 0 && p.tid !== G.userTid && p.contract && p.contract.exp <= G.season);
    const tabs = [['market', `시장 ${fas.length}`], ['soon', `예정 FA ${soon.length}`], ['short', `★ 관심 선수 ${short.length}`], ['watch', `🔔 알림 조건 ${watch.filter(w => w.on !== false).length}`]];
    const base = [
      { k: 'name', label: '이름', f: p => `${App.isShort(p.pid) ? '<span class="stars">★</span> ' : ''}${App.plink(p)} ${bellOf(p)} ${App.injTag(p)}`, v: p => p.name },
      { k: 'pos', label: '포지션', cls: 'c' },
      { k: 'age', label: '나이', cls: 'r', v: p => P.age(p, cy), f: p => P.age(p, cy) },
      { k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) },
      { k: 'pot', label: '잠재력', cls: 'c', v: p => P.potShown(p, G), f: p => `${App.stars(P.potShown(p, G))} <span class="faint small">${P.potShown(p, G)}</span>` },
    ];
    const attrCol = fw.attr ? [{ k: 'attrv', label: R.LABEL[fw.attr], cls: 'c', v: p => p.a[fw.attr], f: p => { const v = R.disp(p.a[fw.attr]); return `<span class="av ${R.attrClass(v)}">${v}</span>`; } }] : [];
    let body = '';
    if (tab === 'market') {
      const list = fas.filter(pass);
      body = filterBar() + `<div class="card flat" style="padding:6px">${App.table('fa', base.concat(attrCol, [
        { k: 'ask', label: '요구 연봉', cls: 'r', v: p => AI.asking(G, p).amt, f: p => { const a = AI.asking(G, p); return `${U.money(a.amt)} × ${a.yrs}년`; } },
        { k: 'int', label: '우리 팀 관심', cls: 'c', v: p => AI.teamAppeal(G, G.userTid, p), f: p => { const v = AI.teamAppeal(G, G.userTid, p); return v > 0.08 ? '<span class="pill good">높음</span>' : v > -0.02 ? '<span class="pill">보통</span>' : '<span class="pill bad">낮음</span>'; } },
        { k: 'act', label: '', nosort: true, f: p => `${starBtn(p)} <button class="btn sm pri" data-act="negotiate" data-pid="${p.pid}">협상</button>` },
      ]), list, { sort: { k: 'ovr', dir: -1 }, limit: 150 })}</div><p class="small muted" style="margin-top:6px">${list.length}명${hasFilter() ? ` (조건에 맞는 선수 / 전체 ${fas.length}명)` : ''} · 🔔는 저장한 알림 조건에 맞는 선수</p>`;
    } else if (tab === 'soon') {
      const list = soon.filter(pass);
      body = filterBar() + `<p class="small muted">${U.seasonLabel(G.season)} 시즌이 끝나면 계약이 끝나는 다른 팀 선수들입니다. 재계약하지 못하면 시장에 나옵니다. ☆로 관심 선수에 넣어 두면 시장에 나오는 날 알려 드립니다.</p>
        <div class="card flat" style="padding:6px">${App.table('soon', base.concat(attrCol, [
        { k: 'team', label: '현재 팀', f: p => `${App.tchip(G.teams[p.tid])}`, v: p => G.teams[p.tid].abbr },
        { k: 'amt', label: '현재 연봉', cls: 'r', v: p => p.contract.amt, f: p => U.money(p.contract.amt) },
        { k: 'act', label: '', nosort: true, f: p => starBtn(p) },
      ]), list, { sort: { k: 'ovr', dir: -1 }, limit: 150 })}</div>`;
    } else if (tab === 'short') {
      const list = short.map(id => G.players[id]).filter(p => p && p.tid !== -3);
      body = `<p class="small muted">관심 선수는 어느 팀 선수든 등록할 수 있습니다(선수 화면의 ☆ 단추). 그 선수가 자유계약 시장에 나오면 받은 편지함으로 알려 드립니다.</p>
        <div class="card flat" style="padding:6px">${App.table('short', base.concat([
        { k: 'team', label: '소속', f: p => p.tid >= 0 ? App.tchip(G.teams[p.tid]) : p.tid === -1 ? '<span class="pill good">FA 시장</span>' : '<span class="pill">드래프트 후보</span>', v: p => p.tid },
        { k: 'exp', label: '계약 만료', cls: 'r', v: p => p.contract?.exp || 0, f: p => p.contract ? U.seasonLabel(p.contract.exp) + (p.contract.exp <= G.season && p.tid >= 0 ? ' <span class="pill warn">올해 만료</span>' : '') : '-' },
        { k: 'act', label: '', nosort: true, f: p => `${p.tid === -1 ? `<button class="btn sm pri" data-act="negotiate" data-pid="${p.pid}">협상</button> ` : ''}<button class="btn sm" data-act="shortTog" data-pid="${p.pid}">빼기</button>` },
      ]), list, { sort: { k: 'ovr', dir: -1 } })}</div>`;
    } else {
      const A2 = Season.autoSet(G);
      body = filterBar() + `<div class="card">
        <h2>저장한 알림 조건 <span class="r"><label class="row" style="gap:6px"><input type="checkbox" id="watchStop" ${A2.watchStop ? 'checked' : ''} data-change="watchStopTog"> 알림이 오면 진행 멈추기</label></span></h2>
        <p class="small muted">위에서 조건(포지션·능력·잠재력·나이·요구 연봉·능력치)을 고른 뒤 <b>🔔 이 조건으로 알림 받기</b>를 누르세요. 조건에 맞는 선수가 시장에 새로 나오면 받은 편지함으로 알려 드립니다. 재계약 결렬, 방출, 드래프트 미지명, 실제 선수 합류 때 모두 확인합니다.</p>
        ${watch.length ? `<div class="grid" style="margin-top:8px">${watch.map(w => { const now = L.fas(G).filter(p => Season.matchWatch(G, p, w)).length; return `<div class="row" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--panel2);gap:10px">
          <input type="checkbox" id="w-on-${w.id}" ${w.on !== false ? 'checked' : ''} data-change="watchTog" data-id="${w.id}" title="켜기/끄기">
          <div style="flex:1;min-width:180px"><input type="text" id="w-name-${w.id}" value="${esc(w.name)}" data-change="watchName" data-id="${w.id}" style="width:100%;font-weight:700"><div class="small muted" style="margin-top:4px">${esc(Season.watchSummary(w))}</div></div>
          <button class="btn sm" data-act="watchShow" data-id="${w.id}">지금 시장 ${now}명 보기</button><button class="btn sm danger" data-act="watchDel" data-id="${w.id}">삭제</button></div>`; }).join('')}</div>` : '<div class="empty">아직 저장한 알림 조건이 없습니다.</div>'}
      </div>`;
    }
    return `<div class="row"><h1>자유계약</h1><span class="sp"></span><span class="pill">${n}/15명</span><span class="pill ${room > 0 ? 'good' : ''}">캡 여유 ${U.money(Math.max(0, room))}</span>${cy >= 1999 ? `<span class="pill">미드레벨 ${G.teams[G.userTid].mleUsed ? '사용함' : U.money(F.mle(cy))}</span>` : ''}<span class="pill">최저 ${U.money(F.minSal(cy))}</span></div>
      ${G.phase === 'fa' ? '<p class="small muted">자유계약 시장 기간입니다. 다른 팀도 매일 선수를 데려갑니다. 좋은 선수는 빨리 움직이세요.</p>' : '<p class="small muted">시즌 중에도 남은 자유계약 선수와 계약할 수 있습니다.</p>'}
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-group="fa" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  };

  // ---------- 드래프트 ----------
  S.draft = () => {
    const G = G_();
    const showReal = App.ui.tabs.draftReal === '1';
    const pros = L.prospects(G);
    const scoutOvr = p => { const e = (U.hrand(p.pid + 'so') - 0.5) * 6; return [Math.round(p.ovr + e - 2), Math.round(p.ovr + e + 2)]; };
    const cols = [
      { k: 'rank', label: '순위', cls: 'r', v: p => -AI.draftScore(G, p, G.userTid), f: (p, i) => i + 1 },
      { k: 'name', label: '이름', f: p => App.plink(p), v: p => p.name },
      { k: 'pos', label: '포지션', cls: 'c' },
      { k: 'age', label: '나이', cls: 'r', v: p => P.age(p, G.season + 1), f: p => P.age(p, G.season + 1) },
      { k: 'hgt', label: '키', cls: 'r', f: p => p.hgt + 'cm' },
      { k: 'col', label: '출신', f: p => `<span class="small">${esc(p.college || '-')}</span>`, v: p => p.college },
      { k: 'ovr', label: '예상 능력', cls: 'c', v: p => p.ovr, f: p => { const [a, b] = scoutOvr(p); return `<span class="num">${a}~${b}</span>`; } },
      { k: 'pot', label: '잠재력', cls: 'c', v: p => P.potShown(p, G), f: p => App.stars(P.potShown(p, G)) },
      ...(showReal ? [{ k: 'real', label: '실제 지명', cls: 'r', v: p => p.prospect?.realPick || 99, f: p => p.prospect?.realPick ? `${p.prospect.realPick}순위 (${esc(p.prospect.realTeam)})` : '<span class="faint">-</span>' }] : []),
    ];
    let myTurn = false, cur = null;
    if (G.phase === 'draft' && G.draft) {
      const dr = G.draft;
      if (dr.idx < dr.order.length) { cur = G.picks.find(k => k.id === dr.order[dr.idx]); myTurn = cur.tid === G.userTid; }
      cols.push({ k: 'act', label: '', nosort: true, f: p => myTurn ? `<button class="btn sm pri" data-act="draftPick" data-pid="${p.pid}">지명</button>` : '' });
    }
    const tbl = App.table('draft', cols, pros, { sort: { k: 'rank', dir: 1 } });
    let board = '';
    if (G.phase === 'draft' && G.draft) {
      const dr = G.draft;
      const done = dr.idx >= dr.order.length;
      const upcoming = dr.order.slice(dr.idx, dr.idx + 8).map((id, i) => { const k = G.picks.find(x => x.id === id); return `<span class="pill ${k.tid === G.userTid ? 'good' : ''}">${dr.idx + i + 1}. ${esc(G.teams[k.tid].abbr)}</span>`; }).join(' ');
      board = `<div class="card" style="margin-bottom:14px"><h2>${dr.year} 드래프트 진행판</h2>
        ${done ? '<p>모든 지명이 끝났습니다.</p><button class="btn pri" data-act="draftFinish">드래프트 마치기 → 재계약 기간</button>' :
          `<div class="row"><b>${dr.idx + 1}순위</b> — ${App.tchip(G.teams[cur.tid])} ${esc(G.teams[cur.tid].ko)} ${myTurn ? '<span class="pill good">우리 차례!</span>' : ''}</div>
           <div class="row" style="margin-top:8px">${upcoming}</div>
           <div class="row" style="margin-top:10px"><button class="btn" data-act="draftAuto" ${myTurn ? 'disabled' : ''}>우리 차례까지 진행</button><button class="btn" data-act="draftAll">끝까지 자동(우리 픽도 코치가)</button></div>`}
        ${dr.results.length ? `<div class="tw" style="margin-top:12px;max-height:260px;overflow-y:auto"><table class="t"><tbody>${dr.results.slice().reverse().map(r => { const p = G.players[r.pid]; return `<tr class="${r.tid === G.userTid ? 'me' : ''}"><td class="muted">${r.pick}</td><td>${App.tchip(G.teams[r.tid])}</td><td>${App.plink(p)}</td><td class="c">${p.pos}</td><td class="r small muted">${showReal && r.real ? '실제 ' + r.real + '순위' : ''}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      </div>`;
    } else {
      const mine = G.picks.filter(k => k.tid === G.userTid && k.season === G.season).sort((a, b) => a.round - b.round);
      board = `<div class="card" style="margin-bottom:14px"><h2>${G.season} 드래프트 <span class="r">${G.lottery ? '로터리 완료' : '정규시즌 뒤 로터리'}</span></h2>
        <div class="row">우리 지명권: ${mine.map(k => `<span class="pill">${k.round}라운드${k.slot ? ' ' + k.slot + '순위' : ''}${k.orig !== G.userTid ? ` (${esc(G.teams[k.orig].abbr)})` : ''}</span>`).join(' ') || '<span class="muted">없음</span>'}</div>
        ${G.lottery ? `<div class="small muted" style="margin-top:6px">로터리 방식: ${esc(G.lottery.info)} · 1순위 ${esc(G.teams[G.lottery.order[0]].ko)}</div>` : ''}</div>`;
    }
    return `<div class="row"><h1>드래프트</h1><span class="sp"></span><label class="row small" style="gap:6px"><input type="checkbox" ${showReal ? 'checked' : ''} data-change="draftReal"> 실제 역사 지명 순위 보기</label></div>${board}
      <div class="card flat" style="padding:6px">${tbl}</div>
      <p class="note" style="margin-top:10px">예상 능력과 잠재력은 스카우트 평가라 오차가 있습니다. 실제 역사에 있던 드래프트는 실제 선수들로 채워지고, 다른 팀들은 대체로 실제 지명 순서를 참고하지만 그대로 따르지는 않습니다.</p>`;
  };
  A.draftReal = el => { App.ui.tabs.draftReal = el.checked ? '1' : '0'; App.rerender(); };
  A.draftPick = el => {
    const G = G_();
    Season.draftPlayer(G, +el.dataset.pid);
    Season.draftUntilUser(G);
    App.autosave(); App.rerender();
  };
  A.draftAuto = () => { const G = G_(); if (G.phase !== 'draft') return; const r = Season.draftUntilUser(G); App.rerender(); if (r === 'user') App.toast('우리 차례입니다! 선수를 지명하세요'); };
  A.draftAll = () => {
    const G = G_();
    while (true) {
      const r = Season.draftUntilUser(G);
      if (r === 'done') break;
      Season.draftPlayer(G, AI.aiDraftPick(G, G.userTid, L.prospects(G)).pid);
    }
    App.rerender();
  };
  A.draftFinish = () => { const G = G_(); Season.finishDraft(G); App.autosave(); App.go('#/finance'); };

  // ---------- 재정·계약 ----------
  S.finance = () => {
    const G = G_();
    const cy = AI.capYear(G);
    const ps = L.roster(G, G.userTid).sort((a, b) => (b.contract?.amt || 0) - (a.contract?.amt || 0));
    const years = [0, 1, 2, 3, 4].map(i => cy + i);
    const dead = (G.dead || []).filter(d => d.tid === G.userTid && d.exp >= cy);
    const totals = years.map(y => F.payroll(G, G.userTid, y));
    const t = G.teams[G.userTid];
    let resign = '';
    if (G.phase === 'resign') {
      const exp = L.roster(G, G.userTid).filter(p => p.contract && p.contract.exp <= G.season);
      resign = `<div class="card" style="margin-bottom:14px"><h2>재계약 대상 <span class="r">다음 단계로 넘어가면 재계약하지 않은 선수는 FA가 됩니다</span></h2>${exp.length ? App.table('resign', [
        { k: 'name', label: '이름', f: p => App.plink(p), v: p => p.name },
        { k: 'age', label: '나이', cls: 'r', v: p => P.age(p, cy), f: p => P.age(p, cy) },
        { k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) },
        { k: 'pot', label: '잠재력', cls: 'c', v: p => P.potShown(p, G), f: p => App.stars(P.potShown(p, G)) },
        { k: 'cur', label: '현재 연봉', cls: 'r', v: p => p.contract.amt, f: p => U.money(p.contract.amt) },
        { k: 'ask', label: '요구', cls: 'r', v: p => AI.asking(G, p).amt, f: p => { const a = AI.asking(G, p); return `${U.money(a.amt)} × ${a.yrs}년`; } },
        { k: 'mor', label: '사기', cls: 'c', v: p => p.morale ?? 60, f: p => App.moraleTxt(p.morale ?? 60) },
        { k: 'act', label: '', nosort: true, f: p => `<button class="btn sm pri" data-act="negotiate" data-pid="${p.pid}">협상</button> <button class="btn sm" data-act="letGo" data-pid="${p.pid}">보내기</button>` },
      ], exp, { sort: { k: 'ovr', dir: -1 } }) : '<div class="muted">계약이 끝나는 선수가 없습니다.</div>'}<div class="row" style="margin-top:10px"><button class="btn pri" data-act="cont" data-mode="next">재계약 마치고 FA 시장 열기</button></div></div>`;
    }
    const hist = Object.entries(t.seasons).filter(([, r]) => r.rev).sort((a, b) => b[0] - a[0]).slice(0, 5);
    return `<h1>재정·계약</h1>${resign}
    <div class="grid g4" style="margin-bottom:14px">
      <div class="card"><h3>샐러리캡 (${U.seasonLabel(cy)})</h3><b style="font-size:20px">${U.money(F.cap(cy))}</b></div>
      <div class="card"><h3>연봉 총액</h3><b style="font-size:20px">${U.money(totals[0])}</b><div class="small ${totals[0] > F.cap(cy) ? 'muted' : ''}">${totals[0] > F.cap(cy) ? '캡 초과 ' + U.money(totals[0] - F.cap(cy)) : '캡 여유 ' + U.money(F.cap(cy) - totals[0])}</div></div>
      <div class="card"><h3>사치세 기준선</h3><b style="font-size:20px">${cy >= 2002 ? U.money(F.taxLine(cy)) : '없음'}</b>${cy >= 2002 && totals[0] > F.taxLine(cy) ? `<div class="small" style="color:var(--bad)">예상 사치세 ${U.money((totals[0] - F.taxLine(cy)) * 1.5)}</div>` : ''}</div>
      <div class="card"><h3>구단 자금</h3><b style="font-size:20px">${U.money(t.cash || 0)}</b><div class="small muted">팬 열기 ${Math.round(t.hype * 100)}/100</div></div>
    </div>
    <div class="card"><h2>계약 현황</h2><div class="tw"><table class="t"><thead><tr><th>선수</th><th class="r">나이</th><th class="c">능력</th>${years.map(y => `<th class="r">${U.seasonLabel(y)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${ps.map(p => `<tr><td>${App.plink(p)} ${p.contract?.rookie ? '<span class="pill">신인</span>' : ''}</td><td class="r">${P.age(p, cy)}</td><td class="c">${App.ovr(p.ovr)}</td>${years.map(y => `<td class="r">${p.contract && p.contract.exp >= y ? U.money(p.contract.amt) : '<span class="faint">-</span>'}</td>`).join('')}<td><button class="btn sm danger" data-act="release" data-pid="${p.pid}">방출</button></td></tr>`).join('')}
      ${dead.map(d => `<tr><td class="muted">${esc(d.name)} <span class="pill">방출(잔여 연봉)</span></td><td></td><td></td>${years.map(y => `<td class="r muted">${d.exp >= y ? U.money(d.amt) : '-'}</td>`).join('')}<td></td></tr>`).join('')}
      <tr><td><b>합계</b></td><td></td><td></td>${totals.map(v => `<td class="r"><b>${U.money(v)}</b></td>`).join('')}<td></td></tr>
      <tr><td class="muted">샐러리캡</td><td></td><td></td>${years.map(y => `<td class="r muted">${U.money(F.cap(y))}</td>`).join('')}<td></td></tr>
    </tbody></table></div></div>
    ${hist.length ? `<div class="card" style="margin-top:14px"><h2>지난 시즌 수입·지출</h2><div class="tw"><table class="t"><thead><tr><th>시즌</th><th class="r">수입</th><th class="r">지출(연봉+사치세)</th><th class="r">손익</th></tr></thead><tbody>${hist.map(([y, r]) => `<tr><td>${U.seasonLabel(+y)}</td><td class="r">${U.money(r.rev)}</td><td class="r">${U.money(r.expense)}</td><td class="r" style="color:${r.rev - r.expense >= 0 ? 'var(--good)' : 'var(--bad)'}">${U.money(r.rev - r.expense)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <p class="note" style="margin-top:12px">금액은 실제 계약이 아니라 선수 능력과 그 시즌의 실제 샐러리캡으로 추정했습니다. 캡을 넘은 팀은 버드 권리(자기 선수 재계약), 미드레벨 예외(1999년~), 최저 연봉 계약으로만 선수를 더할 수 있습니다.</p>`;
  };
  A.letGo = el => { const G = G_(); const p = G.players[+el.dataset.pid]; p.lastTid = G.userTid; p.tid = -1; p.contract = null; if (G.faSeen) G.faSeen[p.pid] = 1; App.toast(`${p.name}을(를) 보냈습니다`); App.rerender(); };
})();
