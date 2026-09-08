/* ============================================================
   fx.js — the reward system.

   The noise escalates with the work: pencils and word bubbles get a
   puff of graphite dust, lineart flicks ink, colors and backgrounds
   throw paint. Finishing a page pops a halftone burst; finishing a
   whole column of one step across a comic takes over the screen for a
   few seconds; finishing a comic does all of it at once.
   ============================================================ */

const canvas = document.getElementById('fx-canvas');
const layer  = document.getElementById('fx-layer');
const ctx = canvas.getContext('2d');

let particles = [];
let running = false;
let dpr = 1;

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = true;
export function setEnabled(on) { enabled = !!on; }
function muted() { return !enabled || reduced.matches; }

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width  = Math.floor(innerWidth  * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const onScreen = (x, y) => x > -40 && x < innerWidth + 40 && y > -40 && y < innerHeight + 40;

/** Read a theme color so canvas particles follow light/dark mode. */
export function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || '#888';
}

const POPS = ['#ff3b30', '#ffcf3f', '#3aa0e0', '#ff5da2', '#2f9e78', '#9b6bd6'];

/** Particle colors for a task, with the ink color resolved at run time. */
function paletteFor(task) {
  return task.key === 'lineart'
    ? [cssVar('--t-lineart'), cssVar('--t-lineart'), ...task.particles]
    : task.particles;
}

function spawn(p) { particles.push(p); }

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += p.g;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.spin;
    p.life -= 1;

    if (p.life <= 0 || p.y > innerHeight + 80) { particles.splice(i, 1); continue; }

    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / p.fadeFrom);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
    } else if (p.shape === 'streak') {
      ctx.fillRect(-p.r * 0.32, -p.r * 1.6, p.r * 0.64, p.r * 3.2);
    } else if (p.shape === 'star') {
      star(ctx, p.r);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (particles.length) requestAnimationFrame(tick);
  else running = false;
}

function star(c, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  c.closePath();
  c.fill();
}

function start() {
  if (!running) { running = true; requestAnimationFrame(tick); }
}

function burst(x, y, opts) {
  const {
    count = 14, colors = POPS, speed = [1.5, 4.5],
    size = [1.5, 3.5], gravity = 0.12, life = [26, 46],
    shape = 'dot', drag = 0.97, spread = Math.PI * 2, dir = -Math.PI / 2,
  } = opts || {};
  for (let i = 0; i < count; i++) {
    const angle = dir + rand(-spread / 2, spread / 2);
    const v = rand(speed[0], speed[1]);
    const lf = rand(life[0], life[1]);
    spawn({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      g: gravity, drag,
      r: rand(size[0], size[1]),
      color: pick(colors),
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.35, 0.35),
      life: lf, fadeFrom: lf * 0.6,
      shape,
    });
  }
  start();
}

/* ---------- DOM-based flourishes ---------- */

function halftone(x, y, color, scale = 1) {
  const el = document.createElement('div');
  el.className = 'halftone';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--dot', color);
  el.style.setProperty('--ht-scale', scale);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

/** An expanding shockwave ring — the "impact" of a tap. */
function ring(x, y, color, { size = 120, width = 4, ms = 620 } = {}) {
  const el = document.createElement('div');
  el.className = 'fx-ring';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--ring-color', color);
  el.style.setProperty('--ring-size', size + 'px');
  el.style.setProperty('--ring-width', width + 'px');
  el.style.animationDuration = ms + 'ms';
  layer.appendChild(el);
  setTimeout(() => el.remove(), ms + 60);
}

function shout(text, x, y, { size = 46, rot = rand(-11, 8), color = '#ffcf3f' } = {}) {
  const el = document.createElement('div');
  el.className = 'shout';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.fontSize = size + 'px';
  el.style.color = color;
  el.style.setProperty('--rot', rot + 'deg');
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* ---------- public effects ---------- */

const PAGE_WORDS  = ['POP!', 'BAM!', 'NICE!', 'ZAP!', 'YES!', 'KAPOW!', 'BOOM!'];
const COMIC_WORDS = ['THE END!', 'BOOK DONE!', 'WOW!', 'FINISHED!'];

/** Centre point of an element, in viewport coordinates. */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * A single task got checked. Tier 1 = pencils / word bubbles,
 * 2 = lineart, 3 = colors / backgrounds.
 */
export function taskChecked(el, task) {
  if (muted()) return;
  const { x, y } = centerOf(el);
  const colors = paletteFor(task);
  const ink = task.key === 'lineart' ? cssVar('--t-lineart') : colors[0];

  if (task.tier === 1) {
    burst(x, y, { count: 28, colors, speed: [1.6, 5], size: [1.5, 4], gravity: .13, life: [26, 46] });
    burst(x, y, { count: 8,  colors, speed: [3, 7],   size: [2, 4],   gravity: .08, life: [18, 30], shape: 'streak' });
    ring(x, y, ink, { size: 110, width: 3 });
    halftone(x, y, ink, .8);
  } else if (task.tier === 2) {
    burst(x, y, { count: 40, colors, speed: [2.2, 7],   size: [1.5, 5], gravity: .22, life: [26, 48] });
    burst(x, y, { count: 12, colors, speed: [3.5, 8.5], size: [3, 6.5], gravity: .26, life: [26, 44] });
    burst(x, y, { count: 10, colors, speed: [4, 9],     size: [2.5, 5], gravity: .05, life: [16, 28], shape: 'streak' });
    ring(x, y, ink, { size: 150, width: 5 });
    halftone(x, y, ink, 1.1);
  } else {
    burst(x, y, { count: 48, colors, speed: [2.5, 8],  size: [2, 6],   gravity: .2,  life: [30, 56] });
    burst(x, y, { count: 18, colors, speed: [3.5, 9],  size: [4, 8],   gravity: .16, life: [30, 52], shape: 'rect' });
    burst(x, y, { count: 10, colors: ['#fff6d0', '#ffcf3f'], speed: [4, 10], size: [3, 6], gravity: .06, life: [18, 32], shape: 'streak' });
    burst(x, y, { count: 6,  colors, speed: [2, 5],    size: [5, 9],   gravity: .12, life: [26, 44], shape: 'star' });
    ring(x, y, ink, { size: 190, width: 6 });
    halftone(x, y, ink, 1.3);
  }
}

/**
 * Every task on one page is done. A mini celebration, anchored to the row
 * rather than taking over the screen: the row pops, the five boxes ripple
 * left to right, and a little comic sticker lands on top of it.
 */
export function pageComplete(row, pageNumber, cells = [], withSticker = true) {
  if (muted()) return;
  const { x, y } = centerOf(row);

  row.classList.add('row-pop');
  setTimeout(() => row.classList.remove('row-pop'), 660);

  // a quick wave across the five finished boxes
  cells.forEach((cell, i) => setTimeout(() => {
    cell.classList.add('cell-pulse');
    setTimeout(() => cell.classList.remove('cell-pulse'), 520);
    const c = centerOf(cell);
    if (onScreen(c.x, c.y)) {
      burst(c.x, c.y, { count: 10, colors: POPS, speed: [2, 5.5], size: [2, 4.5], gravity: .18, life: [20, 38] });
    }
  }, i * 48));

  halftone(x, y, '#ffcf3f', 1.5);
  ring(x, y, '#ff3b30', { size: 290, width: 7, ms: 740 });
  burst(x, y, { count: 38, colors: POPS, speed: [3, 11], size: [3, 7], gravity: .24, life: [36, 70], shape: 'rect' });
  burst(x, y, { count: 16, colors: ['#ffcf3f', '#fff6d0'], speed: [4, 12], size: [3, 8], gravity: .1, life: [24, 42], shape: 'streak' });
  burst(x, y, { count: 10, colors: POPS, speed: [2, 7], size: [5, 10], gravity: .18, life: [30, 54], shape: 'star' });

  // skipped when a bigger milestone is about to take the screen anyway
  if (withSticker) sticker(`PAGE ${pageNumber}`, pick(PAGE_WORDS), x, y);
}

/** The little rosette that lands on a finished row. */
function sticker(topLine, bigLine, x, y) {
  const el = document.createElement('div');
  el.className = 'page-badge';
  el.innerHTML = `
    <div class="pb-rays"></div>
    <div class="pb-core">
      <span class="pb-page"></span>
      <span class="pb-word"></span>
    </div>`;
  el.querySelector('.pb-page').textContent = topLine;
  el.querySelector('.pb-word').textContent = bigLine;
  el.style.left = Math.min(Math.max(x, 108), innerWidth - 108) + 'px';
  el.style.top  = Math.min(Math.max(y, 84), innerHeight - 84) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

/**
 * Every page of the comic is done with one step — all the pencils, all
 * the lineart. A few seconds of full-screen fanfare in that step's colors.
 */
export function columnComplete(task, comicTitle, cells = []) {
  if (muted()) return;
  const colors = paletteFor(task);
  const accent = task.key === 'lineart' ? cssVar('--t-lineart') : colors[0];

  // 1. run down the column that was just finished, cell by cell
  cells.forEach((cell, i) => setTimeout(() => {
    cell.classList.add('cell-pulse');
    setTimeout(() => cell.classList.remove('cell-pulse'), 520);
    const { x, y } = centerOf(cell);
    if (onScreen(x, y)) {
      burst(x, y, { count: 14, colors, speed: [2, 6], size: [2, 5], gravity: .18, life: [22, 40] });
      ring(x, y, accent, { size: 90, width: 3, ms: 500 });
    }
  }, 60 + i * 55));

  // 2. the takeover — unless one just ran. Finishing a comic page by page
  // completes four columns on its last page, and four takeovers in a row
  // would cut each other off; later ones are acknowledged compactly.
  const wait = Math.min(60 + cells.length * 55, 520);
  if (Date.now() - lastFanfareAt < 5000) {
    setTimeout(() => sticker(`ALL ${task.label.toUpperCase()}`, 'DONE!',
      innerWidth / 2, innerHeight * 0.42), wait);
    return;
  }
  lastFanfareAt = Date.now();
  setTimeout(() => fanfare(task, comicTitle, colors, accent), wait);
}

let lastFanfareAt = 0;

function fanfare(task, comicTitle, colors, accent) {
  // two takeovers at once would just fight each other
  document.querySelectorAll('.fanfare').forEach(old => old.remove());

  const el = document.createElement('div');
  el.className = 'fanfare';
  el.style.setProperty('--fc', accent);
  el.innerHTML = `
    <div class="fanfare-rays"></div>
    <div class="fanfare-rays alt"></div>
    <div class="fanfare-scrim"></div>
    <div class="fanfare-core">
      <div class="fanfare-icon"><svg viewBox="0 0 24 24">${task.icon}</svg></div>
      <div class="fanfare-title">ALL THE<br>${task.label.toUpperCase()}</div>
      <div class="fanfare-sub">done for “${comicTitle}”</div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);

  const cx = innerWidth / 2, cy = innerHeight * 0.44;

  halftone(cx, cy, accent, 2.2);
  setTimeout(() => halftone(cx, cy, pick(POPS), 2.6), 220);
  ring(cx, cy, accent, { size: Math.max(innerWidth, innerHeight) * 1.4, width: 10, ms: 1100 });

  // radiating streaks out of the middle
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    spawn({
      x: cx, y: cy,
      vx: Math.cos(a) * rand(7, 15), vy: Math.sin(a) * rand(7, 15),
      g: .02, drag: .985, r: rand(4, 9),
      color: pick(colors), rot: a + Math.PI / 2, spin: 0,
      life: 52, fadeFrom: 34, shape: 'streak',
    });
  }
  start();

  // a steady storm in the step's own colors for a few seconds
  let wave = 0;
  const storm = setInterval(() => {
    for (let i = 0; i < 13; i++) {
      spawn({
        x: rand(0, innerWidth), y: rand(-90, -10),
        vx: rand(-1.6, 1.6), vy: rand(2.5, 6),
        g: .07, drag: .995, r: rand(2.5, 6.5),
        color: pick(colors), rot: rand(0, 6.3), spin: rand(-.3, .3),
        life: 200, fadeFrom: 60,
        shape: task.tier === 1 ? 'dot' : 'rect',
      });
    }
    // side cannons, so it fills the whole screen rather than just raining
    for (const side of [0, 1]) {
      burst(side ? innerWidth + 10 : -10, rand(innerHeight * .3, innerHeight * .9), {
        count: 5, colors, speed: [7, 14], size: [3, 6.5], gravity: .12,
        life: [40, 70], shape: 'rect', spread: Math.PI / 2.4,
        dir: side ? Math.PI * 1.15 : -Math.PI * .15,
      });
    }
    start();
    if (++wave >= 12) clearInterval(storm);
  }, 190);
}

/** A whole comic is finished — the big one. */
export function comicComplete() {
  if (muted()) return;
  const cx = innerWidth / 2, cy = innerHeight * 0.42;

  halftone(cx, cy, '#ff3b30', 2);
  setTimeout(() => halftone(cx, cy, '#3aa0e0', 2.4), 160);
  ring(cx, cy, '#ffcf3f', { size: Math.max(innerWidth, innerHeight) * 1.6, width: 12, ms: 1200 });

  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    spawn({
      x: cx, y: cy,
      vx: Math.cos(a) * rand(7, 16), vy: Math.sin(a) * rand(7, 16),
      g: .02, drag: .985, r: rand(5, 11),
      color: pick(['#ffcf3f', '#ff3b30', '#fff']),
      rot: a + Math.PI / 2, spin: 0,
      life: 54, fadeFrom: 34, shape: 'streak',
    });
  }
  start();

  shout(pick(COMIC_WORDS), cx, cy, { size: Math.min(70, innerWidth / 6.6), rot: -7, color: '#ffcf3f' });

  let wave = 0;
  const rain = setInterval(() => {
    for (let i = 0; i < 34; i++) {
      spawn({
        x: rand(0, innerWidth), y: rand(-80, -10),
        vx: rand(-1.6, 1.6), vy: rand(2, 6),
        g: .07, drag: .995, r: rand(3, 8),
        color: pick(POPS), rot: rand(0, 6.3), spin: rand(-.3, .3),
        life: 200, fadeFrom: 55, shape: 'rect',
      });
    }
    start();
    if (++wave >= 10) clearInterval(rain);
  }, 130);
}

/** The last comic of the whole story is done. */
export function storyComplete() {
  if (muted()) return;
  comicComplete();
  setTimeout(() => {
    shout('THE WHOLE STORY!', innerWidth / 2, innerHeight * 0.62,
      { size: Math.min(40, innerWidth / 10), rot: 4, color: '#ff5da2' });
  }, 700);
}
