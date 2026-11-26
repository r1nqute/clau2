// 경기 전 화면과 생중계
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, Season = HM.Season, App = HM.App, R = HM.Ratings;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const G_ = () => App.G;

  // ---------- 경기 전 ----------
  App.preMatch = g => {
    const G = G_();
    const home = G.teams[g.h], away = G.teams[g.a];
    const my = G.userTid;
    const opp = g.h === my ? away : home;
    const key = tid => L.roster(G, tid).filter(p => !(p.injury && p.injury.days > 0)).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const inj = tid => L.roster(G, tid).filter(p => p.injury && p.injury.days > 0);
    const tac = G.teams[my].tactics;
    const tacTxt = `${App.TAC.pace.find(x => x[0] === tac.pace)?.[1]} · ${App.TAC.focus.find(x => x[0] === tac.focus)?.[1]} · ${App.TAC.def.find(x => x[0] === tac.def)?.[1]}`;
    let ctx = '';
    if (g.type === 'po') { const [ri, si] = g.series; const s = G.playoffs.rounds[ri][si]; ctx = `${Season.roundName(G, ri)} ${s.w[0] + s.w[1] + 1}차전 · 시리즈 ${G.teams[s.h].abbr} ${s.w[0]}-${s.w[1]} ${G.teams[s.a].abbr}`; }
    else if (g.type === 'playin') ctx = '플레이인 토너먼트';
    const side = t => `<div class="card flat" style="flex:1;min-width:220px"><div class="row nowrap"><span class="tbadge" style="${App.tstyle(t)}">${esc(t.abbr)}</span><div><b>${esc(t.ko)}</b><div class="small muted">${App.recTxt(t.tid)} · ${t.tid === g.h ? '홈' : '원정'}</div></div></div>
      <div style="margin-top:8px">${key(t.tid).map(p => `<div class="row small" style="justify-content:space-between"><span>${App.plink(p)}</span>${App.ovr(p.ovr)}</div>`).join('')}</div>
      ${inj(t.tid).length ? `<div class="small" style="margin-top:6px;color:var(--bad)">결장: ${inj(t.tid).map(p => esc(p.name)).join(', ')}</div>` : ''}</div>`;
    App.modal(`경기 날 — ${g.h === my ? 'vs' : '@'} ${esc(opp.ko)}`, `
      ${ctx ? `<div class="pill warn" style="margin-bottom:10px">${ctx}</div>` : ''}
      <div class="row" style="align-items:stretch">${side(home)}${side(away)}</div>
      <div class="note" style="margin-top:12px">우리 전술: <b>${tacTxt}</b> · 출전 시간 ${G.teams[my].rotation.auto ? '코치 자동' : '직접 설정'} · 선발 ${HM.Lineup && HM.Lineup.isFixed(G.teams[my].rotation) ? '직접 지정' : '코치 선택'} <a class="lnk" href="#/tactics">바꾸기</a></div>
      ${Season.mgrSet(G).on && App.matchupHtml ? `<div class="card flat" style="margin-top:12px"><h3>🧠 상대 분석</h3>${App.matchupHtml(opp.tid)}</div>` : ''}`,
      `<button class="btn" data-act="pmTactics">전술 수정</button><button class="btn" data-act="quickGame">결과만 보기</button><button class="btn pri" data-act="liveGame">생중계로 지휘</button>`);
  };
  A.pmTactics = () => { App.closeModal(); App.go('#/tactics'); };
  A.quickGame = () => {
    const G = G_();
    const g = Season.userGameToday(G);
    App.closeModal();
    if (!g) return;
    Season.day(G);
    App.autosave();
    showResult(g);
    App.rerender();
  };
  function showResult(g) {
    const G = G_(); const my = G.userTid;
    const home = g.h === my; const ms = home ? g.hs : g.as, os = home ? g.as : g.hs;
    const opp = G.teams[home ? g.a : g.h];
    const gm = G.games[g.gid];
    let top = '';
    if (gm) {
      const side = gm.res.teams.find(t => t.tid === my);
      const best = side.players.filter(s => s.min).sort((a, b) => (b.rat || 0) - (a.rat || 0)).slice(0, 3);
      top = best.map(s => { const p = G.players[s.pid]; return `<div class="row small" style="justify-content:space-between"><span>${App.plink(p)}</span><span>${s.pts}점 ${s.orb + s.drb}리 ${s.ast}어 · 평점 <b>${(s.rat || 0).toFixed(1)}</b></span></div>`; }).join('');
    }
    App.modal(ms > os ? '승리!' : '패배', `<div class="score"><div class="tm"><b>${esc(G.teams[my].abbr)}</b><span class="pts" style="margin-left:auto">${ms}</span></div><div class="mid"><b>${g.ot ? '연장 끝' : '경기 종료'}</b></div><div class="tm away"><b>${esc(opp.abbr)}</b><span class="pts" style="margin-right:auto">${os}</span></div></div><div style="margin-top:12px">${top}</div>`,
      `<a class="btn" href="#/game/${g.gid}" data-act="closeModalGo">박스스코어</a><button class="btn pri" data-act="cont" data-mode="next">계속</button>`);
  }
  App.showResult = showResult;

  // ---------- 생중계 ----------
  const SPEEDS = { 1: 1100, 2: 520, 3: 200, 4: 55 };
  A.liveGame = () => {
    const G = G_();
    const g = Season.userGameToday(G);
    App.closeModal();
    if (!g) return;
    const game = Season.makeGame(G, g, true);
    App.live = { g, game, speed: 2, paused: false, side: g.h === G.userTid ? 0 : 1, shown: 0, finished: false, half: false };
    App.go('#/live');
    setTimeout(() => App.resumeLive(), 300);
  };
  App.pauseLive = () => { if (App.live) { App.live.paused = true; clearTimeout(App.live.timer); App.live.timer = null; } };
  // 한 포제션씩: 엔진이 한 포제션을 치르고 → 코트에서 그 장면을 재생하고 → 끝나면 중계 글·기록을 갱신
  App.resumeLive = () => {
    const lv = App.live; if (!lv || lv.finished) return;
    lv.paused = false;
    clearTimeout(lv.timer);
    const chain = lv.chain = (lv.chain || 0) + 1;
    const alive = () => App.live === lv && !lv.paused && !lv.finished && lv.chain === chain;
    const tick = async () => {
      if (!alive()) return;
      if (lv.animP) await lv.animP; // 앞 장면이 아직 재생 중이면 기다린다
      if (!alive()) return;
      lv.game.next();
      const anim = App.livePlay ? App.livePlay() : null;
      if (anim) { lv.animP = anim; await anim; if (lv.animP === anim) lv.animP = null; }
      if (App.live !== lv || lv.chain !== chain || lv.finished) return;
      if (lv.game.done) return finishLive();
      // 하프타임에 잠깐 멈춘다
      if (!lv.half && lv.game.q === 3) { lv.half = true; if (Season.autoSet(G_()).halftime) { lv.paused = true; liveUpdate(); App.toast('하프타임 — 전술과 로테이션을 점검하세요', 3000); return; } }
      liveUpdate();
      if (!alive()) return;
      lv.timer = setTimeout(tick, anim ? 150 : SPEEDS[lv.speed]);
    };
    liveUpdate();
    lv.timer = setTimeout(tick, 250);
  };
  function finishLive() {
    const lv = App.live; const G = G_();
    lv.finished = true; clearTimeout(lv.timer);
    if (App.stopPlay) App.stopPlay();
    const res = lv.game.result();
    Season.day(G, res);
    App.autosave();
    liveUpdate();
  }

  S.live = () => {
    const lv = App.live; const G = G_();
    if (!lv) return '<div class="empty">진행 중인 경기가 없습니다</div>';
    return `<div class="card" id="lv-score"></div>
      <div class="row" style="margin:12px 0" id="lv-ctrl"></div>
      <div class="card" id="lv-coach" style="margin-bottom:12px" hidden></div>
      <div class="card" style="margin-bottom:14px"><h2>코트 <span class="r"><span class="small muted" id="lv-shotstat"></span> <select id="lvShotFilter" data-change="shotFilter">${[['all', '두 팀 슛'], ['0', G.teams[lv.g.h].abbr], ['1', G.teams[lv.g.a].abbr]].map(([v, l]) => `<option value="${v}" ${(lv.shotFilter || 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></span></h2>
        <div class="viz-grid">${App.courtHtml('lv-viz')}<div><div class="row" style="margin-bottom:8px"><b>🔥 하이라이트</b><span class="sp"></span><button class="btn sm" data-act="liveReel">▶ 다시 보기</button></div><div class="hl-list" id="lv-hl"></div></div></div></div>
      <div class="grid g3">
        <div class="card span2"><h2>중계</h2><div class="feed" id="lv-feed"></div></div>
        <div class="card"><h2>코트 위 <span class="r" id="lv-tf"></span></h2><div id="lv-court"></div></div>
      </div>
      <div class="card" style="margin-top:14px"><h2>팀 기록</h2><div id="lv-team"></div></div>`;
  };
  App.afters.live = () => liveUpdate();

  function liveUpdate() {
    if (App.coachUpdate) App.coachUpdate(); // 코치 조언 패널도 매 포제션 갱신
    if (App.liveCourt) App.liveCourt();
    const lv = App.live; const G = G_();
    if (!lv || App.route.name !== 'live') return;
    const game = lv.game;
    const [th, ta] = [G.teams[lv.g.h], G.teams[lv.g.a]];
    const clock = Math.max(0, Math.round(game.clock));
    const qtxt = game.done ? '경기 종료' : game.q <= 4 ? `${game.q}쿼터` : `연장 ${game.q - 4}`;
    const sc = document.getElementById('lv-score');
    if (sc) sc.innerHTML = `<div class="score">
      <div class="tm"><span class="tbadge lg" style="${App.tstyle(th)}">${esc(th.abbr)}</span><div class="hide-m"><b>${esc(th.ko)}</b><div class="small muted">팀 파울 ${game.T[0].tfouls}</div></div><span class="pts" style="margin-left:auto">${game.score[0]}</span></div>
      <div class="mid"><b>${qtxt}</b><span class="num">${game.done ? '' : `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`}</span></div>
      <div class="tm away"><span class="tbadge lg" style="${App.tstyle(ta)}">${esc(ta.abbr)}</span><div class="hide-m"><b>${esc(ta.ko)}</b><div class="small muted">팀 파울 ${game.T[1].tfouls}</div></div><span class="pts" style="margin-right:auto">${game.score[1]}</span></div></div>`;
    const ctrl = document.getElementById('lv-ctrl');
    if (ctrl) ctrl.innerHTML = lv.finished ?
      `<span class="pill ${game.score[lv.side] > game.score[1 - lv.side] ? 'good' : 'bad'}">${game.score[lv.side] > game.score[1 - lv.side] ? '승리!' : '패배'}</span><a class="btn" href="#/game/${lv.g.gid}" data-act="liveBox">박스스코어</a><button class="btn pri" data-act="liveDone">계속</button>` :
      `<button class="btn ${lv.paused ? 'pri' : ''}" data-act="livePause">${lv.paused ? '▶ 재개' : '⏸ 멈춤'}</button>
       ${[1, 2, 3, 4].map(s => `<button class="btn sm ${lv.speed === s ? 'pri' : ''}" data-act="liveSpeed" data-s="${s}">${['', '느리게', '보통', '빠르게', '아주 빠르게'][s]}</button>`).join('')}
       <span class="sp"></span><button class="btn" data-act="liveTac">작전 지시</button><button class="btn" data-act="liveSub">선수 교체</button>
       <button class="btn" data-act="liveSkip" data-to="q">다음 쿼터로 ⏭</button>${game.q < 4 || (game.q === 4 && game.clock > 300) ? '<button class="btn" data-act="liveSkip" data-to="clutch">4쿼터 막판(5분)으로 ⏭</button>' : ''}<button class="btn" data-act="liveEnd">끝까지 ⏭</button>`;
    const feed = document.getElementById('lv-feed');
    if (feed) {
      const ev = game.log.slice(-160).reverse();
      feed.innerHTML = ev.map(e => {
        const col = e.side === 0 ? th.colors[0] : e.side === 1 ? ta.colors[0] : 'transparent';
        return `<div class="ev ${e.kind}"><span class="tm">${e.q <= 4 ? e.q + 'Q' : 'OT'} ${Math.floor(e.clock / 60)}:${String(e.clock % 60).padStart(2, '0')}</span><span class="tx" style="border-left:3px solid ${col};padding-left:6px">${esc(e.text)}</span><span class="sc">${e.score[0]}-${e.score[1]}</span></div>`;
      }).join('');
    }
    const my = game.T[lv.side];
    const court = document.getElementById('lv-court');
    if (court) {
      const row = r => { const e = r.energy; const cls = e < 0.6 ? 'low' : e < 0.8 ? 'mid' : ''; return `<tr><td>${r.onCourt ? '🟢' : ''} ${esc(r.nm)}${r.out ? ' <span class="pill bad">퇴장/부상</span>' : ''}</td><td><span class="energy ${cls}"><i style="width:${Math.round(e * 100)}%"></i></span></td><td class="r">${r.s.pts}</td><td class="r">${r.s.orb + r.s.drb}</td><td class="r">${r.s.ast}</td><td class="r">${r.s.pf}</td><td class="r">${Math.round(r.min / 60)}</td></tr>`; };
      const list = my.roster.slice().sort((a, b) => (b.onCourt - a.onCourt) || b.min - a.min);
      court.innerHTML = `<div class="tw"><table class="t"><thead><tr><th>${esc(G.teams[my.tid].abbr)}</th><th>체력</th><th class="r">점</th><th class="r">리</th><th class="r">어</th><th class="r">파</th><th class="r">분</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`;
    }
    const tf = document.getElementById('lv-tf'); if (tf) tf.textContent = my.tac ? `${App.TAC.focus.find(x => x[0] === my.tac.focus)?.[1]} · ${App.TAC.def.find(x => x[0] === my.tac.def)?.[1]}` : '';
    const team = document.getElementById('lv-team');
    if (team) {
      const sum = t => { const o = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0 }; for (const r of t.roster) for (const k in o) o[k] += r.s[k]; return o; };
      const a = sum(game.T[0]), b = sum(game.T[1]);
      const line = (lab, x, y) => `<tr><td class="r"><b>${x}</b></td><td class="c muted">${lab}</td><td><b>${y}</b></td></tr>`;
      team.innerHTML = `<div class="tw"><table class="t"><tbody>
        ${line('야투', `${a.fgm}/${a.fga} (${App.pct(a.fgm, a.fga)}%)`, `${b.fgm}/${b.fga} (${App.pct(b.fgm, b.fga)}%)`)}
        ${line('3점', `${a.tpm}/${a.tpa}`, `${b.tpm}/${b.tpa}`)}${line('자유투', `${a.ftm}/${a.fta}`, `${b.ftm}/${b.fta}`)}
        ${line('리바운드(공격)', `${a.orb + a.drb} (${a.orb})`, `${b.orb + b.drb} (${b.orb})`)}${line('어시스트', a.ast, b.ast)}${line('턴오버', a.tov, b.tov)}${line('스틸 · 블록', `${a.stl} · ${a.blk}`, `${b.stl} · ${b.blk}`)}
      </tbody></table></div>`;
    }
  }
  App.liveUpdate = liveUpdate;
  A.livePause = () => { const lv = App.live; if (lv.paused) App.resumeLive(); else { App.pauseLive(); liveUpdate(); } };
  A.liveSpeed = el => { App.live.speed = +el.dataset.s; liveUpdate(); };
  A.liveEnd = () => {
    const lv = App.live; App.pauseLive(); if (App.stopPlay) App.stopPlay();
    const game = lv.game;
    let guard = 0;
    while (!game.done && guard++ < 3000) game.next();
    finishLive();
  };
  // 지루한 구간 건너뛰기: 다음 쿼터 / 4쿼터 막판
  A.liveSkip = el => {
    const lv = App.live; const game = lv.game;
    const wasPaused = lv.paused;
    App.pauseLive(); if (App.stopPlay) App.stopPlay();
    const q0 = game.q;
    let guard = 0;
    if (el.dataset.to === 'q') { while (!game.done && game.q === q0 && guard++ < 3000) game.next(); }
    else { while (!game.done && !(game.q >= 4 && game.clock <= 300) && guard++ < 3000) game.next(); }
    if (game.q >= 3) lv.half = true;
    if (game.done) return finishLive();
    game.say(-1, el.dataset.to === 'q' ? `— ${game.q <= 4 ? game.q + '쿼터' : '연장'} 시작까지 건너뜀 —` : '— 4쿼터 막판까지 건너뜀 —', 'period');
    if (wasPaused) liveUpdate(); else App.resumeLive();
  };
  A.liveBox = el => { App.go(el.getAttribute('href')); };
  A.liveDone = () => {
    const lv = App.live; const g = lv.g;
    App.live = null;
    App.go('#/home');
    void g;
  };
  A.liveTac = () => {
    const lv = App.live; App.pauseLive(); liveUpdate();
    const tac = lv.game.T[lv.side].tac;
    const grp = (key, title) => `<h3>${title}</h3><div class="row" style="margin-bottom:10px">${App.TAC[key].map(([v, l]) => `<label class="pill" style="cursor:pointer;padding:6px 10px"><input type="radio" name="lt-${key}" value="${v}" ${String(tac[key]) === String(v) ? 'checked' : ''} data-change="liveTacSet" data-key="${key}"> ${l}</label>`).join('')}</div>`;
    App.modal('작전 지시', grp('pace', '템포') + grp('focus', '공격') + grp('def', '수비') + grp('reb', '리바운드'), '<button class="btn pri" data-act="liveResume">적용하고 재개</button>');
  };
  A.liveTacSet = el => {
    const lv = App.live; const key = el.dataset.key; const v = key === 'pace' ? +el.value : el.value;
    lv.game.T[lv.side].tac[key] = v; G_().teams[G_().userTid].tactics[key] = v;
  };
  A.liveResume = () => { App.closeModal(); App.resumeLive(); };
  A.liveSub = () => {
    const lv = App.live; App.pauseLive(); liveUpdate();
    const t = lv.game.T[lv.side];
    const rows = t.roster.map(r => `<label class="row nowrap" style="padding:6px;border-bottom:1px solid var(--line);gap:10px;cursor:pointer"><input type="checkbox" data-change="liveSubTog" value="${r.p.pid}" ${r.onCourt ? 'checked' : ''} ${r.out ? 'disabled' : ''}><span style="flex:1">${esc(r.p.name)} <span class="faint small">${r.p.pos} · ${Math.round(r.p.ovr)}</span></span><span class="energy ${r.energy < 0.6 ? 'low' : r.energy < 0.8 ? 'mid' : ''}"><i style="width:${Math.round(r.energy * 100)}%"></i></span><span class="small muted">${r.s.pf}파울</span></label>`).join('');
    App.modal('선수 교체', `<p class="small muted">코트에 내보낼 5명을 고르세요. 다음 데드볼에 교체됩니다.</p>${rows}<label class="row small" style="margin-top:10px"><input type="checkbox" id="lockCourt" ${t.lockCourt ? 'checked' : ''}> 코치 자동 교체 끄기(직접 교체한 5명을 계속 기용)</label>`,
      '<button class="btn" data-act="liveResume">취소</button><button class="btn pri" data-act="liveSubApply">교체</button>');
  };
  A.liveSubTog = () => { };
  A.liveSubApply = () => {
    const lv = App.live; const t = lv.game.T[lv.side];
    const ids = [...document.querySelectorAll('[data-change="liveSubTog"]:checked')].map(x => +x.value);
    t.lockCourt = document.getElementById('lockCourt').checked;
    if (ids.length !== 5) { App.toast('정확히 5명을 골라야 합니다'); return; }
    const want = ids.map(id => t.roster.find(r => r.p.pid === id));
    lv.game.setCourt(t, want);
    App.closeModal(); App.resumeLive();
  };
})();
