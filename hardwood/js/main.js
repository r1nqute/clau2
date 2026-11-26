// 시작
(function () {
  const HM = globalThis.HM, App = HM.App;
  App.applyTheme();
  // 진행 중인 생중계가 있으면 계속 단추는 생중계로
  const cont = App.cont;
  App.cont = (mode) => {
    if (App.live && !App.live.finished) { App.go('#/live'); return; }
    return cont(mode);
  };
  window.addEventListener('beforeunload', () => App.flushSave());
  window.addEventListener('pagehide', () => App.flushSave());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') App.flushSave(); });

  const hot = globalThis.claude && globalThis.claude.hot;
  // 페이지가 새 판으로 바뀌어도 하던 게임을 이어 열 수 있게 저장 번호를 남긴다
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ saveId: App.G ? App.G.saveId : null })); } catch (e) { /* 무시 */ }

  async function start(data) {
    if (!globalThis.HM_DATA) {
      document.getElementById('root').innerHTML = '<div class="title"><div class="wrap"><div class="hero"><div class="ball"></div><div><h1>하드우드 매니저</h1><p>실제 NBA 기록을 불러오는 중…</p></div></div></div></div>';
      try {
        const r = await fetch('data/nba.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        globalThis.HM_DATA = await r.json();
      } catch (e) {
        document.getElementById('root').innerHTML = `<div class="title"><div class="wrap"><div class="card"><h2>자료를 불러오지 못했습니다</h2><p class="muted">${HM.U.esc(e.message)} — 페이지를 새로 고쳐 다시 시도하세요.</p></div></div></div>`;
        return;
      }
    }
    if (data && data.saveId) {
      try { App.G = await HM.Store.loadBest(data.saveId); App.ui = { sorts: {}, tabs: {} }; return App.go('#/home'); } catch (e) { /* 타이틀로 */ }
    }
    App.go('#/title');
  }
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
