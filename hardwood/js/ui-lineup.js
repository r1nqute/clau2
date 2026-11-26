// 주전 라인업 카드, 주전 지정·포지션 변경, 포지션 변경 제안 처리
(function () {
  const HM = globalThis.HM;
  const U = HM.U, L = HM.L, R = HM.Ratings, App = HM.App, Lu = HM.Lineup;
  const esc = U.esc;
  const A = App.acts;
  const G_ = () => App.G;
  const POS = R.POS, KO = R.POS_KO;
  const fitCls = s => s >= 85 ? 'good' : s >= 60 ? 'warn' : 'bad';
  const fitCol = s => s >= 85 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : 'var(--bad)';
  const injured = p => p.injury && p.injury.days > 0;

  // ---------- 전술 화면: 주전 라인업 ----------
  App.lineupCard = () => {
    const G = G_();
    const lu = Lu.lineup(G);
    const ps = L.roster(G, G.userTid);
    const fits = Object.fromEntries(ps.map(p => [p.pid, Lu.fit(G, p)]));
    const rows = POS.map((pos, i) => {
      const cur = lu.slots[i] != null ? G.players[lu.slots[i]] : null;
      const order = ps.slice().sort((a, b) => (injured(a) - injured(b)) || (fits[b.pid].score[pos] - fits[a.pid].score[pos]) || (b.ovr - a.ovr));
      const opts = `<option value="">— 비워 두기(코치가 채움) —</option>` + order.map(p => {
        const sc = fits[p.pid].score[pos];
        const at = lu.slots.indexOf(p.pid);
        return `<option value="${p.pid}" ${cur && cur.pid === p.pid ? 'selected' : ''}>${esc(p.name)} · ${p.pos} · 능력 ${Math.round(p.ovr)} · 적합 ${sc}${at >= 0 && at !== i ? ` (지금 ${POS[at]})` : ''}${injured(p) ? ' · 부상' : ''}</option>`;
      }).join('');
      const sc = cur ? fits[cur.pid].score[pos] : null;
      const tag = cur ? (injured(cur) ? '<span class="pill bad" title="경기 날 코치가 대신 채웁니다">부상</span>' : `<span class="pill ${fitCls(sc)}" title="이 자리 적합도">적합 ${sc}</span>`) : '<span class="pill">코치</span>';
      return `<div class="lu-row"><span class="lu-pos"><b>${pos}</b><span class="small muted">${KO[pos]}</span></span><select data-change="luSet" data-i="${i}" aria-label="${KO[pos]} 선발">${opts}</select>${tag}</div>`;
    }).join('');
    const warn = !lu.fixed ? '' : POS.map((pos, i) => {
      const id = lu.slots[i]; if (id == null) return '';
      const p = G.players[id]; const sc = fits[id].score[pos];
      return sc < 60 && !injured(p) ? `<li>${esc(p.name)}(${p.pos})는 ${pos} 자리가 낯섭니다(적합 ${sc}). 상대 ${pos}를 막게 됩니다.</li>` : '';
    }).join('');
    return `<div class="card" style="margin-top:14px" id="luCard"><h2>주전 라인업 <span class="r">${lu.fixed ? '<span class="pill good">직접 지정</span>' : '<span class="pill">코치 선택</span>'} <button class="btn sm" data-act="luReset" ${lu.fixed ? '' : 'disabled'}>코치 추천으로</button></span></h2>
      <p class="small muted">자리마다 선발을 고르세요. 다른 자리에 있던 선수를 고르면 두 자리를 맞바꿉니다. 선수는 고른 자리에서 상대 같은 자리 선수와 매치업합니다. 출전 시간은 아래 로테이션 설정을 따르고, 부상이거나 비운 자리는 경기 날 코치가 채웁니다.</p>
      <div class="lu-grid"><div class="lu-slots">${rows}</div>${App.courtHtml('lu-viz')}</div>
      ${warn ? `<ul class="small" style="margin:10px 0 0;color:var(--warn)">${warn}</ul>` : ''}</div>`;
  };
  App.afters.tactics = () => App.lineupAfter();
  App.lineupAfter = () => {
    const G = G_(); if (!document.getElementById('lu-viz')) return;
    const t = G.teams[G.userTid];
    const col = App.vizColors([t, t])[0];
    const lu = Lu.lineup(G);
    const list = POS.map((pos, i) => {
      const id = lu.slots[i];
      if (id == null) return { empty: true, slot: i, pos, nm: '코치' };
      const p = G.players[id];
      return { pid: id, slot: i, pos, nm: HM.Sim.shortName(p.name) };
    });
    App.courtPlayers('lu-viz', list, [], col, col);
  };
  A.luSet = el => {
    const G = G_();
    Lu.setSlot(G, +el.dataset.i, el.value === '' ? null : +el.value);
    App.toast('주전 라인업을 바꿨습니다'); App.autosave && App.autosave(); App.rerender();
  };
  A.luReset = () => { Lu.resetLineup(G_()); App.toast('코치 추천 선발로 되돌렸습니다'); App.rerender(); };

  // ---------- 선수 화면 ----------
  App.starterSlot = pid => { const G = G_(); const p = G.players[pid]; if (!p || p.tid !== G.userTid) return -1; return Lu.lineup(G).slots.indexOf(pid); };
  App.lineupActs = p => {
    const i = App.starterSlot(p.pid);
    return [i >= 0 ? `<button class="btn" data-act="luBench" data-pid="${p.pid}">벤치로 내리기(${POS[i]})</button>` : `<button class="btn" data-act="luStart" data-pid="${p.pid}">⭐ 주전으로 기용</button>`,
      `<button class="btn" data-act="posModal" data-pid="${p.pid}">🔀 포지션 변경</button>`];
  };
  App.starterPill = p => { const i = App.starterSlot(p.pid); return i >= 0 ? `<span class="pill good" title="주전 라인업">⭐ 주전 · ${POS[i]} 자리</span>` : ''; };
  App.posFitHtml = p => {
    const G = G_(); const f = Lu.fit(G, p);
    return `<h2 style="margin-top:14px">포지션 적합도 <span class="r small muted">${f.stats ? '능력치+이번 시즌 기록' : '능력치 기준'}</span></h2>` + f.rank.map(r => `<div class="row nowrap" style="gap:8px;padding:2px 0"><span class="small" style="width:30px;flex:none"><b>${r.pos}</b></span><div class="bar" style="flex:1"><i style="width:${r.score}%;background:${fitCol(r.score)}"></i></div><span class="small num" style="width:28px;text-align:right">${r.score}</span>${r.pos === p.pos ? '<span class="pill" style="flex:none">현재</span>' : '<span style="width:38px;flex:none"></span>'}</div>`).join('');
  };
  A.luBench = el => { Lu.benchPlayer(G_(), +el.dataset.pid); App.toast('벤치로 내렸습니다. 빈 자리는 코치가 채웁니다'); App.rerender(); };
  A.luStart = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    const lu = Lu.lineup(G); const f = Lu.fit(G, p);
    const btns = POS.map((pos, i) => {
      const cur = lu.slots[i] != null ? G.players[lu.slots[i]] : null;
      return `<button class="hl-item" style="grid-template-columns:auto 1fr auto" data-act="luStartAt" data-pid="${p.pid}" data-i="${i}"><b>${pos}</b><span>${cur ? `${esc(cur.name)} <span class="small muted">(${cur.pos} · 능력 ${Math.round(cur.ovr)}) 대신</span>` : '<span class="muted">빈 자리</span>'}</span><span class="pill ${fitCls(f.score[pos])}">적합 ${f.score[pos]}</span></button>`;
    }).join('');
    App.modal(`${p.name} 주전 기용`, `<p class="small muted">어느 자리에 세울까요? 적합도는 ${esc(p.name)}이(가) 그 자리에 얼마나 맞는지입니다.</p><div class="hl-list" style="max-height:none">${btns}</div>`, '<button class="btn" data-act="closeModal">취소</button>');
  };
  A.luStartAt = el => {
    const G = G_(); Lu.setSlot(G, +el.dataset.i, +el.dataset.pid);
    App.closeModal(); App.toast(`${G.players[+el.dataset.pid].name}을(를) ${POS[+el.dataset.i]} 자리 주전으로 세웠습니다`); App.rerender();
  };
  A.posModal = el => {
    const G = G_(); const p = G.players[+el.dataset.pid]; const f = Lu.fit(G, p);
    const btns = f.rank.map(r => `<button class="hl-item" style="grid-template-columns:auto 1fr auto" data-act="posSet" data-pid="${p.pid}" data-pos="${r.pos}" ${r.pos === p.pos ? 'disabled' : ''}><b>${r.pos}</b><span>${KO[r.pos]}${r.pos === p.pos ? ' <span class="pill">현재</span>' : ''}</span><span class="pill ${fitCls(r.score)}">적합 ${r.score}</span></button>`).join('');
    App.modal(`${p.name} 포지션 변경`, `<p class="small muted">포지션은 경기에서 누구를 막는지(매치업), 코치의 선발·교체 구성, 매니저 모드의 포지션 진단에 쓰입니다. 능력치는 그대로입니다. 실제 커리어 모드에서도 직접 정한 포지션은 유지됩니다.</p><div class="hl-list" style="max-height:none">${btns}</div>`, '<button class="btn" data-act="closeModal">취소</button>');
  };
  A.posSet = el => {
    const G = G_(); const p = G.players[+el.dataset.pid];
    const from = p.pos; Lu.setPos(G, p, el.dataset.pos);
    App.closeModal(); App.toast(`${p.name}: ${from} → ${p.pos}`); App.autosave && App.autosave(); App.rerender();
  };

  // ---------- 받은 편지함: 포지션 변경 제안 ----------
  App.posMsgActs = m => {
    const G = G_(); const p = G.players[m.pid];
    if (m.done) return '';
    if (!p || p.tid !== G.userTid) return '<div class="note" style="margin-top:12px">이 선수는 이제 우리 팀에 없습니다.</div>';
    if (p.pos !== m.from) return `<div class="note" style="margin-top:12px">지금 포지션은 ${p.pos}입니다.</div>`;
    return `<div class="row" style="margin-top:14px"><button class="btn pri" data-act="posAccept" data-id="${m.id}">${m.to}(${KO[m.to]})로 바꾸기</button><button class="btn" data-act="posDecline" data-id="${m.id}">${m.from} 유지</button><a class="btn" href="#/tactics">주전 라인업 보기</a></div>`;
  };
  A.posAccept = el => {
    const G = G_(); const m = G.inbox.find(x => x.id === +el.dataset.id); const p = m && G.players[m.pid]; if (!p) return;
    Lu.setPos(G, p, m.to); m.done = `${p.name}의 포지션을 ${m.from}에서 ${m.to}로 바꿨습니다.`;
    App.toast(m.done); App.autosave && App.autosave(); App.rerender();
  };
  A.posDecline = el => {
    const G = G_(); const m = G.inbox.find(x => x.id === +el.dataset.id); if (!m) return;
    m.done = `${m.from} 포지션을 유지하기로 했습니다.`; App.rerender();
  };
})();
