# Comic Checklist

A small, phone-first tracker for drawing comics. Every page of every comic has
the same five steps — **pencils, word bubbles, lineart, colors, backgrounds** —
and this ticks them off, rolls the progress up to the comic and then to the
whole story, and makes a fuss when you finish something.

## How it works

- **+** adds a comic. Tell it how many pages you're planning.
- Tap the five boxes on a page row as you finish each step.
- Tap the page number to attach an optional photo of the page, or to delete it.
- The shelf at the top of the home screen is the whole story — one spine per
  comic you're planning, filling up as each one progresses.

### Reshaping the story

Plans change, so nothing about the structure is fixed:

- **Story length** — the chip under the shelf. The story grows on its own if you
  add more comics than the number you set.
- **⋮ → Split into two comics** — pick a page to split after; the later pages
  move into a new comic that lands right after this one, keeping their
  checkmarks and photos.
- **⋮ → Move earlier / Move later** — reorder comics, for when a new one belongs
  in the middle.
- **⋮ → Add several pages** for a comic that ran long, or tap a page number to
  delete one.
- **⋮ → Mark every page finished** backfills a comic you finished before you
  started tracking. Once complete, the same button offers to clear it again.

### The celebrations

They escalate with the effort, so the loud ones stay special:

| What you finished | What happens |
| --- | --- |
| Pencils / word bubbles | a puff of graphite dust and a shockwave ring |
| Lineart | flicked ink, a halftone ring and speed lines |
| Colors / backgrounds | a burst of paint, confetti and spinning stars |
| A whole page | halftone POP, confetti and a comic-book shout |
| One step across a whole comic | the column lights up cell by cell, then a few seconds of full-screen sunburst and a confetti storm in that step's colors |
| A whole comic | full-screen starburst and confetti rain |
| The final comic of the story | all of that, twice |

Finishing a comic completes all five columns at once, so it shows the comic
celebration instead of five column fanfares.

Turn them off in **⋮ → Celebrations**. They're also automatically muted if your
device is set to reduce motion.

## Your data

Everything is stored **in the browser on the device you're using** — there is no
account and no server:

- progress → `localStorage`
- page photos → IndexedDB, downscaled to 640px on the long edge so a long story
  stays well inside the browser's storage quota

That means clearing your browser's site data will erase it, and progress does
not sync between your phone and your laptop. Use **⋮ → Export backup** now and
then; it downloads one JSON file containing all progress *and* photos, and
**Restore from backup** reads it back on any device.

## Running it

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

(It needs to be served over `http://`, not opened as a `file://` path, because
the JavaScript uses ES modules.)

Pushing to `main` publishes it to GitHub Pages via
`.github/workflows/deploy.yml`.
