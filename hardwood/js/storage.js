// 저장: 슬롯 10개. 이 기기(IndexedDB, 안 되면 localStorage)와 claude.ai 클라우드(아티팩트 개인 DB)에 함께 둔다.
// 파일로 내보내기/가져오기도 된다.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const DB = 'hardwood-manager', VER = 1;
  const SLOTS = 10;
  const slotId = n => 'slot' + n;
  const slotOf = id => { const m = /^slot(\d+)$/.exec(String(id || '')); return m ? +m[1] : 0; };
  let dbp = null;

  // ---------- 이 기기 ----------
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, VER);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    }));
  }
  const LS = {
    list() { try { return JSON.parse(localStorage.getItem('hw-meta') || '[]'); } catch (e) { return []; } },
    put(meta, data) {
      try {
        const l = LS.list().filter(m => m.id !== meta.id); l.unshift(meta);
        localStorage.setItem('hw-meta', JSON.stringify(l)); localStorage.setItem('hw-data-' + meta.id, data);
      } catch (e) { throw new Error('이 기기의 저장 공간이 부족합니다'); }
    },
    get(id) { try { return localStorage.getItem('hw-data-' + id); } catch (e) { return null; } },
    del(id) { try { localStorage.setItem('hw-meta', JSON.stringify(LS.list().filter(m => m.id !== id))); localStorage.removeItem('hw-data-' + id); } catch (e) { /* 무시 */ } },
  };
  let useLS = false;

  function metaOf(G) {
    const t = G.teams[G.userTid];
    return { id: G.saveId, slot: slotOf(G.saveId), name: `${t.ko} · ${G.manager.name}`, team: t.abbr, colors: t.colors, season: G.season, date: G.date, phase: G.phase, updated: Date.now(), start: G.startYear };
  }

  const S = {
    SLOTS, slotId, slotOf,
    async list() {
      if (useLS) return LS.list();
      try {
        const all = await open().then(db => new Promise((res, rej) => {
          const r = db.transaction('meta').objectStore('meta').getAll();
          r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        }));
        return all.sort((a, b) => b.updated - a.updated);
      } catch (e) { useLS = true; return LS.list(); }
    },
    async save(G) {
      if (!G.saveId) G.saveId = slotId(1);
      const meta = metaOf(G);
      const data = JSON.stringify(G);
      if (useLS) { LS.put(meta, data); return meta; }
      try {
        await tx('data', 'readwrite', s => s.put({ id: meta.id, data }));
        await tx('meta', 'readwrite', s => s.put(meta));
      } catch (e) { useLS = true; LS.put(meta, data); }
      return meta;
    },
    async load(id) {
      let data;
      if (useLS) data = LS.get(id);
      else {
        try {
          data = await open().then(db => new Promise((res, rej) => {
            const r = db.transaction('data').objectStore('data').get(id);
            r.onsuccess = () => res(r.result && r.result.data); r.onerror = () => rej(r.error);
          }));
        } catch (e) { useLS = true; data = LS.get(id); }
      }
      if (!data) throw new Error('이 기기에 저장이 없습니다');
      return JSON.parse(data);
    },
    async del(id) {
      if (useLS) return LS.del(id);
      try {
        await tx('data', 'readwrite', s => s.delete(id));
        await tx('meta', 'readwrite', s => s.delete(id));
      } catch (e) { LS.del(id); }
    },
    // 파일로 내보내기. claude.ai 아티팩트 안에서는 downloads 기능으로, 단독 실행이면 일반 내려받기로.
    // 반환: 'saved' | 'declined' | 'unavailable'
    async exportFile(G) {
      const t = G.teams[G.userTid];
      const filename = `hardwood-${t.abbr}-${G.season}-${G.date}.json`;
      const blob = new Blob([JSON.stringify(G)], { type: 'application/json' });
      const c = globalThis.claude;
      if (c && typeof c.use === 'function') {
        let dl = null;
        try { dl = await c.use('downloads'); } catch (e) { dl = null; }
        if (!dl) return 'unavailable';
        try { await dl.save({ filename, data: blob }); return 'saved'; }
        catch (e) { return e && e.code === 'declined' ? 'declined' : 'unavailable'; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return 'saved';
    },
    parseImport(text) {
      const G = JSON.parse(text);
      if (!G || !G.teams || !G.players || G.userTid === undefined) throw new Error('하드우드 매니저 저장 파일이 아닙니다');
      G.saveId = null;
      return G;
    },
  };

  // ---------- 클라우드: data/users/<내 id>/<저장 id> (+ chunks/<a|b><번호>) ----------
  // 브라우저 저장소는 앱 안 화면·사생활 보호 모드 등에서 비워질 수 있어서, 같은 게임을 압축해 클라우드에도 둔다.
  const CHUNK = 240000; // 문서 하나 256KiB 제한 안쪽
  const GAP = 70;       // 요청 사이 최소 간격(ms)
  let cloudP = null;
  const C = { state: 'unknown', last: 0, err: '' };
  function cloud() {
    if (cloudP) return cloudP;
    cloudP = (async () => {
      const c = globalThis.claude;
      if (!c || typeof c.use !== 'function') { C.state = 'off'; return null; }
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        const uid = db && user ? await user.id() : null;
        if (!db || !uid) { C.state = 'off'; return null; }
        if (C.state === 'unknown') C.state = 'on';
        return { col: db.collection('data/users/' + uid) };
      } catch (e) { C.state = 'off'; return null; }
    })();
    return cloudP;
  }
  // 모든 클라우드 요청은 한 줄로 세워 차례로 보낸다. 한도·일시 오류면 기다렸다가 다시 시도한다.
  let lane = Promise.resolve(), lastCall = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function call(fn) {
    const run = async () => {
      for (let k = 0; ; k++) {
        const gap = GAP - (Date.now() - lastCall); if (gap > 0) await sleep(gap);
        lastCall = Date.now();
        try { return await fn(); }
        catch (e) {
          const code = e && e.code;
          if ((code === 'resource_exhausted' || code === 'unavailable') && k < 5) { await sleep(600 * 2 ** k + Math.random() * 400); continue; }
          throw e;
        }
      }
    };
    const p = lane.then(run, run);
    lane = p.catch(() => { });
    return p;
  }
  const errTxt = e => !e ? '알 수 없는 오류'
    : e.code === 'quota_exceeded' ? '클라우드 저장 공간이 가득 찼습니다. 안 쓰는 슬롯을 지우세요.'
    : e.code === 'resource_exhausted' ? '요청이 너무 많아 잠시 막혔습니다. 조금 뒤 다시 시도하세요.'
    : e.code === 'unavailable' ? '클라우드에 잠시 연결할 수 없습니다.'
    : e.code === 'revoked' || e.code === 'not_granted' ? '이 화면에서는 클라우드를 쓸 수 없습니다.'
    : (e.message || e.code || String(e));
  // 클라우드용 압축 형식: 시즌 기록을 배열로, 소수는 셋째 자리까지(압축 크기 약 20% 감소)
  const SK = ['s', 'tid', 'po', 'gp', 'gs', 'min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm', 'rat'];
  const r3 = v => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v;
  const deep = o => Array.isArray(o) ? o.map(deep) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : r3(o);
  function packG(G) {
    const players = {};
    for (const [id, p] of Object.entries(G.players)) {
      const q = deep(p);
      if (Array.isArray(p.stats)) q.stats = p.stats.map(l => SK.map(k => r3(l[k])));
      players[id] = q;
    }
    return Object.assign({}, G, { players, _pk: 1 });
  }
  function unpackG(G) {
    if (!G._pk) return G;
    for (const p of Object.values(G.players)) if (Array.isArray(p.stats)) p.stats = p.stats.map(a => Array.isArray(a) ? Object.fromEntries(SK.map((k, i) => [k, a[i]])) : a);
    delete G._pk;
    return G;
  }
  async function gzip(str) {
    if (typeof CompressionStream === 'undefined') return { enc: 'json', data: str };
    const st = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(st).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { enc: 'gz64', data: btoa(bin) };
  }
  async function gunzip(enc, data) {
    if (enc === 'json') return data;
    const bin = atob(data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const st = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(st).text();
  }
  // 저장 id마다 하나씩만 쓴다. 쓰는 동안 또 부르면 끝난 뒤 가장 최근 상태로 한 번 더.
  const Q = {};
  async function writeCloud(c, G) {
    const meta = metaOf(G);
    const { enc, data } = await gzip(JSON.stringify(packG(G)));
    const ref = c.col.doc(meta.id);
    const prev = await call(() => ref.get());
    const pm = prev.exists ? prev.data() : {};
    // 두 벌(a/b)을 번갈아 써서, 쓰다 끊겨도 앞 저장은 온전히 남는다
    const slot = pm.slot === 'a' ? 'b' : 'a', other = slot === 'a' ? 'b' : 'a';
    const v = Date.now(), n = Math.max(1, Math.ceil(data.length / CHUNK));
    const ch = ref.collection('chunks');
    for (let i = 0; i < n; i++) await call(() => ch.doc(slot + i).set({ v, d: data.slice(i * CHUNK, (i + 1) * CHUNK) }));
    await call(() => ref.set({ kind: 'save', meta, slot, n, enc, v, ['n_' + slot]: n, ['v_' + slot]: v, ['n_' + other]: pm['n_' + other] || 0, ['v_' + other]: pm['v_' + other] || 0, ['e_' + slot]: enc, ['e_' + other]: pm['e_' + other] || pm.enc || enc }));
    // 이 벌에 전보다 조각이 줄었으면 남은 조각을 치운다(실패해도 그만)
    for (let i = n; i < (pm['n_' + slot] || 0); i++) { try { await call(() => ch.doc(slot + i).delete()); } catch (e) { break; } }
    return true;
  }
  const Cloud = {
    status: () => C,
    async available() { return !!(await cloud()); },
    async list() {
      const c = await cloud(); if (!c) return [];
      const snap = await call(() => c.col.get());
      return snap.docs.map(d => d.data()).filter(x => x && x.kind === 'save' && x.meta).map(x => Object.assign({}, x.meta, { slot: slotOf(x.meta.id) }));
    },
    // 반환: true(저장됨) | false(클라우드 없음·실패)
    async save(G) {
      const c = await cloud(); if (!c || !G || !G.saveId) return false;
      const id = G.saveId;
      const q = Q[id] || (Q[id] = { running: null, next: null });
      if (q.running) { q.next = G; return q.running; }
      q.running = (async () => {
        let g = G, ok = false;
        while (g) {
          try { ok = await writeCloud(c, g); C.state = 'on'; C.last = Date.now(); C.err = ''; }
          catch (e) { ok = false; C.state = 'error'; C.err = errTxt(e); }
          g = q.next; q.next = null;
        }
        return ok;
      })();
      try { return await q.running; } finally { q.running = null; }
    },
    async load(id) {
      const c = await cloud(); if (!c) throw new Error('클라우드를 쓸 수 없습니다');
      const ref = c.col.doc(id);
      const m = await call(() => ref.get());
      if (!m.exists) throw new Error('클라우드에 저장이 없습니다');
      const x = m.data();
      const ch = ref.collection('chunks');
      // 최신 벌이 망가졌으면 바로 앞 벌을 읽는다
      const tries = [[x.slot, x.n, x.v, x['e_' + x.slot] || x.enc]];
      const o = x.slot === 'a' ? 'b' : 'a';
      if (x['n_' + o]) tries.push([o, x['n_' + o], x['v_' + o] || null, x['e_' + o] || x.enc]);
      let err = null;
      for (const [sl, n, v, enc] of tries) {
        try {
          const parts = []; let v0 = v;
          for (let i = 0; i < n; i++) {
            const s = await call(() => ch.doc(sl + i).get());
            const d = s.exists ? s.data() : null;
            if (v0 == null && d) v0 = d.v;
            if (!d || d.v !== v0) throw new Error('클라우드 저장이 손상되었습니다');
            parts.push(d.d);
          }
          const G = unpackG(JSON.parse(await gunzip(enc, parts.join(''))));
          if (sl !== x.slot) G._cloudOlder = true;
          return G;
        } catch (e) { err = e; }
      }
      throw err;
    },
    // 지우기: 목록에서 먼저 없애고(대표 문서), 조각은 남김없이 치운다
    async del(id) {
      const c = await cloud(); if (!c) return { ok: true, none: true };
      const q = Q[id]; if (q) { q.next = null; if (q.running) { try { await q.running; } catch (e) { /* 무시 */ } } }
      const ref = c.col.doc(id), ch = ref.collection('chunks');
      try {
        await call(() => ref.delete());
      } catch (e) { return { ok: false, err: errTxt(e) }; }
      let left = 0;
      try {
        const snap = await call(() => ch.get());
        for (const d of snap.docs) { try { await call(() => ch.doc(d.id).delete()); } catch (e) { left++; } }
      } catch (e) { left = -1; }
      return { ok: true, left };
    },
  };
  S.cloud = Cloud;

  // ---------- 합친 목록과 불러오기·지우기 ----------
  // 같은 저장 id는 하나로(더 최근 쪽 정보), 어디에 있는지 표시
  S.listAll = async () => {
    const [loc, cl] = await Promise.all([S.list().catch(() => []), Cloud.list().catch(e => { C.err = errTxt(e); return []; })]);
    const by = {};
    for (const m of loc) by[m.id] = Object.assign({}, m, { slot: slotOf(m.id), local: m.updated });
    for (const m of cl) {
      const o = by[m.id];
      if (!o) by[m.id] = Object.assign({}, m, { cloud: m.updated });
      else { o.cloud = m.updated; if (m.updated > o.updated) Object.assign(o, m, { local: o.local, cloud: m.updated }); }
    }
    return Object.values(by).sort((a, b) => b.updated - a.updated);
  };
  // 더 최근 쪽에서 불러온다(한쪽이 실패하면 다른 쪽)
  S.loadBest = async (id, hint) => {
    const order = hint && hint.cloud && (!hint.local || hint.cloud > hint.local) ? ['cloud', 'local'] : ['local', 'cloud'];
    let err = null;
    for (const w of order) {
      // '이 기기에 없음'보다 클라우드 쪽 이유(손상 등)가 더 쓸모 있다
      try { return w === 'cloud' ? await Cloud.load(id) : await S.load(id); } catch (e) { if (!err || w === 'cloud') err = e; }
    }
    throw err || new Error('저장을 찾지 못했습니다');
  };
  // 반환: { ok, err?, left? } — 클라우드에서 못 지웠으면 ok:false와 이유
  S.delAll = async id => {
    await S.del(id).catch(() => { });
    return Cloud.del(id);
  };
  HM.Store = S;
})();
