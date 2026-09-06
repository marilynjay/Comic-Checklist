/* ============================================================
   fx.js — the reward system.

   The noise escalates with the work: pencils and word bubbles get a
   quiet puff of graphite dust, lineart flicks ink, colors and
   backgrounds throw paint. Finishing a whole page pops a halftone
   burst, and finishing a comic takes over the screen.
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

const PALETTE = {
  graphite: ['#8a8178', '#6f665d', '#a9a096', '#c3bab0'],
  ink:      ['#26221f', '#16130f', '#3b3530', '#57504a'],
  paint:    ['#ff3b30', '#ffcf3f', '#3aa0e0', '#ff5da2', '#2f9e78', '#9b6bd6'],
};

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

    const fade = Math.min(1, p.life / p.fadeFrom);
    if (p.life <= 0 || p.y > innerHeight + 60) { particles.splice(i, 1); continue; }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
    } else if (p.shape === 'streak') {
      ctx.fillRect(-p.r * 0.35, -p.r, p.r * 0.7, p.r * 2);
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

function start() {
  if (!running) { running = true; requestAnimationFrame(tick); }
}

function burst(x, y, opts) {
  const {
    count = 14, colors = PALETTE.graphite, speed = [1.5, 4.5],
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
      spin: rand(-0.3, 0.3),
      life: lf, fadeFrom: lf * 0.6,
      shape,
    });
  }
  start();
}

/* ---------- DOM-based flourishes ---------- */

function halftone(x, y, color) {
  const el = document.createElement('div');
  el.className = 'halftone';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--dot', color);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 750);
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

const PAGE_WORDS  = ['POP!', 'BAM!', 'NICE!', 'ZAP!', 'YES!', 'KAPOW!'];
const COMIC_WORDS = ['THE END!', 'BOOK DONE!', 'WOW!', 'FINISHED!'];

/** Centre point of an element, in viewport coordinates. */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * A single task got checked. `tier` comes from the task definition:
 * 1 = pencils / word bubbles, 2 = lineart, 3 = colors / backgrounds.
 */
export function taskChecked(el, tier) {
  if (muted()) return;
  const { x, y } = centerOf(el);
  if (tier === 1) {
    burst(x, y, {
      count: 12, colors: PALETTE.graphite, speed: [1, 3],
      size: [1, 2.6], gravity: 0.10, life: [20, 34],
    });
  } else if (tier === 2) {
    burst(x, y, {
      count: 18, colors: PALETTE.ink, speed: [2, 5.5],
      size: [1.5, 4.5], gravity: 0.22, life: [24, 42],
    });
    halftone(x, y, '#3b3530');
  } else {
    burst(x, y, {
      count: 26, colors: PALETTE.paint, speed: [2.4, 6.5],
      size: [2, 5], gravity: 0.20, life: [28, 50],
    });
    burst(x, y, {
      count: 8, colors: PALETTE.paint, speed: [3, 7],
      size: [4, 7], gravity: 0.16, life: [26, 44], shape: 'rect',
    });
    halftone(x, y, '#ff5da2');
  }
}

/** Every task on one page is done. */
export function pageComplete(el) {
  if (muted()) return;
  const { x, y } = centerOf(el);
  halftone(x, y, '#ffcf3f');
  burst(x, y, {
    count: 34, colors: PALETTE.paint, speed: [3, 9],
    size: [3, 6], gravity: 0.24, life: [34, 62], shape: 'rect',
  });
  burst(x, y, {
    count: 14, colors: ['#ffcf3f', '#fff6d0'], speed: [4, 10],
    size: [3, 7], gravity: 0.1, life: [22, 38], shape: 'streak',
  });
  shout(pick(PAGE_WORDS), Math.min(Math.max(x, 80), innerWidth - 80), y - 34, { size: Math.min(42, innerWidth / 8) });
}

/** A whole comic is finished — the big one. */
export function comicComplete() {
  if (muted()) return;
  const cx = innerWidth / 2, cy = innerHeight * 0.42;

  halftone(cx, cy, '#ff3b30');
  setTimeout(() => halftone(cx, cy, '#3aa0e0'), 160);

  // radiating starburst
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    spawn({
      x: cx, y: cy,
      vx: Math.cos(a) * rand(6, 13),
      vy: Math.sin(a) * rand(6, 13),
      g: 0.02, drag: 0.985,
      r: rand(4, 9),
      color: pick(['#ffcf3f', '#ff3b30', '#fff']),
      rot: a + Math.PI / 2, spin: 0,
      life: 46, fadeFrom: 30,
      shape: 'streak',
    });
  }
  start();

  shout(pick(COMIC_WORDS), cx, cy, { size: Math.min(70, innerWidth / 6.6), rot: -7, color: '#ffcf3f' });

  // confetti rain, in waves so it keeps going for a beat
  let wave = 0;
  const rain = setInterval(() => {
    for (let i = 0; i < 26; i++) {
      spawn({
        x: rand(0, innerWidth), y: rand(-80, -10),
        vx: rand(-1.4, 1.4), vy: rand(2, 5.5),
        g: 0.07, drag: 0.995,
        r: rand(3, 7),
        color: pick(PALETTE.paint),
        rot: rand(0, 6.3), spin: rand(-0.28, 0.28),
        life: 190, fadeFrom: 50,
        shape: 'rect',
      });
    }
    start();
    if (++wave >= 7) clearInterval(rain);
  }, 130);
}

/** The last comic of the whole story is done. */
export function storyComplete() {
  if (muted()) return;
  comicComplete();
  setTimeout(() => {
    shout('THE WHOLE STORY!', innerWidth / 2, innerHeight * 0.6,
      { size: Math.min(40, innerWidth / 10), rot: 4, color: '#ff5da2' });
  }, 700);
}
