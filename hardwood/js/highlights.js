// 하이라이트: 경기 장면 기록(plays)에서 볼 만한 장면을 골라 점수와 설명을 붙인다
(function () {
  const HM = globalThis.HM = globalThis.HM || {};

  // plays: Game.plays, nameOf(pid) → 이름, teamOf(side) → 약어
  function analyze(plays, nameOf, teamOf) {
    const out = [];
    let run = [0, 0], runFrom = 0, runShown = false;
    for (let i = 0; i < plays.length; i++) {
      const e = plays[i];
      const nm = e.pid !== undefined ? nameOf(e.pid) : '';
      const after = e.score;
      if (e.t === 'shot' && e.made) {
        const pts = e.pts || 0;
        const before = after.slice(); before[e.side] -= pts;
        const mb = before[e.side] - before[1 - e.side], ma = after[e.side] - after[1 - e.side];
        const late = e.q >= 4 && e.clock <= 120;
        const clutch = late && Math.abs(mb) <= 5;
        let sc = 0; const tags = [];
        if (e.dunk) { sc += 3; tags.push('덩크'); }
        if (e.type === 'three') { sc += 1.5; }
        if (e.and1) { sc += 1; tags.unshift('앤드원'); }
        if (e.put) { sc += 1; tags.push('풋백'); }
        if (clutch) sc += 3;
        if (mb <= 0 && ma > 0) { sc += e.q >= 4 ? 2.5 : 1; tags.unshift('역전'); }
        else if (ma === 0) { sc += e.q >= 4 ? 2 : 0.5; tags.unshift('동점'); }
        // 버저비터: 쿼터 마지막 순간의 점프슛(골밑 마무리는 제외)
        if (e.clock <= 1 && e.type !== 'rim') { sc += e.q >= 4 && Math.abs(mb) <= 3 ? 6 : 3; tags.unshift('버저비터'); }
        // 승부가 기운 가비지 타임은 덜 중요하다
        if (Math.abs(mb) >= (e.q >= 4 ? 15 : 22)) sc *= 0.5;
        const kind = e.type === 'three' ? '3점슛' : e.dunk ? '' : e.type === 'mid' ? '점프슛' : '골밑슛';
        const cap = `${nm} ${tags.filter(t => t !== '덩크').join(' ')} ${e.dunk ? '덩크' : kind}${sc >= 6 ? '!!' : '!'}`.replace(/\s+/g, ' ').trim();
        if (sc >= 3) out.push({ i, sc, cap, e, clutch });
        // 연속 득점
        if (run[1 - e.side] > 0) { run = [0, 0]; runFrom = i; runShown = false; }
        run[e.side] += pts;
        if (run[e.side] >= 10 && !runShown) { runShown = true; out.push({ i, sc: 3 + run[e.side] / 5, cap: `${run[e.side]}-0 런! ${teamOf(e.side)}가 흐름을 잡습니다`, e, run: true, from: runFrom }); }
      } else if (e.t === 'ft' && e.made) {
        if (run[1 - e.side] > 0) { run = [0, 0]; runFrom = i; runShown = false; }
        run[e.side] += e.made;
        const before = after.slice(); before[e.side] -= e.made;
        if (e.q >= 4 && e.clock <= 30 && before[e.side] - before[1 - e.side] <= 0 && after[e.side] > after[1 - e.side]) out.push({ i, sc: 4, cap: `${nm} 승부를 가르는 자유투`, e });
      } else if (e.t === 'shot' && !e.made && e.blk) {
        const late = e.q >= 4 && e.clock <= 120 && Math.abs(after[0] - after[1]) <= 5;
        out.push({ i, sc: 2.5 + (late ? 3 : 0), cap: `${nameOf(e.blk)} 블록${late ? '으로 승부처를 지킵니다' : '!'}`, e, def: true });
      } else if (e.t === 'tov' && e.stl) {
        const late = e.q >= 4 && e.clock <= 60 && Math.abs(after[0] - after[1]) <= 4;
        if (late) out.push({ i, sc: 4.5, cap: `${nameOf(e.stl)} 결정적인 스틸!`, e, def: true });
      }
    }
    return out;
  }
  // 상위 n개(시간 순)
  function top(list, n = 10) {
    // 평범한 블록은 세 개까지만(득점 장면이 먼저)
    let blk = 0;
    const pick = list.slice().sort((a, b) => b.sc - a.sc).filter(h => !(h.def && h.sc < 4 && ++blk > 3));
    return pick.slice(0, n).sort((a, b) => a.i - b.i);
  }
  // 저장용: 슛 차트 압축 [x, y, 성공, 편, 종류(0 골밑·1 중거리·2 3점)]
  function compactShots(plays) {
    return plays.filter(e => e.t === 'shot' && !e.fouled && e.x !== undefined).map(e => [e.x, e.y, e.made ? 1 : 0, e.side, e.type === 'rim' ? 0 : e.type === 'mid' ? 1 : 2]);
  }
  function compactHl(list) {
    return list.map(h => ({ cap: h.cap, pid: h.e.pid, q: h.e.q, clock: h.e.clock, side: h.e.side, x: h.e.x, y: h.e.y, made: h.e.made ? 1 : 0, t: h.e.t, def: !!h.def, score: h.e.score }));
  }
  HM.HL = { analyze, top, compactShots, compactHl };
})();
