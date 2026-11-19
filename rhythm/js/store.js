/* STARLANE 4K — 저장소
 * 곡 정보와 채보는 IndexedDB 'songs', 원본 파일은 'files'.
 * IndexedDB를 못 쓰는 브라우저(사생활 보호 창 등)에서는 이번 창에서만 기억한다.
 * 설정과 최고 기록은 localStorage.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'starlane4k';
  const DB_VER = 1;
  let db = null;
  const mem = { songs: new Map(), files: new Map() };

  function open() {
    return new Promise(resolve => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('no db')); return; }
      let t;
      try { t = db.transaction(store, mode); } catch (e) { reject(e); return; }
      const st = t.objectStore(store);
      let out;
      try { out = fn(st); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      t.onerror = () => reject(t.error || new Error('tx error'));
      t.onabort = () => reject(t.error || new Error('tx abort'));
    });
  }

  const Store = {
    persistent: false,

    async init() {
      db = await open();
      this.persistent = !!db;
      return this.persistent;
    },

    async listSongs() {
      if (!db) return Array.from(mem.songs.values());
      try {
        const all = await tx('songs', 'readonly', st => st.getAll());
        return all || [];
      } catch (e) { return Array.from(mem.songs.values()); }
    },

    async putSong(song) {
      const rec = Object.assign({}, song);
      delete rec._files; delete rec.blob; delete rec.bgBlob; delete rec.url; delete rec.bgUrl; delete rec.state; delete rec.progress; delete rec.error;
      mem.songs.set(rec.id, rec);
      if (!db) return;
      try { await tx('songs', 'readwrite', st => st.put(rec)); } catch (e) { /* 이번 창에서만 기억 */ }
    },

    async putFiles(id, blob, bgBlob) {
      mem.files.set(id, { id, blob, bgBlob: bgBlob || null });
      if (!db) return false;
      try {
        await tx('files', 'readwrite', st => st.put({ id, blob, bgBlob: bgBlob || null }));
        return true;
      } catch (e) {
        return false;
      }
    },

    async getFiles(id) {
      if (mem.files.has(id)) return mem.files.get(id);
      if (!db) return null;
      try {
        const rec = await tx('files', 'readonly', st => st.get(id));
        if (rec) mem.files.set(id, rec);
        return rec || null;
      } catch (e) { return null; }
    },

    async remove(id) {
      mem.songs.delete(id);
      mem.files.delete(id);
      if (!db) return;
      try { await tx('songs', 'readwrite', st => st.delete(id)); } catch (e) { /* */ }
      try { await tx('files', 'readwrite', st => st.delete(id)); } catch (e) { /* */ }
    },

    // ── 설정과 기록
    loadJSON(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? Object.assign({}, fallback, JSON.parse(v)) : Object.assign({}, fallback);
      } catch (e) { return Object.assign({}, fallback); }
    },
    saveJSON(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* */ }
    },
  };

  root.Store = Store;
})(window);
