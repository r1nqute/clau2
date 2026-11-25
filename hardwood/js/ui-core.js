// 화면 뼈대: 상태, 라우터, 표, 모달, 계속 단추
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, F = HM.Fin, Season = HM.Season, R = HM.Ratings;
  const esc = U.esc;

  const App = {
    G: null, route: { name: 'title', params: [] }, ui: { sorts: {}, tabs: {} }, screens: {}, acts: {}, afters: {},
    live: null,
  };
  HM.App = App;

  // ---------- 작은 도우미 ----------
  // 팀 바탕색 밝기에 따라 글자색을 고른다
  const lum = hex => { const h = String(hex).replace('#', ''); if (h.length < 6) return 0.3; const c = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  App.textOn = c1 => lum(c1) > 0.33 ? '#111111' : '#ffffff';
  App.tstyle = t => `--c1:${t.colors[0]};--c2:${t.colors[1]};--ct:${App.textOn(t.colors[0])}`;
  App.tchip = (t, txt) => t ? `<span class="tchip" style="${App.tstyle(t)}">${esc(txt || t.abbr)}</span>` : '';
  App.tlink = t => t ? `<a class="lnk" href="#/team/${t.tid}">${esc(t.ko)}</a>` : '-';
  App.tname = tid => tid >= 0 ? App.G.teams[tid].ko : tid === -1 ? '자유계약' : tid === -2 ? '드래프트 후보' : '은퇴';
  App.plink = p => p ? `<a class="lnk nm" href="#/player/${p.pid}">${esc(p.name)}</a>` : '-';
  App.ovrCls = v => v >= 90 ? 'o5' : v >= 82 ? 'o4' : v >= 75 ? 'o3' : v >= 68 ? 'o2' : 'o1';
  App.ovr = v => `<span class="ovr ${App.ovrCls(v)}">${Math.round(v)}</span>`;
  App.stars = v => {
    const s = P.stars(v); let h = '';
    for (let i = 1; i <= 5; i++) h += s >= i ? '★' : s >= i - 0.5 ? '⯪' : '<span class="off">★</span>';
    return `<span class="stars" title="${Math.round(v)}">${h}</span>`;
  };
  App.age = p => P.age(p, App.G.season);
  App.injTag = p => p.injury && p.injury.days > 0 ? `<span class="pill bad" title="${esc(p.injury.type)}">부상 ${p.injury.days}일</span>` : '';
  App.moraleTag = p => {
    const m = p.morale ?? 60;
    return m >= 75 ? '<span class="pill good">사기 높음</span>' : m < 35 ? '<span class="pill bad">사기 낮음</span>' : '';
  };
  App.moraleTxt = m => m >= 80 ? '매우 좋음' : m >= 65 ? '좋음' : m >= 45 ? '보통' : m >= 30 ? '나쁨' : '매우 나쁨';
  App.contractTxt = p => p.contract ? `${U.money(p.contract.amt)} · ${U.seasonLabel(p.contract.exp)}까지` : '-';
  App.phaseTxt = ph => ({ preseason: '프리시즌', regular: '정규시즌', playin: '플레이인', playoffs: '플레이오프', draft: '드래프트', resign: '재계약 기간', fa: '자유계약 시장' }[ph] || ph);
  App.recTxt = (tid, y) => { const r = L.rec(App.G, tid, y); return `${r.w}승 ${r.l}패`; };
  App.line = (p, po = 0, y) => Season.seasonLine(p, y ?? App.G.season, po);
  App.pg = (l, k, d = 1) => l && l.gp ? (l[k] / l.gp).toFixed(d) : '-';
  App.pct = (a, b) => b ? (a / b * 100).toFixed(1) : '-';

  // ---------- 정렬되는 표 ----------
  // cols: [{k, label, cls, f(row)->html, v(row)->정렬값, title}]
  App.table = (id, cols, rows, opt = {}) => {
    const st = App.ui.sorts[id] || opt.sort || null;
    let list = rows.slice();
    if (st) {
      const c = cols.find(x => x.k === st.k);
      if (c) {
        const get = c.v || (r => r[c.k]);
        list.sort((a, b) => {
          let x = get(a), y = get(b);
          if (x === undefined || x === null || x === '-' || Number.isNaN(x)) x = st.dir > 0 ? Infinity : -Infinity;
          if (y === undefined || y === null || y === '-' || Number.isNaN(y)) y = st.dir > 0 ? Infinity : -Infinity;
          if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'ko') * st.dir;
          return (x - y) * st.dir;
        });
      }
    }
    if (opt.limit) list = list.slice(0, opt.limit);
    const head = cols.map(c => `<th class="${c.cls || ''} ${st && st.k === c.k ? 'sorted' : ''}" ${c.nosort ? '' : `data-sort="${id}|${c.k}"`} title="${esc(c.title || '')}">${c.label}${st && st.k === c.k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
    const body = list.map((r, i) => `<tr class="${opt.rowCls ? opt.rowCls(r, i) : ''}">${cols.map(c => `<td class="${c.cls || ''}">${c.f ? c.f(r, i) : esc(r[c.k] ?? '')}</td>`).join('')}</tr>`).join('');
    return `<div class="tw"><table class="t" id="tbl-${id}"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="empty">없음</td></tr>`}</tbody></table></div>`;
  };

  // ---------- 모달·알림·진행 ----------
  App.modal = (title, body, foot = '', opt = {}) => {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="box ${opt.wide ? 'wide' : ''}"><div class="mh"><b>${title}</b><button class="x" data-act="closeModal" aria-label="닫기">✕</button></div><div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ''}</div>`;
    m.classList.add('on');
    App.modalOpen = true;
  };
  App.closeModal = () => { const m = document.getElementById('modal'); m.classList.remove('on'); m.innerHTML = ''; App.modalOpen = false; };
  App.toast = (t, ms = 2200) => {
    const el = document.getElementById('toast'); el.textContent = t; el.classList.add('on');
    clearTimeout(App._tt); App._tt = setTimeout(() => el.classList.remove('on'), ms);
  };
  App.busy = (on, text = '', frac = null) => {
    const b = document.getElementById('busy');
    if (!on) { b.classList.remove('on'); return; }
    b.innerHTML = `<div class="box"><b>${esc(text)}</b>${frac !== null ? `<div class="bar"><i style="width:${Math.round(frac * 100)}%"></i></div>` : ''}</div>`;
    b.classList.add('on');
  };
  App.confirm = (title, body, okText = '확인') => new Promise(res => {
    App._confirmRes = res;
    App.modal(title, body, `<button class="btn" data-act="confirmNo">취소</button><button class="btn pri" data-act="confirmYes">${okText}</button>`);
  });
  App.acts.confirmYes = () => { App.closeModal(); App._confirmRes && App._confirmRes(true); };
  App.acts.confirmNo = () => { App.closeModal(); App._confirmRes && App._confirmRes(false); };
  App.acts.closeModal = () => App.closeModal();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  App.sleep = sleep;

  // ---------- 틀 그리기 ----------
  const NAV = [
    ['home', '🏠', '홈'], ['inbox', '✉️', '받은 편지함'], ['squad', '👥', '선수단'], ['tactics', '📋', '전술·로테이션'], ['schedule', '📅', '일정·결과'],
    ['standings', '🏆', '순위·플레이오프'], ['stats', '📊', '리그 통계'], 'sep', ['trade', '🔄', '트레이드'], ['fa', '✍️', '자유계약'], ['draft', '🎓', '드래프트'],
    ['finance', '💰', '재정·계약'], 'sep', ['league', '🏟️', '리그·팀'], ['history', '📜', '기록실'], ['settings', '⚙️', '저장·설정'],
  ];
  App.frame = () => {
    const G = App.G, t = G.teams[G.userTid];
    const unread = G.inbox.filter(m => !m.read).length;
    const r = L.rec(G, G.userTid);
    const nav = NAV.map(n => n === 'sep' ? '<div class="sep"></div>' :
      `<a href="#/${n[0]}" class="${App.route.name === n[0] ? 'on' : ''}"><span class="ic">${n[1]}</span>${n[2]}${n[0] === 'inbox' && unread ? `<span class="badge">${unread}</span>` : ''}${n[0] === 'draft' && G.phase === 'draft' ? '<span class="badge">!</span>' : ''}${n[0] === 'finance' && G.phase === 'resign' ? '<span class="badge">!</span>' : ''}</a>`).join('');
    const contLabel = App.contLabel();
    return `
    <div id="app">
      <header id="top">
        <button class="menu-btn" data-act="menu" aria-label="메뉴">☰</button>
        <div class="brand"><i></i><span>하드우드 매니저</span></div>
        <a class="topteam" href="#/home"><span class="tbadge" style="${App.tstyle(t)}">${esc(t.abbr)}</span>
          <span class="meta"><b>${esc(t.ko)}</b><span>${r.w}승 ${r.l}패 · ${App.phaseTxt(G.phase)}</span></span></a>
        <div class="topdate"><b>${U.fmtDate(G.date)}</b><span>${U.seasonLabel(G.season)} 시즌</span></div>
        <div class="cont"><button data-act="cont" data-mode="next">${contLabel} ▸</button><button class="more" data-act="contMenu" aria-label="진행 방식">▾</button></div>
      </header>
      <nav id="side" class="nav">${nav}</nav>
      <main id="main"></main>
      <div id="bottombar"><div class="d"><b>${U.fmtDate(G.date)}</b><span>${U.seasonLabel(G.season)} · ${App.phaseTxt(G.phase)}</span></div>
        <div class="cont"><button data-act="cont" data-mode="next">${contLabel} ▸</button><button class="more" data-act="contMenu" aria-label="진행 방식">▾</button></div></div>
    </div>`;
  };
  App.contLabel = () => {
    const G = App.G;
    if (App.live && !App.live.finished) return '생중계로';
    if (G.phase === 'draft') return '드래프트 진행';
    if (G.phase === 'resign') return 'FA 시장 열기';
    if (G.phase === 'preseason') return '개막까지';
    if (G.phase === 'fa') return '다음 날';
    if (Season.userGameToday(G)) return '경기 시작';
    return '계속';
  };

  App.render = () => {
    const root = document.getElementById('root');
    const G = App.G;
    if (!G || App.route.name === 'title') {
      root.innerHTML = `<div id="main-title">${App.screens.title()}</div>`;
      App.afters.title && App.afters.title();
      return;
    }
    if (App.route.name === 'live' && !App.live) App.route = { name: 'home', params: [] };
    const scroll = window.scrollY;
    root.innerHTML = App.frame();
    const fn = App.screens[App.route.name] || App.screens.home;
    let html;
    try { html = fn(...App.route.params); } catch (e) { console.error(e); html = `<div class="card"><h2>화면을 그리지 못했습니다</h2><pre class="small">${esc(e.stack || e)}</pre></div>`; }
    document.getElementById('main').innerHTML = html;
    const af = App.afters[App.route.name]; if (af) af(...App.route.params);
    if (App.keepScroll) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
    App.keepScroll = false;
  };
  App.rerender = () => { App.keepScroll = true; App.render(); };
  App.go = h => { if (location.hash === h) App.render(); else location.hash = h; };

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, ...params] = h.split('/');
    return { name: name || (App.G ? 'home' : 'title'), params: params.map(decodeURIComponent) };
  }
  window.addEventListener('hashchange', () => {
    App.route = parseHash();
    const side = document.getElementById('side'); if (side) side.classList.remove('open');
    if (App.live && App.route.name !== 'live' && App.live.timer) { /* 생중계는 뒤에서 멈춤 */ App.pauseLive && App.pauseLive(); }
    App.render();
  });

  // ---------- 이벤트 위임 ----------
  document.addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]');
    if (th) {
      const [id, k] = th.dataset.sort.split('|');
      const cur = App.ui.sorts[id];
      App.ui.sorts[id] = { k, dir: cur && cur.k === k ? -cur.dir : -1 };
      App.rerender();
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el) {
      if (e.target.id === 'modal') App.closeModal();
      return;
    }
    const fn = App.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el && App.acts[el.dataset.change]) App.acts[el.dataset.change](el, e);
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-input]');
    if (el && App.acts[el.dataset.input]) App.acts[el.dataset.input](el, e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && App.modalOpen) App.closeModal();
  });
  App.acts.menu = () => document.getElementById('side').classList.toggle('open');
  App.acts.tab = el => { App.ui.tabs[el.dataset.group] = el.dataset.tab; App.rerender(); };

  // ---------- 저장 ----------
  App.save = async (quiet) => {
    try { await HM.Store.save(App.G); if (!quiet) App.toast('저장했습니다'); }
    catch (e) { App.toast('저장 실패: ' + e.message, 4000); }
  };
  App.autosave = () => { if (App.G && App.G.settings.autosave !== false) App.save(true); };

  // ---------- 계속 ----------
  App.acts.contMenu = () => {
    const G = App.G;
    const inSeason = ['regular', 'playin', 'playoffs'].includes(G.phase);
    const opts = [];
    if (inSeason) {
      opts.push(['next', '다음 경기까지', '우리 경기 날 멈추고 경기를 지휘합니다']);
      opts.push(['day', '하루', '하루만 진행합니다']);
      opts.push(['week', '1주일(자동 경기)', '우리 경기도 자동으로 치릅니다']);
      opts.push(['month', '1개월(자동 경기)', '']);
      if (G.phase === 'regular') opts.push(['season', '정규시즌 끝까지', '플레이오프 직전까지 모두 자동']);
      opts.push(['post', '시즌 끝까지', '플레이오프까지 모두 자동(드래프트 전까지)']);
    } else if (G.phase === 'fa') {
      opts.push(['day', '하루', '']); opts.push(['week', '1주일', '']); opts.push(['month', '1개월', '']); opts.push(['season', '프리시즌까지', 'FA 시장을 끝냅니다']);
    } else if (G.phase === 'preseason') {
      opts.push(['next', '개막까지', '']); opts.push(['day', '하루', '']);
    } else opts.push(['next', App.contLabel(), '']);
    App.modal('진행 방식', `<div class="grid">${opts.map(o => `<button class="btn" style="justify-content:flex-start;padding:12px" data-act="cont" data-mode="${o[0]}"><b>${o[1]}</b><span class="muted small">${o[2]}</span></button>`).join('')}</div>`);
  };

  App.acts.cont = el => App.cont(el.dataset.mode || 'next');

  App.cont = async (mode = 'next') => {
    const G = App.G;
    App.closeModal();
    if (App.running) return;
    if (G.fired) return App.go('#/fired');
    if (G.phase === 'draft') {
      if (location.hash !== '#/draft') { App.go('#/draft'); return; }
      return App.acts.draftAuto();
    }
    if (G.phase === 'resign') {
      const exp = L.roster(G, G.userTid).filter(p => p.contract && p.contract.exp <= G.season);
      if (exp.length) {
        const ok = await App.confirm('자유계약 시장으로', `재계약하지 않은 선수 ${exp.length}명(${exp.map(p => esc(p.name)).join(', ')})은 자유계약 선수가 됩니다. 계속할까요?`, '계속');
        if (!ok) return;
      }
      Season.endResign(G);
      App.autosave();
      return App.go('#/fa');
    }
    App.running = true;
    const startDate = G.date, startPhase = G.phase, startSeason = G.season;
    const limit = { day: 1, week: 7, month: 30 }[mode] || 9999;
    let days = 0, lastYield = Date.now();
    const offersBefore = G.inbox.filter(m => m.type === 'offer' && !m.done).length;
    try {
      while (true) {
        if (G.fired) break;
        const ug = Season.userGameToday(G);
        if (ug && (mode === 'next' || mode === 'day')) {
          App.running = false;
          App.render();
          return App.preMatch(ug);
        }
        const r = Season.day(G);
        if (r === 'roster') {
          App.running = false; App.busy(false);
          App.modal('로스터 초과', `개막을 앞두고 로스터가 ${L.roster(G, G.userTid).length}명입니다. 15명 이하로 줄여야 정규시즌을 시작할 수 있습니다.<br><br>선수단 화면에서 선수를 방출하거나 트레이드하세요.`, '<button class="btn pri" data-act="goSquad">선수단으로</button>');
          App.rerender();
          return;
        }
        if (r === 'wait') break;
        days++;
        if (r === 'phase') {
          const keepGoing = (mode === 'post' && ['playin', 'playoffs'].includes(G.phase)) || (mode === 'season' && G.phase === 'fa');
          if (!keepGoing) break;
        }
        if (G.season !== startSeason && G.phase === 'preseason') break;
        if (days >= limit) break;
        if (mode === 'next' && G.inbox.filter(m => m.type === 'offer' && !m.done).length > offersBefore) break;
        if (Date.now() - lastYield > 120) {
          const frac = mode === 'season' || mode === 'post' ? null : Math.min(1, days / Math.min(limit, 60));
          App.busy(true, `${U.fmtDate(G.date)} 진행 중…`, frac);
          await sleep(0);
          lastYield = Date.now();
        }
      }
    } catch (e) { console.error(e); App.toast('오류: ' + e.message, 5000); }
    App.running = false;
    App.busy(false);
    void startDate; void startPhase;
    App.autosave();
    if (G.fired) return App.go('#/fired');
    if (G.phase === 'draft' && startPhase !== 'draft') return App.go('#/draft');
    if (G.phase !== startPhase && (G.phase === 'playoffs' || G.phase === 'playin')) return App.go('#/standings');
    App.rerender();
    if (G.phase === 'preseason' && startPhase === 'fa') App.go('#/inbox');
  };
  App.acts.goSquad = () => { App.closeModal(); App.go('#/squad'); };

  // 받은 편지함 읽지 않은 중요 메시지
  App.markRead = id => { const m = App.G.inbox.find(x => x.id === id); if (m) m.read = true; };
})();
