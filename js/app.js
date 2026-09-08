/* ============================================================
   app.js — screens, rendering and wiring.
   ============================================================ */

import {
  TASKS, state, save, addComic, getComic, deleteComic, deletePage,
  newPage, pageDone, columnDone, comicStats, storyStats,
  splitComic, moveComic, comicIndex,
  getThumb, putThumb, deleteThumb, shrinkImage,
  exportBackup, importBackup,
} from './store.js';
import * as fx from './fx.js';

/* ---------------- task icons ---------------- */

const icon = task => `<svg viewBox="0 0 24 24" aria-hidden="true">${task.icon}</svg>`;

/* ---------------- element lookup ---------------- */

const $ = id => document.getElementById(id);
const el = {
  home: $('view-home'), comic: $('view-comic'),
  comicList: $('comic-list'), emptyHome: $('empty-home'),
  storyPct: $('story-pct'), shelf: $('shelf'),
  storySub: $('story-sub'), storyGoalText: $('story-goal-text'),
  comicTitle: $('comic-title'), comicFill: $('comic-bar-fill'),
  comicPct: $('comic-pct'), comicSub: $('comic-sub'),
  pageList: $('page-list'), legend: $('legend'),
  toast: $('toast'),
};

let openComicId = null;
let pendingPageId = null;   // page whose photo dialog is open

fx.setEnabled(state.celebrations !== false);

/* ---------------- small helpers ---------------- */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

function confirmDialog(title, text, { ok = 'Delete', cancel = 'Keep it', danger = true } = {}) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('btn-confirm-yes').textContent = ok;
  $('btn-confirm-no').textContent = cancel;
  $('btn-confirm-yes').classList.toggle('btn-danger', danger);
  $('btn-confirm-yes').classList.toggle('btn-solid', !danger);
  const dlg = $('dlg-confirm');
  dlg.showModal();
  return new Promise(resolve => {
    const yes = () => { cleanup(); dlg.close(); resolve(true); };
    const no  = () => { cleanup(); dlg.close(); resolve(false); };
    function cleanup() {
      $('btn-confirm-yes').removeEventListener('click', yes);
      $('btn-confirm-no').removeEventListener('click', no);
      dlg.removeEventListener('cancel', no);
    }
    $('btn-confirm-yes').addEventListener('click', yes);
    $('btn-confirm-no').addEventListener('click', no);
    dlg.addEventListener('cancel', no);
  });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------------- routing ---------------- */

function showHome() {
  openComicId = null;
  el.comic.hidden = true;
  el.home.hidden = false;
  location.hash = '';
  renderHome();
  scrollTo(0, 0);
}

function showComic(id) {
  const comic = getComic(id);
  if (!comic) return showHome();
  openComicId = id;
  el.home.hidden = true;
  el.comic.hidden = false;
  location.hash = 'c/' + id;
  renderComic();
  scrollTo(0, 0);
}

addEventListener('hashchange', () => {
  const m = location.hash.match(/^#c\/(.+)$/);
  if (m && m[1] !== openComicId) showComic(m[1]);
  else if (!m && openComicId) showHome();
});

/* ---------------- home ---------------- */

function renderStoryPanel() {
  const s = storyStats();
  el.storyPct.textContent = s.pct + '%';
  el.storyGoalText.textContent = plural(s.goal, 'comic', 'comics');

  // one spine per comic in the planned story; the ones you haven't started
  // yet are drawn as empty slots waiting on the shelf
  el.shelf.innerHTML = '';
  for (let i = 0; i < s.slots; i++) {
    const comic = state.comics[i];
    const spine = document.createElement('button');
    spine.type = 'button';
    spine.setAttribute('role', 'listitem');
    if (!comic) {
      spine.className = 'spine unstarted';
      spine.disabled = true;
      spine.setAttribute('aria-label', `Comic ${i + 1}: not started`);
      spine.innerHTML = `<b>${i + 1}</b>`;
    } else {
      const cs = comicStats(comic);
      spine.className = 'spine' + (cs.complete ? ' done' : '');
      spine.title = `${comic.title} — ${cs.pct}%`;
      spine.setAttribute('aria-label', `${comic.title}, ${cs.pct} percent done`);
      spine.innerHTML = `<i style="height:${cs.pct}%"></i><b>${i + 1}</b>`;
      spine.addEventListener('click', () => showComic(comic.id));
    }
    el.shelf.appendChild(spine);
  }

  el.storySub.textContent = !s.comics
    ? 'No comics yet — start your first one.'
    : `${s.comicsDone} of ${s.slots} comics finished · ${s.done}/${s.total} steps done`;
}

function renderHome() {
  renderStoryPanel();
  el.comicList.innerHTML = '';
  el.emptyHome.hidden = state.comics.length > 0;

  for (const comic of state.comics) {
    const s = comicStats(comic);
    const li = document.createElement('li');
    const card = document.createElement('button');
    card.className = 'comic-card' + (s.complete ? ' complete' : '');
    card.type = 'button';
    card.dataset.comic = comic.id;
    card.innerHTML = `
      <div class="cc-top">
        <h3 class="cc-name"></h3>
        <span class="cc-badge${s.complete ? ' done' : ''}">${s.complete ? 'DONE' : s.pct + '%'}</span>
      </div>
      <p class="cc-meta">${plural(s.pages, 'page', 'pages')} · ${s.pagesDone} finished · ${s.done}/${s.total} steps</p>
      <div class="cc-bar"><i style="width:${s.pct}%"></i></div>`;
    card.querySelector('.cc-name').textContent = comic.title;
    card.addEventListener('click', () => showComic(comic.id));
    li.appendChild(card);
    el.comicList.appendChild(li);
  }
}

/* ---------------- comic view ---------------- */

function renderLegend() {
  el.legend.innerHTML =
    '<span class="legend-spacer"></span>' +
    TASKS.map(t => `<span class="legend-item">${t.short.replace('\n', '<br>')}</span>`).join('');
}

function renderComic() {
  const comic = getComic(openComicId);
  if (!comic) return showHome();

  el.comicTitle.textContent = comic.title;
  renderLegend();
  updateComicBar();

  el.pageList.innerHTML = '';
  comic.pages.forEach((page, i) => el.pageList.appendChild(pageRow(comic, page, i)));
  loadThumbs(comic);
}

function updateComicBar() {
  const comic = getComic(openComicId);
  if (!comic) return;
  const s = comicStats(comic);
  el.comicFill.style.width = s.pct + '%';
  el.comicFill.classList.toggle('done', s.complete);
  el.comicPct.textContent = s.pct + '%';
  el.comicSub.textContent = s.pages
    ? `${s.pagesDone} of ${plural(s.pages, 'page', 'pages')} finished · ${s.done}/${s.total} steps`
    : 'No pages yet — add one below.';
}

function pageRow(comic, page, index) {
  const li = document.createElement('li');
  li.className = 'page-row' + (pageDone(page) ? ' complete' : '');
  li.dataset.page = page.id;

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'page-handle';
  handle.setAttribute('aria-label', `Page ${index + 1} options and photo`);
  handle.innerHTML = `
    <span class="page-num">${index + 1}</span>
    <span class="page-thumb" data-thumb="${page.id}">
      <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M5 17l4-4 3 3 2-2 4 4"/></svg>
    </span>`;
  handle.addEventListener('click', () => openPageDialog(page.id, index + 1));
  li.appendChild(handle);

  for (const t of TASKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'task-btn';
    b.style.setProperty('--tc', t.color);
    if (t.key === 'lineart') b.style.setProperty('--check-fg', 'var(--paper-card)');
    b.dataset.task = t.key;
    b.setAttribute('aria-pressed', String(!!page.tasks[t.key]));
    b.setAttribute('aria-label', `${t.label}, page ${index + 1}`);
    b.innerHTML = icon(t);
    b.addEventListener('click', () => toggleTask(comic, page, t, b, li));
    li.appendChild(b);
  }
  return li;
}

function toggleTask(comic, page, task, btn, row) {
  const wasPageDone = pageDone(page);
  const wasComicDone = comicStats(comic).complete;

  page.tasks[task.key] = !page.tasks[task.key];
  const on = page.tasks[task.key];
  btn.setAttribute('aria-pressed', String(on));
  save();

  const nowPageDone = pageDone(page);
  row.classList.toggle('complete', nowPageDone);
  updateComicBar();

  if (!on) return;   // unchecking is silent — no confetti for undo

  btn.classList.remove('just-checked');
  void btn.offsetWidth;            // restart the stamp animation
  btn.classList.add('just-checked');

  // work out which milestones this tap crossed before firing anything, so a
  // smaller one can stand aside for a bigger one
  const comicJustDone = comicStats(comic).complete && !wasComicDone;
  const columnJustDone = !comicJustDone
    && comic.pages.length > 1 && columnDone(comic, task.key);
  const pageJustDone = nowPageDone && !wasPageDone;

  // every tap gets its own hit, then any milestone stacks on top
  fx.taskChecked(btn, task);

  if (pageJustDone) {
    const number = comic.pages.indexOf(page) + 1;
    const cells = [...row.querySelectorAll('.task-btn')];
    // the sticker is skipped when the screen is about to be taken over anyway
    setTimeout(() => fx.pageComplete(row, number, cells,
      !columnJustDone && !comicJustDone), 130);
  }

  if (comicJustDone) {
    // finishing the comic finishes every column at once, so the comic
    // celebration stands in for all of them
    const story = storyStats();
    const finale = story.comicsDone >= story.slots;
    setTimeout(() => (finale ? fx.storyComplete() : fx.comicComplete()), 520);
    setTimeout(() => toast(finale
      ? 'Every comic finished. The whole story is done!'
      : `“${comic.title}” is finished!`), 760);
    return;
  }

  // all of one step, across every page of this comic
  if (columnJustDone) {
    const cells = [...el.pageList.querySelectorAll(`[data-task="${task.key}"]`)];
    fx.columnComplete(task, comic.title, cells);
    setTimeout(() => toast(
      `All ${task.label.toLowerCase()} done for “${comic.title}”!`), 1400);
  }
}

/* thumbnails are fetched after the rows exist so the list paints immediately */
async function loadThumbs(comic) {
  for (const page of comic.pages) {
    if (!page.hasImage) continue;
    try {
      const data = await getThumb(page.id);
      if (!data) continue;
      const node = el.pageList.querySelector(`[data-thumb="${page.id}"]`);
      if (node) {
        node.style.backgroundImage = `url("${data}")`;
        node.classList.add('has-img');
      }
    } catch { /* a missing thumbnail is not worth interrupting anyone over */ }
  }
}

/* ---------------- comic dialog (create / rename / add pages / goal) ---------------- */

const dlgComic = $('dlg-comic');
let comicDialogMode = 'create';

function openComicDialog(mode) {
  comicDialogMode = mode;
  const comic = getComic(openComicId);
  const titleField = $('in-title').closest('.field');
  const pagesField = $('field-pages');
  const half = comic ? Math.max(1, Math.floor(comic.pages.length / 2)) : 1;

  const setup = {
    create: {
      h: 'New comic', ok: 'Create',
      titleLabel: 'Title', titleValue: '',
      pagesLabel: 'How many pages?', pagesValue: 12,
      hint: 'You can always add more later.',
    },
    rename: {
      h: 'Rename comic', ok: 'Save',
      titleLabel: 'Title', titleValue: comic ? comic.title : '',
    },
    addpages: {
      h: 'Add pages', ok: 'Add',
      pagesLabel: 'How many pages to add?', pagesValue: 4,
    },
    goal: {
      h: 'Story length', ok: 'Save',
      pagesLabel: 'How many comics in the whole story?', pagesValue: state.storyGoal,
      hint: 'The story grows on its own if you add more comics than this.',
    },
    split: {
      h: 'Split into two', ok: 'Split',
      titleLabel: 'Name for the second half',
      titleValue: comic ? `${comic.title} (part 2)` : '',
      pagesLabel: comic ? `Split after which page? (1–${comic.pages.length - 1})` : 'Split after which page?',
      pagesValue: half,
      hint: 'Later pages move across, keeping their checkmarks and photos.',
    },
  }[mode];

  $('dlg-comic-title').textContent = setup.h;
  $('btn-comic-save').textContent = setup.ok;

  titleField.hidden = !setup.titleLabel;
  if (setup.titleLabel) {
    titleField.querySelector('.field-label').textContent = setup.titleLabel;
    $('in-title').value = setup.titleValue;
  }

  pagesField.hidden = !setup.pagesLabel;
  if (setup.pagesLabel) {
    pagesField.querySelector('.field-label').textContent = setup.pagesLabel;
    $('in-pages').value = setup.pagesValue;
  }

  const hint = pagesField.querySelector('.field-hint');
  hint.hidden = !setup.hint;
  if (setup.hint) hint.textContent = setup.hint;

  dlgComic.showModal();
  if (setup.titleLabel) setTimeout(() => $('in-title').focus(), 60);
}

$('form-comic').addEventListener('submit', ev => {
  // The dialog form closes itself; we only act on the "ok" button.
  const ok = ev.submitter && ev.submitter.value === 'ok';
  if (!ok) return;

  const title = $('in-title').value.trim();
  const count = Math.max(1, Math.min(200, parseInt($('in-pages').value, 10) || 1));

  if (comicDialogMode === 'create') {
    const comic = addComic(title || `Comic ${state.comics.length + 1}`, count);
    setTimeout(() => showComic(comic.id), 0);
  } else if (comicDialogMode === 'rename') {
    const comic = getComic(openComicId);
    if (comic && title) { comic.title = title; save(); el.comicTitle.textContent = title; }
  } else if (comicDialogMode === 'addpages') {
    const comic = getComic(openComicId);
    if (comic) {
      for (let i = 0; i < count; i++) comic.pages.push(newPage());
      save();
      renderComic();
      toast(`Added ${plural(count, 'page', 'pages')}.`);
    }
  } else if (comicDialogMode === 'split') {
    const comic = getComic(openComicId);
    if (comic && comic.pages.length > 1) {
      const part2 = splitComic(comic, count, title);
      showHome();
      toast(`Split — “${part2.title}” has ${plural(part2.pages.length, 'page', 'pages')}.`);
    }
  } else if (comicDialogMode === 'goal') {
    state.storyGoal = count;
    save();
    renderStoryPanel();
  }
});

/* ---------------- page dialog (photo / delete) ---------------- */

const dlgPage = $('dlg-page');

async function openPageDialog(pageId, number) {
  pendingPageId = pageId;
  const comic = getComic(openComicId);
  const page = comic && comic.pages.find(p => p.id === pageId);
  if (!page) return;

  $('dlg-page-title').textContent = 'Page ' + number;
  const preview = $('thumb-preview');
  preview.innerHTML = '';
  preview.classList.remove('show');
  $('btn-remove-image').hidden = true;
  $('pick-image-label').textContent = 'Add a photo of this page';

  if (page.hasImage) {
    try {
      const data = await getThumb(pageId);
      if (data) {
        const img = new Image();
        img.src = data;
        img.alt = 'Photo of page ' + number;
        preview.appendChild(img);
        preview.classList.add('show');
        $('btn-remove-image').hidden = false;
        $('pick-image-label').textContent = 'Replace photo';
      }
    } catch { /* ignore */ }
  }
  dlgPage.showModal();
}

$('btn-pick-image').addEventListener('click', () => $('in-image').click());

$('in-image').addEventListener('change', async ev => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file || !pendingPageId) return;
  const comic = getComic(openComicId);
  const page = comic && comic.pages.find(p => p.id === pendingPageId);
  if (!page) return;
  try {
    const data = await shrinkImage(file);
    await putThumb(page.id, data);
    page.hasImage = true;
    save();
    dlgPage.close();
    renderComic();
    toast('Photo added.');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Could not use that image.');
  }
});

$('btn-remove-image').addEventListener('click', async () => {
  const comic = getComic(openComicId);
  const page = comic && comic.pages.find(p => p.id === pendingPageId);
  if (!page) return;
  await deleteThumb(page.id).catch(() => {});
  page.hasImage = false;
  save();
  dlgPage.close();
  renderComic();
});

$('btn-delete-page').addEventListener('click', async () => {
  const comic = getComic(openComicId);
  const page = comic && comic.pages.find(p => p.id === pendingPageId);
  if (!comic || !page) return;
  const number = comic.pages.indexOf(page) + 1;
  dlgPage.close();
  const yes = await confirmDialog(
    `Delete page ${number}?`,
    'The later pages will shift up to fill the gap.',
  );
  if (!yes) return;
  await deletePage(comic, page.id);
  renderComic();
});

$('btn-page-close').addEventListener('click', () => dlgPage.close());

/* ---------------- comic options ---------------- */

const dlgComicMenu = $('dlg-comic-menu');
$('btn-comic-menu').addEventListener('click', () => {
  const comic = getComic(openComicId);
  if (!comic) return;
  // The same slot flips to an undo, so a mis-tap doesn't mean re-checking
  // every box by hand.
  const done = comicStats(comic).complete;
  const i = comicIndex(comic.id);
  const total = state.comics.length;
  $('comic-position').textContent = `Comic ${i + 1} of ${total} in the story`;
  $('btn-move-up').hidden = i <= 0;
  $('btn-move-down').hidden = i < 0 || i >= total - 1;
  $('btn-split').hidden = comic.pages.length < 2;
  $('btn-mark-all').hidden = comic.pages.length === 0;
  $('mark-all-label').textContent = done ? 'Clear every checkmark' : 'Mark every page finished';
  $('mark-all-hint').textContent = done
    ? 'Start this comic over from nothing'
    : 'For a comic you finished before you started tracking';
  $('btn-mark-all').classList.toggle('danger', done);
  dlgComicMenu.showModal();
});

$('btn-mark-all').addEventListener('click', async () => {
  const comic = getComic(openComicId);
  if (!comic) return;
  const done = comicStats(comic).complete;
  dlgComicMenu.close();

  const yes = await confirmDialog(
    done ? `Clear “${comic.title}”?` : `Mark “${comic.title}” finished?`,
    done
      ? `Every checkmark on all ${plural(comic.pages.length, 'page', 'pages')} will be cleared. Photos stay.`
      : `All five steps on all ${plural(comic.pages.length, 'page', 'pages')} will be ticked off.`,
    { ok: done ? 'Clear it' : 'Mark it done', cancel: 'Cancel', danger: done },
  );
  if (!yes) return;

  for (const page of comic.pages) {
    for (const t of TASKS) page.tasks[t.key] = !done;
  }
  save();
  renderComic();
  if (!done) {
    fx.comicComplete();
    toast(`“${comic.title}” is finished!`);
  }
});
$('btn-comic-menu-close').addEventListener('click', () => dlgComicMenu.close());
$('btn-rename').addEventListener('click', () => { dlgComicMenu.close(); openComicDialog('rename'); });
$('btn-split').addEventListener('click', () => { dlgComicMenu.close(); openComicDialog('split'); });

for (const [id, delta] of [['btn-move-up', -1], ['btn-move-down', 1]]) {
  $(id).addEventListener('click', () => {
    const comic = getComic(openComicId);
    if (!comic || !moveComic(comic, delta)) return;
    dlgComicMenu.close();
    toast(`Now comic ${comicIndex(comic.id) + 1} of ${state.comics.length}.`);
  });
}
$('btn-add-many').addEventListener('click', () => { dlgComicMenu.close(); openComicDialog('addpages'); });
$('btn-delete-comic').addEventListener('click', async () => {
  const comic = getComic(openComicId);
  if (!comic) return;
  dlgComicMenu.close();
  const yes = await confirmDialog(
    `Delete “${comic.title}”?`,
    `All ${plural(comic.pages.length, 'page', 'pages')} and their photos go with it. This cannot be undone.`,
  );
  if (!yes) return;
  await deleteComic(comic.id);
  showHome();
});

/* ---------------- data menu ---------------- */

const dlgMenu = $('dlg-menu');
function paintMotionState() {
  $('motion-state').textContent = state.celebrations === false ? 'off' : 'on';
}
$('btn-menu').addEventListener('click', () => { paintMotionState(); dlgMenu.showModal(); });
$('btn-menu-close').addEventListener('click', () => dlgMenu.close());

$('btn-export').addEventListener('click', async () => {
  try {
    await exportBackup();
    toast('Backup downloaded.');
  } catch (err) {
    console.error(err);
    toast('Export failed.');
  }
});

$('btn-import').addEventListener('click', () => $('in-import').click());
$('in-import').addEventListener('change', async ev => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const yes = await confirmDialog(
    'Restore this backup?',
    'Everything currently on this device will be replaced by the contents of the file.',
    { ok: 'Restore', cancel: 'Cancel' },
  );
  if (!yes) return;
  try {
    await importBackup(file);
    dlgMenu.close();
    showHome();
    toast('Backup restored.');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Could not read that backup.');
  }
});

$('btn-motion').addEventListener('click', () => {
  state.celebrations = state.celebrations === false;
  fx.setEnabled(state.celebrations);
  save();
  paintMotionState();
  if (state.celebrations) fx.pageComplete($('btn-motion'));
});

/* ---------------- top-level buttons ---------------- */

$('btn-add-comic').addEventListener('click', () => openComicDialog('create'));
$('btn-back').addEventListener('click', showHome);
$('btn-story-goal').addEventListener('click', () => openComicDialog('goal'));

document.addEventListener('storage-error', () => {
  toast('This device is out of storage — export a backup and remove some photos.');
});

/* ---------------- go ---------------- */

const deepLink = location.hash.match(/^#c\/(.+)$/);
if (deepLink && getComic(deepLink[1])) showComic(deepLink[1]);
else showHome();
