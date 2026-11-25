// 집중 훈련 화면
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, P = HM.P, Season = HM.Season, App = HM.App, R = HM.Ratings, T = HM.Train;
  const esc = U.esc;
  const S = App.screens, A = App.acts;
  const G_ = () => App.G;

  const effTxt = e => `${e >= 0 ? '+' : ''}${e.toFixed(1)}`;
  // 잠재력까지 걸릴 날(대략)
  function eta(G, p, s) {
    const r = T.rate(G, p, s);
    if (r <= 0.0001) return null;
    const n = T.FOCUS[s.focus][1].length;
    const perPoint = Math.max(0.01, T.efficiency(p, s.focus) / (5 * n));
    return Math.round((p.pa - p.ovr) / (r * perPoint));
  }

  function slotCard(G, s) {
    const p = G.players[s.pid];
    const age = P.age(p, G.season);
    const rec = T.recommend(p);
    const pct = U.clamp((p.ovr - 40) / Math.max(1, p.pa - 40) * 100, 0, 100);
    const gains = Object.entries(s.gain).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill good">${R.LABEL[k]} +${(v / 5).toFixed(1)}</span>`).join(' ');
    const d = eta(G, p, s);
    const inj = p.injury && p.injury.days > 0;
    const status = inj ? `<span class="pill bad">부상 중 — 훈련 쉼(${p.injury.days}일)</span>` : p.ovr >= p.pa - 0.2 ? '<span class="pill warn">잠재력 도달 — 더 오르기 어려움</span>' : d !== null ? `<span class="small muted">이대로면 잠재력까지 약 ${d > 400 ? '1년 이상' : d + '일'}</span>` : '';
    const opts = Object.entries(T.FOCUS).map(([k, [nm, , desc]]) => `<option value="${k}" ${s.focus === k ? 'selected' : ''}>${nm}${k === rec ? ' ★추천' : ''} — ${desc} (1단계당 능력 ${effTxt(T.efficiency(p, k))})</option>`).join('');
    const ints = Object.entries(T.INT).map(([k, [nm, , note]]) => `<label class="pill" style="cursor:pointer;padding:5px 10px"><input type="radio" name="int-${p.pid}" value="${k}" ${String(s.int) === k ? 'checked' : ''} data-change="trInt" data-pid="${p.pid}"> ${nm}${note ? ` <span class="faint">${note}</span>` : ''}</label>`).join(' ');
    return `<div class="card">
      <div class="row nowrap" style="gap:12px"><div class="ovrbig"><b>${Math.round(p.ovr)}</b><span>능력</span></div>
        <div style="flex:1;min-width:0"><b style="font-size:16px">${App.plink(p)}</b> <span class="small muted">${p.pos} · ${age}세 · 성실성 ${R.disp(p.a.wrk)}</span>
          <div class="row nowrap small" style="gap:8px;margin-top:6px"><span class="muted">능력→잠재력</span><div class="bar" style="flex:1"><i style="width:${pct}%"></i></div><b>${Math.round(p.ovr)} / ${Math.round(p.pa)}</b></div></div>
        <button class="btn sm danger" data-act="trRemove" data-pid="${p.pid}">해제</button></div>
      <div style="margin-top:10px"><select id="focus-${p.pid}" data-change="trFocus" data-pid="${p.pid}" style="width:100%">${opts}</select></div>
      <div class="row" style="margin-top:8px;gap:6px">${ints}</div>
      <div class="row nowrap small" style="gap:8px;margin-top:10px"><span class="muted">다음 상승까지</span><div class="bar" style="flex:1"><i style="width:${Math.round(s.prog * 100)}%;background:var(--a5)"></i></div>${status}</div>
      <div class="row" style="margin-top:8px;gap:6px"><span class="small muted">이번 시즌 성과:</span> ${gains || '<span class="small faint">아직 없음</span>'}</div>
    </div>`;
  }

  S.training = () => {
    const G = G_();
    const st = T.state(G);
    const ros = L.roster(G, G.userTid);
    const free = T.MAX - st.slots.length;
    const cands = ros.filter(p => !T.slotOf(G, p.pid)).sort((a, b) => T.prospectScore(G, b) - T.prospectScore(G, a));
    const tbl = App.table('trcand', [
      { k: 'name', label: '선수', f: p => `${App.plink(p)} ${App.injTag(p)}`, v: p => p.name },
      { k: 'pos', label: '포지션', cls: 'c' },
      { k: 'age', label: '나이', cls: 'r', v: p => P.age(p, G.season), f: p => P.age(p, G.season) },
      { k: 'ovr', label: '능력', cls: 'c', v: p => p.ovr, f: p => App.ovr(p.ovr) },
      { k: 'pa', label: '잠재력', cls: 'c', v: p => p.pa, f: p => `${App.stars(P.potShown(p, G))} <span class="faint small">${P.potShown(p, G)}</span>` },
      { k: 'gap', label: '성장 여지', cls: 'r', v: p => p.pa - p.ovr, f: p => { const g = Math.max(0, Math.round(p.pa - p.ovr)); return g ? `+${g}` : '<span class="faint">없음</span>'; } },
      { k: 'wrk', label: '성실성', cls: 'c', v: p => p.a.wrk, f: p => { const v = R.disp(p.a.wrk); return `<span class="av ${R.attrClass(v)}">${v}</span>`; } },
      { k: 'score', label: '훈련 효과', cls: 'c', v: p => T.prospectScore(G, p), f: p => { const sc = T.prospectScore(G, p); return sc >= 12 ? '<span class="pill good">매우 큼</span>' : sc >= 6 ? '<span class="pill good">큼</span>' : sc >= 2 ? '<span class="pill">보통</span>' : '<span class="pill">작음(유지 훈련)</span>'; } },
      { k: 'rec', label: '추천 분야', nosort: true, f: p => T.FOCUS[T.recommend(p)][0] },
      { k: 'act', label: '', nosort: true, f: p => `<button class="btn sm pri" data-act="trAdd" data-pid="${p.pid}" ${free > 0 ? '' : 'disabled'}>집중 훈련</button>` },
    ], cands, { sort: { k: 'score', dir: -1 } });
    return `<div class="row"><h1>🏋️ 집중 훈련</h1><span class="sp"></span><span class="pill">${st.slots.length}/${T.MAX}명</span></div>
      <p class="small muted">시즌마다 최대 ${T.MAX}명을 골라 한 분야를 집중적으로 훈련합니다. 날마다 조금씩 능력치가 올라 <b>잠재력</b>에 가까워지고, 잠재력에 닿으면 멈춥니다. 나이가 어리고 성실성이 높을수록, 잠재력과의 차이가 클수록 빨리 오릅니다. 29세 이상은 노쇠를 늦추는 유지 훈련 효과가 있습니다.${G.settings.prog === 'real' ? ' 실제 커리어 모드에서도 훈련으로 얻은 몫은 다음 시즌 실제 능력치 위에 다시 얹힙니다(잠재력 한도 안).' : ''}</p>
      ${st.slots.length ? `<div class="grid g3" style="margin-top:10px">${st.slots.map(s => slotCard(G, s)).join('')}</div>` : '<div class="card"><div class="empty">아직 집중 훈련 중인 선수가 없습니다. 아래 표에서 골라 보세요.</div></div>'}
      <div class="card" style="margin-top:14px"><h2>훈련 대상 고르기 <span class="r">훈련 효과 = 성장 여지 × 나이 × 성실성</span></h2>${tbl}
        <p class="small muted" style="margin-top:6px">분야 목록의 "1단계당 능력"은 그 분야 능력치를 1단계(1~20 눈금) 올렸을 때 종합 능력이 얼마나 오르는지입니다. ★추천은 효율과 포지션에 맞춘 코치 추천입니다. "강하게"는 빠르지만 하루 0.035% 확률로 다치고 사기가 조금씩 떨어집니다.</p></div>`;
  };
  A.trAdd = el => {
    const G = G_(); const s = T.assign(G, +el.dataset.pid);
    if (!s) { App.toast(`집중 훈련은 ${T.MAX}명까지입니다. 먼저 한 명을 해제하세요`, 3000); return; }
    App.toast(`${G.players[s.pid].name}: ${T.FOCUS[s.focus][0]} 집중 훈련 시작`); App.autosave(); App.rerender();
  };
  A.trRemove = el => { T.remove(G_(), +el.dataset.pid); App.autosave(); App.rerender(); };
  A.trFocus = el => { T.assign(G_(), +el.dataset.pid, el.value); App.autosave(); App.rerender(); };
  A.trInt = el => { T.assign(G_(), +el.dataset.pid, null, +el.value); App.autosave(); App.rerender(); };
  // 선수 화면에서
  A.trToggle = el => {
    const G = G_(); const pid = +el.dataset.pid;
    if (T.slotOf(G, pid)) { T.remove(G, pid); App.toast('집중 훈련을 해제했습니다'); }
    else if (!T.assign(G, pid)) { App.toast(`집중 훈련은 ${T.MAX}명까지입니다. 훈련 화면에서 자리를 비우세요`, 3000); return; }
    else App.toast('집중 훈련을 시작했습니다. 분야와 강도는 훈련 화면에서 바꿀 수 있습니다', 3000);
    App.autosave(); App.rerender();
  };
  // 이름 옆 표시
  App.trainTag = p => { const s = T.slotOf(G_(), p.pid); return s ? `<span class="pill info" title="집중 훈련: ${T.FOCUS[s.focus][0]}(${T.INT[s.int][0]})">🏋️</span>` : ''; };
})();
