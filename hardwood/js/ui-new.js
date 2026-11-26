// 타이틀·새 게임
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, R = HM.Ratings, App = HM.App, Season = HM.Season;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const D = () => globalThis.HM_DATA;

  const NOTES = {
    1978: 'ABA 합병 직후의 리그', 1980: '3점슛 도입 · 매직과 버드의 데뷔', 1985: '조던의 데뷔 시즌', 1988: '쇼타임 레이커스의 2연패', 1991: '불스 왕조의 시작',
    1992: '드림팀의 해', 1996: '72승 불스', 1997: '전설의 96 드래프트 신인들', 1999: '파업으로 단축된 시즌(게임에선 82경기)', 2000: '샤크와 코비', 2003: '르브론 드래프트의 해',
    2004: '샤크·코비·말론·페이턴의 레이커스', 2008: '빅3 셀틱스', 2011: '노비츠키의 우승', 2013: '히트 빅3 2연패', 2016: '73승 워리어스와 클리블랜드의 기적', 2017: '듀란트의 워리어스 합류',
    2020: '버블 시즌', 2021: '플레이인 토너먼트 도입', 2024: '웸반야마의 첫 시즌', 2026: '쿠퍼 플래그의 데뷔', 2027: '지금 진행 중인 시즌',
  };

  // 시즌별 팀 미리보기(실제 데이터에서 바로 계산)
  const previewCache = {};
  function preview(y) {
    if (previewCache[y]) return previewCache[y];
    const d = D();
    const teams = d.seasons[y].teams.map(r => ({ abbr: r[0], name: r[1], ko: d.ko[r[1]] || r[1], fr: r[2], conf: r[3], w: r[5], l: r[6], players: [] }));
    const by = Object.fromEntries(teams.map(t => [t.abbr, t]));
    for (const [rid, list] of Object.entries(d.snaps)) {
      const s = list.find(x => x[0] === y); if (!s) continue;
      const t = by[s[1].split('/')[0]]; if (!t) continue;
      const x = L.decodeSnap(s);
      t.players.push({ name: d.players[rid][0], ovr: R.ovr(x.a, x.t), min: s[8] * s[10] });
    }
    for (const t of teams) {
      t.players.sort((a, b) => b.min - a.min);
      const top = t.players.slice(0, 15).sort((a, b) => b.ovr - a.ovr);
      const w = [0.17, 0.155, 0.14, 0.125, 0.11, 0.09, 0.075, 0.06, 0.045, 0.03];
      t.str = top.slice(0, 10).reduce((s, p, i) => s + p.ovr * w[i], 0);
      t.star = top[0];
      const prev = d.seasons[y - 1]?.teams.find(r => r[2] === t.fr);
      t.prev = prev ? [prev[5], prev[6]] : null;
    }
    teams.sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
    return (previewCache[y] = teams);
  }

  App.newSel = App.newSel || { year: null, abbr: null, name: '', prog: 'real' };

  S.title = () => {
    const d = D();
    const sel = App.newSel;
    if (!sel.year) sel.year = d.last;
    const teams = preview(sel.year);
    if (!teams.some(t => t.abbr === sel.abbr)) sel.abbr = null;
    const years = []; for (let y = d.last; y >= d.first; y--) years.push(y);
    const strRank = teams.slice().sort((a, b) => b.str - a.str).map(t => t.abbr);
    const stars = t => { const r = strRank.indexOf(t.abbr) / teams.length; const n = r < 0.1 ? 5 : r < 0.25 ? 4 : r < 0.5 ? 3 : r < 0.75 ? 2 : 1; return '<span class="stars">' + '★'.repeat(n) + `<span class="off">${'★'.repeat(5 - n)}</span></span>`; };
    const colors = d.colors;
    const tsel = teams.find(t => t.abbr === sel.abbr);
    return `<div class="title"><div class="wrap">
      <div class="hero"><div class="ball"></div><div style="flex:1;min-width:0"><h1>하드우드 매니저</h1><p>실제 NBA 역사 위에서 펼치는 농구 감독 시뮬레이션 · ${U.seasonLabel(d.first)} ~ ${U.seasonLabel(d.last)}</p></div>${App.themeBtn()}</div>
      <div id="saves"></div>
      <div class="card" style="margin-top:14px">
        <h2>새 게임</h2>
        <div class="yearsel"><span class="muted">시작 시즌</span>
          <select data-change="newYear">${years.map(y => `<option value="${y}" ${y === sel.year ? 'selected' : ''}>${U.seasonLabel(y)} 시즌${NOTES[y] ? ' — ' + NOTES[y] : ''}</option>`).join('')}</select>
          <span class="small muted">${teams.length}개 팀 · 그 시즌의 실제 로스터로 시작합니다</span></div>
        <h3 style="margin-top:16px">맡을 팀 고르기</h3>
        <div class="teams">${teams.map(t => `<button class="tpick ${t.abbr === sel.abbr ? 'on' : ''}" data-act="newTeam" data-abbr="${t.abbr}">
          <span class="tbadge" style="${App.tstyle({ colors: colors[t.abbr] || ['#555555', '#cccccc'] })}">${esc(t.abbr)}</span>
          <span class="info"><b>${esc(t.ko)}</b><span>${stars(t)} ${t.prev ? `지난 시즌 ${t.prev[0]}-${t.prev[1]}` : ''}</span><br><span>${t.star ? '에이스 ' + esc(t.star.name) : ''}</span></span></button>`).join('')}</div>
        ${tsel ? `<div class="card flat" style="margin-top:14px;background:var(--panel2)"><div class="row nowrap"><span class="tbadge lg" style="${App.tstyle({ colors: colors[tsel.abbr] || ['#555555', '#cccccc'] })}">${esc(tsel.abbr)}</span><div><b style="font-size:16px">${esc(tsel.ko)}</b><div class="small muted">${esc(tsel.name)} · ${tsel.conf === 'E' ? '동부' : '서부'} · 전력 ${strRank.indexOf(tsel.abbr) + 1}위/${teams.length}</div>
          <div class="small" style="margin-top:4px">주요 선수: ${tsel.players.slice(0, 15).sort((a, b) => b.ovr - a.ovr).slice(0, 5).map(p => `${esc(p.name)} <span class="faint">${Math.round(p.ovr)}</span>`).join(', ')}</div></div></div></div>` : ''}
        <div class="grid g2" style="margin-top:16px">
          <div><h3>감독 이름</h3><input type="text" maxlength="20" value="${esc(sel.name)}" placeholder="감독" data-input="newName" style="width:100%"></div>
          <div><h3>선수 성장 방식</h3><div class="grid">
            <label class="opt"><input type="radio" name="prog" value="real" ${sel.prog === 'real' ? 'checked' : ''} data-change="newProg"><span><b>실제 커리어 따라가기</b><span class="small muted">실존 선수가 현실의 성장·노쇠 곡선을 따릅니다(약간의 편차). 미래 드래프트도 실제 선수들로 채워집니다.</span></span></label>
            <label class="opt"><input type="radio" name="prog" value="random" ${sel.prog === 'random' ? 'checked' : ''} data-change="newProg"><span><b>무작위 성장</b><span class="small muted">시작 시점부터 역사가 갈라집니다. 잠재력과 나이에 따라 성장이 정해집니다.</span></span></label>
          </div></div>
        </div>
        <div class="row" style="margin-top:16px"><span class="small muted">저장 슬롯</span><span id="newSlot"><select disabled><option>슬롯 확인 중…</option></select></span></div>
        <div class="row" style="margin-top:12px"><button class="btn pri" style="padding:12px 22px;font-size:15px" data-act="newStart" ${sel.abbr ? '' : 'disabled'}>${sel.abbr ? `${esc(tsel.ko)} 감독으로 시작` : '팀을 고르세요'}</button>
          <span class="sp"></span><label class="btn"><input type="file" accept="application/json,.json" style="display:none" data-change="importSave">저장 파일 불러오기</label></div>
      </div>
      <p class="small muted" style="margin-top:14px">선수 능력치는 Basketball-Reference 기록을 바탕으로 계산했습니다. NBA와 관계없는 팬 제작 시뮬레이션입니다.</p>
    </div></div>`;
  };
  // 이어하기 목록은 ui-saves.js(App.afters.title)
  A.newYear = el => { App.newSel.year = +el.value; App.newSel.abbr = null; App.render(); };
  A.newTeam = el => { App.newSel.abbr = el.dataset.abbr; App.render(); };
  A.newName = el => { App.newSel.name = el.value; };
  A.newProg = el => { App.newSel.prog = el.value; };
  A.newStart = async () => {
    const sel = App.newSel;
    if (!sel.abbr) return;
    const sl = App._slots || await App.slots(false);
    const n = sel.slot || 1;
    if (sl.by[n]) {
      const ok = await App.confirm('슬롯 덮어쓰기', `슬롯 ${n}에 있는 저장(${esc(sl.by[n].name)}, ${U.seasonLabel(sl.by[n].season)})을 덮어쓰고 새 게임을 시작할까요?`, '덮어쓰기');
      if (!ok) return;
    }
    App.busy(true, '리그를 만드는 중…');
    await App.sleep(30);
    try {
      const G = L.create({ startYear: sel.year, userAbbr: sel.abbr, managerName: (sel.name || '').trim() || '감독', prog: sel.prog });
      Season.setupSeason(G, true);
      Season.welcome(G);
      Season.scanFA(G);
      G.saveId = HM.Store.slotId(n);
      App.G = G;
      App.ui = { sorts: {}, tabs: {} };
      App._slots = null; sel.slotPicked = false;
      await App.save(true, true);
    } catch (e) { console.error(e); App.busy(false); App.toast('리그를 만들지 못했습니다: ' + e.message, 5000); return; }
    App.busy(false);
    App.go('#/inbox');
  };
  // 불러오기·지우기는 ui-saves.js
  A.importSave = el => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const G = HM.Store.parseImport(r.result);
        const n = await App.pickSlot('가져온 게임을 둘 슬롯', '파일에서 가져온 게임을 어느 슬롯에 저장할까요?');
        if (!n) return;
        G.saveId = HM.Store.slotId(n);
        App.G = G; App.ui = { sorts: {}, tabs: {} }; App._slots = null;
        App.busy(true, '저장하는 중…'); await App.save(true, true); App.busy(false);
        App.go('#/home');
      } catch (e) { App.toast('불러오기 실패: ' + e.message, 4000); }
    };
    r.readAsText(f);
  };
})();
