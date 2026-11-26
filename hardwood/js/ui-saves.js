// 저장 슬롯 화면: 타이틀의 이어하기, 설정의 슬롯 관리, 슬롯 고르기 창
(function () {
  const HM = globalThis.HM;
  const U = HM.U, App = HM.App, St = HM.Store;
  const esc = U.esc;
  const A = App.acts;
  const N = St.SLOTS;

  // 슬롯 현황: { by: {n: meta}, legacy: [meta], cloud: bool }
  async function slots(localOnly) {
    let list = [];
    const cloud = St.cloud ? await St.cloud.available() : false;
    try { list = localOnly || !cloud ? (await St.list()).map(m => Object.assign({}, m, { slot: St.slotOf(m.id), local: m.updated })) : await St.listAll(); } catch (e) { list = []; }
    const by = {}, legacy = [];
    for (const m of list) { const n = St.slotOf(m.id); if (n >= 1 && n <= N) by[n] = m; else legacy.push(m); }
    App._slots = { by, legacy, cloud };
    return App._slots;
  }
  App.slots = slots;
  const firstEmpty = s => { for (let n = 1; n <= N; n++) if (!s.by[n]) return n; return 0; };
  const where = m => m.cloud && m.local ? '<span class="pill good">☁️ 클라우드 · 이 기기</span>' : m.cloud ? '<span class="pill good">☁️ 클라우드</span>' : '<span class="pill">이 기기</span>';
  const info = m => `<span class="tbadge" style="${App.tstyle({ colors: m.colors || ['#555555', '#cccccc'] })}">${esc(m.team)}</span>
    <div style="flex:1;min-width:0"><b>${esc(m.name)}</b><div class="small muted">${U.seasonLabel(m.season)} · ${U.fmtDate(m.date)} · ${App.phaseTxt(m.phase)}</div>
    <div class="small faint">${new Date(m.updated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 저장 ${where(m)}</div></div>`;

  // ---------- 타이틀: 이어하기 ----------
  function titleHtml(s, note) {
    const filled = []; const empty = [];
    for (let n = 1; n <= N; n++) (s.by[n] ? filled : empty).push(n);
    const row = (n, m) => `<div class="slot-row"><span class="slot-no">${n}</span>${info(m)}
      <div class="slot-acts"><button class="btn pri sm" data-act="loadSave" data-id="${esc(m.id)}">불러오기</button><button class="btn sm danger" data-act="delSave" data-id="${esc(m.id)}">삭제</button></div></div>`;
    const leg = s.legacy.map(m => `<div class="slot-row"><span class="slot-no">-</span>${info(m)}
      <div class="slot-acts"><button class="btn pri sm" data-act="loadSave" data-id="${esc(m.id)}">불러오기</button><button class="btn sm danger" data-act="delSave" data-id="${esc(m.id)}">삭제</button></div></div>`).join('');
    if (!filled.length && !leg && !note) return '';
    return `<div class="card"><h2>이어하기 <span class="r small muted">저장 슬롯 ${filled.length}/${N}</span></h2>
      ${filled.length ? `<div class="slot-list">${filled.map(n => row(n, s.by[n])).join('')}</div>` : ''}
      ${empty.length && filled.length ? `<div class="small muted" style="margin-top:8px">빈 슬롯: ${empty.join(', ')}</div>` : ''}
      ${leg ? `<h3 style="margin-top:12px">이전 방식 저장</h3><p class="small muted" style="margin:0 0 6px">불러오면 빈 슬롯으로 옮겨집니다.</p><div class="slot-list">${leg}</div>` : ''}
      ${note ? `<p class="small muted" style="margin:10px 0 0">${note}</p>` : ''}</div>`;
  }
  App.afters.title = async () => {
    const el = document.getElementById('saves'); if (!el) return;
    const s0 = await slots(true);
    el.innerHTML = titleHtml(s0, '☁️ 클라우드 저장을 확인하는 중…');
    App.newSlotRender();
    const s = await slots(false);
    if (document.getElementById('saves') !== el) return;
    const err = St.cloud && St.cloud.status().err;
    el.innerHTML = titleHtml(s, s.cloud ? (err ? `⚠️ 클라우드 목록을 읽지 못했습니다: ${esc(err)}` : '☁️ 클라우드 저장이 켜져 있습니다. 진행할 때마다 이 기기와 클라우드(내 계정에만 보임)에 함께 저장됩니다.') : '이 화면에서는 브라우저에만 저장됩니다. 브라우저 데이터가 지워지면 사라지니, 가끔 설정의 "파일로 내보내기"로 백업하세요.');
    App.newSlotRender();
  };
  // 새 게임: 저장할 슬롯 고르기
  App.newSlotRender = () => {
    const el = document.getElementById('newSlot'); const s = App._slots; if (!el || !s) return;
    const sel = App.newSel;
    if (!sel.slot || (s.by[sel.slot] && !sel.slotPicked)) sel.slot = firstEmpty(s) || 1;
    el.innerHTML = `<select data-change="newSlotSel" aria-label="저장 슬롯">${Array.from({ length: N }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === sel.slot ? 'selected' : ''}>슬롯 ${n} — ${s.by[n] ? `${esc(s.by[n].team)} ${U.seasonLabel(s.by[n].season)} (덮어씀)` : '비어 있음'}</option>`).join('')}</select>`;
  };
  A.newSlotSel = el => { App.newSel.slot = +el.value; App.newSel.slotPicked = true; };

  // 불러오기(이전 방식 저장은 빈 슬롯으로 옮긴다)
  A.loadSave = async el => {
    const id = el.dataset.id;
    const s = App._slots || await slots(false);
    const hint = Object.values(s.by).concat(s.legacy).find(m => m.id === id);
    App.busy(true, '불러오는 중…');
    let G;
    try { G = await St.loadBest(id, hint); }
    catch (e) { App.busy(false); App.toast('불러오기 실패: ' + e.message, 5000); return; }
    App.G = G; App.ui = { sorts: {}, tabs: {} }; App.live = null;
    if (G._cloudOlder) { delete G._cloudOlder; App.toast('클라우드의 마지막 저장이 손상되어 바로 앞 저장을 불러왔습니다', 5000); }
    if (!St.slotOf(G.saveId)) {
      const n = firstEmpty(s);
      if (n) {
        G.saveId = St.slotId(n);
        App.busy(true, `슬롯 ${n}으로 옮기는 중…`);
        const ok = await App.save(true, true);
        if (ok) { const r = await St.delAll(id); App.toast(`이전 저장을 슬롯 ${n}으로 옮겼습니다${r.ok ? '' : ` (이전 클라우드 사본은 남아 있음: ${r.err})`}`, 4000); }
      } else App.toast('빈 슬롯이 없어 이전 방식 저장으로 계속합니다', 4000);
    }
    App.busy(false);
    App.go('#/home');
  };
  // 지우기: 이 기기와 클라우드 모두
  A.delSave = async el => {
    const id = el.dataset.id;
    const s = App._slots || await slots(false);
    const m = Object.values(s.by).concat(s.legacy).find(x => x.id === id);
    const n = St.slotOf(id);
    if (App.G && App.G.saveId === id) { App.toast('지금 하고 있는 게임의 슬롯은 지울 수 없습니다', 3000); return; }
    const ok = await App.confirm('저장 삭제', `${n ? `슬롯 ${n}` : '이 저장'}${m ? `(${esc(m.name)}, ${U.seasonLabel(m.season)})` : ''}을 이 기기와 클라우드에서 지울까요? 되돌릴 수 없습니다.`, '삭제');
    if (!ok) return;
    App.busy(true, '지우는 중…');
    const r = await St.delAll(id);
    App.busy(false);
    App.toast(r.ok ? `${n ? `슬롯 ${n}` : '저장'}을 지웠습니다` : `클라우드에서 지우지 못했습니다: ${r.err} — 다시 시도하세요`, r.ok ? 2500 : 6000);
    App._slots = null;
    if (App.route.name === 'settings') App.afters.settings(); else App.render();
  };
  // 슬롯 고르기 창(파일 가져오기 등): 고른 번호 또는 null
  App.pickSlot = (title, note) => new Promise(async res => {
    const s = await slots(false);
    App._pickRes = res;
    App.modal(title, `${note ? `<p class="small muted">${note}</p>` : ''}<div class="slot-list">${Array.from({ length: N }, (_, i) => i + 1).map(n => `<button class="slot-row slot-pick" data-act="pickSlotGo" data-n="${n}"><span class="slot-no">${n}</span>${s.by[n] ? info(s.by[n]) + '<span class="pill warn">덮어씀</span>' : '<div class="muted" style="flex:1">비어 있음</div>'}</button>`).join('')}</div>`,
      '<button class="btn" data-act="pickSlotCancel">취소</button>');
  });
  A.pickSlotGo = async el => {
    const n = +el.dataset.n; const s = App._slots;
    if (s && s.by[n]) { App.closeModal(); const ok = await App.confirm('슬롯 덮어쓰기', `슬롯 ${n}의 저장(${esc(s.by[n].name)})을 덮어쓸까요?`, '덮어쓰기'); const r = App._pickRes; App._pickRes = null; if (r) r(ok ? n : null); return; }
    App.closeModal(); const r = App._pickRes; App._pickRes = null; if (r) r(n);
  };
  A.pickSlotCancel = () => { App.closeModal(); const r = App._pickRes; App._pickRes = null; if (r) r(null); };

  // ---------- 설정: 슬롯 관리 ----------
  App.saveCardHtml = () => `<div class="card span2" id="saveCard"><h2>저장 슬롯 <span class="r"><button class="btn pri sm" data-act="saveNow">지금 저장</button> <button class="btn sm" data-act="exportSave">파일로 내보내기</button> <button class="btn sm" data-act="toTitle">타이틀로</button></span></h2>
    <div class="small" id="cloudSt">저장 상태 확인 중…</div>
    <label class="row small" style="margin-top:8px"><input type="checkbox" ${App.G.settings.autosave !== false ? 'checked' : ''} data-change="autosave"> 진행하거나 무언가 바꿀 때마다 자동 저장</label>
    <p class="small muted" style="margin:8px 0">지금 게임은 <b>슬롯 ${St.slotOf(App.G.saveId) || '-'}</b>에 자동 저장됩니다. 다른 슬롯에 저장하면 지금 상태의 복사본이 그 슬롯에 남습니다(트레이드 전 같은 되돌아갈 지점). 그 슬롯을 불러오면 거기서부터 이어서 진행합니다.</p>
    <div class="slot-list" id="slotList"><div class="small muted">슬롯을 읽는 중…</div></div></div>`;
  App.afters.settings = async () => {
    const st = document.getElementById('cloudSt'); const box = document.getElementById('slotList');
    if (!st && !box) return;
    const s = await slots(false);
    const G = App.G; if (!G) return;
    const cur = St.slotOf(G.saveId);
    const cs = St.cloud ? St.cloud.status() : { state: 'off' };
    const t = x => x ? new Date(x).toLocaleTimeString('ko-KR') : '';
    if (st && document.body.contains(st)) {
      const local = App.lastSave.localErr ? `⚠️ 이 기기 저장 실패: ${esc(App.lastSave.localErr)}` : `💾 이 기기 저장${App.lastSave.local ? ` · 마지막 ${t(App.lastSave.local)}` : ''}`;
      const cl = !s.cloud ? '⚠️ 이 화면에서는 클라우드 저장을 쓸 수 없습니다(브라우저에만 저장). 가끔 "파일로 내보내기"로 백업하세요.'
        : cs.state === 'error' ? `⚠️ 클라우드 저장 실패: ${esc(cs.err)} <button class="btn sm" data-act="saveNow">다시 저장</button>`
        : `☁️ 클라우드 저장 켜짐(내 계정에만 보임)${cs.last ? ` · 마지막 ${t(cs.last)}` : ' · 곧 첫 저장'}`;
      st.innerHTML = `${local}<br>${cl}`;
    }
    if (box && document.body.contains(box)) {
      const legacy = s.legacy.filter(m => m.id !== G.saveId);
      box.innerHTML = Array.from({ length: N }, (_, i) => i + 1).map(n => {
        const m = s.by[n];
        const isCur = n === cur;
        const acts = isCur ? `<span class="pill good">지금 게임</span>`
          : `<button class="btn sm" data-act="saveCopy" data-n="${n}">${m ? '여기에 덮어 저장' : '여기에 저장'}</button>${m ? `<button class="btn sm" data-act="slotLoad" data-id="${esc(m.id)}">불러오기</button><button class="btn sm danger" data-act="delSave" data-id="${esc(m.id)}">삭제</button>` : ''}`;
        return `<div class="slot-row ${isCur ? 'cur' : ''}"><span class="slot-no">${n}</span>${m ? info(m) : '<div class="muted" style="flex:1">비어 있음</div>'}<div class="slot-acts">${acts}</div></div>`;
      }).join('') + (legacy.length ? `<h3 style="margin-top:10px">이전 방식 저장</h3>` + legacy.map(m => `<div class="slot-row"><span class="slot-no">-</span>${info(m)}<div class="slot-acts"><button class="btn sm danger" data-act="delSave" data-id="${esc(m.id)}">삭제</button></div></div>`).join('') : '');
    }
  };
  // 지금 상태의 복사본을 다른 슬롯에
  A.saveCopy = async el => {
    const n = +el.dataset.n; const G = App.G; if (!G) return;
    const s = App._slots || await slots(false);
    if (s.by[n]) { const ok = await App.confirm('슬롯 덮어쓰기', `슬롯 ${n}의 저장(${esc(s.by[n].name)}, ${U.seasonLabel(s.by[n].season)})을 지금 상태로 덮어쓸까요?`, '덮어쓰기'); if (!ok) return; }
    App.busy(true, `슬롯 ${n}에 저장하는 중…`);
    await App.save(true);
    const copy = JSON.parse(JSON.stringify(G)); copy.saveId = St.slotId(n);
    let localOk = true; try { await St.save(copy); } catch (e) { localOk = false; }
    const hasCloud = St.cloud ? await St.cloud.available() : false;
    const cloudOk = hasCloud ? await St.cloud.save(copy) : null;
    App.busy(false);
    App.toast(`슬롯 ${n}에 저장했습니다 (${[localOk ? '이 기기 ✓' : '이 기기 ✗', hasCloud ? (cloudOk ? '클라우드 ✓' : '클라우드 ✗ ' + St.cloud.status().err) : null].filter(Boolean).join(' · ')})`, cloudOk === false ? 5000 : 2500);
    App.afters.settings();
  };
  // 다른 슬롯으로 갈아타기(지금 게임은 먼저 저장)
  A.slotLoad = async el => {
    const id = el.dataset.id; const n = St.slotOf(id);
    const ok = await App.confirm('슬롯 불러오기', `지금 게임을 저장하고 슬롯 ${n}을 불러올까요? 이후 자동 저장은 슬롯 ${n}에 됩니다.`, '불러오기');
    if (!ok) return;
    App.busy(true, '저장하는 중…');
    await App.save(true, true);
    App.busy(false);
    App._slots = null;
    await A.loadSave({ dataset: { id } });
  };
})();
