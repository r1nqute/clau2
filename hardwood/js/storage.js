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
  HM.Store = S;
})();
