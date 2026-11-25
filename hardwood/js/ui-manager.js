// 매니저 모드 화면: 수석 코치 보고서, 경기 전 상대 분석, 생중계 코치 조언
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, Season = HM.Season, AI = HM.AI, App = HM.App, R = HM.Ratings, Adv = HM.Adv;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const G_ = () => App.G;
  const M_ = () => Season.mgrSet(G_());
  const TXT = Adv.TXT;
  const effTxt = e => `${e >= 0 ? '+' : ''}${e.toFixed(1)}`;

  function mgrToggles() {
    const M = M_();
    const tog = (k, l, d) => `<label class="opt"><input type="checkbox" id="mgr-${k}" ${M[k] ? 'checked' : ''} data-change="mgrTog" data-k="${k}"><span><b>${l}</b><span class="small muted">${d}</span></span></label>`;
    return `<div class="grid g4">${tog('on', '매니저 모드 켜기', '경기 전 상대 분석과 코치 조언을 보여 줍니다.')}${tog('live', '경기 중 코치 조언', '생중계에 조언과 적용 단추를 띄웁니다.')}${tog('auto', '코치에게 경기 운영 맡기기', '경기 중 조언을 코치가 바로 적용합니다(결과만 보기 경기에도).')}${tog('report', '월간 코치 보고서', '매달 1일 받은 편지함으로 보고서를 보냅니다.')}</div>`;
  }
  A.mgrTog = el => { M_()[el.dataset.k] = el.checked; App.autosave(); App.rerender(); };

  // ---------- 수석 코치 보고서 ----------
  S.manager = () => {
    const G = G_(), tid = G.userTid;
    const M = M_();
    const dg = Adv.diagnose(G, tid), dp = Adv.depth(G, tid);
    const n = dg.n;
    const bar = x => {
      const pct = Math.round((1 - (x.rank - 1) / Math.max(1, n - 1)) * 100);
      const col = x.tag === 'good' ? 'var(--good)' : x.tag === 'bad' ? 'var(--bad)' : 'var(--accent)';
      return `<div class="row nowrap" style="gap:10px;padding:4px 0"><span style="width:92px;flex:none" class="small">${x.label}</span><div class="bar" style="flex:1"><i style="width:${pct}%;background:${col}"></i></div><span class="small num" style="width:64px;text-align:right">${x.rank}위/${n}</span>${x.tag ? `<span class="pill ${x.tag}" style="width:42px;justify-content:center">${x.tag === 'good' ? '강점' : '약점'}</span>` : '<span style="width:42px"></span>'}</div>`;
    };
    // 포지션 뎁스
    const depthCols = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => {
      const d = dp.pos[pos];
      const list = d.list.slice().sort((a, b) => b.ovr - a.ovr);
      return `<div class="card flat" style="padding:10px;${d.short ? 'border-color:var(--bad)' : ''}"><div class="row" style="justify-content:space-between"><b>${pos}</b>${d.short ? '<span class="pill bad">부족</span>' : d.many ? '<span class="pill">과잉</span>' : d.need >= 4 ? '<span class="pill warn">보강 필요</span>' : '<span class="pill good">충분</span>'}</div>
        <div style="margin-top:6px">${list.map(p => `<div class="row small nowrap" style="justify-content:space-between;padding:2px 0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.plink(p)}${p.injury && p.injury.days > 0 ? ' 🩹' : ''}</span>${App.ovr(p.ovr)}</div>`).join('') || '<span class="small muted">없음</span>'}</div></div>`;
    }).join('');
    // 영입
    const fa = Adv.faTargets(G), tr = Adv.tradeTargets(G);
    const full = L.roster(G, tid).length >= 15;
    const faRows = fa.map(x => `<tr><td>${App.plink(x.p)}</td><td class="c">${x.p.pos}</td><td class="r">${P.age(x.p, AI.capYear(G))}</td><td class="c">${App.ovr(x.p.ovr)}</td><td class="r">${U.money(x.ask.amt)}×${x.ask.yrs}</td><td class="small">${x.reasons.map(esc).join(' · ')}</td><td><button class="btn sm pri" data-act="negotiate" data-pid="${x.p.pid}" ${x.can ? '' : 'disabled'}>협상</button></td></tr>`).join('');
    const pkgTxt = x => {
      const k = x.pkg;
      const give = k.ap.map(id => `${esc(G.players[id].name)}(${Math.round(G.players[id].ovr)})`).concat(k.ak.map(id => { const pk = G.picks.find(z => z.id === id); return `${pk.season} ${pk.round}R`; }));
      const extra = k.bp.filter(id => id !== x.p.pid).map(id => esc(G.players[id].name));
      return `${give.join(' + ') || '-'}${extra.length ? ` <span class="faint">(함께 받음: ${extra.join(', ')})</span>` : ''}`;
    };
    const trRows = tr.map(x => `<tr><td>${App.plink(x.p)}</td><td>${App.tchip(x.team)}</td><td class="c">${x.p.pos}</td><td class="r">${P.age(x.p, G.season)}</td><td class="c">${App.ovr(x.p.ovr)}</td><td class="r">${U.money(x.p.contract?.amt)}</td><td class="small">${x.reasons.map(esc).join(' · ')}</td><td class="small">${pkgTxt(x)}</td><td><button class="btn sm" data-act="mgrTrade" data-pid="${x.p.pid}" ${App.tradeAllowed() ? '' : 'disabled'}>트레이드 준비</button></td></tr>`).join('');
    // 방출
    const rel = Adv.releaseCands(G);
    const relRows = rel.map(x => `<tr><td>${App.plink(x.p)}</td><td class="c">${x.p.pos}</td><td class="c">${App.ovr(x.p.ovr)}</td><td class="r">${U.money(x.p.contract?.amt)}</td><td class="small">${x.reasons.map(esc).join(' · ')}</td><td class="r small">${x.dead ? `잔여 ${U.money(x.dead)}` : '-'}</td><td><button class="btn sm danger" data-act="release" data-pid="${x.p.pid}">방출</button> <button class="btn sm" data-act="tradeWith" data-pid="${x.p.pid}">트레이드</button></td></tr>`).join('');
    // 전술
    const rt = Adv.recommendTactics(G, tid);
    const tacRow = (k, title) => {
      const cur = rt.cur[k], rec = rt.rec[k];
      const opts = rt.opts[k].map(o => `<span class="pill ${o.v === rec ? 'good' : ''}" title="100포제션당">${TXT[k][o.v]} ${effTxt(o.eff)}</span>`).join(' ');
      return `<tr><td><b>${title}</b></td><td>${TXT[k][cur]}</td><td>${cur === rec ? '<span class="muted">유지</span>' : `<b>${TXT[k][rec]}</b>`}</td><td class="small">${opts}</td></tr>`;
    };
    const ng = G.schedule.find(g => !g.played && (g.h === tid || g.a === tid));
    const oppTid = ng ? (ng.h === tid ? ng.a : ng.h) : null;
    return `<div class="row"><h1>🧠 매니저 모드</h1><span class="sp"></span><span class="small muted">수석 코치 보고서 · ${U.fmtDate(G.date)}</span></div>
    ${mgrToggles()}
    ${!M.on ? '<div class="note" style="margin-top:12px">매니저 모드가 꺼져 있습니다. 보고서는 그대로 볼 수 있지만 경기 전·경기 중 조언은 나오지 않습니다.</div>' : ''}
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>팀 진단 <span class="r">출전 시간으로 가중한 로테이션 기준</span></h2>${dg.items.map(bar).join('')}
        <div class="note" style="margin-top:10px">${dg.weak.length ? `약점은 <b>${dg.weak.map(w => w.label).join(', ')}</b>입니다. 이 부분을 채울 선수를 찾으세요.` : '눈에 띄는 약점이 없습니다.'}${dg.strong.length ? ` 강점은 ${dg.strong.map(w => w.label).join(', ')}입니다.` : ''}</div></div>
      <div class="card"><h2>포지션 뎁스 <span class="r">${dp.needs.length ? `부족: ${dp.needs.join(', ')}` : '포지션 균형 양호'}</span></h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">${depthCols}</div>
        <p class="small muted" style="margin-top:8px">로테이션 기준선(9번째 선수 능력): ${Math.round(dp.cut)} · 주전 평균: ${Math.round(dp.top5)}. 인접 포지션 선수(예: SG↔SF)는 약간 낮춰서 대신할 수 있다고 봅니다.</p></div>
    </div>
    <div class="card" style="margin-top:14px"><h2>영입 추천 — 자유계약 <span class="r">${full ? '로스터가 꽉 찼습니다(15명): 먼저 정리가 필요합니다' : `로스터 ${L.roster(G, tid).length}/15 · 캡 여유 ${U.money(Math.max(0, AI.capRoom(G, tid)))}`}</span></h2>
      ${faRows ? `<div class="tw"><table class="t"><thead><tr><th>선수</th><th class="c">포지션</th><th class="r">나이</th><th class="c">능력</th><th class="r">요구</th><th>이유</th><th></th></tr></thead><tbody>${faRows}</tbody></table></div>` : '<div class="muted">지금 시장에는 로테이션을 끌어올릴 선수가 없습니다.</div>'}</div>
    <div class="card" style="margin-top:14px"><h2>영입 추천 — 트레이드 <span class="r">${App.tradeAllowed() ? '상대가 받아 줄 묶음까지 맞춰 본 대상' : '지금은 트레이드 기간이 아닙니다'}</span></h2>
      ${trRows ? `<div class="tw"><table class="t"><thead><tr><th>선수</th><th>팀</th><th class="c">포지션</th><th class="r">나이</th><th class="c">능력</th><th class="r">연봉</th><th>이유</th><th>예상 대가(우리가 보낼 것)</th><th></th></tr></thead><tbody>${trRows}</tbody></table></div>` : '<div class="muted">추천할 트레이드 대상이 없습니다.</div>'}
      <p class="small muted" style="margin-top:6px">상대가 받아 줄 만한 묶음을 실제로 맞춰 본 대상만 보여 줍니다. 우리 핵심 두 명(${Adv.coreOf(G, tid).map(id => esc(G.players[id].name)).join(', ')})은 묶음에 넣지 않습니다. "트레이드 준비"를 누르면 그 묶음이 트레이드 화면에 채워집니다.</p></div>
    <div class="card" style="margin-top:14px"><h2>정리 추천 — 방출·트레이드 후보</h2>
      ${relRows ? `<div class="tw"><table class="t"><thead><tr><th>선수</th><th class="c">포지션</th><th class="c">능력</th><th class="r">연봉</th><th>이유</th><th class="r">방출 시 부담</th><th></th></tr></thead><tbody>${relRows}</tbody></table></div>` : '<div class="muted">정리할 선수가 없습니다.</div>'}</div>
    <div class="card" style="margin-top:14px"><h2>전술 추천 <span class="r">리그 평균 상대 기준 · 숫자는 100포제션당 득실</span></h2>
      <div class="tw"><table class="t"><thead><tr><th></th><th>지금</th><th>추천</th><th>선택지별 효과</th></tr></thead><tbody>
      ${tacRow('focus', '공격')}${tacRow('def', '수비')}${tacRow('reb', '리바운드')}
      <tr><td><b>템포</b></td><td>${TXT.pace[rt.cur.pace]}</td><td>${rt.cur.pace === rt.rec.pace ? '<span class="muted">유지</span>' : `<b>${TXT.pace[rt.rec.pace]}</b>`}</td><td class="small">${esc(rt.pace.why)}</td></tr>
      </tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn pri" data-act="mgrApplyTac" ${JSON.stringify(rt.rec) === JSON.stringify({ focus: rt.cur.focus, def: rt.cur.def, reb: rt.cur.reb, pace: rt.cur.pace }) ? 'disabled' : ''}>추천 전술 적용</button><span class="small muted">${rt.gain > 0.05 ? `지금보다 100포제션당 약 ${rt.gain.toFixed(1)}점 이득으로 봅니다.` : '지금 전술이 이미 무난합니다.'} 효과 계산은 경기 엔진과 같은 공식을 씁니다.</span></div></div>
    ${oppTid !== null ? `<div class="card" style="margin-top:14px"><h2>다음 상대 분석 <span class="r">${U.fmtDate(ng.date)}</span></h2>${App.matchupHtml(oppTid)}</div>` : ''}`;
  };
  A.mgrApplyTac = () => {
    const G = G_(); const rt = Adv.recommendTactics(G, G.userTid);
    Object.assign(G.teams[G.userTid].tactics, rt.rec);
    App.toast('추천 전술을 적용했습니다'); App.autosave(); App.rerender();
  };
  A.mgrTrade = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    App.ui.trade = { partner: p.tid, mine: [], theirs: [p.pid], myPicks: [], theirPicks: [] };
    const o = { a: G.userTid, b: p.tid, ap: [], bp: [p.pid], ak: [], bk: [] };
    const n = AI.balance(G, o, p.tid, Adv.coreOf(G, G.userTid));
    if (n) App.ui.trade = { partner: p.tid, mine: n.ap, theirs: n.bp, myPicks: n.ak, theirPicks: n.bk };
    App.go('#/trade');
    App.toast(n ? '상대가 원할 만한 조건으로 채웠습니다. 확인하고 제안하세요' : '상대가 맞출 조합을 찾지 못했습니다. 직접 골라 보세요', 3500);
  };

  // ---------- 상대 분석(경기 전·보고서 공용) ----------
  App.matchupHtml = oppTid => {
    const G = G_();
    const mu = Adv.matchup(G, oppTid);
    const t = G.teams[oppTid];
    const rt = mu.rt;
    const notes = mu.notes.slice(0, 6).map(nn => `<span class="pill ${nn.good ? 'good' : 'warn'}">${esc(nn.txt)}</span>`).join(' ');
    const changes = ['focus', 'def', 'reb', 'pace'].filter(k => String(rt.rec[k]) !== String(rt.cur[k])).map(k => `${{ focus: '공격', def: '수비', reb: '리바운드', pace: '템포' }[k]}: ${TXT[k][rt.cur[k]]} → <b>${TXT[k][rt.rec[k]]}</b>`);
    return `<div class="row nowrap" style="gap:10px"><span class="tbadge" style="${App.tstyle(t)}">${esc(t.abbr)}</span><div style="min-width:0"><b>${esc(t.ko)}</b> <span class="small muted">${App.recTxt(oppTid)} · 상대 전술: ${TXT.focus[mu.tac.focus]}, ${TXT.def[mu.tac.def]}</span>
      <div class="small" style="margin-top:2px">핵심 선수: ${mu.key.map(p => `${App.plink(p)} ${Math.round(p.ovr)}`).join(', ')}${mu.out.length ? ` · <span style="color:var(--bad)">결장: ${mu.out.map(p => esc(p.name)).join(', ')}</span>` : ''}</div></div></div>
      <div class="row" style="margin-top:8px">${notes || '<span class="small muted">두드러진 강점·약점이 없는 팀입니다.</span>'}</div>
      <div class="note" style="margin-top:8px">🧠 코치 추천: ${changes.length ? changes.join(' · ') : '지금 전술 그대로 가도 좋습니다.'}<br><span class="small muted">${esc(rt.pace.why)}${rt.gain > 0.05 ? ` 추천대로면 100포제션당 약 ${rt.gain.toFixed(1)}점 이득.` : ''}</span>
      ${changes.length ? `<div style="margin-top:6px"><button class="btn sm pri" data-act="mgrApplyVs" data-opp="${oppTid}">이 상대에 맞춰 전술 적용</button></div>` : ''}</div>`;
  };
  A.mgrApplyVs = el => {
    const G = G_(); const rt = Adv.recommendTactics(G, G.userTid, +el.dataset.opp);
    Object.assign(G.teams[G.userTid].tactics, rt.rec);
    App.toast('상대에 맞춘 전술을 적용했습니다');
    App.autosave();
    const ug = Season.userGameToday(G);
    if (App.modalOpen && ug) App.preMatch(ug); else App.rerender();
  };

  // ---------- 생중계 코치 조언 ----------
  App.coachUpdate = () => {
    const el = document.getElementById('lv-coach');
    const lv = App.live; if (!el || !lv) return;
    const M = M_();
    if (!M.on || !M.live) { el.hidden = true; return; }
    el.hidden = false;
    if (lv.finished) { el.innerHTML = '<h2>🧠 코치 조언</h2><div class="small muted">경기가 끝났습니다.</div>'; return; }
    const game = lv.game, side = lv.side;
    const dismissed = lv.dismissed || (lv.dismissed = {});
    const tips = Adv.liveTips(game, side).filter(t => !dismissed[t.id]).slice(0, 3);
    lv.tips = tips;
    const auto = !!game.autoCoach[side];
    const recent = game.log.filter(e => e.kind === 'coach' && e.side === side).slice(-2).reverse();
    el.innerHTML = `<div class="row"><h2 style="margin:0">🧠 코치 조언</h2><span class="sp"></span><label class="row small" style="gap:6px"><input type="checkbox" id="coachAuto" ${auto ? 'checked' : ''} data-change="coachAuto"> 코치에게 맡기기</label></div>
      ${tips.length ? `<div class="grid" style="margin-top:8px;gap:6px">${tips.map(t => `<div class="row nowrap" style="gap:8px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--panel2)"><span>${t.kind === 'sub' ? '🔁' : '📋'}</span><span class="small" style="flex:1;min-width:0">${esc(t.txt)}</span><button class="btn sm pri" data-act="tipApply" data-id="${esc(t.id)}">적용</button><button class="btn sm" data-act="tipDismiss" data-id="${esc(t.id)}" aria-label="무시">✕</button></div>`).join('')}</div>` : `<div class="small muted" style="margin-top:6px">${auto ? '코치가 경기를 지켜보며 필요할 때 조정합니다.' : '지금은 특별히 바꿀 것이 없습니다.'}</div>`}
      ${recent.length ? `<div class="small muted" style="margin-top:6px">${recent.map(e => esc(e.text)).join('<br>')}</div>` : ''}`;
  };
  A.tipApply = el => {
    const lv = App.live; if (!lv || !lv.tips) return;
    const t = lv.tips.find(x => x.id === el.dataset.id); if (!t) return;
    t.act();
    (lv.dismissed || (lv.dismissed = {}))[t.id] = 1;
    lv.game.say(lv.side, `🧠 감독 지시: ${t.txt}`, 'coach');
    const tac = lv.game.T[lv.side].tac; Object.assign(G_().teams[G_().userTid].tactics, { pace: tac.pace, focus: tac.focus, def: tac.def, reb: tac.reb });
    App.toast('적용했습니다');
    App.liveUpdate();
  };
  A.tipDismiss = el => { const lv = App.live; (lv.dismissed || (lv.dismissed = {}))[el.dataset.id] = 1; App.coachUpdate(); };
  A.coachAuto = el => { const lv = App.live; lv.game.autoCoach[lv.side] = el.checked; App.coachUpdate(); };
})();
