// 화면들
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, Season = HM.Season, R = HM.Ratings, AI = HM.AI, App = HM.App;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const D = () => globalThis.HM_DATA;
  const G_ = () => App.G;

  const ICON = { info: 'ℹ️', board: '🏛️', injury: '🩹', season: '🏀', award: '🏅', draft: '🎓', contract: '✍️', offer: '🔄', complaint: '😠', champ: '🏆', scout: '🔔', coach: '🧠', train: '🏋️' };

  // ---------- 홈 ----------
  S.home = () => {
    const G = G_(), t = G.teams[G.userTid], r = L.rec(G, G.userTid);
    const conf = Season.standings(G, t.conf);
    const pos = conf.findIndex(x => x.t.tid === G.userTid) + 1;
    const myGames = G.schedule.filter(g => g.h === G.userTid || g.a === G.userTid);
    const recent = myGames.filter(g => g.played).slice(-5).reverse();
    const upcoming = myGames.filter(g => !g.played).slice(0, 5);
    const ug = Season.userGameToday(G);
    const roster = L.roster(G, G.userTid);
    const leaders = ['pts', 'reb', 'ast'].map(k => {
      let best = null, bv = -1;
      for (const p of roster) { const l = App.line(p); if (!l || l.gp < 1) continue; const v = (k === 'reb' ? l.orb + l.drb : l[k]) / l.gp; if (v > bv) { bv = v; best = p; } }
      return [k, best, bv];
    });
    const conf100 = Math.round(G.board.conf);
    const gameRow = g => {
      const home = g.h === G.userTid, opp = G.teams[home ? g.a : g.h];
      let res = '';
      if (g.played) { const my = home ? g.hs : g.as, op = home ? g.as : g.hs; res = `<span class="pill ${my > op ? 'good' : 'bad'}">${my > op ? '승' : '패'}</span> <b class="num">${my}-${op}</b>${g.ot ? ` <span class="faint small">OT</span>` : ''}`; }
      return `<tr><td class="muted small">${U.fmtDateShort(g.date)}</td><td>${home ? 'vs' : '@'} ${App.tchip(opp)} ${App.tlink(opp)}</td><td class="r">${g.played ? `<a class="lnk" href="#/game/${g.gid}">${res}</a>` : `<span class="muted small">${App.recTxt(opp.tid)}</span>`}</td></tr>`;
    };
    const unread = G.inbox.slice(0, 4);
    return `
    <div class="grid g3">
      <div class="card span2">
        <div class="row nowrap"><span class="tbadge lg" style="${App.tstyle(t)}">${esc(t.abbr)}</span>
          <div><h1 style="margin:0">${esc(t.ko)}</h1><div class="muted">${esc(t.name)} · ${t.conf === 'E' ? '동부' : '서부'} 컨퍼런스 · 감독 ${esc(G.manager.name)}</div></div></div>
        <div class="grid g4 kpi" style="margin-top:14px">
          <div><h3>성적</h3><b style="font-size:20px">${r.w}-${r.l}</b><div class="small muted">${t.conf === 'E' ? '동부' : '서부'} ${pos}위</div></div>
          <div><h3>연속</h3><b style="font-size:20px">${r.streak > 0 ? r.streak + '연승' : r.streak < 0 ? (-r.streak) + '연패' : '-'}</b><div class="small muted">최근 10경기 ${r.last.filter(x => x).length}-${r.last.filter(x => !x).length}</div></div>
          <div><h3>득실</h3><b style="font-size:20px">${r.w + r.l ? ((r.pf - r.pa) / (r.w + r.l) > 0 ? '+' : '') + ((r.pf - r.pa) / (r.w + r.l)).toFixed(1) : '-'}</b><div class="small muted">경기당</div></div>
          <div><h3>이사회 신뢰</h3><b style="font-size:20px">${conf100}</b><div class="bar" style="margin-top:6px"><i style="width:${conf100}%;background:${conf100 < 30 ? 'var(--bad)' : conf100 < 55 ? 'var(--warn)' : 'var(--good)'}"></i></div></div>
        </div>
        <div class="note" style="margin-top:12px">🏛️ 이사회 목표: <b>${esc(G.board.exp?.txt || '-')}</b></div>
      </div>
      <div class="card">
        <h2>다음 경기</h2>
        ${upcoming[0] ? (() => { const g = upcoming[0], home = g.h === G.userTid, opp = G.teams[home ? g.a : g.h]; return `
          <div class="row nowrap" style="gap:12px"><span class="tbadge lg" style="${App.tstyle(opp)}">${esc(opp.abbr)}</span>
          <div><b>${home ? '홈' : '원정'} · ${esc(opp.ko)}</b><div class="muted small">${U.fmtDate(g.date)}${g.type === 'po' ? ' · 플레이오프' : g.type === 'playin' ? ' · 플레이인' : ''}</div><div class="small">${App.recTxt(opp.tid)}</div></div></div>
          ${ug ? '<button class="btn pri" style="margin-top:12px;width:100%" data-act="cont" data-mode="next">경기 시작</button>' : ''}`; })() : `<div class="muted">${G.phase === 'preseason' ? '개막 전입니다.' : G.phase === 'fa' ? '자유계약 시장 기간입니다.' : G.phase === 'draft' ? '드래프트 날입니다.' : G.phase === 'resign' ? '재계약 기간입니다.' : '예정된 경기가 없습니다.'}</div>`}
      </div>
      <div class="card">
        <h2>팀 리더 <span class="r">${U.seasonLabel(G.season)}</span></h2>
        ${leaders.map(([k, p, v]) => p ? `<div class="row" style="justify-content:space-between;padding:4px 0"><span class="muted">${{ pts: '득점', reb: '리바운드', ast: '어시스트' }[k]}</span><span>${App.plink(p)} <b class="num">${v.toFixed(1)}</b></span></div>` : '').join('') || '<div class="muted small">아직 기록이 없습니다.</div>'}
      </div>
      <div class="card">
        <h2>최근 결과</h2>
        <div class="tw"><table class="t"><tbody>${recent.map(gameRow).join('') || '<tr><td class="muted">경기 없음</td></tr>'}</tbody></table></div>
      </div>
      <div class="card">
        <h2>다가오는 일정</h2>
        <div class="tw"><table class="t"><tbody>${upcoming.map(gameRow).join('') || '<tr><td class="muted">경기 없음</td></tr>'}</tbody></table></div>
      </div>
      <div class="card">
        <h2>받은 편지함 <a class="r lnk" href="#/inbox">모두 보기</a></h2>
        ${unread.map(m => `<a class="mitem ${m.read ? '' : 'unread'}" href="#/inbox/${m.id}"><span class="ic-type">${ICON[m.type] || 'ℹ️'}</span><div><b>${esc(m.title)}</b><span>${U.fmtDateShort(m.date)}</span></div></a>`).join('')}
      </div>
      <div class="card">
        <h2>${t.conf === 'E' ? '동부' : '서부'} 순위 <a class="r lnk" href="#/standings">전체</a></h2>
        <div class="tw"><table class="t"><tbody>${conf.slice(0, 10).map((x, i) => `<tr class="${x.t.tid === G.userTid ? 'me' : ''}"><td class="muted">${i + 1}</td><td>${App.tchip(x.t)} ${App.tlink(x.t)}</td><td class="r num">${x.r.w}-${x.r.l}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card span2">
        <h2>리그 소식</h2>
        ${G.news.slice(0, 10).map(n => `<div class="row nowrap" style="padding:5px 0;border-bottom:1px solid var(--line)"><span class="faint small num" style="min-width:42px">${U.fmtDateShort(n.date)}</span><span class="small">${esc(n.text)}</span></div>`).join('') || '<div class="muted">소식이 없습니다.</div>'}
      </div>
    </div>`;
  };

  // ---------- 받은 편지함 ----------
  S.inbox = (id) => {
    const G = G_();
    const sel = id ? G.inbox.find(m => m.id === +id) : G.inbox[0];
    if (sel && !sel.read) { sel.read = true; setTimeout(() => { const b = document.querySelector('.nav a[href="#/inbox"] .badge'); const n = G.inbox.filter(m => !m.read).length; if (b) { if (n) b.textContent = n; else b.remove(); } }, 0); }
    let actions = '';
    if (sel && sel.type === 'offer' && !sel.done) actions = `<div class="row" style="margin-top:14px"><button class="btn pri" data-act="offerAccept" data-id="${sel.id}">수락</button><button class="btn" data-act="offerDecline" data-id="${sel.id}">거절</button><button class="btn" data-act="offerEdit" data-id="${sel.id}">트레이드 화면에서 수정</button></div>`;
    if (sel && sel.type === 'scout' && sel.pids) {
      const still = sel.pids.map(id => G.players[id]).filter(p => p && p.tid === -1);
      actions += still.length ? `<div class="row" style="margin-top:14px">${still.map(p => `<button class="btn pri" data-act="negotiate" data-pid="${p.pid}">${esc(p.name)} 협상</button>`).join('')}<button class="btn" data-act="scoutGo" data-id="${sel.id}">자유계약 화면에서 보기</button></div>` : `<div class="note" style="margin-top:12px">이 선수들은 이미 시장을 떠났습니다: ${sel.pids.map(id => G.players[id]).filter(Boolean).map(p => `${esc(p.name)} → ${p.tid >= 0 ? esc(G.teams[p.tid].ko) : p.tid === -3 ? '은퇴' : '시장 밖'}`).join(', ')}</div>`;
    }
    if (sel && sel.pid && G.players[sel.pid]) actions += `<div style="margin-top:12px"><a class="btn" href="#/player/${sel.pid}">선수 정보</a></div>`;
    return `<h1>받은 편지함</h1>
    <div class="inbox">
      <div class="card flat" style="padding:0"><div class="mlist">${G.inbox.map(m => `<a class="mitem ${m.read ? '' : 'unread'} ${sel && m.id === sel.id ? 'on' : ''}" href="#/inbox/${m.id}"><span class="dot"></span><span class="ic-type">${ICON[m.type] || 'ℹ️'}</span><div><b>${esc(m.title)}</b><span>${U.fmtDate(m.date)}</span></div></a>`).join('') || '<div class="empty">메시지가 없습니다</div>'}</div></div>
      <div class="card">${sel ? `<div class="muted small">${U.fmtDate(sel.date)}</div><h2 style="margin-top:4px">${ICON[sel.type] || ''} ${esc(sel.title)}</h2><div class="mbody">${sel.body}</div>${sel.done ? `<div class="note" style="margin-top:12px">${esc(sel.done)}</div>` : ''}${actions}` : '<div class="empty">메시지를 고르세요</div>'}</div>
    </div>`;
  };
  A.offerAccept = el => {
    const G = G_(); const m = G.inbox.find(x => x.id === +el.dataset.id); const o = m.offer;
    const still = o.ap.every(id => G.players[id] && G.players[id].tid === o.a) && o.bp.every(id => G.players[id] && G.players[id].tid === o.b) &&
      o.ak.every(id => G.picks.find(k => k.id === id && k.tid === o.a)) && o.bk.every(id => G.picks.find(k => k.id === id && k.tid === o.b));
    if (!still) { m.done = '자산 구성이 바뀌어 제안이 무효가 되었습니다.'; App.rerender(); return; }
    if (!tradeAllowed()) { App.toast('지금은 트레이드할 수 없습니다'); return; }
    const errs = AI.tradeCheck(G, o);
    if (errs.length) { App.toast(errs[0], 4000); return; }
    AI.execTrade(G, o); m.done = '트레이드를 수락했습니다.';
    Season.news(G, Season.tradeText(G, o), { type: 'trade' });
    App.toast('트레이드 성사!'); App.autosave(); App.rerender();
  };
  A.offerDecline = el => { const m = G_().inbox.find(x => x.id === +el.dataset.id); m.done = '제안을 거절했습니다.'; App.rerender(); };
  A.offerEdit = el => {
    const m = G_().inbox.find(x => x.id === +el.dataset.id); const o = m.offer;
    App.ui.trade = { partner: o.a, mine: o.bp.slice(), theirs: o.ap.slice(), myPicks: o.bk.slice(), theirPicks: o.ak.slice() };
    App.go('#/trade');
  };
  function tradeAllowed() {
    const G = G_();
    if (G.phase === 'regular' && G.date > G.cal.deadline) return false;
    if (G.phase === 'playin' || G.phase === 'playoffs') return false;
    return true;
  }
  App.tradeAllowed = tradeAllowed;

  // ---------- 경기별 기록 ----------
  const LOGK = ['gid', 'tid', 'gs', 'min10', 'pts', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pf', 'pm', 'rat10'];
  let gameMapCache = null;
  function gameMap(G) {
    if (!gameMapCache || gameMapCache.n !== G.schedule.length || gameMapCache.s !== G.season || gameMapCache.G !== G) {
      const m = new Map(); for (const g of G.schedule) m.set(g.gid, g);
      gameMapCache = { m, n: G.schedule.length, s: G.season, G };
    }
    return gameMapCache.m;
  }
  // 선수의 이번 시즌 경기별 기록(옛 순서 → 최근 순서)
  App.gameLog = (p, po) => {
    const G = G_();
    if (!G.logs || G.logsSeason !== G.season) return [];
    const raw = G.logs[p.pid] || [];
    const gm = gameMap(G);
    const out = [];
    for (const t of raw) {
      const o = {}; LOGK.forEach((k, i) => { o[k] = t[i]; });
      const g = gm.get(o.gid); if (!g) continue;
      const isPo = g.type === 'po' ? 1 : 0;
      if (po !== undefined && po !== null && isPo !== po) continue;
      const home = g.h === o.tid;
      o.g = g; o.date = g.date; o.home = home; o.opp = home ? g.a : g.h; o.type = g.type;
      o.my = home ? g.hs : g.as; o.op = home ? g.as : g.hs; o.win = o.my > o.op;
      o.min = o.min10 / 10; o.reb = o.orb + o.drb; o.rat = o.rat10 / 10;
      out.push(o);
    }
    return out;
  };
  const ratCls = r => r >= 8 ? 'a5' : r >= 7 ? 'a4' : r >= 6.3 ? 'a3' : r >= 5.5 ? 'a2' : 'a1';
  // 최근 폼: 마지막 n경기 평점 칩
  App.formChips = (p, n = 5) => {
    const lg = App.gameLog(p).slice(-n);
    if (!lg.length) return '<span class="faint small">-</span>';
    return `<span class="form" title="최근 ${lg.length}경기 평점">${lg.map(o => `<span class="fchip ${ratCls(o.rat)}${o.win ? '' : ' loss'}" title="${U.fmtDateShort(o.date)} ${o.home ? 'vs' : '@'} ${esc(G_().teams[o.opp].abbr)} · ${o.pts}점 ${o.reb}리 ${o.ast}어">${o.rat.toFixed(1)}</span>`).join('')}</span>`;
  };
  A.openLog = el => { App.ui.tabs.player = 'log'; App.go('#/player/' + el.dataset.pid); };

  function logTab(p) {
    const G = G_();
    const po = App.ui.tabs.logPo === '1' ? 1 : 0;
    const all = App.gameLog(p);
    const lg = all.filter(o => (o.type === 'po' ? 1 : 0) === po);
    const hasPo = all.some(o => o.type === 'po');
    const toggle = `<div class="tabs" style="margin-bottom:10px"><button class="${po ? '' : 'on'}" data-act="tab" data-group="logPo" data-tab="0">정규시즌 ${all.length - all.filter(o => o.type === 'po').length}경기</button>${hasPo ? `<button class="${po ? 'on' : ''}" data-act="tab" data-group="logPo" data-tab="1">플레이오프 ${all.filter(o => o.type === 'po').length}경기</button>` : ''}</div>`;
    if (!lg.length) return `<div class="card">${toggle}<div class="empty">${U.seasonLabel(G.season)} 시즌에 ${po ? '플레이오프' : ''} 출전한 경기가 아직 없습니다.<br><span class="small">경기별 기록은 이번 시즌 것만 보관합니다. 지난 시즌 합계는 '시즌·커리어 기록' 탭에 있습니다.</span></div></div>`;
    const avg = arr => {
      const n = arr.length || 1, t = {};
      for (const k of ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'rat']) t[k] = arr.reduce((s2, o) => s2 + o[k], 0) / n;
      return t;
    };
    const box = (title, arr) => { const a = avg(arr); return `<div class="card flat"><h3>${title}</h3><div class="row" style="gap:14px;align-items:baseline"><span><b style="font-size:20px">${a.pts.toFixed(1)}</b> <span class="small muted">득점</span></span><span><b>${a.reb.toFixed(1)}</b> <span class="small muted">리바</span></span><span><b>${a.ast.toFixed(1)}</b> <span class="small muted">어시</span></span></div>
      <div class="small muted" style="margin-top:4px">${a.min.toFixed(1)}분 · FG ${App.pct(a.fgm, a.fga)}% · 3P ${App.pct(a.tpm, a.tpa)}% · 평점 <b class="${ratCls(a.rat)}">${a.rat.toFixed(2)}</b></div></div>`; };
    const best = lg.reduce((m, o) => (!m || o.pts > m.pts || (o.pts === m.pts && o.rat > m.rat)) ? o : m, null);
    const dd = lg.filter(o => [o.pts, o.reb, o.ast, o.stl, o.blk].filter(x => x >= 10).length >= 2).length;
    const td = lg.filter(o => [o.pts, o.reb, o.ast, o.stl, o.blk].filter(x => x >= 10).length >= 3).length;
    const w = lg.filter(o => o.win).length;
    const summary = `<div class="grid g4" style="margin-bottom:12px">${box(`시즌 평균 · ${lg.length}경기`, lg)}${box('최근 5경기', lg.slice(-5))}${box('최근 10경기', lg.slice(-10))}
      <div class="card flat"><h3>최고 경기</h3><div><b style="font-size:20px">${best.pts}점</b> ${best.reb}리 ${best.ast}어</div><div class="small muted" style="margin-top:4px">${U.fmtDateShort(best.date)} ${best.home ? 'vs' : '@'} ${esc(G.teams[best.opp].ko)} · 더블더블 ${dd}회${td ? ` · 트리플더블 ${td}회` : ''} · 출전 경기 ${w}승 ${lg.length - w}패</div></div></div>`;
    const rows = lg.slice().reverse();
    const tbl = App.table('plog', [
      { k: 'date', label: '날짜', v: o => o.date + String(o.gid).padStart(6, '0'), f: o => `<span class="num">${U.fmtDateShort(o.date)}</span>` },
      { k: 'opp', label: '상대', v: o => G.teams[o.opp].abbr, f: o => `${o.home ? 'vs' : '@'} ${App.tchip(G.teams[o.opp])}` },
      { k: 'res', label: '결과', v: o => o.my - o.op, f: o => { const t = `<span class="pill ${o.win ? 'good' : 'bad'}">${o.win ? '승' : '패'}</span> <span class="num">${o.my}-${o.op}</span>${o.g.ot ? ' <span class="faint small">OT</span>' : ''}`; return G.games[o.gid] ? `<a class="lnk" href="#/game/${o.gid}">${t}</a>` : t; } },
      { k: 'gs', label: '선발', cls: 'c', f: o => o.gs ? '●' : '' },
      { k: 'min', label: '분', cls: 'r', f: o => Math.round(o.min) },
      { k: 'pts', label: '득점', cls: 'r', f: o => `<b>${o.pts}</b>` },
      { k: 'reb', label: '리바', cls: 'r' },
      { k: 'ast', label: '어시', cls: 'r' },
      { k: 'stl', label: '스틸', cls: 'r' },
      { k: 'blk', label: '블록', cls: 'r' },
      { k: 'tov', label: 'TO', cls: 'r' },
      { k: 'fg', label: 'FG', cls: 'r', v: o => o.fga ? o.fgm / o.fga : -1, f: o => `${o.fgm}-${o.fga}` },
      { k: 'tp', label: '3P', cls: 'r', v: o => o.tpm, f: o => `${o.tpm}-${o.tpa}` },
      { k: 'ft', label: 'FT', cls: 'r', v: o => o.ftm, f: o => `${o.ftm}-${o.fta}` },
      { k: 'pf', label: '파울', cls: 'r' },
      { k: 'pm', label: '+/-', cls: 'r', f: o => (o.pm > 0 ? '+' : '') + o.pm },
      { k: 'rat', label: '평점', cls: 'r', f: o => `<span class="av ${ratCls(o.rat)}">${o.rat.toFixed(1)}</span>` },
    ], rows, { sort: { k: 'date', dir: -1 } });
    return `<div class="card">${toggle}${summary}<div class="small muted" style="margin-bottom:6px">결과를 누르면 박스스코어를 봅니다(우리 팀 경기와 플레이오프만 보관).</div>${tbl}</div>`;
  }

  // ---------- 선수단 ----------
  const ATTR_SHORT = { ins: '골밑', mid: '중거', tp: '3점', ft: '자유', pss: '패스', hdl: '핸들', orb: '공리', pdef: '외수', idef: '골수', stl: '스틸', blk: '블록', drb: '수리', iq: 'IQ', cmp: '침착', ldr: '리더', wrk: '성실', spd: '속도', ath: '운동', str: '근력', sta: '지구' };
  App.ATTR_SHORT = ATTR_SHORT;
  App.rosterTable = (id, players, opt = {}) => {
    const G = G_();
    const tab = opt.tab || 'ov';
    const po = opt.po || 0;
    const base = [
      { k: 'name', label: '이름', f: p => `${App.plink(p)} ${App.trainTag ? App.trainTag(p) : ''} ${App.injTag(p)}`, v: p => p.name },
      { k: 'pos', label: '포지션', cls: 'c' },
      { k: 'age', label: '나이', cls: 'r', v: p => App.age(p), f: p => App.age(p) },
    ];
    let cols;
    if (tab === 'attr') {
      cols = base.concat([{ k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) }], R.KEYS.map(k => ({ k, label: ATTR_SHORT[k], cls: 'c', title: R.LABEL[k], v: p => p.a[k], f: p => { const v = R.disp(p.a[k]); return `<span class="av ${R.attrClass(v)}">${v}</span>`; } })));
    } else if (tab === 'stats') {
      const ln = p => App.line(p, po);
      const pg = (k) => p => { const l = ln(p); return l && l.gp ? l[k] / l.gp : null; };
      cols = base.concat([
        { k: 'gp', label: '경기', cls: 'r', v: p => ln(p)?.gp ?? 0, f: p => ln(p)?.gp ?? 0 },
        { k: 'gs', label: '선발', cls: 'r', v: p => ln(p)?.gs ?? 0, f: p => ln(p)?.gs ?? 0 },
        { k: 'min', label: '분', cls: 'r', v: pg('min'), f: p => App.pg(ln(p), 'min') },
        { k: 'pts', label: '득점', cls: 'r', v: pg('pts'), f: p => App.pg(ln(p), 'pts') },
        { k: 'reb', label: '리바', cls: 'r', v: p => { const l = ln(p); return l && l.gp ? (l.orb + l.drb) / l.gp : null; }, f: p => { const l = ln(p); return l && l.gp ? ((l.orb + l.drb) / l.gp).toFixed(1) : '-'; } },
        { k: 'ast', label: '어시', cls: 'r', v: pg('ast'), f: p => App.pg(ln(p), 'ast') },
        { k: 'stl', label: '스틸', cls: 'r', v: pg('stl'), f: p => App.pg(ln(p), 'stl') },
        { k: 'blk', label: '블록', cls: 'r', v: pg('blk'), f: p => App.pg(ln(p), 'blk') },
        { k: 'tov', label: '턴오버', cls: 'r', v: pg('tov'), f: p => App.pg(ln(p), 'tov') },
        { k: 'fgp', label: 'FG%', cls: 'r', v: p => { const l = ln(p); return l && l.fga ? l.fgm / l.fga : null; }, f: p => { const l = ln(p); return l ? App.pct(l.fgm, l.fga) : '-'; } },
        { k: 'tpp', label: '3P%', cls: 'r', v: p => { const l = ln(p); return l && l.tpa ? l.tpm / l.tpa : null; }, f: p => { const l = ln(p); return l ? App.pct(l.tpm, l.tpa) : '-'; } },
        { k: 'ftp', label: 'FT%', cls: 'r', v: p => { const l = ln(p); return l && l.fta ? l.ftm / l.fta : null; }, f: p => { const l = ln(p); return l ? App.pct(l.ftm, l.fta) : '-'; } },
        { k: 'pm', label: '+/-', cls: 'r', v: pg('pm'), f: p => App.pg(ln(p), 'pm') },
        { k: 'rat', label: '평점', cls: 'r', v: pg('rat'), f: p => { const l = ln(p); return l && l.gp ? `<b>${(l.rat / l.gp).toFixed(2)}</b>` : '-'; } },
      ]);
    } else if (tab === 'con') {
      cols = base.concat([
        { k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) },
        { k: 'amt', label: '연봉', cls: 'r', v: p => p.contract?.amt || 0, f: p => U.money(p.contract?.amt) },
        { k: 'exp', label: '계약 만료', cls: 'r', v: p => p.contract?.exp || 0, f: p => p.contract ? U.seasonLabel(p.contract.exp) + (p.contract.rookie ? ' <span class="pill">신인</span>' : '') : '-' },
        { k: 'val', label: '시장 가치', cls: 'r', v: p => F.marketValue(p, AI.capYear(G), App.age(p)), f: p => U.money(F.marketValue(p, AI.capYear(G), App.age(p))) },
        { k: 'mor', label: '사기', cls: 'r', v: p => p.morale ?? 60, f: p => App.moraleTxt(p.morale ?? 60) },
        ...(opt.own ? [{ k: 'act', label: '', nosort: true, f: p => `<button class="btn sm danger" data-act="release" data-pid="${p.pid}">방출</button>` }] : []),
      ]);
    } else {
      cols = base.concat([
        { k: 'hgt', label: '키', cls: 'r', f: p => p.hgt + 'cm' },
        { k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) },
        { k: 'pot', label: '잠재력', cls: 'c', v: p => P.potShown(p, G), f: p => App.stars(P.potShown(p, G)) },
        { k: 'amt', label: '연봉', cls: 'r', v: p => p.contract?.amt || 0, f: p => U.money(p.contract?.amt) },
        { k: 'gp', label: '경기', cls: 'r', v: p => App.line(p)?.gp ?? 0, f: p => App.line(p)?.gp ?? 0 },
        { k: 'pts', label: '득점', cls: 'r', v: p => { const l = App.line(p); return l && l.gp ? l.pts / l.gp : null; }, f: p => App.pg(App.line(p), 'pts') },
        { k: 'reb', label: '리바', cls: 'r', v: p => { const l = App.line(p); return l && l.gp ? (l.orb + l.drb) / l.gp : null; }, f: p => { const l = App.line(p); return l && l.gp ? ((l.orb + l.drb) / l.gp).toFixed(1) : '-'; } },
        { k: 'ast', label: '어시', cls: 'r', v: p => { const l = App.line(p); return l && l.gp ? l.ast / l.gp : null; }, f: p => App.pg(App.line(p), 'ast') },
        { k: 'rat', label: '평점', cls: 'r', v: p => { const l = App.line(p); return l && l.gp ? l.rat / l.gp : null; }, f: p => { const l = App.line(p); return l && l.gp ? (l.rat / l.gp).toFixed(2) : '-'; } },
        { k: 'form', label: '최근 폼', nosort: true, f: p => `<a class="lnk" data-act="openLog" data-pid="${p.pid}" title="경기별 기록 보기">${App.formChips(p)}</a>` },
        { k: 'mor', label: '상태', cls: 'c', nosort: true, f: p => App.moraleTag(p) },
      ]);
    }
    return App.table(id, cols, players, { sort: { k: 'ovr', dir: -1 }, rowCls: opt.rowCls });
  };
  S.squad = () => {
    const G = G_();
    const tab = App.ui.tabs.squad || 'ov';
    const po = App.ui.tabs.squadPo === '1' ? 1 : 0;
    const ps = L.roster(G, G.userTid);
    const pay = F.payroll(G, G.userTid, AI.capYear(G));
    const tabs = [['ov', '개요'], ['attr', '능력치'], ['stats', '시즌 기록'], ['con', '계약']];
    return `<div class="row"><h1>선수단</h1><span class="sp"></span><span class="pill">${ps.length}/15명</span><span class="pill">연봉 ${U.money(pay)} / 캡 ${U.money(F.cap(AI.capYear(G)))}</span></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-group="squad" data-tab="${k}">${l}</button>`).join('')}
      ${tab === 'stats' ? `<span class="sp"></span><button class="${po ? '' : 'on'}" data-act="tab" data-group="squadPo" data-tab="0">정규</button><button class="${po ? 'on' : ''}" data-act="tab" data-group="squadPo" data-tab="1">플레이오프</button>` : ''}</div>
      <div class="card flat" style="padding:6px">${App.rosterTable('squad-' + tab, ps, { tab, po, own: true })}</div>
      <p class="note" style="margin-top:10px">능력치는 FM처럼 1~20으로 보입니다. <b>능력</b>은 100점 만점의 종합치, <b>잠재력</b>은 스카우트가 본 최고 도달치입니다. 실제 커리어 모드에서는 실존 선수가 현실의 성장 곡선을 따라갑니다(약간의 편차 포함).</p>`;
  };
  A.release = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    const cy = AI.capYear(G);
    const opts = AI.releaseOptions(G, p);
    const room = AI.capRoom(G, G.userTid);
    const amt = p.contract ? p.contract.amt : 0;
    const rows = opts.map((o, i) => `<label class="opt"><input type="radio" name="relmode" value="${o.mode}" ${i === (opts.length > 1 ? 1 : 0) ? 'checked' : ''}><span><b>${o.label}</b>
      <span class="small muted">${o.desc || ''}${o.yrs ? `<br>${U.seasonLabel(cy)} 캡에 남는 돈 <b>${U.money(o.now)}</b> · 총 ${U.money(o.total)} · ${o.yrs}년 · 방출 뒤 캡 여유 <b>${U.money(room + amt - o.now)}</b>` : ''}</span></span></label>`).join('');
    App.modal(`선수 방출: ${esc(p.name)}`, `<div class="small muted" style="margin-bottom:8px">지금 연봉 ${U.money(amt)}${p.contract ? ` · ${U.seasonLabel(p.contract.exp)}까지` : ''} · 지금 캡 여유 ${U.money(room)}</div><div class="grid">${rows}</div>
      <p class="small muted" style="margin-top:8px">실제 NBA처럼 방출해도 보장된 연봉은 남습니다. 바이아웃이나 스트레치로 올해 부담을 줄일 수 있습니다.</p>`,
      `<button class="btn" data-act="closeModal">취소</button><button class="btn pri danger" data-act="releaseDo" data-pid="${p.pid}">방출</button>`);
  };
  A.releaseDo = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    const mode = (document.querySelector('input[name="relmode"]:checked') || {}).value || 'waive';
    App.closeModal();
    AI.release(G, p, mode);
    if (G.faSeen) G.faSeen[p.pid] = 1;
    Season.news(G, `${p.name}, ${G.teams[G.userTid].ko}에서 방출`, { type: 'fa' });
    App.toast(`${p.name} 방출 — 캡 여유 ${U.money(AI.capRoom(G, G.userTid))}`, 3000); App.autosave(); App.rerender();
  };

  // ---------- 선수 ----------
  S.player = pid => {
    const G = G_(); const p = G.players[+pid];
    if (!p) return '<div class="empty">선수를 찾을 수 없습니다</div>';
    const t = p.tid >= 0 ? G.teams[p.tid] : null;
    const age = App.age(p);
    const pot = P.potShown(p, G);
    const attrs = R.GROUPS.map(([g, gl]) => `<div class="grp"><h3>${gl}</h3>${R.ATTRS.filter(a => a[2] === g).map(([k, lab]) => { const v = R.disp(p.a[k]); return `<div class="attr"><span>${lab}</span><span class="v ${R.attrClass(v)}">${v}</span></div>`; }).join('')}</div>`).join('');
    const tend = `<div class="kv small"><span>공격 점유(USG)</span><span>${(p.t.usg * 100).toFixed(1)}%</span><span>3점 시도 비중</span><span>${(p.t.r3 * 100).toFixed(0)}%</span><span>2점 중 골밑 비중</span><span>${(p.t.rim * 100).toFixed(0)}%</span><span>자유투 유도</span><span>${(p.t.ftr * 100).toFixed(0)}</span></div>`;
    // 게임 속 기록
    const lines = p.stats.slice().sort((a, b) => a.s - b.s || a.po - b.po);
    const statRows = lines.map(l => `<tr><td>${U.seasonLabel(l.s)}${l.po ? ' <span class="pill info">PO</span>' : ''}</td><td>${App.tchip(G.teams[l.tid])}</td><td class="r">${l.gp}</td><td class="r">${App.pg(l, 'min')}</td><td class="r"><b>${App.pg(l, 'pts')}</b></td><td class="r">${l.gp ? ((l.orb + l.drb) / l.gp).toFixed(1) : '-'}</td><td class="r">${App.pg(l, 'ast')}</td><td class="r">${App.pg(l, 'stl')}</td><td class="r">${App.pg(l, 'blk')}</td><td class="r">${App.pct(l.fgm, l.fga)}</td><td class="r">${App.pct(l.tpm, l.tpa)}</td><td class="r">${App.pct(l.ftm, l.fta)}</td><td class="r">${l.gp ? (l.rat / l.gp).toFixed(2) : '-'}</td></tr>`).join('');
    // 실제 기록(게임 시작 이전)
    let real = '';
    if (p.rid && D().snaps[p.rid]) {
      const rl = D().snaps[p.rid].filter(s => s[0] < G.startYear);
      if (rl.length) real = `<div class="card" style="margin-top:14px"><h2>실제 NBA 기록 <span class="r">게임 시작(${U.seasonLabel(G.startYear)}) 이전</span></h2><div class="tw"><table class="t"><thead><tr><th>시즌</th><th>팀</th><th class="r">경기</th><th class="r">분</th><th class="r">득점</th><th class="r">리바</th><th class="r">어시</th><th class="r">스틸</th><th class="r">블록</th><th class="r">FG%</th><th class="r">3P%</th><th class="r">FT%</th></tr></thead><tbody>${rl.map(s => `<tr><td>${U.seasonLabel(s[0])}</td><td>${esc(s[1])}</td><td class="r">${s[8]}</td><td class="r">${(s[10] / 10).toFixed(1)}</td><td class="r"><b>${(s[11] / 10).toFixed(1)}</b></td><td class="r">${(s[12] / 10).toFixed(1)}</td><td class="r">${(s[13] / 10).toFixed(1)}</td><td class="r">${(s[14] / 10).toFixed(1)}</td><td class="r">${(s[15] / 10).toFixed(1)}</td><td class="r">${(s[16] / 10).toFixed(1)}</td><td class="r">${s[17] ? (s[17] / 10).toFixed(1) : '-'}</td><td class="r">${(s[18] / 10).toFixed(1)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    // 수상
    const AWN = { MVP: 'MVP', DPOY: '올해의 수비수', ROY: '신인왕', '6MOY': '식스맨', MIP: '기량발전상', ANBA1: '올-NBA 퍼스트', ANBA2: '올-NBA 세컨드', ANBA3: '올-NBA 서드', ADEF1: '올-디펜시브 퍼스트', ADEF2: '올-디펜시브 세컨드', AS: '올스타', CH: '우승', FMVP: '파이널 MVP' };
    const realAw = p.rid && D().awards[p.rid] ? D().awards[p.rid].split(',').map(x => x.split(':')).filter(([y]) => +y < G.startYear) : [];
    const cnt = {};
    for (const [, k] of realAw) cnt[k] = (cnt[k] || 0) + 1;
    const gameAw = {};
    for (const a of p.awards) gameAw[a.k] = (gameAw[a.k] || 0) + 1;
    const awHtml = (c) => Object.entries(c).sort((a, b) => Object.keys(AWN).indexOf(a[0]) - Object.keys(AWN).indexOf(b[0])).map(([k, n]) => `<span class="pill ${k === 'MVP' || k === 'CH' || k === 'FMVP' ? 'warn' : ''}">${AWN[k] || k}${n > 1 ? ' ×' + n : ''}</span>`).join(' ');
    // 행동
    const acts = [];
    const own = p.tid === G.userTid;
    if (own) {
      const ts = HM.Train && HM.Train.slotOf(G, p.pid);
      acts.push(`<button class="btn ${ts ? '' : 'pri'}" data-act="trToggle" data-pid="${p.pid}">${ts ? '🏋️ 집중 훈련 해제' : '🏋️ 집중 훈련 시키기'}</button>`);
      if (ts) acts.push(`<a class="btn" href="#/training">훈련: ${HM.Train.FOCUS[ts.focus][0]}(${HM.Train.INT[ts.int][0]})</a>`);
      acts.push(`<button class="btn" data-act="tradeWith" data-pid="${p.pid}">트레이드 블록에</button>`);
      if (G.phase === 'resign' && p.contract && p.contract.exp <= G.season) acts.push(`<button class="btn pri" data-act="negotiate" data-pid="${p.pid}">재계약 협상</button>`);
      acts.push(`<button class="btn danger" data-act="release" data-pid="${p.pid}">방출</button>`);
    } else if (p.tid >= 0) acts.push(`<button class="btn pri" data-act="tradeWith" data-pid="${p.pid}">트레이드 제안</button>`);
    else if (p.tid === -1) acts.push(`<button class="btn pri" data-act="negotiate" data-pid="${p.pid}">계약 제안</button>`);
    if (!own && p.tid !== -3) acts.push(`<button class="btn" data-act="shortTog" data-pid="${p.pid}">${App.isShort(p.pid) ? '★ 관심 선수 해제' : '☆ 관심 선수로 등록'}</button>`);
    const prospect = p.tid === -2 ? `<div class="note" style="margin-top:10px">🎓 ${p.prospect.year} 드래프트 후보${p.prospect.realPick ? ` · <span data-spoil>실제 역사: ${p.prospect.realRound}라운드 ${p.prospect.realPick}순위 (${esc(p.prospect.realTeam)})</span>` : ''}</div>` : '';
    return `
    <div class="card">
      <div class="phead">
        <div class="face" style="${t ? App.tstyle(t) : '--c1:var(--panel3);--c2:var(--muted);--ct:var(--muted)'}">${esc(p.pos)}</div>
        <div style="min-width:0;flex:1">
          <h1>${esc(p.name)} ${p.hof ? '<span class="pill warn" title="실제 명예의 전당 헌액자">HOF</span>' : ''}</h1>
          <div class="sub">${t ? `${App.tchip(t)} ${App.tlink(t)}` : App.tname(p.tid)} · ${R.POS_KO[p.pos]} · ${age}세 · ${p.hgt}cm · ${p.wgt}kg${p.college ? ' · ' + esc(p.college) : ''}</div>
          <div class="sub">${p.draft ? `${p.draft.year} 드래프트 ${p.draft.round}라운드 ${p.draft.pick}순위 (${esc(p.draft.abbr)})` : p.undrafted ? `${p.undrafted} 드래프트 미지명` : '드래프트 정보 없음'} · NBA ${p.yearsPro || 0}년차</div>
          <div class="row" style="margin-top:6px">${App.injTag(p)} ${p.injury ? `<span class="small muted">${esc(p.injury.type)}</span>` : ''} <span class="pill">사기 ${App.moraleTxt(p.morale ?? 60)}</span> ${p.contract ? `<span class="pill">${App.contractTxt(p)}</span>` : ''}</div>
        </div>
        <div class="row" style="gap:18px">
          <div class="ovrbig"><b>${Math.round(p.ovr)}</b><span>능력</span>${(() => { const d = p.ovr - (p.ovrStart ?? p.ovr); return Math.abs(d) >= 0.5 ? `<div class="small num" style="color:var(${d > 0 ? '--good' : '--bad'})" title="이번 시즌 시작 대비">시즌 ${d > 0 ? '▲' : '▼'}${Math.abs(Math.round(d)) || 1}</div>` : ''; })()}</div>
          <div class="ovrbig"><b>${pot}</b><span>잠재력</span><div>${App.stars(pot)}</div></div>
        </div>
      </div>
      ${prospect}
      <div class="row" style="margin-top:12px">${acts.join('')}</div>
    </div>
    ${(() => { const ptab = App.ui.tabs.player || 'ov'; const nLog = App.gameLog(p).length; return `<div class="tabs" style="margin-top:14px">${[['ov', '개요'], ['log', `경기별 기록${nLog ? ' ' + nLog : ''}`], ['car', '시즌·커리어 기록']].map(([k, l]) => `<button class="${ptab === k ? 'on' : ''}" data-act="tab" data-group="player" data-tab="${k}">${l}</button>`).join('')}</div>`; })()}
    ${(App.ui.tabs.player || 'ov') === 'log' ? logTab(p) : (App.ui.tabs.player || 'ov') === 'car' ? `${statRows ? `<div class="card"><h2>게임 속 기록</h2><div class="tw"><table class="t"><thead><tr><th>시즌</th><th>팀</th><th class="r">경기</th><th class="r">분</th><th class="r">득점</th><th class="r">리바</th><th class="r">어시</th><th class="r">스틸</th><th class="r">블록</th><th class="r">FG%</th><th class="r">3P%</th><th class="r">FT%</th><th class="r">평점</th></tr></thead><tbody>${statRows}</tbody></table></div></div>` : '<div class="card"><div class="empty">아직 게임 속 기록이 없습니다.</div></div>'}${real}` : `
    ${App.gameLog(p).length ? `<div class="card" style="margin-bottom:14px"><div class="row"><h2 style="margin:0">최근 폼</h2>${App.formChips(p, 10)}<span class="sp"></span><button class="btn sm" data-act="tab" data-group="player" data-tab="log">경기별 기록 보기 →</button></div></div>` : ''}
    <div class="grid g3">
      <div class="card span2"><h2>능력치</h2><div class="attrs">${attrs}</div></div>
      <div class="card"><h2>플레이 성향</h2>${tend}
        <h2 style="margin-top:14px">공헌도</h2><div class="kv small"><span>공격(BPM 환산)</span><span>${p.o >= 0 ? '+' : ''}${p.o.toFixed(1)}</span><span>수비(BPM 환산)</span><span>${p.d >= 0 ? '+' : ''}${p.d.toFixed(1)}</span></div>
        ${Object.keys(gameAw).length ? `<h2 style="margin-top:14px">게임 속 수상</h2><div class="row">${awHtml(gameAw)}</div>` : ''}
        ${Object.keys(cnt).length ? `<h2 style="margin-top:14px">실제 수상(시작 이전)</h2><div class="row">${awHtml(cnt)}</div>` : ''}
      </div>
    </div>`}`;
  };
  A.tradeWith = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    if (p.tid === G.userTid) App.ui.trade = { partner: App.ui.trade?.partner ?? (G.userTid === 0 ? 1 : 0), mine: [p.pid], theirs: [], myPicks: [], theirPicks: [] };
    else App.ui.trade = { partner: p.tid, mine: [], theirs: [p.pid], myPicks: [], theirPicks: [] };
    App.go('#/trade');
  };

  // ---------- 전술 ----------
  const TAC = {
    pace: [[0, '느리게', '하프코트에서 공을 오래 돌립니다. 체력 소모가 적습니다.'], [1, '보통', '균형 잡힌 템포.'], [2, '빠르게', '속공과 얼리 오펜스. 포제션이 늘고 체력 소모가 큽니다.']],
    focus: [['bal', '균형', '선수 성향대로 고르게 공격합니다.'], ['in', '골밑 공략', '페인트존 공격 비중을 높입니다. 골밑 마무리가 좋은 팀에 맞습니다.'], ['out', '외곽·3점', '3점 시도를 늘립니다. 슈터가 많아야 효과가 납니다.'], ['motion', '모션 오펜스', '공을 많이 돌리고 고르게 슛을 나눕니다. 패스가 좋은 팀에 맞습니다.'], ['star', '에이스 중심', '최고 선수에게 공을 몰아줍니다.']],
    def: [['man', '대인 방어', '기본 수비.'], ['zone', '지역 방어', '골밑을 지키는 대신 3점을 내줍니다. 상대 슈터가 약할 때 좋습니다.'], ['press', '전면 압박', '턴오버를 노리지만 체력 소모가 크고, 볼핸들러가 좋은 팀에는 뚫립니다.']],
    reb: [['bal', '보통', ''], ['crash', '공격 리바운드 가담', '공격 리바운드를 노리는 대신 상대 속공을 허용합니다.'], ['back', '백코트 우선', '공격 리바운드를 포기하고 상대 속공을 막습니다.']],
  };
  App.TAC = TAC;
  S.tactics = () => {
    const G = G_(), t = G.teams[G.userTid];
    const tac = t.tactics, rot = t.rotation;
    const group = (key, title) => `<div class="card"><h2>${title}</h2><div class="grid">${TAC[key].map(([v, l, d]) => `<label class="opt"><input type="radio" name="tac-${key}" value="${v}" ${String(tac[key]) === String(v) ? 'checked' : ''} data-change="setTac" data-key="${key}"><span><b>${l}</b><span class="small muted">${d}</span></span></label>`).join('')}</div></div>`;
    const ps = L.roster(G, G.userTid).sort((a, b) => b.ovr - a.ovr);
    const healthy = ps.filter(p => !(p.injury && p.injury.days > 0));
    const auto = HM.Sim.autoRotation(healthy, G.phase === 'playoffs');
    let rotHtml;
    if (rot.auto) {
      rotHtml = `<p class="muted small">코치진이 능력치와 체력에 맞춰 선발과 출전 시간을 정합니다. 아래는 현재 예상 로테이션입니다.</p>` +
        `<div class="tw"><table class="t"><thead><tr><th>선수</th><th class="c">포지션</th><th class="c">능력</th><th class="r">예상 출전 시간</th></tr></thead><tbody>${healthy.slice().sort((a, b) => (auto.minutes[b.pid] || 0) - (auto.minutes[a.pid] || 0)).map(p => `<tr><td>${auto.starters.includes(p.pid) ? '⭐ ' : ''}${App.plink(p)}</td><td class="c">${p.pos}</td><td class="c">${App.ovr(p.ovr)}</td><td class="r">${(auto.minutes[p.pid] || 0).toFixed(0)}분</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      const total = ps.reduce((s, p) => s + (+rot.minutes[p.pid] || 0), 0);
      rotHtml = `<p class="muted small">선발 5명을 고르고 경기당 목표 출전 시간(합계 240분)을 정하세요. 체력·파울·점수 차에 따라 실제 시간은 조금 달라집니다. 부상 선수는 자동으로 빠집니다.</p>
      <div class="row" style="margin-bottom:8px"><span class="pill ${Math.abs(total - 240) <= 2 ? 'good' : 'warn'}">합계 ${total.toFixed(0)}분 / 240분</span><span class="pill">${rot.starters.length}/5 선발</span><span class="sp"></span><button class="btn sm" data-act="rotFill">코치 추천값으로</button><button class="btn sm" data-act="rotNorm">240분에 맞추기</button></div>
      <div class="tw"><table class="t"><thead><tr><th>선발</th><th>선수</th><th class="c">포지션</th><th class="c">능력</th><th class="c">지구력</th><th class="r">목표 시간</th></tr></thead><tbody>
      ${ps.map(p => `<tr><td class="c"><input type="checkbox" data-change="rotStarter" data-pid="${p.pid}" ${rot.starters.includes(p.pid) ? 'checked' : ''}></td><td>${App.plink(p)} ${App.injTag(p)}</td><td class="c">${p.pos}</td><td class="c">${App.ovr(p.ovr)}</td><td class="c"><span class="av ${R.attrClass(R.disp(p.a.sta))}">${R.disp(p.a.sta)}</span></td>
        <td class="r"><input type="number" min="0" max="48" step="1" style="width:70px" value="${Math.round(+rot.minutes[p.pid] || 0)}" data-change="rotMin" data-pid="${p.pid}"></td></tr>`).join('')}
      </tbody></table></div>`;
    }
    return `<h1>전술·로테이션</h1>
    <div class="grid g2">${group('pace', '템포')}${group('focus', '공격 전술')}${group('def', '수비 전술')}${group('reb', '리바운드')}</div>
    <div class="card" style="margin-top:14px"><h2>로테이션 <span class="r"><label class="row" style="gap:6px"><input type="checkbox" ${rot.auto ? 'checked' : ''} data-change="rotAuto"> 코치에게 맡기기</label></span></h2>${rotHtml}</div>`;
  };
  A.setTac = el => { const t = G_().teams[G_().userTid]; t.tactics[el.dataset.key] = el.dataset.key === 'pace' ? +el.value : el.value; App.toast('전술을 바꿨습니다'); };
  A.rotAuto = el => {
    const G = G_(), t = G.teams[G.userTid];
    if (el.checked) t.rotation = { auto: true, starters: [], minutes: {} };
    else {
      const ps = L.roster(G, G.userTid).filter(p => !(p.injury && p.injury.days > 0));
      const a = HM.Sim.autoRotation(ps, false);
      t.rotation = { auto: false, starters: a.starters.slice(), minutes: Object.fromEntries(Object.entries(a.minutes).map(([k, v]) => [k, Math.round(v)])) };
    }
    App.rerender();
  };
  A.rotFill = () => { const G = G_(); const t = G.teams[G.userTid]; const ps = L.roster(G, G.userTid).filter(p => !(p.injury && p.injury.days > 0)); const a = HM.Sim.autoRotation(ps, false); t.rotation = { auto: false, starters: a.starters.slice(), minutes: Object.fromEntries(Object.entries(a.minutes).map(([k, v]) => [k, Math.round(v)])) }; App.rerender(); };
  A.rotNorm = () => {
    const G = G_(); const rot = G.teams[G.userTid].rotation;
    const tot = Object.values(rot.minutes).reduce((s, v) => s + (+v || 0), 0) || 1;
    for (const k in rot.minutes) rot.minutes[k] = Math.min(48, Math.round((+rot.minutes[k] || 0) * 240 / tot));
    App.rerender();
  };
  A.rotStarter = el => {
    const rot = G_().teams[G_().userTid].rotation; const pid = +el.dataset.pid;
    if (el.checked) { if (rot.starters.length >= 5) { el.checked = false; App.toast('선발은 5명까지입니다'); return; } rot.starters.push(pid); }
    else rot.starters = rot.starters.filter(x => x !== pid);
    App.rerender();
  };
  A.rotMin = el => { const rot = G_().teams[G_().userTid].rotation; rot.minutes[+el.dataset.pid] = U.clamp(+el.value || 0, 0, 48); App.rerender(); };

  // ---------- 일정 ----------
  S.schedule = () => {
    const G = G_();
    const games = G.schedule.filter(g => g.h === G.userTid || g.a === G.userTid);
    const byMonth = {};
    for (const g of games) { const m = g.date.slice(0, 7); (byMonth[m] = byMonth[m] || []).push(g); }
    const out = Object.entries(byMonth).map(([m, list]) => {
      const [y, mo] = m.split('-');
      return `<div class="card" style="margin-bottom:12px"><h2>${y}년 ${+mo}월</h2><div class="tw"><table class="t"><tbody>${list.map(g => {
        const home = g.h === G.userTid, opp = G.teams[home ? g.a : g.h];
        let res = '';
        if (g.played) { const my = home ? g.hs : g.as, op = home ? g.as : g.hs; res = `<a class="lnk" href="#/game/${g.gid}"><span class="pill ${my > op ? 'good' : 'bad'}">${my > op ? '승' : '패'}</span> <b class="num">${my}-${op}</b>${g.ot ? ' OT' : ''}</a>`; }
        else res = g.date === G.date ? '<span class="pill info">오늘</span>' : '';
        return `<tr><td class="muted small num">${U.fmtDate(g.date)}</td><td>${g.type === 'po' ? '<span class="pill warn">PO</span> ' : g.type === 'playin' ? '<span class="pill warn">플레이인</span> ' : ''}${home ? 'vs' : '@'} ${App.tchip(opp)} ${App.tlink(opp)}</td><td class="r">${res}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;
    }).join('');
    return `<h1>일정·결과 <span class="muted small">${U.seasonLabel(G.season)}</span></h1>${out || '<div class="empty">일정이 없습니다</div>'}`;
  };

  // ---------- 박스스코어 ----------
  App.boxHtml = (gm) => {
    const G = G_();
    const [th, ta] = [G.teams[gm.h], G.teams[gm.a]];
    const [rh, ra] = gm.res.teams;
    const qn = Math.max(rh.q.length, ra.q.length);
    const qh = Array.from({ length: qn }, (_, i) => i < 4 ? `${i + 1}Q` : `OT${i - 3}`);
    const box = (t, side) => {
      const rows = side.players.filter(s => s.min > 0).sort((a, b) => b.gs - a.gs || b.min - a.min);
      const dnp = side.players.filter(s => !s.min);
      const tot = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
      for (const s of rows) for (const k in tot) tot[k] += s[k];
      return `<div class="card" style="margin-top:12px"><h2>${App.tchip(t)} ${esc(t.ko)}</h2><div class="tw"><table class="t"><thead><tr><th>선수</th><th class="r">분</th><th class="r">득점</th><th class="r">FG</th><th class="r">3P</th><th class="r">FT</th><th class="r">공리</th><th class="r">리바</th><th class="r">어시</th><th class="r">스틸</th><th class="r">블록</th><th class="r">TO</th><th class="r">파울</th><th class="r">+/-</th><th class="r">평점</th></tr></thead><tbody>
      ${rows.map(s => { const p = G.players[s.pid]; const r = s.rat ?? HM.Sim.rating(s); return `<tr><td>${s.gs ? '' : '<span class="faint">·</span> '}${p ? App.plink(p) : '?'}</td><td class="r">${Math.round(s.min / 60)}</td><td class="r"><b>${s.pts}</b></td><td class="r">${s.fgm}-${s.fga}</td><td class="r">${s.tpm}-${s.tpa}</td><td class="r">${s.ftm}-${s.fta}</td><td class="r">${s.orb}</td><td class="r">${s.orb + s.drb}</td><td class="r">${s.ast}</td><td class="r">${s.stl}</td><td class="r">${s.blk}</td><td class="r">${s.tov}</td><td class="r">${s.pf}</td><td class="r">${s.pm > 0 ? '+' : ''}${s.pm}</td><td class="r"><span class="av ${r >= 8 ? 'a5' : r >= 7 ? 'a4' : r >= 6.3 ? 'a3' : 'a2'}">${r ? r.toFixed(1) : '-'}</span></td></tr>`; }).join('')}
      <tr><td><b>합계</b></td><td></td><td class="r"><b>${tot.pts}</b></td><td class="r">${tot.fgm}-${tot.fga} <span class="faint">${App.pct(tot.fgm, tot.fga)}</span></td><td class="r">${tot.tpm}-${tot.tpa}</td><td class="r">${tot.ftm}-${tot.fta}</td><td class="r">${tot.orb}</td><td class="r">${tot.orb + tot.drb}</td><td class="r">${tot.ast}</td><td class="r">${tot.stl}</td><td class="r">${tot.blk}</td><td class="r">${tot.tov}</td><td class="r">${tot.pf}</td><td></td><td></td></tr>
      </tbody></table></div>${dnp.length ? `<div class="small muted" style="margin-top:6px">출전하지 않음: ${dnp.map(s => esc(G.players[s.pid]?.name || '')).join(', ')}</div>` : ''}</div>`;
    };
    return `<div class="card"><div class="score">
      <div class="tm"><span class="tbadge lg" style="${App.tstyle(th)}">${esc(th.abbr)}</span><div><b>${esc(th.ko)}</b><div class="small muted">홈</div></div><span class="pts" style="margin-left:auto">${rh.pts}</span></div>
      <div class="mid"><b>${gm.res.ot ? `종료(${gm.res.ot > 1 ? gm.res.ot + '차 ' : ''}연장)` : '경기 종료'}</b><span>${U.fmtDate(gm.date)}${gm.type === 'po' ? ' · 플레이오프' : ''}</span></div>
      <div class="tm away"><span class="tbadge lg" style="${App.tstyle(ta)}">${esc(ta.abbr)}</span><div><b>${esc(ta.ko)}</b><div class="small muted">원정</div></div><span class="pts" style="margin-right:auto">${ra.pts}</span></div>
    </div>
    <div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th></th>${qh.map(q => `<th class="r">${q}</th>`).join('')}<th class="r">합계</th></tr></thead><tbody>
      <tr><td>${App.tchip(th)}</td>${qh.map((_, i) => `<td class="r">${rh.q[i] ?? 0}</td>`).join('')}<td class="r"><b>${rh.pts}</b></td></tr>
      <tr><td>${App.tchip(ta)}</td>${qh.map((_, i) => `<td class="r">${ra.q[i] ?? 0}</td>`).join('')}<td class="r"><b>${ra.pts}</b></td></tr>
    </tbody></table></div>
    <div class="small muted" style="margin-top:6px">리드 체인지 ${gm.res.lead?.changes ?? '-'}회 · 최대 리드 ${th.abbr} ${gm.res.lead?.max[0] ?? '-'} / ${ta.abbr} ${gm.res.lead?.max[1] ?? '-'}</div></div>
    ${App.boxCourtHtml ? App.boxCourtHtml(gm) : ''}${box(th, rh)}${box(ta, ra)}`;
  };
  App.afters.game = gid => { if (App.boxCourtAfter) App.boxCourtAfter(G_().games[+gid]); };
  S.game = gid => {
    const gm = G_().games[+gid];
    if (!gm) return '<div class="empty">이 경기의 박스스코어는 보관되어 있지 않습니다(우리 팀 경기와 플레이오프만 이번 시즌 동안 보관됩니다).</div>';
    return `<div class="row" style="margin-bottom:10px"><a class="btn sm" href="#/schedule">← 일정</a></div>` + App.boxHtml(gm);
  };

  // ---------- 순위 ----------
  S.standings = () => {
    const G = G_();
    const tab = App.ui.tabs.stand || (G.playoffs || G.playin ? 'po' : 'conf');
    const tabs = [['conf', '컨퍼런스'], ['div', '디비전'], ['all', '리그 전체'], ['po', '플레이오프']];
    const y = G.season;
    const nPO = y <= 1983 ? 6 : y >= 2021 ? 6 : 8;
    const tbl = (list, cut) => {
      const gb = Season.gamesBehind(list);
      return `<div class="tw"><table class="t"><thead><tr><th>#</th><th>팀</th><th class="r">승</th><th class="r">패</th><th class="r">승률</th><th class="r">게임차</th><th class="r hide-m">홈</th><th class="r hide-m">원정</th><th class="r hide-m">컨퍼런스</th><th class="r">득실</th><th class="r hide-m">연속</th><th class="r hide-m">최근10</th></tr></thead><tbody>
      ${list.map((x, i) => { const r = x.r; const gp = r.w + r.l; return `<tr class="${x.t.tid === G.userTid ? 'me' : ''} ${cut && i === nPO - 1 ? 'cut' : ''} ${cut && y >= 2021 && i === 9 ? 'cut2' : ''}"><td class="muted">${i + 1}</td><td>${App.tchip(x.t)} ${App.tlink(x.t)}</td><td class="r">${r.w}</td><td class="r">${r.l}</td><td class="r">${gp ? (r.w / gp).toFixed(3).replace(/^0/, '') : '-'}</td><td class="r">${gb[i] ? gb[i].toFixed(1) : '-'}</td><td class="r hide-m">${r.hw}-${r.hl}</td><td class="r hide-m">${r.w - r.hw}-${r.l - r.hl}</td><td class="r hide-m">${r.cw}-${r.cl}</td><td class="r">${gp ? ((r.pf - r.pa) / gp > 0 ? '+' : '') + ((r.pf - r.pa) / gp).toFixed(1) : '-'}</td><td class="r hide-m">${r.streak > 0 ? '승' + r.streak : r.streak < 0 ? '패' + (-r.streak) : '-'}</td><td class="r hide-m">${r.last.filter(Boolean).length}-${r.last.filter(v => !v).length}</td></tr>`; }).join('')}</tbody></table></div>`;
    };
    let body = '';
    if (tab === 'conf') body = ['E', 'W'].map(c => `<div class="card" style="margin-bottom:14px"><h2>${c === 'E' ? '동부' : '서부'} 컨퍼런스</h2>${tbl(Season.standings(G, c), true)}<div class="small muted" style="margin-top:6px">실선: 플레이오프 직행${y >= 2021 ? ', 점선: 플레이인(7~10위)' : ''}</div></div>`).join('');
    else if (tab === 'div') {
      const DIVN = { ATL: '대서양', CEN: '중부', SE: '남동부', MID: '중서부', PAC: '태평양', NW: '북서부', SW: '남서부' };
      const divs = [...new Set(G.teams.map(t => t.conf + '|' + t.div))].sort();
      body = `<div class="grid g2">${divs.map(d => { const [c, dv] = d.split('|'); const list = Season.standings(G).filter(x => x.t.conf === c && x.t.div === dv); return `<div class="card"><h2>${c === 'E' ? '동부' : '서부'} · ${DIVN[dv] || dv} 디비전</h2>${tbl(list, false)}</div>`; }).join('')}</div>`;
    } else if (tab === 'all') body = `<div class="card">${tbl(Season.standings(G), false)}</div>`;
    else body = App.bracketHtml();
    return `<h1>순위·플레이오프 <span class="muted small">${U.seasonLabel(y)}</span></h1><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-group="stand" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  };
  App.bracketHtml = () => {
    const G = G_();
    let pi = '';
    if (G.playin) {
      pi = `<div class="card" style="margin-bottom:14px"><h2>플레이인 토너먼트</h2><div class="grid g2">${['E', 'W'].map(c => {
        const x = G.playin.conf[c]; const t = id => id !== null && id !== undefined ? `${App.tchip(G.teams[id])} ${esc(G.teams[id].ko)}` : '미정';
        return `<div><h3>${c === 'E' ? '동부' : '서부'}</h3><div class="small">7위전: ${t(x.a[0])} vs ${t(x.a[1])} → 7번 시드 ${x.seed7 !== null ? t(x.seed7) : '미정'}</div><div class="small">9·10위전: ${t(x.b[0])} vs ${t(x.b[1])}</div><div class="small">8번 시드 결정전: ${x.c ? `${t(x.c[0])} vs ${t(x.c[1])}` : '미정'} → ${x.seed8 !== null ? t(x.seed8) : '미정'}</div></div>`;
      }).join('')}</div></div>`;
    }
    if (!G.playoffs) return pi + '<div class="empty">플레이오프가 아직 시작되지 않았습니다.</div>';
    const po = G.playoffs;
    const ser = s => {
      if (!s) return '<div class="series faint">미정</div>';
      const row = (tid, seed, w, other) => `<div class="s ${s.done ? (s.winner === tid ? 'w' : 'l') : ''}"><span>${seed ? `<span class="faint">${seed}</span> ` : ''}${App.tchip(G.teams[tid])} ${esc(G.teams[tid].abbr)}</span><b>${w}</b></div>`;
      return `<div class="series ${s.h === G.userTid || s.a === G.userTid ? 'me' : ''}">${row(s.h, s.hs, s.w[0])}${row(s.a, s.as, s.w[1])}</div>`;
    };
    const r = po.rounds;
    const conf = (ri, c) => (r[ri] || []).filter(s => s.conf === c);
    const col = (list, n) => `<div class="bcol">${Array.from({ length: n }, (_, i) => ser(list[i])).join('')}</div>`;
    const n1 = G.season <= 1983 ? 2 : 4;
    const html = `<div class="tw"><div class="bracket">
      ${col(conf(0, 'E'), n1)}${col(conf(1, 'E'), 2)}${col(conf(2, 'E'), 1)}${col(r[3] || [], 1)}${col(conf(2, 'W'), 1)}${col(conf(1, 'W'), 2)}${col(conf(0, 'W'), n1)}
    </div></div><div class="row small muted" style="justify-content:space-between;margin-top:6px"><span>← 동부</span><span>${po.champ !== null && po.champ !== undefined ? `🏆 챔피언: <b>${esc(G.teams[po.champ].ko)}</b>` : 'NBA 파이널'}</span><span>서부 →</span></div>`;
    return pi + `<div class="card">${html}</div>`;
  };

  // ---------- 리그 통계 ----------
  S.stats = () => {
    const G = G_();
    const tab = App.ui.tabs.stats || 'lead';
    const po = App.ui.tabs.statsPo === '1' ? 1 : 0;
    const tabs = [['lead', '부문별 리더'], ['players', '선수 기록'], ['teams', '팀 기록']];
    const all = Object.values(G.players).filter(p => p.tid >= -1).map(p => ({ p, l: App.line(p, po) })).filter(x => x.l && x.l.gp > 0);
    const maxGp = Math.max(1, ...G.teams.map(t => { const r = L.rec(G, t.tid); return r.w + r.l; }));
    let body = '';
    if (tab === 'lead') {
      const q = po ? 3 : Math.max(1, Math.floor(maxGp * 0.55));
      const cats = [['득점', x => x.l.pts / x.l.gp], ['리바운드', x => (x.l.orb + x.l.drb) / x.l.gp], ['어시스트', x => x.l.ast / x.l.gp], ['스틸', x => x.l.stl / x.l.gp], ['블록', x => x.l.blk / x.l.gp], ['평점', x => x.l.rat / x.l.gp, 2],
        ['야투율', x => x.l.fga >= (po ? 20 : maxGp * 3) ? x.l.fgm / x.l.fga * 100 : -1], ['3점 성공률', x => x.l.tpa >= (po ? 10 : maxGp * 1.2) ? x.l.tpm / x.l.tpa * 100 : -1], ['자유투 성공률', x => x.l.fta >= (po ? 10 : maxGp * 1.5) ? x.l.ftm / x.l.fta * 100 : -1]];
      body = `<div class="grid g3">${cats.map(([nm, f, d]) => { const list = all.filter(x => x.l.gp >= q && f(x) >= 0).sort((a, b) => f(b) - f(a)).slice(0, 10); return `<div class="card"><h2>${nm}</h2><div class="tw"><table class="t"><tbody>${list.map((x, i) => `<tr class="${x.p.tid === G.userTid ? 'me' : ''}"><td class="muted">${i + 1}</td><td>${App.plink(x.p)} <span class="faint small">${x.p.tid >= 0 ? G.teams[x.p.tid].abbr : ''}</span></td><td class="r"><b>${f(x).toFixed(d || 1)}</b></td></tr>`).join('') || '<tr><td class="muted">기록 없음</td></tr>'}</tbody></table></div></div>`; }).join('')}</div><p class="small muted">규정: ${po ? '3경기' : q + '경기'} 이상 출전</p>`;
    } else if (tab === 'players') {
      const team = App.ui.tabs.statsTeam ?? 'all';
      const list = all.filter(x => team === 'all' || String(x.p.tid) === team).map(x => x.p);
      body = `<div class="row" style="margin-bottom:8px"><select data-change="statsTeam"><option value="all">모든 팀</option>${G.teams.map(t => `<option value="${t.tid}" ${String(t.tid) === team ? 'selected' : ''}>${esc(t.ko)}</option>`).join('')}</select></div><div class="card flat" style="padding:6px">${App.rosterTable('lgstats', list, { tab: 'stats', po })}</div>`;
    } else {
      const rows = G.teams.map(t => {
        const ps = Object.values(G.players).filter(p => p.stats.some(l => l.s === G.season && l.tid === t.tid && l.po === po));
        const tot = { gp: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0 };
        for (const p of ps) for (const l of p.stats) if (l.s === G.season && l.tid === t.tid && l.po === po) for (const k in tot) if (k !== 'gp') tot[k] += l[k];
        const r = L.rec(G, t.tid); const gp = po ? Math.max(1, G.schedule.filter(g => g.type === 'po' && g.played && (g.h === t.tid || g.a === t.tid)).length) : Math.max(1, r.w + r.l);
        return { t, gp, tot, r, opp: po ? null : r.pa / gp };
      });
      const c = (k, label, f, d = 1) => ({ k, label, cls: 'r', v: f, f: x => { const v = f(x); return v === null || isNaN(v) ? '-' : v.toFixed(d); } });
      body = `<div class="card flat" style="padding:6px">${App.table('teamstats', [
        { k: 'team', label: '팀', f: x => `${App.tchip(x.t)} ${App.tlink(x.t)}`, v: x => x.t.ko },
        c('pts', '득점', x => x.tot.pts / x.gp), c('opp', '실점', x => x.opp), c('diff', '득실', x => x.opp === null ? null : x.tot.pts / x.gp - x.opp),
        c('fg', 'FG%', x => x.tot.fgm / x.tot.fga * 100), c('tp', '3P%', x => x.tot.tpm / x.tot.tpa * 100), c('tpa', '3PA', x => x.tot.tpa / x.gp),
        c('reb', '리바', x => (x.tot.orb + x.tot.drb) / x.gp), c('ast', '어시', x => x.tot.ast / x.gp), c('stl', '스틸', x => x.tot.stl / x.gp), c('blk', '블록', x => x.tot.blk / x.gp), c('tov', '턴오버', x => x.tot.tov / x.gp),
      ], rows, { sort: { k: 'diff', dir: -1 }, rowCls: x => x.t.tid === G.userTid ? 'me' : '' })}</div>`;
    }
    return `<h1>리그 통계 <span class="muted small">${U.seasonLabel(G.season)}</span></h1><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-group="stats" data-tab="${k}">${l}</button>`).join('')}<span class="sp"></span><button class="${po ? '' : 'on'}" data-act="tab" data-group="statsPo" data-tab="0">정규</button><button class="${po ? 'on' : ''}" data-act="tab" data-group="statsPo" data-tab="1">플레이오프</button></div>${body}`;
  };
  A.statsTeam = el => { App.ui.tabs.statsTeam = el.value; App.rerender(); };

  // ---------- 리그·팀 ----------
  S.league = () => {
    const G = G_();
    const rows = G.teams.map(t => ({ t, r: L.rec(G, t.tid), s: L.strength(G, t.tid), pay: F.payroll(G, t.tid, AI.capYear(G)), best: L.roster(G, t.tid).sort((a, b) => b.ovr - a.ovr)[0] }));
    return `<h1>리그·팀</h1><div class="card flat" style="padding:6px">${App.table('league', [
      { k: 'team', label: '팀', f: x => `${App.tchip(x.t)} ${App.tlink(x.t)}`, v: x => x.t.ko },
      { k: 'conf', label: '컨퍼런스', cls: 'c', f: x => x.t.conf === 'E' ? '동부' : '서부', v: x => x.t.conf },
      { k: 'rec', label: '성적', cls: 'r', f: x => `${x.r.w}-${x.r.l}`, v: x => x.r.w - x.r.l },
      { k: 's', label: '전력', cls: 'c', f: x => App.ovr(x.s), v: x => x.s },
      { k: 'best', label: '에이스', f: x => x.best ? `${App.plink(x.best)} ${App.ovr(x.best.ovr)}` : '-', v: x => x.best?.ovr || 0 },
      { k: 'pay', label: '연봉 총액', cls: 'r', f: x => U.money(x.pay), v: x => x.pay },
      { k: 'strat', label: '방향', cls: 'c', f: x => x.t.tid === G.userTid ? '<span class="pill info">우리 팀</span>' : ({ contend: '<span class="pill warn">우승 도전</span>', rebuild: '<span class="pill">리빌딩</span>', mid: '<span class="pill">중위권</span>' }[x.t.strategy]), v: x => x.t.strategy },
    ], rows, { sort: { k: 's', dir: -1 }, rowCls: x => x.t.tid === G.userTid ? 'me' : '' })}</div>`;
  };
  S.team = tid => {
    const G = G_(); const t = G.teams[+tid]; if (!t) return '';
    const tab = App.ui.tabs.team || 'ov';
    const ps = L.roster(G, t.tid);
    const picks = G.picks.filter(k => k.tid === t.tid).sort((a, b) => a.season - b.season || a.round - b.round);
    const hist = Object.entries(t.seasons).filter(([y]) => +y < G.season).sort((a, b) => b[0] - a[0]);
    return `<div class="card"><div class="row nowrap"><span class="tbadge lg" style="${App.tstyle(t)}">${esc(t.abbr)}</span><div style="min-width:0"><h1 style="margin:0">${esc(t.ko)}</h1><div class="muted">${esc(t.name)} · ${App.recTxt(t.tid)} · 연봉 ${U.money(F.payroll(G, t.tid, AI.capYear(G)))}</div></div><span class="sp"></span>${t.tid !== G.userTid ? `<button class="btn pri" data-act="tradeTeam" data-tid="${t.tid}">트레이드</button>` : ''}</div></div>
    <div class="tabs" style="margin-top:12px">${[['ov', '개요'], ['attr', '능력치'], ['stats', '기록'], ['con', '계약']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-group="team" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="card flat" style="padding:6px">${App.rosterTable('team-' + tab, ps, { tab })}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>보유 지명권</h2>${picks.map(k => `<span class="pill" style="margin:2px">${k.season} ${k.round}R${k.orig !== t.tid ? ` (${esc(G.teams[k.orig].abbr)})` : ''}</span>`).join('') || '<span class="muted">없음</span>'}</div>
      <div class="card"><h2>지난 시즌</h2>${hist.length ? hist.map(([y, r]) => `<div class="row" style="justify-content:space-between"><span>${U.seasonLabel(+y)}</span><span>${r.w}-${r.l} ${r.po >= 4 ? '🏆' : r.po >= 0 ? `<span class="pill">PO ${['1R', '2R', 'CF', 'F'][r.po] || ''}</span>` : ''}</span></div>`).join('') : `<span class="muted">${t.prevReal ? `시작 직전 실제 시즌: ${t.prevReal[0]}-${t.prevReal[1]}` : '기록 없음'}</span>`}</div>
    </div>`;
  };
  A.tradeTeam = el => { App.ui.trade = { partner: +el.dataset.tid, mine: [], theirs: [], myPicks: [], theirPicks: [] }; App.go('#/trade'); };

  // ---------- 기록실 ----------
  S.history = () => {
    const G = G_(), d = D();
    const ys = Object.keys(G.history).map(Number).filter(y => G.history[y].champ !== undefined).sort((a, b) => b - a);
    const pn = id => id && G.players[id] ? App.plink(G.players[id]) : '-';
    const rows = ys.map(y => {
      const h = G.history[y]; const a = h.awards || {};
      return `<tr><td>${U.seasonLabel(y)}</td><td>${App.tchip(G.teams[h.champ])} <b>${esc(h.champName)}</b> <span class="faint small">${h.score}</span></td><td>${esc(h.runnerName)}</td><td>${pn(a.mvp)}</td><td>${pn(h.fmvp)}</td><td>${pn(a.roy)}</td><td>${pn(a.dpoy)}</td><td>${h.user ? `${h.user.w}-${h.user.l} ${['탈락', '1R', '2R', 'CF', '준우승', '🏆'][h.user.po + 1] || ''}` : ''}</td></tr>`;
    }).join('');
    const realRows = Object.entries(d.champs).filter(([y]) => +y < G.startYear).sort((a, b) => b[0] - a[0]).map(([y, ab]) => {
      const row = d.seasons[y]?.teams.find(r => r[0] === ab);
      return `<tr><td>${U.seasonLabel(+y)}</td><td>${row ? esc(d.ko[row[1]] || row[1]) : esc(ab)}</td></tr>`;
    }).join('');
    const myCareer = ys.map(y => G.history[y].user).filter(Boolean);
    const titles = myCareer.filter(x => x.po >= 4).length;
    return `<h1>기록실</h1>
    <div class="card"><h2>감독 경력 <span class="r">${esc(G.manager.name)}</span></h2><div class="row"><span class="pill">${myCareer.length}시즌</span><span class="pill">${myCareer.reduce((s, x) => s + x.w, 0)}승 ${myCareer.reduce((s, x) => s + x.l, 0)}패</span><span class="pill warn">우승 ${titles}회</span><span class="pill">플레이오프 ${myCareer.filter(x => x.po >= 0).length}회</span></div></div>
    <div class="card" style="margin-top:14px"><h2>게임 속 시즌</h2><div class="tw"><table class="t"><thead><tr><th>시즌</th><th>우승</th><th>준우승</th><th>MVP</th><th>파이널 MVP</th><th>신인왕</th><th>올해의 수비수</th><th>우리 팀</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="empty">아직 끝난 시즌이 없습니다</td></tr>'}</tbody></table></div></div>
    <div class="card" style="margin-top:14px"><h2>실제 역사 <span class="r">게임 시작 이전 NBA 우승팀</span></h2><div class="tw"><table class="t"><tbody>${realRows}</tbody></table></div></div>`;
  };

  // ---------- 저장·설정 ----------
  S.settings = () => {
    const G = G_();
    const theme = App.themePref();
    return `<h1>저장·설정</h1>
    <div class="grid g2">
      <div class="card"><h2>저장</h2><p class="small muted">게임은 이 브라우저에 저장됩니다(자동 저장 ${G.settings.autosave !== false ? '켜짐' : '꺼짐'}). 다른 기기로 옮기려면 파일로 내보내세요.</p>
        <div class="row"><button class="btn pri" data-act="saveNow">지금 저장</button><button class="btn" data-act="exportSave">파일로 내보내기</button><button class="btn" data-act="toTitle">타이틀로</button></div>
        <label class="row" style="margin-top:12px"><input type="checkbox" ${G.settings.autosave !== false ? 'checked' : ''} data-change="autosave"> 진행할 때마다 자동 저장</label></div>
      <div class="card"><h2>화면 테마</h2><div class="grid g3">${[['dark', '🌙 다크 모드'], ['light', '☀️ 밝게'], ['system', '📱 기기 설정 따르기']].map(([v, l]) => `<label class="opt"><input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''} data-change="theme"><span><b>${l}</b></span></label>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">위쪽 막대의 🌙/☀️ 단추로도 바로 바꿀 수 있습니다.</p></div>
      ${App.autoCard()}
      <div class="card"><h2>이 게임</h2><div class="kv small"><span>시작 시즌</span><span>${U.seasonLabel(G.startYear)}</span><span>현재 시즌</span><span>${U.seasonLabel(G.season)}</span><span>선수 성장</span><span>${G.settings.prog === 'real' ? '실제 커리어 따라가기' : '무작위 성장'}</span><span>리그</span><span>${G.teams.length}개 팀</span></div>
        <div class="row" style="margin-top:10px"><select data-change="progMode"><option value="real" ${G.settings.prog === 'real' ? 'selected' : ''}>실제 커리어 따라가기</option><option value="random" ${G.settings.prog === 'random' ? 'selected' : ''}>무작위 성장</option></select></div></div>
      <div class="card"><h2>자료</h2><p class="small muted">선수 능력치는 Basketball-Reference 기록(1976-77 ~ 2026-27 시즌 초)을 바탕으로 계산했습니다. 팀·선수 이름은 실제 NBA를 따르지만, 이 게임은 NBA와 관계없는 팬 제작 시뮬레이션입니다. 계약 금액은 실제 계약이 아니라 능력과 당시 샐러리캡으로 추정한 값입니다.</p></div>
    </div>`;
  };
  // 자동 진행(턴 끄기)
  App.autoCard = () => {
    const A = Season.autoSet(G_());
    const tog = (k, title, desc) => `<label class="opt"><input type="checkbox" ${A[k] ? 'checked' : ''} data-change="autoTog" data-k="${k}"><span><b>${title}</b><span class="small muted">${desc}</span></span></label>`;
    const sel = (k, title, opts) => `<div><h3>${title}</h3><div class="grid">${opts.map(([v, l, d]) => `<label class="opt"><input type="radio" name="auto-${k}" value="${v}" ${A[k] === v ? 'checked' : ''} data-change="autoSel" data-k="${k}"><span><b>${l}</b><span class="small muted">${d}</span></span></label>`).join('')}</div></div>`;
    return `<div class="card span2" id="autoCard"><h2>자동 진행(턴 끄기) <span class="r"><button class="btn sm" data-act="autoPreset" data-p="fast">빠르게: 지루한 부분 모두 자동</button> <button class="btn sm" data-act="autoPreset" data-p="full">모두 직접</button></span></h2>
      <p class="small muted">끈 단계는 코치진이 알아서 처리하고 멈추지 않고 넘어갑니다. 위쪽 <b>계속 ▾</b> 메뉴의 건너뛰기(1주일·트레이드 마감까지·시즌 끝까지·오프시즌 건너뛰기·다음 시즌 개막까지)와 함께 쓰세요.</p>
      <div class="grid g2" style="margin-top:10px">
        ${sel('games', '우리 경기 날 멈추기', [['all', '모든 경기', '경기마다 멈춥니다'], ['playoffs', '플레이오프만', '정규시즌 경기는 자동으로 치릅니다'], ['none', '멈추지 않음', '모든 경기를 자동으로 치르고, 계속을 누르면 1주일씩 진행합니다']])}
        ${sel('gameMode', '멈췄을 때 경기 방식', [['ask', '매번 묻기', '경기 전 화면에서 고릅니다'], ['live', '바로 생중계', '경기 전 화면 없이 생중계로'], ['quick', '바로 결과', '경기 전 화면 없이 결과만']])}
      </div>
      <h3 style="margin-top:14px">코치에게 맡길 단계(턴 끄기)</h3>
      <div class="grid g2">
        ${tog('preseason', '프리시즌 건너뛰기', '새 시즌이 오면 바로 개막까지 진행합니다. 로스터가 넘치면 코치가 정리합니다.')}
        ${tog('draft', '드래프트 자동', '우리 지명도 코치가 합니다(대체로 실제 평가 순서를 따릅니다).')}
        ${tog('resign', '재계약 자동', '계약이 끝나는 선수를 코치가 판단해 재계약하거나 보냅니다.')}
        ${tog('fa', '자유계약 시장 자동', 'FA 기간을 멈추지 않고 넘기며, 코치가 필요한 선수와 계약합니다.')}
      </div>
      <h3 style="margin-top:14px">알림·정지</h3>
      <div class="grid g3">
        ${tog('halftime', '생중계 하프타임 정지', '하프타임에 잠깐 멈춥니다.')}
        ${tog('offers', 'AI 트레이드 제안 받기', '끄면 다른 구단이 제안을 보내지 않습니다.')}
        ${tog('minorInjury', '가벼운 부상 알림', '끄면 7일 이상 결장하는 부상만 알립니다.')}
        <div class="opt" style="display:block"><b>🎟️ 드래프트 우선권</b><div class="row" style="margin-top:6px">${[['round1', '1라운드 1순위'], ['all', '모든 라운드 맨 먼저'], ['off', '끄기(로터리대로)']].map(([v, l]) => `<label class="pill" style="cursor:pointer;padding:5px 10px"><input type="radio" name="auto-draftFirst" value="${v}" ${(A.draftFirst || 'off') === v ? 'checked' : ''} data-change="autoSel" data-k="draftFirst"> ${l}</label>`).join('')}</div><span class="small muted">드래프트 날 우리 팀이 먼저 지명합니다. 지명권이 없으면 하나 받습니다.</span></div>
        ${tog('watchStop', '관심 FA 알림 때 멈추기', '자유계약 화면에서 저장한 조건이나 ★ 관심 선수가 시장에 나오면 진행을 멈춥니다.')}
      </div></div>`;
  };
  A.autoTog = el => { Season.autoSet(G_())[el.dataset.k] = el.checked; App.toast('설정을 바꿨습니다'); App.autosave(); };
  A.autoSel = el => { Season.autoSet(G_())[el.dataset.k] = el.value; App.toast('설정을 바꿨습니다'); App.autosave(); App.rerender(); };
  A.autoPreset = el => {
    const A2 = Season.autoSet(G_());
    if (el.dataset.p === 'fast') Object.assign(A2, { games: 'playoffs', gameMode: 'ask', preseason: true, draft: true, resign: true, fa: true, halftime: false, minorInjury: false });
    else Object.assign(A2, { games: 'all', gameMode: 'ask', preseason: false, draft: false, resign: false, fa: false, halftime: true, offers: true, minorInjury: true });
    App.toast(el.dataset.p === 'fast' ? '지루한 부분을 모두 자동으로 바꿨습니다' : '모든 단계를 직접 하도록 바꿨습니다'); App.autosave(); App.rerender();
  };
  A.saveNow = () => App.save();
  A.exportSave = async () => {
    const r = await HM.Store.exportFile(G_());
    App.toast(r === 'saved' ? '저장 파일을 내보냈습니다' : r === 'declined' ? '내보내기를 취소했습니다' : '이 화면에서는 파일로 내보낼 수 없습니다. 브라우저에서 열어 보세요', 3500);
  };
  A.toTitle = async () => { await App.save(true); App.G = null; App.live = null; App.go('#/title'); };
  A.autosave = el => { G_().settings.autosave = el.checked; };
  A.progMode = el => { G_().settings.prog = el.value; App.toast('다음 시즌부터 적용됩니다'); };
  A.theme = el => { App.setTheme(el.value); };

  // ---------- 해임 ----------
  S.fired = () => {
    const G = G_();
    const open = G.teams.map(t => ({ t, s: L.strength(G, t.tid) })).sort((a, b) => a.s - b.s).slice(0, 8);
    return `<div class="card" style="max-width:720px;margin:20px auto"><h1>해임되었습니다</h1><p>${esc(G.teams[G.fired.team].ko)} 이사회가 감독님과의 동행을 끝냈습니다. 하지만 농구계는 넓습니다. 감독이 필요한 다른 구단이 있습니다.</p>
      <div class="teams" style="margin-top:12px">${open.filter(x => x.t.tid !== G.fired.team).map(x => `<button class="tpick" data-act="newJob" data-tid="${x.t.tid}"><span class="tbadge" style="${App.tstyle(x.t)}">${esc(x.t.abbr)}</span><span class="info"><b>${esc(x.t.ko)}</b><span>전력 ${Math.round(x.s)}</span></span></button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-act="toTitle">타이틀로</button></div></div>`;
  };
  A.newJob = el => {
    const G = G_(); G.userTid = +el.dataset.tid; G.fired = null; G.board.conf = 50;
    for (const t of G.teams) if (t.tid === G.userTid) { t.rotation = { auto: true, starters: [], minutes: {} }; }
    Season.msg(G, `${G.teams[G.userTid].ko} 부임`, '새 구단에서 다시 시작합니다. 이사회는 당장 큰 기대를 하지 않습니다.', { type: 'board' });
    G.board.exp = { lv: 1, txt: '팀을 추스르고 미래를 준비하라', rank: 0 };
    App.autosave(); App.go('#/home');
  };
})();
