// 시작
(function () {
  const HM = globalThis.HM, App = HM.App;
  try { const th = localStorage.getItem('hw-theme'); if (th && th !== 'system') document.documentElement.setAttribute('data-theme', th); } catch (e) { /* 무시 */ }
  // 진행 중인 생중계가 있으면 계속 단추는 생중계로
  const cont = App.cont;
  App.cont = (mode) => {
    if (App.live && !App.live.finished) { App.go('#/live'); return; }
    return cont(mode);
  };
  window.addEventListener('beforeunload', () => { if (App.G) App.save(true); });
  location.hash = '#/title';
  App.route = { name: 'title', params: [] };
  App.render();
})();
