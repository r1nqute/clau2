// 저장: IndexedDB(없으면 localStorage). 파일로 내보내기/가져오기.
(function () {
  const HM = globalThis.HM = globalThis.HM || {};
  const DB = 'hardwood-manager', VER = 1;
  let dbp = null;

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
      } catch (e) { throw new Error('저장 공간이 부족합니다. 파일로 내보내기를 이용하세요.'); }
    },
    get(id) { try { return localStorage.getItem('hw-data-' + id); } catch (e) { return null; } },
    del(id) { try { localStorage.setItem('hw-meta', JSON.stringify(LS.list().filter(m => m.id !== id))); localStorage.removeItem('hw-data-' + id); } catch (e) { /* 무시 */ } },
  };
  let useLS = false;

  function metaOf(G) {
    const t = G.teams[G.userTid];
    return { id: G.saveId, name: `${t.ko} · ${G.manager.name}`, team: t.abbr, colors: t.colors, season: G.season, date: G.date, phase: G.phase, updated: Date.now(), start: G.startYear };
  }

  const S = {
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
      if (!G.saveId) G.saveId = 's' + Date.now().toString(36);
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
      if (!data) throw new Error('저장 파일을 찾지 못했습니다');
      return JSON.parse(data);
    },
    async del(id) {
      if (useLS) return LS.del(id);
      await tx('data', 'readwrite', s => s.delete(id));
      await tx('meta', 'readwrite', s => s.delete(id));
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
      G.saveId = 's' + Date.now().toString(36);
      return G;
    },
  };
  // ---------- 클라우드 저장: claude.ai 아티팩트의 개인 DB(data/users/<내 id>/, 나만 읽고 씀) ----------
  // 브라우저 저장소는 앱 안 화면·사생활 보호 모드 등에서 비워질 수 있어서, 같은 게임을 압축해 클라우드에도 둔다.
  const CHUNK = 200000; // 문서 하나 256KiB 제한 안쪽
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
  async function pack(str) {
    if (typeof CompressionStream === 'undefined') return { enc: 'json', data: str };
    const st = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(st).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { enc: 'gz64', data: btoa(bin) };
  }
  async function unpack(enc, data) {
    if (enc === 'json') return data;
    const bin = atob(data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const st = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(st).text();
  }
  const errTxt = e => e && e.code === 'quota_exceeded' ? '클라우드 저장 공간이 가득 찼습니다. 타이틀 화면에서 안 쓰는 저장을 지우세요.' : (e && (e.message || e.code)) || String(e);
  let busy = null, again = null;
  const Cloud = {
    status: () => C,
    async available() { return !!(await cloud()); },
    async list() {
      const c = await cloud(); if (!c) return [];
      const snap = await c.col.get();
      return snap.docs.map(d => d.data()).filter(x => x && x.kind === 'save' && x.meta).map(x => x.meta);
    },
    // 한 번에 하나만 쓴다. 쓰는 동안 또 부르면 끝난 뒤 가장 최근 상태로 한 번 더 쓴다.
    async save(G) {
      if (busy) { again = G; return busy; }
      busy = (async () => {
        const c = await cloud(); if (!c) return false;
        try {
          if (!G.saveId) G.saveId = 's' + Date.now().toString(36);
          const meta = metaOf(G);
          const { enc, data } = await pack(JSON.stringify(G));
          const ref = c.col.doc(meta.id);
          const prev = await ref.get();
          const pm = prev.exists ? prev.data() : {};
          // 두 벌(a/b)을 번갈아 써서, 쓰다 끊겨도 앞 저장은 온전히 남는다
          const slot = pm.slot === 'a' ? 'b' : 'a', other = slot === 'a' ? 'b' : 'a';
          const v = Date.now(), n = Math.max(1, Math.ceil(data.length / CHUNK));
          for (let i = 0; i < n; i++) await ref.collection('chunks').doc(slot + i).set({ v, d: data.slice(i * CHUNK, (i + 1) * CHUNK) });
          await ref.set({ kind: 'save', meta, slot, n, enc, v, ['n_' + slot]: n, ['n_' + other]: pm['n_' + other] || 0 });
          C.state = 'on'; C.last = Date.now(); C.err = '';
          return true;
        } catch (e) { C.state = 'error'; C.err = errTxt(e); return false; }
      })();
      const r = await busy; busy = null;
      if (again) { const g = again; again = null; return Cloud.save(g); }
      return r;
    },
    async load(id) {
      const c = await cloud(); if (!c) throw new Error('클라우드 저장을 쓸 수 없습니다');
      const ref = c.col.doc(id);
      const m = await ref.get();
      if (!m.exists) throw new Error('클라우드에 저장이 없습니다');
      const x = m.data();
      const parts = [];
      for (let i = 0; i < x.n; i++) {
        const ch = await ref.collection('chunks').doc(x.slot + i).get();
        const d = ch.exists ? ch.data() : null;
        if (!d || d.v !== x.v) throw new Error('클라우드 저장이 온전하지 않습니다');
        parts.push(d.d);
      }
      return JSON.parse(await unpack(x.enc, parts.join('')));
    },
    async del(id) {
      const c = await cloud(); if (!c) return;
      const ref = c.col.doc(id);
      const m = await ref.get(); if (!m.exists) return;
      const x = m.data();
      for (const sl of ['a', 'b']) for (let i = 0; i < (x['n_' + sl] || 0); i++) await ref.collection('chunks').doc(sl + i).delete();
      await ref.delete();
    },
  };
  S.cloud = Cloud;
  // 이 기기와 클라우드의 저장을 합친 목록(같은 게임은 더 최근 것)
  S.listAll = async () => {
    const [loc, cl] = await Promise.all([S.list().catch(() => []), Cloud.list().catch(() => [])]);
    const by = {};
    for (const m of loc) by[m.id] = Object.assign({}, m, { local: m.updated });
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
      try { return w === 'cloud' ? await Cloud.load(id) : await S.load(id); } catch (e) { err = e; }
    }
    throw err || new Error('저장 파일을 찾지 못했습니다');
  };
  S.delAll = async id => { await Promise.allSettled([S.del(id), Cloud.del(id)]); };
  HM.Store = S;
})();
