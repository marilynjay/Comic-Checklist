/* ============================================================
   store.js — all persistence.
   Progress lives in localStorage (small, synchronous, reliable).
   Page thumbnails live in IndexedDB (too big for localStorage).
   ============================================================ */

export const TASKS = [
  {
    key: 'pencils', label: 'Pencils', short: 'Pencils', tier: 1,
    color: 'var(--t-pencils)', cssVar: '--t-pencils',
    // particle colors are picked to read on both the light and dark paper
    particles: ['#a89e91', '#8a8178', '#c3bab0', '#6f665d'],
    icon: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  },
  {
    key: 'bubbles', label: 'Word bubbles', short: 'Word\nbubbles', tier: 1,
    color: 'var(--t-bubbles)', cssVar: '--t-bubbles',
    particles: ['#5b86b5', '#78a6d6', '#a9c8e8', '#2f6ba8'],
    icon: '<path d="M4 5h16v11h-9l-5 4v-4H4V5z"/><path d="M8 10h8"/>',
  },
  {
    key: 'lineart', label: 'Lineart', short: 'Lineart', tier: 2,
    color: 'var(--t-lineart)', cssVar: '--t-lineart',
    particles: ['#8a8178', '#57504a'],   // the ink color itself is added at runtime
    icon: '<path d="M3.5 16.5c4 2.5 5.5-7 9-5s3.5 5.5 8 3" stroke-width="2.6"/>',
  },
  {
    key: 'colors', label: 'Colors', short: 'Colors', tier: 3,
    color: 'var(--t-colors)', cssVar: '--t-colors',
    particles: ['#e0537d', '#ff5da2', '#ffcf3f', '#3aa0e0', '#2f9e78', '#9b6bd6'],
    icon: '<path d="M12 4a8 8 0 10.5 16c1.3 0 1.6-1 .9-1.8-.8-1-.1-2.2 1.2-2.2H16a4 4 0 004-4.2C19.7 7.3 16.3 4 12 4z"/><circle cx="8.5" cy="10" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="15.5" cy="10.5" r="1"/>',
  },
  {
    key: 'backgrounds', label: 'Backgrounds', short: 'Back-\ngrounds', tier: 3,
    color: 'var(--t-backs)', cssVar: '--t-backs',
    particles: ['#2f9e78', '#7fd6b2', '#3aa0e0', '#ffcf3f'],
    icon: '<path d="M3.5 18.5h17"/><path d="M5 18.5l4.5-7 3 4.5 2-3 4.5 5.5"/><circle cx="8" cy="6.5" r="1.6"/>',
  },
];

const LS_KEY = 'comic-checklist/v1';
const DB_NAME = 'comic-checklist-thumbs';
const DB_STORE = 'thumbs';

/* ---------------- state ---------------- */

function blank() {
  return { version: 1, storyGoal: 10, celebrations: true, comics: [] };
}

export const state = load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    return migrate(data);
  } catch (err) {
    console.warn('Could not read saved progress, starting fresh.', err);
    return blank();
  }
}

function migrate(data) {
  const s = Object.assign(blank(), data);
  s.comics = (Array.isArray(s.comics) ? s.comics : []).map(c => ({
    id: c.id || uid(),
    title: typeof c.title === 'string' ? c.title : 'Untitled comic',
    createdAt: c.createdAt || Date.now(),
    pages: (Array.isArray(c.pages) ? c.pages : []).map(p => {
      const tasks = {};
      for (const t of TASKS) tasks[t.key] = !!(p.tasks && p.tasks[t.key]);
      return { id: p.id || uid(), tasks, hasImage: !!p.hasImage };
    }),
  }));
  return s;
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 120);
}
export function writeNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Save failed', err);
    document.dispatchEvent(new CustomEvent('storage-error'));
  }
}
addEventListener('pagehide', writeNow);
addEventListener('visibilitychange', () => { if (document.hidden) writeNow(); });

export function uid() {
  return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ---------------- model helpers ---------------- */

export function newPage() {
  const tasks = {};
  for (const t of TASKS) tasks[t.key] = false;
  return { id: uid(), tasks, hasImage: false };
}

export function addComic(title, pageCount) {
  const comic = {
    id: uid(),
    title: title || 'Untitled comic',
    createdAt: Date.now(),
    pages: Array.from({ length: pageCount }, newPage),
  };
  state.comics.push(comic);
  save();
  return comic;
}

export function getComic(id) {
  return state.comics.find(c => c.id === id) || null;
}

export async function deleteComic(id) {
  const i = state.comics.findIndex(c => c.id === id);
  if (i < 0) return;
  const [comic] = state.comics.splice(i, 1);
  save();
  for (const p of comic.pages) await deleteThumb(p.id).catch(() => {});
}

export async function deletePage(comic, pageId) {
  const i = comic.pages.findIndex(p => p.id === pageId);
  if (i < 0) return;
  comic.pages.splice(i, 1);
  save();
  await deleteThumb(pageId).catch(() => {});
}

export function pageDone(page) {
  return TASKS.every(t => page.tasks[t.key]);
}

/** Is every page of this comic done with one particular step? */
export function columnDone(comic, key) {
  return comic.pages.length > 0 && comic.pages.every(p => p.tasks[key]);
}

export function comicStats(comic) {
  const total = comic.pages.length * TASKS.length;
  let done = 0;
  let pagesDone = 0;
  for (const p of comic.pages) {
    let n = 0;
    for (const t of TASKS) if (p.tasks[t.key]) n++;
    done += n;
    if (n === TASKS.length) pagesDone++;
  }
  return {
    done, total,
    pct: total ? Math.round((done / total) * 100) : 0,
    pagesDone, pages: comic.pages.length,
    complete: total > 0 && done === total,
  };
}

export function storyStats() {
  let done = 0, total = 0, comicsDone = 0, filled = 0;
  for (const c of state.comics) {
    const s = comicStats(c);
    done += s.done; total += s.total;
    if (s.complete) comicsDone++;
    filled += s.total ? s.done / s.total : 0;
  }
  // Measured against the planned length of the story, so a comic you haven't
  // started yet still counts as a comic you haven't done. One book finished
  // out of ten reads as 10%, not 100%.
  const slots = Math.max(state.storyGoal, state.comics.length, 1);
  return {
    done, total, slots,
    pct: Math.round((filled / slots) * 100),
    comicsDone, comics: state.comics.length, goal: state.storyGoal,
  };
}

/* ---------------- thumbnails (IndexedDB) ---------------- */

let dbPromise = null;
function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const getThumb    = id       => tx('readonly',  s => s.get(id));
export const putThumb    = (id, v)  => tx('readwrite', s => s.put(v, id));
export const deleteThumb = id       => tx('readwrite', s => s.delete(id));
export const allThumbs   = ()       => db().then(d => new Promise((resolve, reject) => {
  const out = {};
  const t = d.transaction(DB_STORE, 'readonly');
  const cur = t.objectStore(DB_STORE).openCursor();
  cur.onsuccess = () => {
    const c = cur.result;
    if (!c) return;
    out[c.key] = c.value;
    c.continue();
  };
  t.oncomplete = () => resolve(out);
  t.onerror = () => reject(t.error);
}));

/**
 * Shrink a picked photo down to a thumbnail data URL.
 * Phone cameras hand us 4000px, 5MB JPEGs; we only ever show ~40px on the
 * row and ~430px in the preview, so downscaling keeps a 150-page story well
 * inside the browser's storage quota.
 */
export function shrinkImage(file, maxDim = 640, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file did not look like an image.')); };
    img.src = url;
  });
}

/* ---------------- backup ---------------- */

export async function exportBackup() {
  const thumbs = await allThumbs().catch(() => ({}));
  const payload = {
    app: 'comic-checklist',
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
    thumbs,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `comic-checklist-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function importBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload || payload.app !== 'comic-checklist' || !payload.state) {
    throw new Error("That doesn't look like a Comic Checklist backup.");
  }
  const fresh = migrate(payload.state);
  Object.assign(state, fresh);
  writeNow();

  // Wipe existing thumbnails, then restore the ones in the backup.
  await tx('readwrite', s => s.clear()).catch(() => {});
  const thumbs = payload.thumbs || {};
  for (const [id, value] of Object.entries(thumbs)) {
    await putThumb(id, value).catch(() => {});
  }
  return fresh;
}
